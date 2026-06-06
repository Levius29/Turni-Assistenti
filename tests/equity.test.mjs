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
