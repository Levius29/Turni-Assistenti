import assert from 'node:assert/strict';
import test from 'node:test';
import * as M from '../src/scheduler.js';

// Snapshot di regressione: pinna l'output del solver PRIMA della modularizzazione,
// così ogni refactor successivo è provabilmente equivalente. Catturato su main 2026-06-06.
const sigOf = wk => wk.days.map(d => M.ASSISTANT_NAMES.map(n => {
  const a = d.assignments[n];
  return a === 'OFF' ? 'OFF' : a.s + '-' + a.e;
}).join(',')).join('|');

const SNAPSHOTS = {
  standard: {
    mut: null,
    sig: '510-990,540-840,840-1140|510-990,540-840,840-1140|510-990,840-1140,540-840|660-1140,510-810,540-840|630-1140,510-810,540-780|OFF,OFF,OFF',
    hours: { Lucrezia: 38, Manuela: 25, Madalina: 24 },
  },
  extraAfternoon: {
    mut: s => { s.days.find(d => d.key === 'tue').exceptions.extraAfternoon = true; },
    sig: '510-990,540-840,840-1140|510-990,780-1080,840-1140|510-990,540-840,840-1140|660-1140,510-810,540-840|630-1140,510-810,540-780|OFF,OFF,OFF',
    hours: { Lucrezia: 38, Manuela: 25, Madalina: 24 },
  },
  extraMorning: {
    mut: s => { s.days.find(d => d.key === 'wed').exceptions.extraMorning = true; },
    sig: '510-990,540-840,840-1140|510-990,840-1140,540-840|510-990,540-840,840-1140|660-1140,510-810,540-840|630-1140,510-810,540-780|OFF,OFF,OFF',
    hours: { Lucrezia: 38, Manuela: 25, Madalina: 24 },
  },
  satOpen: {
    mut: s => { s.days.find(d => d.key === 'sat').exceptions.satOpen = true; },
    sig: '510-990,540-840,840-1140|510-990,540-840,840-1140|510-990,840-1140,540-840|660-1140,510-810,540-840|630-1140,OFF,510-750|OFF,510-810,OFF',
    hours: { Lucrezia: 38, Manuela: 25, Madalina: 24 },
  },
  overtimeManuela: {
    // 3× pomeriggio extra → domanda alta → tier straordinario Manuela (29h).
    mut: s => { for (const k of ['mon', 'tue', 'wed']) s.days.find(d => d.key === k).exceptions.extraAfternoon = true; },
    sig: '510-870,660-1080,720-1140|570-1080,510-810,840-1140|630-1140,510-900,840-1080|510-1020,900-1140,540-780|630-1140,510-900,540-780|OFF,OFF,OFF',
    hours: { Lucrezia: 38, Manuela: 29, Madalina: 24 },
    overtimeUsed: true,
  },
};

for (const [name, snap] of Object.entries(SNAPSHOTS)) {
  test(`regression snapshot: ${name}`, () => {
    const seed = M.createBaseWeek('2026-06-08');
    if (snap.mut) snap.mut(seed);
    const r = M.solveWeek(seed);
    assert.equal(r.solved, true, `${name}: deve essere risolvibile`);
    assert.equal(sigOf(r.week), snap.sig, `${name}: assegnamenti cambiati vs snapshot`);
    assert.equal(M.validateWeek(r.week).length, 0, `${name}: deve restare valida`);
    const stats = M.getAssistantStats(r.week);
    for (const [person, h] of Object.entries(snap.hours)) {
      assert.equal(stats[person].hours, h, `${name}: ${person} ore`);
    }
    if (snap.overtimeUsed) assert.equal(r.week.overtimeUsed, true, `${name}: deve usare lo straordinario`);
  });
}

test('regression: turno bloccato preservato dopo rigenerazione', () => {
  const cur = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const lockShift = cur.days[0].assignments.Lucrezia;
  const prev = {
    days: cur.days.map(d => ({
      key: d.key,
      exceptions: d.exceptions,
      locks: Object.fromEntries(M.ASSISTANT_NAMES.map(n => [n, d.key === 'mon' && n === 'Lucrezia'])),
      assignments: d.assignments,
    })),
  };
  const reg = M.regenerateWeekWithFeedback('2026-06-08', prev);
  assert.ok(reg.week, 'deve produrre una settimana');
  assert.deepEqual(reg.week.days[0].assignments.Lucrezia, lockShift, 'il turno bloccato deve restare invariato');
  assert.equal(M.validateWeek(reg.week).length, 0, 'la settimana rigenerata deve essere valida');
});
