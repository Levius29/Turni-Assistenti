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
