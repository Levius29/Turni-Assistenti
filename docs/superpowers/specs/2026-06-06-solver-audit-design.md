# Audit & miglioramento solver turni — Design

Data: 2026-06-06
Branch: `fix/solver-audit-2026-06`
Scope approvato: tutti gli 11 punti dell'audit.

## Contesto

App single-file `index.html`: scheduler turni per 3 assistenti di studio dentistico.
Solver a backtracking con potatura, tier di distribuzione pomeriggi, copertura
continua 08:30–19:00. Logica inline nello `<script>`, testata estraendo lo script
(vedi `tests/ui-export.test.mjs`). Nessuna dipendenza di build; test via `node --test`.

Vincolo di dominio confermato dall'utente: **lo studio tollera un solo buco di
copertura ≤ 30' nei giorni feriali** (pausa pranzo). Non serve presidio continuo
assoluto.

## Principio architetturale

- Resta tutto in `index.html`, logica inline (single-file deployabile su GitHub Pages).
- Nessuna nuova dipendenza runtime.
- Ogni fix accompagnato da test in un nuovo file `tests/solver-logic.test.mjs`.
- I 5 test esistenti restano verdi (nessuna regressione su HTML/PDF/derivazione ore).

## Fix di correttezza

### #1 + #2 — Copertura unificata: `coverageDeficit`

Sostituisce `gapOf`. Calcola i **minuti scoperti totali** nella fascia 08:30–19:00
(somma cumulativa dei buchi, non il massimo) e somma il *debito pranzo*:

- Si costruisce la copertura per slot da `STUDIO_OPEN` a `STUDIO_CLOSE`.
- `realGap` = somma dei minuti con copertura 0.
- `lunchDebt` = 30' se esiste una fascia coperta da **una sola persona che fa
  turno lungo** (il suo break di 30' è realmente scoperto). Conteggiato una volta
  per persona-sola-lunga nel giorno.
- Regola: `realGap + lunchDebt ≤ LUNCH_GAP_MAX (30')`.

Casi:
- Solo long-shifter tutto il giorno → deficit 30' → **valido**.
- Solo long-shifter + altro buco → > 30' → **segnalato**.
- Due persone sovrapposte sulla fascia pranzo → nessun debito.

Stessa funzione usata sia in `validateWeek` sia nel pre-check di `getDayCombos`
→ correzione in un punto solo.

### #3 — `validateWeek` controlla i giorni lavorati

`getAssistantStats` aggiunge `workDays` (giorni con `hours > 0`). `validateWeek`
emette avviso se `workDays` supera `ASSISTANTS[n].workDays` o `maxWorkDays` (max 5).
Oggi questo vincolo è applicato solo nella potatura del solver (`feasibleAhead`),
quindi edit manuali o lock possono produrre 6 giorni lavorati senza alcun avviso.

### #4 — Niente mutazione globale di `ASSISTANTS`

`solveWeekCore` riceve i cap/ore del tier come **parametro** (`tierRules`) invece
di mutare l'oggetto globale `ASSISTANTS`. `feasibleAhead` e la validazione interna
leggono `tierRules`. Elimina lo stato sporco in caso di eccezione durante il solve
(oggi `restore()` non è in `try/finally`). Radice del problema risolta, non solo
sintomo.

## Fix di velocità

### #5 — `getDayCombos` da O(N³) a ~O(K³)

Pre-dedup degli shift di **ogni** assistente per la firma-ruolo
(`hours, coversMorning, coversClose, isAfternoon` + bucket finestre 9:30–13:30 e
14:00–18:00 usate da `morningPair`/`afternoonPair`). ~100 coppie → ~25
rappresentanti per assistente. Il triplo loop passa da ~1M a ~16k iterazioni/giorno
(~40–60×). Output identico: le firme combo risultanti sono le stesse di oggi.

### #6 — `rem` calcolato una volta

`rem` dipende solo dagli allowed shift (indipendente dai cap del tier) → calcolato
in `solveWeek` e passato a `solveWeekCore`, invece di ricalcolarlo fino a 8 volte
(4 tier × 2 maxCloses).

## Combinazioni

### #7 — "Alternativa" con varietà oraria reale

Il solve resta sul set deduplicato (veloce). Dopo aver trovato una soluzione, un
pass leggero sostituisce su ogni giorno il combo scelto con un altro **della stessa
firma ma orari diversi** (stesso monte ore / pomeriggi / chiusure, layout orario
diverso). "Alternativa" mostra così varianti realmente diverse senza far esplodere
il branching del backtracking.

### #8 — Griglia 30 minuti

Invariata (YAGNI). Annotata, non modificata.

## Migliorie

### #9 — Pruning storage

Su `saveWeeks`, si conservano solo le settimane in finestra ±8 attorno alla corrente
più quelle con lock o edit manuali. Evita la crescita illimitata di localStorage.

### #10 — Niente freeze UI durante il solve

Prima del solve si mostra lo status "Calcolo turni…" e si lancia il solve dopo un
`setTimeout(0)`, così l'UI ridisegna prima del blocco sincrono. Nessun Web Worker
(overkill per single-file). Il budget del solver resta limitato.

### #11 — jsPDF robusto

`integrity` (SRI) + `crossorigin` sui due `<script>` CDN jsPDF/autotable, e messaggio
d'errore migliore se la libreria non carica. Nessun vendoring inline (gonfierebbe il
file).

## Test

Nuovo file `tests/solver-logic.test.mjs`:

- deficit cumulativo: due buchi da 30' → segnalato (oggi falso-OK);
- debito pranzo: solo long-shifter → deficit 30' (valido); + altro buco → segnalato;
- `workDays` > 5 → avviso in `validateWeek`;
- no mutazione globale: `ASSISTANTS` invariato (deep-equal) dopo `solveWeek`;
- perf: numero di combo per giorno ridotto, firme combo identiche al pre-refactor;
- alternativa ≠ originale a parità di statistiche.

I 5 test esistenti restano verdi.

## Fuori scope

- Cambio della griglia oraria (resta 30').
- Web Worker / async vero.
- Vendoring offline di jsPDF.
- Refactor non collegati ai punti sopra.
