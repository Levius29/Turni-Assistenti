import assert from 'node:assert/strict';
import test from 'node:test';
import * as M from '../src/scheduler.js';

// Logica importata direttamente dal modulo ES (niente più estrazione via regex).
function loadLogic() { return M; }

// ── Task 1: coverageDeficit ──
test('coverageDeficit somma i buchi (cumulativo, non max)', () => {
  const { getShift, coverageDeficit } = loadLogic();
  const s = v => getShift(v);
  // 08:30-12:00, 12:30-15:30, 16:00-19:00 → buchi 30'+30' = 60'
  const shifts = [s({ s: 510, e: 720 }), s({ s: 750, e: 930 }), s({ s: 960, e: 1140 })];
  assert.equal(coverageDeficit(shifts, 'mon'), 60);
});

test('coverageDeficit: solo turno lungo = debito pranzo 30 (valido)', () => {
  const { getShift, coverageDeficit } = loadLogic();
  assert.equal(coverageDeficit([getShift({ s: 510, e: 1140 })], 'mon'), 30); // 08:30-19:00 long, solo
});

test('coverageDeficit: lungo coperto da seconda persona sulla fascia pranzo = 0', () => {
  const { getShift, coverageDeficit } = loadLogic();
  const shifts = [getShift({ s: 510, e: 1140 }), getShift({ s: 720, e: 960 })]; // 2ª copre 12:00-16:00
  assert.equal(coverageDeficit(shifts, 'mon'), 0);
});

// ── Task 2: workDays in validateWeek ──
test('validateWeek segnala >5 giorni lavorati', () => {
  const M = loadLogic();
  const w = M.createBaseWeek('2026-06-08');
  w.days.find(d => d.key === 'sat').exceptions.satOpen = true;
  for (const k of ['mon', 'tue', 'wed', 'thu', 'fri']) M.assign(w, k, { Manuela: { s: 510, e: 810 } });
  M.assign(w, 'sat', { Manuela: { s: 540, e: 840 } });   // mon-fri + sabato → 6 giorni
  const msgs = M.validateWeek(w).map(x => x.message);
  assert.ok(msgs.some(m => /Manuela.*giorni/i.test(m)), 'atteso avviso giorni lavorati');
});

// ── Task 3: nessuna mutazione globale ──
test('solveWeek non muta ASSISTANTS globale', () => {
  const M = loadLogic();
  const before = JSON.parse(JSON.stringify(M.ASSISTANTS));
  M.solveWeek(M.createBaseWeek('2026-06-08'));
  assert.deepEqual(M.ASSISTANTS, before);
});

// ── Task 5: getDayCombos invarianza (un rappresentante per firma) ──
test('getDayCombos: un combo per firma', () => {
  const M = loadLogic();
  const w = M.createBaseWeek('2026-06-08');
  for (const day of w.days) {
    const combos = M.getDayCombos(w, day, 0);
    const sig = c => M.ASSISTANT_NAMES.map(n => {
      const dn = c.d[n];
      let p = `${dn.h},${dn.af}`;
      if ('close' in dn) p += ',' + dn.close;
      if ('oReq' in dn) p += ',' + dn.oReq;
      return p;
    }).join('|');
    const sigs = new Set(combos.map(sig));
    assert.equal(sigs.size, combos.length, `firme duplicate in ${day.key}`);
  }
});

// ── Task 5: equivalenza comportamentale dopo ottimizzazione getDayCombos ──
function solvedValid(M, mutate) {
  const seed = M.createBaseWeek('2026-06-08');
  if (mutate) mutate(seed);
  const r = M.solveWeek(seed);
  return r.solved && M.validateWeek(r.week).length === 0;
}
test('solver resta valido: settimana standard', () => {
  const M = loadLogic();
  assert.equal(solvedValid(M), true);
});
test('solver resta valido: doppio pomeriggio (extraAfternoon)', () => {
  const M = loadLogic();
  assert.equal(solvedValid(M, s => { s.days.find(d => d.key === 'tue').exceptions.extraAfternoon = true; }), true);
});
test('solver resta valido: doppia mattina (extraMorning)', () => {
  const M = loadLogic();
  assert.equal(solvedValid(M, s => { s.days.find(d => d.key === 'wed').exceptions.extraMorning = true; }), true);
});
test('solver resta valido: sabato aperto', () => {
  const M = loadLogic();
  assert.equal(solvedValid(M, s => { s.days.find(d => d.key === 'sat').exceptions.satOpen = true; }), true);
});

// ── Task 6: alternativa a parità di ore ──
test('alternativa: stessa stat ore, settimana diversa', () => {
  const M = loadLogic();
  const seed = M.createBaseWeek('2026-06-08');
  const r = M.solveWeek(seed);
  const sig = wk => wk.days.map(d => M.ASSISTANT_NAMES.map(n => { const a = d.assignments[n]; return a === 'OFF' ? 'OFF' : a.s + '-' + a.e; }).join(',')).join('|');
  const alt = M.solveWeek(seed, new Set([sig(r.week)]));
  assert.equal(alt.solved, true);
  assert.notEqual(sig(alt.week), sig(r.week));
  const s1 = M.getAssistantStats(r.week), s2 = M.getAssistantStats(alt.week);
  for (const n of M.ASSISTANT_NAMES) assert.equal(s1[n].hours, s2[n].hours, `${n} ore diverse`);
});
