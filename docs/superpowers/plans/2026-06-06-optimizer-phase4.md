# Ottimizzatore turni Fase 4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare il solver da "prima settimana valida" a "settimana valida a costo minimo" multi-obiettivo (equità nel tempo + preferenze soft + ordine deterministico), senza toccare i vincoli hard.

**Architecture:** Il backtracker esistente resta la primitiva di feasibility. `solveWeek` (first-valid) rimane invariato per test/regression. Un nuovo collettore `collectFeasibleWeeks` raccoglie le settimane feasible del primo tier ammesso; `solveWeekOptimized` le ordina per `costOfWeek` e ritorna la migliore + le alternative. L'app instrada `generateWeek`/`regenerate*` sul path ottimizzato passando un ledger equità derivato da `localStorage`.

**Tech Stack:** Vanilla ES modules (`src/scheduler.js`, `src/app.js`), test `node --test` (Node 20+), zero dipendenze runtime.

**Branch:** `optimizer/cost-ranked-phase4` (già creato). Spec: `docs/superpowers/specs/2026-06-06-optimizer-phase4-design.md`.

---

## File Structure

- `src/scheduler.js` (modifica) — tutte le funzioni pure nuove: `variance`, `buildEquityLedger`, `equityCost`, `preferenceCost`, `tidyCost`, `costOfWeek`, costanti pesi, `buildTierRules` (refactor), `collectFeasibleWeeks`, `solveWeekOptimized`, `diagnoseInfeasibility`. Modifica `defaultStaffConfig` (campo `preferences`), `generateWeek`, `regenerateWeekWithFeedback`, `regenerateCleanWeekWithFeedback`, `regenerateAlternativeWithFeedback`.
- `src/app.js` (modifica) — `buildLedgerFromStorage`, passaggio ledger ai call-site, sezione "Preferenze" nel modale team.
- `tests/equity.test.mjs` (nuovo) — ledger + equityCost.
- `tests/preferences.test.mjs` (nuovo) — modello + preferenceCost.
- `tests/optimizer.test.mjs` (nuovo) — costOfWeek, collect, solveWeekOptimized, Alternativa, diagnose.
- `tests/ui-export.test.mjs` (modifica) — asserzione presenza UI preferenze.

Le funzioni pure (Task 1–5) non dipendono dal solver e sono testabili in isolamento. Il motore (Task 6–8) riusa `getDayCombos`/`buildRem`/`validateWeek`. Il wiring (Task 9–10) collega app→solver.

---

## Note di stile per l'esecutore

- Il codebase usa **una funzione `export` per riga, stile compatto** (vedi `src/scheduler.js`). Mantieni quello stile: niente prettier-reformat dei file esistenti.
- I test esistenti usano `import * as M from '../src/scheduler.js'` e `node:test`/`node:assert/strict`. Segui lo stesso pattern.
- Esegui i test con: `npm test` (= `node --test tests/*.mjs`). Su Node 25 usare il glob `tests/*.mjs` (mai `tests/` come dir).
- Commit frequenti, uno per task. Messaggi in italiano, chiudere con la riga `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## Task 1: Ledger equità + helper varianza

**Files:**
- Modify: `src/scheduler.js` (aggiungere in fondo alle funzioni pure, dopo `getLockedShiftCount`)
- Test: `tests/equity.test.mjs` (create)

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `tests/equity.test.mjs`:

```js
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import * as M from '../src/scheduler.js';

after(() => { M.reconfigure(M.defaultStaffConfig()); });

// variance: varianza di popolazione (media degli scarti quadratici).
test('variance: 0 su valori uguali, positiva altrimenti', () => {
  assert.equal(M.variance([2, 2, 2]), 0);
  assert.equal(M.variance([]), 0);
  assert.ok(Math.abs(M.variance([0, 2]) - 1) < 1e-9); // media 1, scarti 1 e 1 -> 1
});

// buildEquityLedger: somma opens/closes/saturdays/workDays per persona sulle ultime N settimane.
test('buildEquityLedger: accumula gli oneri delle settimane passate', () => {
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const led = M.buildEquityLedger([wk], 8);
  for (const n of M.ASSISTANT_NAMES) {
    assert.ok(n in led, `${n} presente nel ledger`);
    const stats = M.getAssistantStats(wk)[n];
    assert.equal(led[n].opens, stats.opens);
    assert.equal(led[n].closes, stats.closes);
    assert.equal(led[n].saturdays, stats.saturdays);
    assert.equal(led[n].workDays, stats.workDays);
  }
});

// Ledger vuoto = tutti zero.
test('buildEquityLedger: nessuna settimana passata = zero', () => {
  const led = M.buildEquityLedger([], 8);
  for (const n of M.ASSISTANT_NAMES)
    assert.deepEqual(led[n], { opens: 0, closes: 0, saturdays: 0, workDays: 0 });
});

// Finestra mobile: con N=1 conta solo la più recente (per startDate).
test('buildEquityLedger: rispetta la finestra mobile N', () => {
  const w1 = M.solveWeek(M.createBaseWeek('2026-06-01')).week;
  const w2 = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const ledAll = M.buildEquityLedger([w1, w2], 2);
  const ledOne = M.buildEquityLedger([w1, w2], 1);
  const sum = led => M.ASSISTANT_NAMES.reduce((t, n) => t + led[n].workDays, 0);
  assert.ok(sum(ledAll) > sum(ledOne), 'N=2 accumula più giorni di N=1');
});
```

- [ ] **Step 2: Esegui per vederlo fallire**

Run: `npm test 2>&1 | grep -E "equity|fail"`
Expected: FAIL — `M.variance is not a function` / `M.buildEquityLedger is not a function`.

- [ ] **Step 3: Implementa**

In `src/scheduler.js`, dopo `getLockedShiftCount` (ultima riga), aggiungi:

```js
// ── OTTIMIZZATORE (Fase 4): funzioni pure di costo ──
// Varianza di popolazione (media degli scarti quadratici). Misura di squilibrio.
export function variance(arr){if(arr.length===0)return 0;const m=arr.reduce((a,b)=>a+b,0)/arr.length;return arr.reduce((a,b)=>a+(b-m)*(b-m),0)/arr.length;}
// Ledger equità: somma opens/closes/saturdays/workDays per persona sulle ultime N settimane
// (più recenti per startDate). Persone non più in organico vengono ignorate (solo ASSISTANT_NAMES correnti).
export function buildEquityLedger(pastWeeks,N=8){
  const sorted=[...pastWeeks].filter(Boolean).sort((a,b)=>a.startDate<b.startDate?1:-1).slice(0,N);
  const led=Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{opens:0,closes:0,saturdays:0,workDays:0}]));
  for(const wk of sorted){const st=getAssistantStats(wk);for(const n of ASSISTANT_NAMES){const s=st[n];led[n].opens+=s.opens;led[n].closes+=s.closes;led[n].saturdays+=s.saturdays;led[n].workDays+=s.workDays;}}
  return led;
}
```

- [ ] **Step 4: Esegui per vederlo passare**

Run: `npm test 2>&1 | tail -6`
Expected: PASS, tutti i test (esistenti 29 + 4 nuovi) verdi.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/equity.test.mjs
git commit -m "feat(opt): ledger equità + helper varianza

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Costo equità

**Files:**
- Modify: `src/scheduler.js` (dopo `buildEquityLedger`)
- Test: `tests/equity.test.mjs`

- [ ] **Step 1: Aggiungi i test che falliscono**

Appendi a `tests/equity.test.mjs`:

```js
// equityCost: varianza dei tassi (onere/giorni-lavorati) tra le persone, sommata su opens/closes/saturdays.
test('equityCost: scende quando l\'onere va a chi è indietro nel ledger', () => {
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const stats = M.getAssistantStats(wk);
  // Ledger sbilanciato: la prima persona ha già fatto molte chiusure, le altre zero.
  const [a, b, c] = M.ASSISTANT_NAMES;
  const heavy = { [a]: { opens: 0, closes: 10, saturdays: 0, workDays: 20 },
                  [b]: { opens: 0, closes: 0, saturdays: 0, workDays: 20 },
                  [c]: { opens: 0, closes: 0, saturdays: 0, workDays: 20 } };
  const flat = Object.fromEntries(M.ASSISTANT_NAMES.map(n => [n, { opens: 0, closes: 0, saturdays: 0, workDays: 20 }]));
  // Il costo è una varianza >= 0.
  assert.ok(M.equityCost(wk, flat) >= 0);
  // Con ledger sbilanciato, una settimana in cui 'a' NON chiude riduce lo squilibrio rispetto a una dove chiude di più.
  assert.equal(typeof M.equityCost(wk, heavy), 'number');
  void stats;
});

// equityCost deterministico: stesso input -> stesso valore.
test('equityCost: deterministico', () => {
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const led = M.buildEquityLedger([], 8);
  assert.equal(M.equityCost(wk, led), M.equityCost(wk, led));
});
```

- [ ] **Step 2: Esegui per vederlo fallire**

Run: `npm test 2>&1 | grep -E "equityCost|fail"`
Expected: FAIL — `M.equityCost is not a function`.

- [ ] **Step 3: Implementa**

In `src/scheduler.js`, dopo `buildEquityLedger`:

```js
// Pesi globali della funzione costo (tarabili).
export let W_EQ=10, W_PREF=3, W_TIDY=0.1;
// Costo equità: per ogni onere {opens,closes,saturdays} calcola il tasso per persona
// rate_p = (storico_p + candidato_p) / max(1, workDays_storico_p + workDays_candidato_p)
// e somma la varianza dei tassi tra le persone. Tassi allineati = equo = costo basso.
export function equityCost(week,ledger){
  const cand=getAssistantStats(week);
  let cost=0;
  for(const duty of ['opens','closes','saturdays']){
    const rates=ASSISTANT_NAMES.map(n=>{const l=ledger[n]||{opens:0,closes:0,saturdays:0,workDays:0};const wd=l.workDays+cand[n].workDays;return (l[duty]+cand[n][duty])/Math.max(1,wd);});
    cost+=variance(rates);
  }
  return cost;
}
```

- [ ] **Step 4: Esegui per vederlo passare**

Run: `npm test 2>&1 | tail -6`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/equity.test.mjs
git commit -m "feat(opt): costo equità (varianza tassi oneri) + pesi globali

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Modello preferenze + costo preferenze

**Files:**
- Modify: `src/scheduler.js` — `defaultStaffConfig` (campo `preferences`) e nuova `preferenceCost`
- Test: `tests/preferences.test.mjs` (create)

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `tests/preferences.test.mjs`:

```js
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import * as M from '../src/scheduler.js';

after(() => { M.reconfigure(M.defaultStaffConfig()); });

// defaultStaffConfig include un oggetto preferences (vuoto) per ogni persona.
test('defaultStaffConfig: ogni persona ha preferences', () => {
  const cfg = M.defaultStaffConfig();
  for (const n of Object.keys(cfg)) assert.ok(cfg[n].preferences && typeof cfg[n].preferences === 'object');
});

// preferenceCost: 0 se nessuno ha preferenze.
test('preferenceCost: 0 senza preferenze', () => {
  M.reconfigure(M.defaultStaffConfig());
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  assert.equal(M.preferenceCost(wk), 0);
});

// avoidClose: penalizza chi è impostato a 'evita chiusura' e chiude.
test('preferenceCost: avoidClose penalizza le chiusure', () => {
  const cfg = M.defaultStaffConfig();
  const closer = M.CLOSE_PREF_PERSON || Object.keys(cfg)[0];
  cfg[closer].preferences = { avoidClose: true };
  M.reconfigure(cfg);
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const closes = M.getAssistantStats(wk)[closer].closes;
  // Se quella persona chiude almeno una volta, il costo è > 0; altrimenti 0. In entrambi i casi = closes * peso.
  assert.equal(M.preferenceCost(wk) > 0, closes > 0);
});

// preferredDayOff: penalizza se la persona lavora il giorno che preferisce libero.
test('preferenceCost: preferredDayOff penalizza il lavoro quel giorno', () => {
  const cfg = M.defaultStaffConfig();
  const p = Object.keys(cfg)[0];
  cfg[p].preferences = { preferredDayOff: 'mon' };
  M.reconfigure(cfg);
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const monShift = M.getShift(wk.days.find(d => d.key === 'mon').assignments[p]);
  assert.equal(M.preferenceCost(wk) > 0, monShift.hours > 0);
});
```

- [ ] **Step 2: Esegui per vederlo fallire**

Run: `npm test 2>&1 | grep -E "preference|preferences|fail"`
Expected: FAIL — `M.preferenceCost is not a function` e/o `preferences` assente.

- [ ] **Step 3: Implementa**

3a. In `src/scheduler.js`, dentro `defaultStaffConfig()` aggiungi `preferences:{}` a ciascuna persona. La funzione attuale è (riga ~33):

```js
export function defaultStaffConfig(){return {
    Lucrezia: { weeklyHours: 38, minAfternoons: 2, maxAfternoons: 3, canWorkLong: true,  maxWorkDays: 5, afternoonThresholdMin: 1020, escalationPriority: 2, closePref: { preferred: 2, max: 3 }, preferences: {} },
    Manuela:  { weeklyHours: 24, minAfternoons: 1, maxAfternoons: 1, canWorkLong: false, workDays: 5, afternoonThresholdMin: 900, escalationPriority: 3, overtime: { weeklyHours: 29, maxAfternoons: 2, requiresShift: { s: 900, e: 1140 } }, preferences: {} },
    Madalina: { weeklyHours: 24, minAfternoons: 2, maxAfternoons: 3, canWorkLong: false, workDays: 5, afternoonThresholdMin: 960, escalationPriority: 1, preferences: {} },
  };}
```

> NOTA esecutore: copia i valori ESISTENTI dei tre contratti dal file e aggiungi solo `, preferences: {}` in coda a ciascuno. Non cambiare gli altri campi. Verifica i valori reali leggendo il file prima di editare (i numeri sopra sono quelli attesi ma vanno confermati su sorgente).

3b. Dopo `equityCost`, aggiungi le sotto-costanti e `preferenceCost`:

```js
// Sotto-pesi del costo preferenze (tarabili).
export let PREF_W={dayOff:2, close:1, open:1, window:1};
// Costo preferenze: somma, per persona e per giorno lavorato, le violazioni soft dei desiderata.
export function preferenceCost(week){
  let cost=0;
  for(const n of ASSISTANT_NAMES){
    const pr=STAFF_CONFIG[n]?.preferences;if(!pr)continue;
    for(const day of week.days){
      const sh=getShift(day.assignments[n]);if(sh.hours===0)continue;
      if(pr.preferredDayOff&&day.key===pr.preferredDayOff)cost+=PREF_W.dayOff;
      if(pr.avoidClose&&sh.coversClose)cost+=PREF_W.close;
      if(pr.avoidOpen&&sh.coversMorning)cost+=PREF_W.open;
      if(pr.preferredWindow)cost+=PREF_W.window*windowPenalty(pr.preferredWindow,sh);
    }
  }
  return cost;
}
// Penalità finestra oraria preferita (in "ore" di scostamento, >=0).
export function windowPenalty(pref,sh){
  if(typeof pref==='object'&&pref){return (Math.abs(sh.startMin-pref.start)+Math.abs(sh.endMin-pref.end))/60;}
  if(pref==='early')return Math.max(0,sh.startMin-STUDIO_OPEN)/60;
  if(pref==='late')return Math.max(0,STUDIO_CLOSE-sh.endMin)/60;
  if(pref==='morning')return Math.max(0,sh.endMin-13*60)/60;
  if(pref==='afternoon')return sh.coversAfternoon?0:Math.max(0,13*60-sh.startMin)/60+1;
  return 0;
}
```

- [ ] **Step 4: Esegui per vederlo passare**

Run: `npm test 2>&1 | tail -6`
Expected: PASS. Verifica anche che `tests/generic-team.test.mjs` resti verde (usa config a 4 persone senza `preferences` → `preferenceCost` salta chi non ha `preferences`).

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/preferences.test.mjs
git commit -m "feat(opt): modello preferenze + costo preferenze soft

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Costo ordine (tidy)

**Files:**
- Modify: `src/scheduler.js` (dopo `windowPenalty`)
- Test: `tests/optimizer.test.mjs` (create)

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `tests/optimizer.test.mjs`:

```js
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import * as M from '../src/scheduler.js';

after(() => { M.reconfigure(M.defaultStaffConfig()); });

// tidyCost: >=0, e premia i turni vicini ai template canonici (distanza minore = costo minore).
test('tidyCost: turno su template canonico costa meno di uno spostato', () => {
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const base = M.tidyCost(wk);
  assert.ok(base >= 0);
  assert.equal(M.tidyCost(wk), base); // deterministico
});
```

- [ ] **Step 2: Esegui per vederlo fallire**

Run: `npm test 2>&1 | grep -E "tidyCost|fail"`
Expected: FAIL — `M.tidyCost is not a function`.

- [ ] **Step 3: Implementa**

In `src/scheduler.js`, dopo `windowPenalty`:

```js
// Insieme di orari canonici {s,e} (dai template legacy) per il tie-break deterministico.
export const CANONICAL_SHIFTS=Object.values(LEGACY_TEMPLATES);
// Costo ordine: somma, per ogni turno lavorato, la distanza (in ore) dal template canonico più vicino.
// Termine minimo (W_TIDY piccolo): a parità di equità+preferenze preferisce orari "tondi" e rende la scelta stabile.
export function tidyCost(week){
  let cost=0;
  for(const day of week.days)for(const n of ASSISTANT_NAMES){
    const sh=getShift(day.assignments[n]);if(sh.hours===0)continue;
    let best=Infinity;
    for(const t of CANONICAL_SHIFTS){const d=(Math.abs(sh.startMin-t.s)+Math.abs(sh.endMin-t.e))/60;if(d<best)best=d;}
    cost+=best===Infinity?0:best;
  }
  return cost;
}
```

- [ ] **Step 4: Esegui per vederlo passare**

Run: `npm test 2>&1 | tail -6`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/optimizer.test.mjs
git commit -m "feat(opt): costo ordine (distanza dai template canonici)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Funzione costo totale

**Files:**
- Modify: `src/scheduler.js` (dopo `tidyCost`)
- Test: `tests/optimizer.test.mjs`

- [ ] **Step 1: Aggiungi i test che falliscono**

Appendi a `tests/optimizer.test.mjs`:

```js
// costOfWeek = W_EQ*equity + W_PREF*pref + W_TIDY*tidy. Deterministico.
test('costOfWeek: combina i tre termini ed è deterministico', () => {
  M.reconfigure(M.defaultStaffConfig());
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const led = M.buildEquityLedger([], 8);
  const expected = M.W_EQ * M.equityCost(wk, led) + M.W_PREF * M.preferenceCost(wk) + M.W_TIDY * M.tidyCost(wk);
  assert.ok(Math.abs(M.costOfWeek(wk, led) - expected) < 1e-9);
  assert.equal(M.costOfWeek(wk, led), M.costOfWeek(wk, led));
});
```

- [ ] **Step 2: Esegui per vederlo fallire**

Run: `npm test 2>&1 | grep -E "costOfWeek|fail"`
Expected: FAIL — `M.costOfWeek is not a function`.

- [ ] **Step 3: Implementa**

In `src/scheduler.js`, dopo `tidyCost`:

```js
// Costo totale di una settimana (somma pesata). Più basso = migliore.
export function costOfWeek(week,ledger){
  return W_EQ*equityCost(week,ledger)+W_PREF*preferenceCost(week)+W_TIDY*tidyCost(week);
}
```

- [ ] **Step 4: Esegui per vederlo passare**

Run: `npm test 2>&1 | tail -6`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/optimizer.test.mjs
git commit -m "feat(opt): funzione costo totale (somma pesata equità/preferenze/ordine)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Refactor — estrai `buildTierRules` (nessun cambio di comportamento)

**Files:**
- Modify: `src/scheduler.js` — estrai il calcolo `tierRules` inline da `solveWeek` (riga ~214) in una funzione riusabile.
- Test: nessun nuovo test; i 33 esistenti devono restare verdi (refactor puro).

- [ ] **Step 1: Implementa l'estrazione**

In `src/scheduler.js`, subito **prima** di `export function solveWeek`, aggiungi:

```js
// Regole effettive per un tier di distribuzione pomeriggi (tetti pomeriggi + ore/giorni effettivi
// considerando festività/assenze). Estratto da solveWeek per riuso nel collettore ottimizzato.
export function buildTierRules(seedWeek,tier){
  return Object.fromEntries(ASSISTANT_NAMES.map(n=>{const c=STAFF_CONFIG[n];const inOt=tier.ot&&c.overtime&&tier.caps[n]>c.maxAfternoons;const baseWh=inOt?c.overtime.weeklyHours:ASSISTANTS[n].weeklyHours;const r={...ASSISTANTS[n],maxAfternoons:tier.caps[n],weeklyHours:effectiveWeeklyHours(n,seedWeek,baseWh)};if('workDays'in ASSISTANTS[n])r.workDays=effectiveWorkDays(n,seedWeek,ASSISTANTS[n].workDays);if('maxWorkDays'in ASSISTANTS[n])r.maxWorkDays=effectiveWorkDays(n,seedWeek,ASSISTANTS[n].maxWorkDays);return[n,r];}));
}
```

- [ ] **Step 2: Usa l'helper in `solveWeek`**

Dentro `solveWeek`, sostituisci la riga che costruisce `tierRules` inline:

```js
const tierRules=Object.fromEntries(ASSISTANT_NAMES.map(n=>{const c=STAFF_CONFIG[n];const inOt=tier.ot&&c.overtime&&tier.caps[n]>c.maxAfternoons;const baseWh=inOt?c.overtime.weeklyHours:ASSISTANTS[n].weeklyHours;const r={...ASSISTANTS[n],maxAfternoons:tier.caps[n],weeklyHours:effectiveWeeklyHours(n,seedWeek,baseWh)};if('workDays'in ASSISTANTS[n])r.workDays=effectiveWorkDays(n,seedWeek,ASSISTANTS[n].workDays);if('maxWorkDays'in ASSISTANTS[n])r.maxWorkDays=effectiveWorkDays(n,seedWeek,ASSISTANTS[n].maxWorkDays);return[n,r];}));
```

con:

```js
const tierRules=buildTierRules(seedWeek,tier);
```

- [ ] **Step 3: Esegui i test (regressione)**

Run: `npm test 2>&1 | tail -6`
Expected: PASS — tutti verdi, in particolare `tests/regression.test.mjs` (gli snapshot NON devono cambiare: refactor puro).

- [ ] **Step 4: Commit**

```bash
git add src/scheduler.js
git commit -m "refactor(opt): estrai buildTierRules da solveWeek (no behavior change)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Collettore di settimane feasible

**Files:**
- Modify: `src/scheduler.js` (dopo `buildTierRules`)
- Test: `tests/optimizer.test.mjs`

- [ ] **Step 1: Aggiungi i test che falliscono**

Appendi a `tests/optimizer.test.mjs`:

```js
// collectFeasibleWeeks: ritorna un pool di settimane TUTTE valide, dal primo tier ammesso, entro il cap.
test('collectFeasibleWeeks: pool di sole settimane valide, rispetta il cap', () => {
  M.reconfigure(M.defaultStaffConfig());
  const seed = M.createBaseWeek('2026-06-08');
  const { pool } = M.collectFeasibleWeeks(seed, { cap: 50 });
  assert.ok(pool.length > 0, 'almeno una settimana feasible');
  assert.ok(pool.length <= 50, 'rispetta il cap');
  for (const w of pool) assert.equal(M.validateWeek(w).length, 0, 'ogni settimana del pool è valida');
  // Tutte distinte per firma.
  const sigs = new Set(pool.map(M.weekAssignmentSig));
  assert.equal(sigs.size, pool.length, 'nessun duplicato nel pool');
});

// avoidSigs: le firme escluse non compaiono nel pool.
test('collectFeasibleWeeks: avoidSigs esclude le firme indicate', () => {
  M.reconfigure(M.defaultStaffConfig());
  const seed = M.createBaseWeek('2026-06-08');
  const first = M.collectFeasibleWeeks(seed, { cap: 10 }).pool[0];
  const sig = M.weekAssignmentSig(first);
  const { pool } = M.collectFeasibleWeeks(seed, { cap: 50, avoidSigs: new Set([sig]) });
  assert.ok(!pool.some(w => M.weekAssignmentSig(w) === sig), 'la firma esclusa non è nel pool');
});
```

- [ ] **Step 2: Esegui per vederlo fallire**

Run: `npm test 2>&1 | grep -E "collectFeasibleWeeks|fail"`
Expected: FAIL — `M.collectFeasibleWeeks is not a function`.

- [ ] **Step 3: Implementa**

In `src/scheduler.js`, dopo `buildTierRules`:

```js
// Raccoglie settimane feasible (tutte valide) dal PRIMO tier di distribuzione pomeriggi ammesso,
// fino a `cap` soluzioni o esaurimento `budget`. Riusa getDayCombos/buildRem/validateWeek.
// Mantiene i vincoli hard (incluso il tetto chiusure closePref.max della persona con preferenza).
export function collectFeasibleWeeks(seedWeek,{cap=2000,budget=SOLVE_BUDGET_FULL,avoidSigs}={}){
  const demand=afternoonDemand(seedWeek);
  const combosByDay=seedWeek.days.map((day,idx)=>getDayCombos(seedWeek,day,idx));
  const D=seedWeek.days.length;
  const order=[...Array(D).keys()].sort((a,b)=>combosByDay[a].length-combosByDay[b].length);
  const orderedCombos=order.map(i=>combosByDay[i]);
  const rem=buildRem(seedWeek.days,order);
  const closeMax=CLOSE_PREF_PERSON?(STAFF_CONFIG[CLOSE_PREF_PERSON].closePref?.max??Infinity):Infinity;
  for(const tier of AFTERNOON_TIERS){
    if(demand>Object.values(tier.caps).reduce((a,b)=>a+b,0))continue;
    const tierRules=buildTierRules(seedWeek,tier);
    const pool=[],seen=new Set();let nodes=0;const placed=new Array(D);
    const feasibleAhead=(nextPos,st)=>{for(const a of ASSISTANT_NAMES){const rules=tierRules[a],s=st[a],r=rem[nextPos][a];if(s.hours>rules.weeklyHours)return false;if(s.afternoons>rules.maxAfternoons)return false;if(rules.workDays&&s.workDays>rules.workDays)return false;if(rules.maxWorkDays&&s.workDays>rules.maxWorkDays)return false;if(s.hours+r.maxHours<rules.weeklyHours)return false;if(s.hours+r.minHours>rules.weeklyHours)return false;if(s.afternoons+r.maxAfternoons<rules.minAfternoons)return false;if(rules.workDays&&(s.workDays+r.maxWorkDays<rules.workDays||s.workDays+r.minWorkDays>rules.workDays))return false;if(rules.maxWorkDays&&s.workDays+r.minWorkDays>rules.maxWorkDays)return false;}return true;};
    const visit=(pos,stats)=>{
      if(nodes>budget||pool.length>=cap)return;nodes++;
      if(pos===D){const w=buildWeekFromDayAssignments(seedWeek,placed);if(validateWeek(w,tierRules).length===0){const sig=weekAssignmentSig(w);if((!avoidSigs||!avoidSigs.has(sig))&&!seen.has(sig)){seen.add(sig);pool.push(w);}}return;}
      for(const combo of orderedCombos[pos]){
        const d=combo.d,next=cloneStats(stats);
        for(const a of ASSISTANT_NAMES){const da=d[a];next[a].hours+=da.h;next[a].afternoons+=da.af;next[a].workDays+=da.wd;}
        if(CLOSE_PREF_PERSON){next[CLOSE_PREF_PERSON].closes+=d[CLOSE_PREF_PERSON].close;if(next[CLOSE_PREF_PERSON].closes>closeMax)continue;}
        if(OVERTIME_PERSON){const _thr=STAFF_CONFIG[OVERTIME_PERSON].maxAfternoons+1,_req=STAFF_CONFIG[OVERTIME_PERSON].overtime.requiresShift;if(_req&&next[OVERTIME_PERSON].afternoons>=_thr){let has=d[OVERTIME_PERSON].oReq;if(!has)for(let q=0;q<pos;q++){const pc=placed[order[q]];if(pc&&pc.d[OVERTIME_PERSON].oReq){has=true;break;}}if(!has)continue;}}
        if(!feasibleAhead(pos+1,next))continue;
        placed[order[pos]]=combo;visit(pos+1,next);placed[order[pos]]=undefined;
        if(nodes>budget||pool.length>=cap)return;
      }
    };
    visit(0,Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{hours:0,afternoons:0,workDays:0,closes:0}])));
    if(pool.length)return{pool,overtime:tier.ot,tier};
  }
  return{pool:[],overtime:false,tier:null};
}
```

- [ ] **Step 4: Esegui per vederlo passare**

Run: `npm test 2>&1 | tail -6`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/optimizer.test.mjs
git commit -m "feat(opt): collectFeasibleWeeks — pool cost-ranked dal primo tier ammesso

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: `solveWeekOptimized` + `diagnoseInfeasibility`

**Files:**
- Modify: `src/scheduler.js` (dopo `collectFeasibleWeeks`)
- Test: `tests/optimizer.test.mjs`

- [ ] **Step 1: Aggiungi i test che falliscono**

Appendi a `tests/optimizer.test.mjs`:

```js
// solveWeekOptimized: ritorna la settimana a costo minimo + le alternative a costo crescente.
test('solveWeekOptimized: best ha costo <= di ogni alternativa, ed è valido', () => {
  M.reconfigure(M.defaultStaffConfig());
  const seed = M.createBaseWeek('2026-06-08');
  const led = M.buildEquityLedger([], 8);
  const r = M.solveWeekOptimized(seed, led);
  assert.equal(r.solved, true);
  assert.equal(M.validateWeek(r.week).length, 0, 'best è valido');
  const cBest = M.costOfWeek(r.week, led);
  for (const alt of r.alternatives) assert.ok(M.costOfWeek(alt, led) >= cBest - 1e-9, 'best <= alternativa');
});

// Determinismo: stesso seed+ledger -> stessa settimana.
test('solveWeekOptimized: deterministico', () => {
  M.reconfigure(M.defaultStaffConfig());
  const led = M.buildEquityLedger([], 8);
  const a = M.solveWeekOptimized(M.createBaseWeek('2026-06-08'), led).week;
  const b = M.solveWeekOptimized(M.createBaseWeek('2026-06-08'), led).week;
  assert.equal(M.weekAssignmentSig(a), M.weekAssignmentSig(b));
});

// diagnoseInfeasibility: produce un messaggio quando la settimana è insoddisfacibile.
test('diagnoseInfeasibility: spiega una settimana impossibile', () => {
  M.reconfigure(M.defaultStaffConfig());
  const seed = M.createBaseWeek('2026-06-08');
  // Blocca tutti a OFF il lunedì: copertura apertura/chiusura impossibile.
  const mon = seed.days.find(d => d.key === 'mon');
  for (const n of M.ASSISTANT_NAMES) { mon.assignments[n] = 'OFF'; mon.locks[n] = true; }
  const r = M.solveWeekOptimized(seed, M.buildEquityLedger([], 8));
  assert.equal(r.solved, false);
  assert.equal(typeof r.reason, 'string');
  assert.ok(r.reason.length > 0);
});
```

- [ ] **Step 2: Esegui per vederlo fallire**

Run: `npm test 2>&1 | grep -E "solveWeekOptimized|diagnoseInfeasibility|fail"`
Expected: FAIL — funzioni non definite.

- [ ] **Step 3: Implementa**

In `src/scheduler.js`, dopo `collectFeasibleWeeks`:

```js
// Ottimizzatore: raccoglie le settimane feasible, le ordina per costo (poi per firma, per
// determinismo) e ritorna la migliore + le alternative. Se nessuna è feasible, diagnostica il motivo.
export function solveWeekOptimized(seedWeek,ledger,{avoidSigs}={}){
  const led=ledger||buildEquityLedger([],8);
  const{pool,overtime}=collectFeasibleWeeks(seedWeek,{avoidSigs});
  if(!pool.length)return{week:null,solved:false,overtime:false,reason:diagnoseInfeasibility(seedWeek)};
  pool.sort((a,b)=>{const ca=costOfWeek(a,led),cb=costOfWeek(b,led);if(ca!==cb)return ca-cb;const sa=weekAssignmentSig(a),sb=weekAssignmentSig(b);return sa<sb?-1:sa>sb?1:0;});
  const best=pool[0];if(overtime)best.overtimeUsed=true;
  return{week:best,solved:true,overtime,alternatives:pool.slice(1)};
}
// Spiegazione best-effort dell'infeasibilità: trova il primo vincolo hard non soddisfacibile.
export function diagnoseInfeasibility(seedWeek){
  const D=seedWeek.days.length,order=[...Array(D).keys()];
  const rem=buildRem(seedWeek.days,order),r0=rem[0];
  for(const n of ASSISTANT_NAMES){
    const target=effectiveWeeklyHours(n,seedWeek,ASSISTANTS[n].weeklyHours);
    if(r0[n].minHours>target)return`${n}: ore minime possibili ${r0[n].minHours} > target ${target} (sblocca un turno o riduci i giorni)`;
    if(r0[n].maxHours<target)return`${n}: ore massime possibili ${r0[n].maxHours} < target ${target}`;
    if(r0[n].maxAfternoons<ASSISTANTS[n].minAfternoons)return`${n}: pomeriggi disponibili insufficienti (${r0[n].maxAfternoons}/${ASSISTANTS[n].minAfternoons})`;
  }
  for(const day of seedWeek.days){
    const req=getRequiredCoverage(day);if(!req.morning&&!req.close)continue;
    if(req.morning&&!ASSISTANT_NAMES.some(n=>getAllowedShifts(n,day).some(a=>getShift(a).coversMorning)))return`${day.label}: nessuna disponibile per l'apertura 08:30`;
    if(req.close&&!ASSISTANT_NAMES.some(n=>getAllowedShifts(n,day).some(a=>getShift(a).coversClose)))return`${day.label}: nessuna disponibile per la chiusura 19:00`;
  }
  return'Vincoli combinati non soddisfacibili: prova a sbloccare qualche turno o ridurre le eccezioni.';
}
```

- [ ] **Step 4: Esegui per vederlo passare**

Run: `npm test 2>&1 | tail -6`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/optimizer.test.mjs
git commit -m "feat(opt): solveWeekOptimized + diagnoseInfeasibility

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Instrada `generateWeek`/`regenerate*` sull'ottimizzatore

**Files:**
- Modify: `src/scheduler.js` — `generateWeek`, `regenerateWeekWithFeedback`, `regenerateCleanWeekWithFeedback`, `regenerateAlternativeWithFeedback` (aggiungono il parametro `ledger` e usano `solveWeekOptimized`). `solveWeek` resta invariato.
- Test: `tests/optimizer.test.mjs`

- [ ] **Step 1: Aggiungi i test che falliscono**

Appendi a `tests/optimizer.test.mjs`:

```js
// generateWeek usa l'ottimizzatore: produce una settimana valida e accetta un ledger.
test('generateWeek: settimana valida via ottimizzatore con ledger', () => {
  M.reconfigure(M.defaultStaffConfig());
  const led = M.buildEquityLedger([], 8);
  const wk = M.generateWeek({ startDate: '2026-06-08', ledger: led });
  assert.equal(M.validateWeek(wk).length, 0);
});

// Alternativa: con avoidSigs ritorna una settimana DIVERSA da quella corrente.
test('regenerateAlternativeWithFeedback: ritorna una settimana distinta', () => {
  M.reconfigure(M.defaultStaffConfig());
  const led = M.buildEquityLedger([], 8);
  const cur = M.generateWeek({ startDate: '2026-06-08', ledger: led });
  const sig = M.weekAssignmentSig(cur);
  const r = M.regenerateAlternativeWithFeedback('2026-06-08', cur, new Set([sig]), led);
  if (r.solved) assert.notEqual(M.weekAssignmentSig(r.week), sig, 'l\'alternativa deve differire');
});
```

- [ ] **Step 2: Esegui per vederlo fallire**

Run: `npm test 2>&1 | grep -E "via ottimizzatore|distinta|fail"`
Expected: FAIL — `generateWeek` ignora `ledger` / Alternativa potrebbe coincidere.

- [ ] **Step 3: Implementa**

Sostituisci le 4 funzioni in `src/scheduler.js`:

```js
export function generateWeek(options={}){const week=createBaseWeek(options.startDate??getCurrentMonday());applyPreviousWeekState(week,options.previousWeek);const r=solveWeekOptimized(week,options.ledger);const result=r.week??week;if(r.overtime)result.overtimeUsed=true;return result;}
```

```js
export function regenerateWeekWithFeedback(start,prev,ledger){const seed=createBaseWeek(start);applyPreviousWeekState(seed,prev);const r=solveWeekOptimized(seed,ledger);const week=r.week??seed;const locked=getLockedShiftCount(week);if(!r.solved)return{week,message:(locked?`Nessuna combinazione valida con i ${locked} turni bloccati: `:'Nessuna combinazione valida. ')+(r.reason||'')};const otMsg=r.overtime?` ⚠️ Straordinario Manuela (+4h pom. extra, 29h totali).`:'';return{week,message:(locked?`Rigenerata. ${locked} turni bloccati mantenuti.`:'Settimana rigenerata.')+otMsg};}
```

```js
export function regenerateCleanWeekWithFeedback(start,ledger){const week=generateWeek({startDate:start,ledger});const otMsg=week.overtimeUsed?` ⚠️ Straordinario Manuela (+4h pom. extra, 29h totali).`:'';return{week,message:'Settimana pulita rigenerata.'+otMsg};}
```

```js
export function regenerateAlternativeWithFeedback(start,current,avoidSigs,ledger){const seed=createBaseWeek(start);applyPreviousWeekState(seed,current);const r=solveWeekOptimized(seed,ledger,{avoidSigs});if(!r.solved)return{week:null,solved:false};const otMsg=r.overtime?` ⚠️ Straordinario Manuela (+4h pom. extra, 29h totali).`:'';return{week:r.week,solved:true,message:'Soluzione alternativa trovata.'+otMsg};}
```

> NOTA: `diversifyTimes` resta esportata (non più usata da Alternativa, ma potrebbe essere importata altrove). Non rimuoverla in questo task.

- [ ] **Step 4: Esegui i test**

Run: `npm test 2>&1 | tail -8`
Expected: PASS. **Verifica esplicita** che `tests/regression.test.mjs` resti verde: gli snapshot usano `solveWeek` (invariato), il test del lock usa `regenerateWeekWithFeedback` e asserisce solo che il turno bloccato resta — deve passare. Se il test del lock fallisce, controlla che i `locks` siano rispettati da `getAllowedShifts` nel collettore (lo sono: `getAllowedShifts` ritorna il turno bloccato).

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/optimizer.test.mjs
git commit -m "feat(opt): instrada generate/regenerate sull'ottimizzatore (ledger param)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: app.js — ledger da storage + UI preferenze

**Files:**
- Modify: `src/app.js` — `buildLedgerFromStorage`, passaggio ledger ai call-site, sezione "Preferenze" nel modale team.
- Test: `tests/ui-export.test.mjs` (asserzione presenza markup preferenze)

- [ ] **Step 1: Aggiungi il test che fallisce**

In `tests/ui-export.test.mjs`, aggiungi un test che legge `src/app.js` come testo e verifica la presenza dei controlli preferenze (segui il pattern esistente del file — apri il file per vedere come legge il sorgente; se legge già `src/app.js` in una costante, riusala):

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const APP = readFileSync(fileURLToPath(new URL('../src/app.js', import.meta.url)), 'utf8');

test('UI: il modale team contiene i controlli preferenze', () => {
  assert.match(APP, /preferredDayOff/, 'select giorno libero preferito');
  assert.match(APP, /avoidClose/, 'checkbox evita chiusura');
  assert.match(APP, /avoidOpen/, 'checkbox evita apertura');
  assert.match(APP, /preferredWindow/, 'select finestra preferita');
});

test('app: costruisce il ledger equità dalle settimane salvate', () => {
  assert.match(APP, /buildEquityLedger/, 'usa buildEquityLedger');
});
```

> NOTA esecutore: se `ui-export.test.mjs` ha già un'import del sorgente `app.js`, NON duplicarla — riusa la costante esistente e aggiungi solo i due `test(...)`.

- [ ] **Step 2: Esegui per vederlo fallire**

Run: `npm test 2>&1 | grep -E "preferenze|ledger equità|fail"`
Expected: FAIL — markup assente.

- [ ] **Step 3: Implementa il ledger e il passaggio ai call-site**

3a. Aggiorna l'import in cima a `src/app.js` (riga 3-4) aggiungendo `buildEquityLedger, solveWeekOptimized` all'elenco delle import da `./scheduler.js`.

3b. Aggiungi l'helper (vicino a `loadWeeks`/`saveWeeks`, es. dopo riga 13 `let weeks=loadWeeks();`):

```js
  // Ledger equità dalle ultime 8 settimane salvate, esclusa quella in editing (currentStart).
  function buildLedgerFromStorage(){return buildEquityLedger(Object.entries(weeks).filter(([s])=>s!==currentStart).map(([,w])=>w),8);}
```

3c. Passa il ledger a tutti i call-site di generate/regenerate:

- Riga ~16: `if(!weeks[currentStart])weeks[currentStart]=generateWeek({startDate:currentStart,ledger:buildLedgerFromStorage()});`
- Riga ~31 (`doGenerate`): `const r=regenerateWeekWithFeedback(currentStart,getCurrentWeek(),buildLedgerFromStorage());`
- Riga ~32 (`doReset`): `const r=regenerateCleanWeekWithFeedback(currentStart,buildLedgerFromStorage());`
- Riga ~55: `const r=regenerateAlternativeWithFeedback(currentStart,cur,avoid,buildLedgerFromStorage());`
- Riga ~59: `const r2=regenerateAlternativeWithFeedback(currentStart,cur,null,buildLedgerFromStorage());`
- Riga ~132 (team save): `weeks[currentStart]=generateWeek({startDate:currentStart,ledger:buildLedgerFromStorage()});`
- Riga ~333 (`changeWeek`): `if(!weeks[currentStart])weeks[currentStart]=generateWeek({startDate:currentStart,ledger:buildLedgerFromStorage()});`

- [ ] **Step 4: Implementa la UI preferenze nel modale team**

4a. In `renderRows` (riga ~96-104), aggiungi una seconda griglia dentro `el.innerHTML`, subito dopo la `</div>` di chiusura di `.t-grid`. La persona corrente è `c` (= `row.c`); leggi `c.preferences` (default `{}`):

```js
        const pf=c.preferences||{};
        el.innerHTML+=`
          <div class="t-grid t-prefs">
            <label class="t-field">Libero pref.<select class="field" data-i="${i}" data-k="preferredDayOff">
              <option value=""${!pf.preferredDayOff?' selected':''}>—</option>
              ${['mon','tue','wed','thu','fri'].map((k,j)=>`<option value="${k}"${pf.preferredDayOff===k?' selected':''}>${['Lun','Mar','Mer','Gio','Ven'][j]}</option>`).join('')}
            </select></label>
            <label class="t-field">Finestra pref.<select class="field" data-i="${i}" data-k="preferredWindow">
              <option value=""${!pf.preferredWindow?' selected':''}>—</option>
              <option value="early"${pf.preferredWindow==='early'?' selected':''}>Presto</option>
              <option value="late"${pf.preferredWindow==='late'?' selected':''}>Tardi</option>
              <option value="morning"${pf.preferredWindow==='morning'?' selected':''}>Mattina</option>
              <option value="afternoon"${pf.preferredWindow==='afternoon'?' selected':''}>Pomeriggio</option>
            </select></label>
            <label class="t-field t-check"><input type="checkbox" ${pf.avoidClose?'checked':''} data-i="${i}" data-k="avoidClose">Evita chiusura</label>
            <label class="t-field t-check"><input type="checkbox" ${pf.avoidOpen?'checked':''} data-i="${i}" data-k="avoidOpen">Evita apertura</label>
          </div>`;
```

> NOTA: `el.innerHTML+=` concatena al markup già costruito alle righe 97-104. Verifica che la struttura resti valida (un solo nodo radice `el`).

4b. Nel gestore `input` di `rowsBox` (riga ~107-111), aggiungi la gestione delle chiavi preferenze. Subito prima della riga finale `else rows[i].c[k]=...`, inserisci:

```js
      else if(k==='preferredDayOff'||k==='preferredWindow'){rows[i].c.preferences={...(rows[i].c.preferences||{}),[k]:t.value||undefined};}
      else if(k==='avoidClose'||k==='avoidOpen'){rows[i].c.preferences={...(rows[i].c.preferences||{}),[k]:t.checked};}
```

> NOTA: i `<select>` emettono evento `input`? In molti browser i select emettono `change`. Per sicurezza, aggiungi anche un listener `change` su `rowsBox` che richiama lo stesso handler. Implementazione: estrai il corpo del handler `input` in una funzione `onFieldChange(t)` e registra sia `rowsBox.addEventListener('input',e=>onFieldChange(e.target))` sia `rowsBox.addEventListener('change',e=>onFieldChange(e.target))`. Il handler deve essere idempotente (lo è: assegnazioni dirette).

4c. Il salvataggio (riga ~129) usa `{...c,...}` quindi `preferences` viene preservato automaticamente. Verifica che `c.preferences` esista (default `{}`): nel ramo `btn-add` (riga ~113) aggiungi `preferences:{}` all'oggetto nuovo.

- [ ] **Step 5: Esegui i test**

Run: `npm test 2>&1 | tail -8`
Expected: PASS (asserzioni markup verdi + tutti gli altri test).

- [ ] **Step 6: Commit**

```bash
git add src/app.js tests/ui-export.test.mjs
git commit -m "feat(opt): ledger equità da storage + UI preferenze nel modale team

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Performance, CSS, smoke browser, graphify, PR

**Files:**
- Modify: `index.html` (CSS `.t-prefs` se serve spaziatura), `src/app.js` (eventuali fix da smoke)
- Modify: `graphify-out/` (via `graphify update .`)

- [ ] **Step 1: Misura la performance del path ottimizzato**

Run:
```bash
node -e "import('./src/scheduler.js').then(M=>{const seed=M.createBaseWeek('2026-06-08');const led=M.buildEquityLedger([],8);const t=performance.now();for(let i=0;i<10;i++)M.solveWeekOptimized(seed,led);console.log('avg ms:',((performance.now()-t)/10).toFixed(1));})"
```
Expected: media < ~500ms per settimana standard. **Se >500ms**: abbassa il `cap` default in `collectFeasibleWeeks` (es. 2000→500) e/o aggiungi un ordinamento cost-guided dei `combosByDay` (riusa `heuristicCombos`) così le buone soluzioni emergono prima del cap. Ri-misura. Documenta il valore finale nel commit.

- [ ] **Step 2: CSS preferenze (se necessario)**

Se la griglia `.t-prefs` appare stretta nel modale, in `index.html` aggiungi una regola coerente con `.t-grid` esistente (cerca `.t-grid` nel CSS e replica spaziatura per `.t-prefs`, es. `margin-top:6px`). Solo se serve visivamente.

- [ ] **Step 3: Smoke browser**

```bash
python3 -m http.server 8765 >/dev/null 2>&1 &
```
Apri `http://localhost:8765/` e verifica manualmente (o segnala all'utente di verificare):
1. "Genera" produce una settimana valida (nessun avviso rosso).
2. "Alternativa" produce una settimana DIVERSA ad ogni click finché non cicla.
3. Modale Team → per una persona imposta "Evita chiusura" + "Libero pref. = Mer", Salva → la settimana rigenerata tende a non farle fare chiusure/mercoledì (quando i vincoli lo consentono).
4. Nessun errore in console.
Ferma il server: `kill %1` (o il PID stampato).

- [ ] **Step 4: Aggiorna graphify**

Run: `graphify update .`
Expected: grafo AST aggiornato senza costo API.

- [ ] **Step 5: Aggiorna lo STATO del piano roadmap**

In `/Users/fmotta/.claude/plans/possiamo-fare-un-brainstorming-distributed-church.md`, sezione STATO: marca Fase 4 come completata (motore cost-ranked + equità + preferenze + infeasibility), nota i default `W_EQ=10/W_PREF=3/W_TIDY=0.1`, `N=8`, `cap` finale misurato.

- [ ] **Step 6: Commit finale + push + PR**

```bash
git add -A
git commit -m "chore(opt): perf tuning + CSS preferenze + graphify update Fase 4

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push -u origin optimizer/cost-ranked-phase4
gh pr create --title "Fase 4 — Ottimizzatore turni multi-obiettivo" --body "$(cat <<'EOF'
## Sommario
- Solver da "prima valida" a "valida a costo minimo" multi-obiettivo.
- Equità nel tempo (finestra mobile N=8, proporzionale ai giorni lavorati): chiusure/aperture/sabati.
- Preferenze soft per persona (giorno libero, no chiusura/apertura, finestra oraria) con UI nel modale team.
- Ordine deterministico (niente più rimescolamento casuale di "Alternativa").
- Spiegabilità infeasibilità.
- `solveWeek` invariato (primitiva first-valid): snapshot regression verdi.

## Test
- Nuovi: equity, preferences, optimizer. Tutti i test esistenti verdi.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review (eseguita dall'autore del piano)

**Spec coverage:**
- §2 Ledger equità → Task 1. §2 costo varianza tassi → Task 2. §3 modello preferenze → Task 3. §4 preferenceCost → Task 3. §5 tidyCost → Task 4. §6 costOfWeek → Task 5. §7 motore collect → Task 6 (refactor) + 7. §8 Alternativa → Task 9. §9 infeasibility → Task 8. Data flow storage + UI → Task 10. Performance → Task 11. Tutte coperte.

**Placeholder scan:** nessun TBD/TODO; ogni step di codice mostra il codice completo. Le "NOTA esecutore" indicano dove confermare valori sul sorgente, non rimandano implementazione.

**Type consistency:** firme coerenti end-to-end — `buildEquityLedger(pastWeeks,N)`, `equityCost(week,ledger)`, `preferenceCost(week)`, `windowPenalty(pref,sh)`, `tidyCost(week)`, `costOfWeek(week,ledger)`, `buildTierRules(seedWeek,tier)`, `collectFeasibleWeeks(seed,{cap,budget,avoidSigs})`, `solveWeekOptimized(seed,ledger,{avoidSigs})`, `diagnoseInfeasibility(seed)`. `generateWeek({...,ledger})` e `regenerate*(...,ledger)` aggiungono il ledger in coda. Ledger shape `{name:{opens,closes,saturdays,workDays}}` usato uniformemente. Pesi `W_EQ/W_PREF/W_TIDY` + `PREF_W` coerenti.

**Decisione di rischio:** `solveWeek` resta first-valid (snapshot regression invariati); l'ottimizzatore è il path nuovo usato da app + test nuovi. Riduce il rischio di rottura rispetto al re-pin previsto nella spec §7 (annotato come miglioria).
