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

// costOfWeek = W_EQ*equity + W_PREF*pref + W_TIDY*tidy. Deterministico.
test('costOfWeek: combina i tre termini ed è deterministico', () => {
  M.reconfigure(M.defaultStaffConfig());
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const led = M.buildEquityLedger([], 8);
  const expected = M.W_EQ * M.equityCost(wk, led) + M.W_PREF * M.preferenceCost(wk) + M.W_TIDY * M.tidyCost(wk);
  assert.ok(Math.abs(M.costOfWeek(wk, led) - expected) < 1e-9);
  assert.equal(M.costOfWeek(wk, led), M.costOfWeek(wk, led));
});

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
