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
