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
  });
}
