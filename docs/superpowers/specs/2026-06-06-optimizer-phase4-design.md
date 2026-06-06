# Fase 4 — Ottimizzatore turni multi-obiettivo (design)

> Spec validata 2026-06-06. Branch: `optimizer/cost-ranked-phase4`. Una PR a sé.

## Obiettivo

Trasformare il solver da **"prima settimana valida"** (soddisfacimento) a
**"settimana valida a costo minimo"** (ottimizzazione multi-obiettivo), senza
toccare i vincoli hard esistenti (contratti, soglie pomeriggio per persona,
straordinario, copertura studio, gap pranzo). Tre obiettivi soft, combinati a
**somma pesata**:

1. **Equità nel tempo** (primaria) — chiusure 19:00, aperture 08:30, sabati
   lavorati distribuiti equamente tra le persone su una finestra mobile,
   **proporzionalmente ai giorni lavorati**.
2. **Preferenze personali** (soft) — giorno libero preferito, evita
   chiusura/apertura, finestra oraria preferita.
3. **Ordine deterministico** — niente più rimescolamento casuale di "Alternativa";
   scelta stabile e ripetibile.

Decisioni di policy fissate in brainstorm:
- Stabilità settimana-su-settimana **non** è un obiettivo (rigenerazioni libere di cambiare).
- Equità misurata su **finestra mobile ultime N=8 settimane** salvate (regolabile).
- Equità **proporzionale ai giorni lavorati** (rate, non conteggio grezzo).
- Equità ↔ preferenze: **somma pesata** (una preferenza forte può battere un piccolo squilibrio).
- Motore: **enumerazione cost-ranked** (raccogli soluzioni feasible + scegli min-cost).
- "Orari più sensati": ridimensionato a tie-break deterministico (gli orari attuali sono già accettabili).

## Architettura & flusso

Il backtracker esistente (`solveWeekCore`/`visit`) resta il **motore di
feasibility**: enumera assegnazioni settimanali che rispettano tutti i vincoli
hard. Sopra si aggiunge un **layer di scoring**:

```
generateWeek(opts) / regenerate*(...)
  └─ solveWeek(seed, { ledger, avoidSigs, mode:'optimize' })
       └─ solveWeekCore in modalità COLLECT
            • enumera settimane feasible (cap K + budget)
            • costOfWeek(week, ledger) per ciascuna
            • tiene best (min cost) + top-M distinte per "Alternativa"
       └─ ritorna { week:best, alternatives:[...], solved, overtime }
```

Tutto in `src/scheduler.js` (modulo puro, zero dipendenze, deterministico). Il
**ledger** è calcolato in `src/app.js` dalle settimane in `localStorage`
(`weeks.v1`) e **passato come argomento** al solver: il modulo puro non conosce
lo storage. `costOfWeek` e i pesi vivono nel modulo puro e sono testabili in
isolamento.

## Componenti

### 1. Ledger equità — `buildEquityLedger(pastWeeks, N=8)`

Input: array di settimane risolte (le ultime N salvate, più recenti per `startDate`).
Per persona accumula su tutta la finestra:
- `closes` (turni con `coversClose`)
- `opens` (turni con `coversMorning`)
- `saturdays` (sabato con `hours>0`)
- `workDays` (giorni con `hours>0`) — denominatore = "opportunità"

Output:
```js
{ Lucrezia:{closes,opens,saturdays,workDays}, Manuela:{...}, ... }
```
Persone non più in organico vengono ignorate (solo `ASSISTANT_NAMES` correnti).
Se `pastWeeks` è vuoto → ledger a zero (equità calcolata solo entro la settimana corrente).

### 2. Costo equità — `equityCost(week, ledger)`

Per ciascun onere `d ∈ {closes, opens, saturdays}`:
- `cand_p` = conteggio onere `d` per persona `p` nella settimana candidata
- `candWD_p` = giorni lavorati di `p` nella candidata
- `rate_p = (ledger[p][d] + cand_p) / max(1, ledger[p].workDays + candWD_p)`
- contributo onere = **varianza di `rate_p` tra le persone** (popolazione)

`equityCost = Σ_d varianza_p(rate_p[d])`. Varianza bassa = tassi allineati = equo.
Chi ha rate storico più basso viene spinto a ricevere i nuovi oneri.

### 3. Modello preferenze

Esteso `STAFF_CONFIG[name].preferences` (opzionale, assente = nessuna preferenza):
```js
preferences: {
  preferredDayOff: 'wed' | null,        // weekday key
  avoidClose: false,                    // bool
  avoidOpen:  false,                    // bool
  preferredWindow: 'early'|'late'|'morning'|'afternoon'|null
}
```
Persistito in `staff.v1` insieme al resto della config. `defaultStaffConfig()`
include `preferences:{}` per le 3 persone attuali (nessuna preferenza di default →
comportamento equità-only finché l'utente non ne imposta).

### 4. Costo preferenze — `preferenceCost(week)`

Per persona, sommando sui giorni:
- `preferredDayOff`: +`Wdayoff` se lavora il giorno preferito libero
- `avoidClose`: +`Wclose` per ogni chiusura assegnata
- `avoidOpen`: +`Wopen` per ogni apertura assegnata
- `preferredWindow`: +`Wwin · scostamento` tra finestra del turno e preferenza
  - `early`: penalizza `startMin` tardo; `late`: penalizza `startMin` presto
  - `morning`: penalizza copertura pomeridiana; `afternoon`: penalizza solo-mattina
  - `{start,end}`: penalizza |start−s| + |end−e| normalizzato

Sub-pesi interni (`Wdayoff, Wclose, Wopen, Wwin`) costanti nel modulo, tarabili.

### 5. Costo ordine — `tidyCost(week)`

Termine minimo, solo tie-break deterministico:
- piccola penalità per turni lontani dai template canonici (`LEGACY_TEMPLATES`)
- garantisce che, a parità di equità+preferenze, la scelta sia stabile e
  "tonda" invece che casuale. Sostituisce `diversifyTimes`.

### 6. Funzione costo totale — `costOfWeek(week, ledger)`

```js
cost = W_EQ * equityCost(week, ledger)
     + W_PREF * preferenceCost(week)
     + W_TIDY * tidyCost(week)
```
Default: `W_EQ=10, W_PREF=3, W_TIDY=0.1`. Costanti esportate in cima al modulo.
Tie-break finale stabile su `weekAssignmentSig` (ordine lessicografico) per
determinismo totale a parità di costo.

### 7. Motore cost-ranked — `solveWeekCore` modalità collect

- Modalità `optimize`: invece di `return` alla prima soluzione completa, la
  registra in un pool. Continua fino a cap `K` (default 2000) o esaurimento budget.
- Ordino i combo giornalieri (`getDayCombos`) con una **proxy di costo** così le
  soluzioni buone emergono presto (col cap si resta near-ottimi anche su spazi grandi).
- A fine enumerazione: ordino il pool per `costOfWeek` (poi per sig), ritorno la
  minima come `best` e le successive **distinte** come `alternatives`.
- `avoidSigs` resta supportato (esclude sig già mostrate).
- Retro-compatibilità: senza `ledger`/`mode`, comportamento = prima-valida (per i
  call-site non ancora migrati durante l'implementazione incrementale).

### 8. "Alternativa" — `regenerateAlternativeWithFeedback`

Niente più `diversifyTimes` random. Ritorna la **prossima settimana distinta** a
costo crescente dal pool (o, se il pool è esaurito, ri-enumera con `avoidSigs`
aggiornato). Deterministica.

### 9. Spiegabilità infeasibilità

Pool vuoto dopo enumerazione → `diagnoseInfeasibility(seed)`: rilassa un gruppo di
vincoli hard per volta e ritrova se diventa feasible:
- copertura (morning/afternoon/close/gap)
- ore esatte per persona
- pomeriggi (min/max)
- giorni lavorati (max)
- lock manuali
Ritorna il **primo gruppo** la cui rimozione sblocca → messaggio mirato
*"Infeasibile per: copertura pomeridiana giovedì"*. Best-effort: se nessun singolo
gruppo basta, messaggio generico con elenco dei gruppi sospetti.

## Data flow storage

- `src/app.js` legge `weeks.v1`, seleziona le ultime N settimane risolte
  (escludendo quella in editing), chiama `buildEquityLedger`, passa il ledger a
  `solveWeek`. Nessuna nuova chiave storage: il ledger è derivato, non persistito.
- Preferenze: dentro `staff.v1` (già persistito). UI nel modale team.

## UI (in `src/app.js`)

Nel modale editor team, per ogni persona, nuova sezione **"Preferenze"**:
- select "Giorno libero preferito" (— / Lun…Ven)
- checkbox "Evita chiusura 19:00", "Evita apertura 08:30"
- select "Finestra preferita" (— / Presto / Tardi / Mattina / Pomeriggio)
Salvataggio col resto della config (`saveStaff`). Rigenerazione applica subito.

## Testing

- `tests/equity.test.mjs` — `buildEquityLedger` conta corretto; `equityCost`
  scende quando l'onere va a chi è indietro; proporzionalità (part-time penalizzato meno).
- `tests/preferences.test.mjs` — ogni tipo penalizzato dal costo; rispettato quando
  feasible; sacrificabile dai pesi in conflitto con equità.
- `tests/optimizer.test.mjs` — `costOfWeek` deterministico; stesso input → stessa
  settimana; "Alternativa" distinta e a costo ≥ best; pool rispetta cap.
- `tests/regression.test.mjs` — **ri-pinnare** gli snapshot (la selezione cambia da
  prima-valida a min-cost). Verificare che ogni nuova selezione sia
  `validateWeek(week).length===0` e costo ≤ vecchia selezione. Documentare in PR.
- Tutti i test esistenti (29) devono restare verdi o essere aggiornati
  consapevolmente con motivazione.

## Performance

Raccogliere un pool è più pesante della prima-soluzione (baseline `solveWeek`
~160ms). Mitigazioni: cap `K`, ordinamento cost-guided (buone soluzioni presto),
budget invariato. **Misurare** in implementazione; se >~500ms su settimana
standard, abbassare `K` o potare più aggressivamente. Vincolo: niente regressione
percepibile nella UI ("Genera" deve restare istantaneo).

## Fuori scope

- Obiettivo stabilità vs settimana precedente.
- Macchina di template per "orari sensati" (solo tie-break minimo).
- Backend / multiutente (ledger da `localStorage`).
- UI di tuning pesi (default hardcoded; tuning = fase futura).

## Piano di consegna (per writing-plans)

Implementazione incrementale TDD, ogni step testato, commit frequenti, su branch
`optimizer/cost-ranked-phase4`, una PR finale. Ordine suggerito:
1. Ledger equità (puro, testato).
2. `equityCost` + costanti pesi.
3. Modello + `preferenceCost` + `tidyCost`.
4. `costOfWeek`.
5. `solveWeekCore` modalità collect + cost-ranked.
6. Integrazione `solveWeek`/`generateWeek`/`regenerate*` + Alternativa.
7. `diagnoseInfeasibility`.
8. UI preferenze nel modale team.
9. Ri-pin regression + verifica performance + smoke.
