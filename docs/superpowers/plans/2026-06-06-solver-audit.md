# Solver Audit & Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Correggere 4 bug logici, ottimizzare il solver, aumentare la varietà delle alternative e applicare 3 migliorie UX/storage/robustezza nello scheduler turni `index.html`.

**Architecture:** Tutto resta in `index.html` (logica inline). Test puri in `tests/solver-logic.test.mjs` estraendo lo `<script>` come fa `ui-export.test.mjs`. Nessuna nuova dipendenza.

**Tech Stack:** HTML/CSS/JS vanilla single-file, jsPDF (CDN), `node --test`.

Riferimento design: `docs/superpowers/specs/2026-06-06-solver-audit-design.md`.

---

## Convenzioni test

Loader esteso (in cima a `tests/solver-logic.test.mjs`) che espone le funzioni necessarie:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function loadLogic(){
  const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const ASSISTANT_NAMES'));
  const logic=script.slice(0,script.indexOf('// ── STORAGE ──'));
  return new Function(logic+'return {ASSISTANTS,ASSISTANT_NAMES,getShift,createBaseWeek,createEmptyWeek,assign,solveWeek,validateWeek,getAssistantStats,getDayCombos,coverageDeficit,getRequiredCoverage,getCoverage};')();
}
```

Esecuzione: `node --test tests/` (dalla root del repo).

---

### Task 1: #1+#2 — `coverageDeficit` (copertura cumulativa + debito pranzo)

**Files:**
- Modify: `index.html` — sostituire `gapOf`/`maxUncoveredGap` (righe ~627-628), aggiornare l'uso in `validateWeek` (~629) e `getDayCombos` (~753).
- Test: `tests/solver-logic.test.mjs`

- [ ] **Step 1: test che falliscono**

```js
test('coverageDeficit somma i buchi (cumulativo, non max)', () => {
  const { getShift, coverageDeficit } = loadLogic();
  // due persone con due buchi da 30' separati → 60' totali, oggi gapOf darebbe 30
  const s=v=>getShift(v);
  // 08:30-12:00 (510-720), 12:30-15:30 (750-930), 16:00-19:00 (960-1140): buchi 30+30=60
  const shifts=[s({s:510,e:720}),s({s:750,e:930}),s({s:960,e:1140})];
  assert.equal(coverageDeficit(shifts,'mon'),60);
});
test('coverageDeficit: solo turno lungo = debito pranzo 30 (valido)', () => {
  const { getShift, coverageDeficit } = loadLogic();
  assert.equal(coverageDeficit([getShift({s:510,e:1140})],'mon'),30); // 08:30-19:00 long, solo
});
test('coverageDeficit: lungo coperto da seconda persona sulla fascia pranzo = 0', () => {
  const { getShift, coverageDeficit } = loadLogic();
  const shifts=[getShift({s:510,e:1140}),getShift({s:720,e:960})]; // 2ª copre 12:00-16:00
  assert.equal(coverageDeficit(shifts,'mon'),0);
});
```

- [ ] **Step 2: verifica fallimento** — `node --test tests/solver-logic.test.mjs` → FAIL (`coverageDeficit` non definita).

- [ ] **Step 3: implementazione.** Sostituire la funzione `gapOf` con `coverageDeficit` (slot-based, SLOT=30):

```js
// Minuti scoperti 08:30-19:00 (cumulativo) + debito pranzo: se una fascia e' coperta
// da una sola persona in turno lungo, i suoi 30' di pausa contano come scoperti.
function coverageDeficit(shifts,dayKey){
  if(!WEEKDAY_KEYS.includes(dayKey))return 0;
  const working=shifts.filter(s=>s.hours>0&&s.startMin!=null);
  const N=(STUDIO_CLOSE-STUDIO_OPEN)/SLOT;
  let realGap=0; let soloLongRun=0,maxSoloLong=0;
  for(let i=0;i<N;i++){
    const t0=STUDIO_OPEN+i*SLOT,t1=t0+SLOT;
    const cover=working.filter(s=>s.startMin<=t0&&s.endMin>=t1);
    if(cover.length===0){realGap+=SLOT;soloLongRun=0;}
    else{
      if(cover.length===1&&cover[0].isLong){soloLongRun+=SLOT;maxSoloLong=Math.max(maxSoloLong,soloLongRun);}
      else soloLongRun=0;
    }
  }
  const lunchDebt=maxSoloLong>=SLOT?LUNCH_GAP_MAX:0;
  return realGap+lunchDebt;
}
function maxUncoveredGap(day){return coverageDeficit(shiftsOf(day),day.key);}
```

- [ ] **Step 4: aggiornare i call site.**
  - In `validateWeek`: `if(maxUncoveredGap(day)>LUNCH_GAP_MAX)` resta invariato (usa la nuova logica).
  - In `getDayCombos` (~753): `if(isWeekday&&gapOf([l,m,md],day.key)>LUNCH_GAP_MAX)continue;` → `if(isWeekday&&coverageDeficit([l,m,md],day.key)>LUNCH_GAP_MAX)continue;`

- [ ] **Step 5: verifica pass** — `node --test tests/` → tutti PASS (inclusi i 5 esistenti).

- [ ] **Step 6: commit** — `git add -A && git commit -m "fix: copertura cumulativa + debito pausa pranzo turno lungo"`

---

### Task 2: #3 — `validateWeek` segnala giorni lavorati > max

**Files:** Modify `index.html` (`getAssistantStats` ~616, `validateWeek` ~629). Test stesso file.

- [ ] **Step 1: test fallente**

```js
test('validateWeek segnala >5 giorni lavorati', () => {
  const M=loadLogic();
  const w=M.createBaseWeek('2026-06-08');
  // forza Manuela a lavorare anche sabato (6 giorni)
  w.days.find(d=>d.key==='sat').exceptions.satOpen=true;
  M.assign(w,'sat',{Manuela:{s:540,e:840}});
  const msgs=M.validateWeek(w).map(x=>x.message);
  assert.ok(msgs.some(m=>/Manuela.*giorni/i.test(m)),'atteso avviso giorni lavorati');
});
```

- [ ] **Step 2: verifica fallimento** → FAIL (nessun avviso giorni).

- [ ] **Step 3: implementazione.**
  - In `getAssistantStats`, dentro il loop giorni aggiungere `if(sh.hours>0)s[n].workDays++;` e inizializzare `workDays:0` nell'oggetto stato.
  - In `validateWeek`, nel loop `for(const[name]of Object.entries(ASSISTANTS))` aggiungere dopo i check pomeriggi:
    ```js
    const maxWD=rules.workDays??rules.maxWorkDays;
    if(maxWD&&s.workDays>maxWD)w.push({message:`${name}: ${s.workDays} giorni lavorati (max ${maxWD})`});
    ```

- [ ] **Step 4: verifica pass** → PASS.
- [ ] **Step 5: commit** — `git commit -am "fix: validateWeek segnala giorni lavorati oltre il massimo"`

---

### Task 3: #4 — Niente mutazione globale di ASSISTANTS

**Files:** Modify `index.html` (`solveWeek` ~674-698, `solveWeekCore` ~700-731).

**Approccio:** `solveWeekCore` riceve `tierRules` (mappa nome→{weeklyHours,maxAfternoons,minAfternoons,canWorkLong,workDays,maxWorkDays}). `feasibleAhead` e il `visit` finale (`validateWeek`) usano `tierRules` invece di leggere `ASSISTANTS`. `validateWeek` accetta un secondo parametro opzionale `rulesOverride`.

- [ ] **Step 1: test fallente**

```js
test('solveWeek non muta ASSISTANTS globale', () => {
  const M=loadLogic();
  const before=JSON.parse(JSON.stringify(M.ASSISTANTS));
  M.solveWeek(M.createBaseWeek('2026-06-08'));
  assert.deepEqual(M.ASSISTANTS,before);
});
```

- [ ] **Step 2: verifica.** Oggi probabilmente PASS (restore funziona nel caso felice); il test blinda contro regressioni del refactor. Procedere comunque al refactor.

- [ ] **Step 3: refactor.**
  - `solveWeek`: rimuovere `orig`/`restore`/mutazioni. Costruire per ogni tier:
    ```js
    const tierRules=Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{...ASSISTANTS[n],maxAfternoons:tier.caps[n],...(tier.ot&&n==='Manuela'?{weeklyHours:29}:{})}]));
    ```
    e passarlo a `solveWeekCore(seedWeek,maxCloses,combos,budget,avoidSigs,tierRules,rem)`.
  - `solveWeekCore`: nuova firma con `tierRules` (default = `Object.fromEntries(ASSISTANT_NAMES.map(n=>[n,{...ASSISTANTS[n]}]))`). In `feasibleAhead` sostituire `ASSISTANTS[a]` con `tierRules[a]`. Nel ramo `pos===D`: `validateWeek(w,tierRules)`.
  - `validateWeek(week,rulesOverride)`: `const ASSIST=rulesOverride??ASSISTANTS;` e usare `ASSIST[name]`/`ASSIST[n]` al posto di `ASSISTANTS` per le regole (mantenere la logica straordinario Manuela basata su `baseRules`).

- [ ] **Step 4: verifica pass** — `node --test tests/` tutti PASS (il test "settimana standard" garantisce equivalenza funzionale).
- [ ] **Step 5: commit** — `git commit -am "refactor: tierRules come parametro, niente mutazione globale ASSISTANTS"`

---

### Task 4: #6 — `rem` calcolato una volta in `solveWeek`

**Files:** Modify `index.html` (`solveWeek`, `solveWeekCore`).

- [ ] **Step 1:** Estrarre il blocco di calcolo `rem` (righe ~708) in una funzione `computeRem(seedWeek,combosByDay,order)` — ma `rem` dipende dall'`order` che è interno a core. **Decisione:** `order` dipende solo da `combosByDay.length`, deterministico. Calcolare `order`+`rem` in `solveWeek` una volta e passarli a core.
- [ ] **Step 2:** `solveWeekCore` accetta `precomputed={order,rem}` opzionale; se assente li calcola (retrocompat per i test che chiamano core? I test chiamano solo `solveWeek`). 
- [ ] **Step 3:** verifica `node --test tests/` PASS + nessun cambiamento di risultato.
- [ ] **Step 4: commit** — `git commit -am "perf: rem/order calcolati una volta e riusati tra i tier"`

---

### Task 5: #5 — `getDayCombos` pre-dedup per-assistente

**Files:** Modify `index.html` (`getDayCombos` ~735-767). Test: confronto firme.

- [ ] **Step 1: test invarianza firme**

```js
test('getDayCombos: stesse firme combo dopo ottimizzazione', () => {
  const M=loadLogic();
  const w=M.createBaseWeek('2026-06-08');
  for(const day of w.days){
    const combos=M.getDayCombos(w,day,0);
    const sigs=new Set(combos.map(c=>c.__sig));
    assert.equal(sigs.size,combos.length,'un rappresentante per firma');
  }
});
```
(Esportare `__sig` sul combo, oppure ricomputare la firma nel test dai delta `c.d`.)

- [ ] **Step 2: verifica** → definire prima il comportamento atteso.

- [ ] **Step 3: implementazione.** Prima del triplo loop, deduplicare gli shift di ogni assistente per la firma-ruolo:

```js
function roleKey(a,sh){return sh.hours+'|'+(sh.coversMorning?1:0)+'|'+(sh.coversClose?1:0)+'|'+(sh.isAfternoon?1:0)
  +'|'+(sh.startMin!=null&&sh.startMin<=570&&sh.endMin>=810?1:0)   // morningPair window
  +'|'+(sh.startMin!=null&&sh.startMin<=840&&sh.endMin>=1080?1:0)  // afternoonPair window
  +'|'+(isManuelaClose1519(a)?1:0)+'|'+(countsAsAfternoon... );}
```

Nota: `countsAsAfternoon` dipende dal nome assistente → la dedup va fatta per-assistente con il nome corretto. Ridurre `La/Ls`, `Ma/Ms`, `Da/Ds` ai soli rappresentanti distinti per `roleKey` (mantenendo l'allineamento indice originale→{s,e}). Poi il triplo loop opera sui set ridotti. La firma `sig` finale e il dedup `seen` restano identici → output equivalente.

- [ ] **Step 4: verifica** — `node --test tests/` PASS; aggiungere assert che `getDayCombos` per la settimana standard produce lo stesso numero di combo del baseline (annotare i numeri prima/dopo nel commit).
- [ ] **Step 5: commit** — `git commit -am "perf: getDayCombos pre-dedup per-assistente (O(N^3)->O(K^3))"`

---

### Task 6: #7 — "Alternativa" con varietà oraria

**Files:** Modify `index.html` (`getDayCombos` per esporre i rappresentanti alternativi, `regenerateAlternativeWithFeedback`/`requestAlternative` ~773/811).

**Approccio:** dopo aver trovato `r.week`, per ogni giorno cercare un assegnamento diverso con **stessa firma per-assistente** ma orari diversi, e applicarlo. Generare i candidati con `getAllowedShifts` filtrati per la firma del turno corrente di ciascuna assistente, scegliendo un orario diverso che mantenga la copertura del giorno (`coverageDeficit ≤ 30`, stessi `coversMorning/close/isAfternoon/pair`).

- [ ] **Step 1: test**

```js
test('alternativa: stessa stat, orari diversi', () => {
  const M=loadLogic();
  const seed=M.createBaseWeek('2026-06-08');
  const r=M.solveWeek(seed);
  const sig=w=>w.days.map(d=>M.ASSISTANT_NAMES.map(n=>{const a=d.assignments[n];return a==='OFF'?'OFF':a.s+'-'+a.e;}).join(',')).join('|');
  const alt=M.solveWeek(seed,new Set([sig(r.week)]));
  assert.equal(alt.solved,true);
  assert.notEqual(sig(alt.week),sig(r.week));
  const s1=M.getAssistantStats(r.week),s2=M.getAssistantStats(alt.week);
  for(const n of M.ASSISTANT_NAMES)assert.equal(s1[n].hours,s2[n].hours);
});
```

- [ ] **Step 2: verifica** — oggi `solveWeek` con avoidSigs già trova soluzioni diverse se esistono; il test verifica la garanzia. Se passa già, il valore aggiunto è il pass di variazione oraria locale: implementarlo solo se l'alternativa risulta troppo simile (stesse ore identiche). 
- [ ] **Step 3: implementazione** del pass `timeVariant(week)` che permuta gli orari a parità di firma (descritto sopra), invocato in `regenerateAlternativeWithFeedback` quando la nuova firma differisce poco.
- [ ] **Step 4: verifica** PASS.
- [ ] **Step 5: commit** — `git commit -am "feat: alternativa con varieta' oraria a parita' di statistiche"`

---

### Task 7: #9 — Pruning storage

**Files:** Modify `index.html` (`saveWeeks` ~1022).

- [ ] **Step 1:** Implementare pruning in `saveWeeks`:

```js
function saveWeeks(){
  const keep=new Set();
  for(let i=-8;i<=8;i++)keep.add(addDays(currentStart,i*7));
  for(const[k,wk]of Object.entries(weeks)){
    const hasManual=wk.days?.some(d=>Object.values(d.locks||{}).some(Boolean));
    if(!keep.has(k)&&!hasManual)delete weeks[k];
  }
  localStorage.setItem(storageKey,JSON.stringify(weeks));
}
```

- [ ] **Step 2:** Test smoke (Node non ha localStorage): coperto manualmente in browser. Verificare che `node --test` resti verde (saveWeeks non nei test logici).
- [ ] **Step 3: commit** — `git commit -am "chore: pruning localStorage (finestra +-8 settimane + edit manuali)"`

---

### Task 8: #10 — Status "Calcolo turni…" prima del solve

**Files:** Modify `index.html` — handler `#generateWeek`/`#generateWeekMob` (~797/804) e `requestAlternative` (~811).

- [ ] **Step 1:** Wrappare l'esecuzione del solve: mostrare `showStatus('Calcolo turni…')` e rinviare il lavoro pesante con `setTimeout(()=>{ ...solve+render... },0)`. Estrarre la logica condivisa in `function runGenerate(){...}` per non duplicarla tra desktop/mobile.
- [ ] **Step 2:** Verifica manuale browser (no test automatico). `node --test` resta verde.
- [ ] **Step 3: commit** — `git commit -am "ux: feedback 'Calcolo turni' e solve async per non bloccare l'UI"`

---

### Task 9: #11 — jsPDF SRI + crossorigin

**Files:** Modify `index.html` righe 557-558.

- [ ] **Step 1:** Calcolare gli hash SRI reali:
  `curl -s https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js | openssl dgst -sha384 -binary | openssl base64 -A`
  e analogo per autotable. Aggiungere `integrity="sha384-…" crossorigin="anonymous"` ai due `<script>`.
- [ ] **Step 2:** Test esistente PDF resta sui match di stringa → invariato. Verifica `node --test` verde + caricamento PDF in browser.
- [ ] **Step 3: commit** — `git commit -am "security: SRI + crossorigin sui CDN jsPDF"`

---

### Task 10: Verifica finale + graphify update

- [ ] **Step 1:** `node --test tests/` → tutti PASS (5 vecchi + nuovi).
- [ ] **Step 2:** `graphify update .` (AST-only, no API) per riallineare il grafo, se disponibile.
- [ ] **Step 3:** Aprire `index.html` in browser: Genera / Alternativa / Reset / PDF / night mode / mobile.
- [ ] **Step 4: commit finale** se restano modifiche.

---

## Self-Review

- Copertura spec: #1-#11 → Task 1-9; #8 esplicitamente fuori scope (YAGNI). ✓
- Dipendenze ordine: Task 1 (coverageDeficit) prima di Task 5 (getDayCombos); Task 3 (tierRules) prima di Task 4 (rem) — entrambi toccano la firma di `solveWeekCore`, applicare in sequenza. ✓
- Tipi/nomi coerenti: `coverageDeficit`, `tierRules`, `workDays`, `roleKey`, `runGenerate`, `timeVariant`. ✓
- Note: Task 4/6 hanno passi condizionati ("implementare solo se…") — decisione presa in fase di esecuzione misurando il comportamento reale, non placeholder di codice.
