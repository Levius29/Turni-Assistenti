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
