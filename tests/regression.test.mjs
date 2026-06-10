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
    if (snap.overtimeUsed) assert.equal(r.week.overtimeUsed, true, `${name}: deve usare lo straordinario`);
  });
}

// Straordinario ora OFF di default → configurabile per persona. Abilitato, copre la domanda alta.
test('straordinario abilitato: copre 3 pomeriggi extra (Manuela 29h)', () => {
  const cfg = M.defaultStaffConfig();
  cfg.Manuela.overtime = { weeklyHours: 29, maxAfternoons: 2 };
  M.reconfigure(cfg);
  try {
    const seed = M.createBaseWeek('2026-06-08');
    for (const k of ['mon', 'tue', 'wed']) seed.days.find(d => d.key === k).exceptions.extraAfternoon = true;
    const r = M.solveWeek(seed);
    assert.equal(r.solved, true, 'con straordinario deve essere risolvibile');
    assert.equal(r.week.overtimeUsed, true, 'deve usare lo straordinario');
    const stats = M.getAssistantStats(r.week);
    assert.equal(stats.Manuela.hours, 29, 'Manuela 29h in straordinario');
    assert.equal(M.inOvertime('Manuela', r.week), true, 'inOvertime deve essere true');
    assert.equal(M.validateWeek(r.week).length, 0, 'la settimana deve restare valida');
  } finally {
    M.reconfigure(M.defaultStaffConfig());
  }
});

// Il messaggio "straordinario attivato" deve derivare dalla soluzione reale, non dal tier:
// se l'escalation resta nei limiti base di tutti, niente flag (e niente badge S invisibile).
test('nessun falso "straordinario attivato" se nessuno supera i limiti base', () => {
  const cfg = M.defaultStaffConfig();
  cfg.Madalina.overtime = { weeklyHours: 24, maxAfternoons: 3 }; // identici alla base: mai vero straordinario
  M.reconfigure(cfg);
  try {
    const seed = M.createBaseWeek('2026-06-08');
    seed.days.find(d => d.key === 'mon').exceptions.extraAfternoon = true; // domanda 6 > caps base 5
    const r = M.solveWeekOptimized(seed);
    assert.equal(r.solved, true, 'deve essere risolvibile con l\'escalation di Madalina');
    assert.equal(r.overtime, false, 'nessuno supera i target base → niente straordinario');
    assert.ok(!r.week.overtimeUsed, 'flag overtimeUsed assente');
    assert.ok(M.ASSISTANT_NAMES.every(n => !M.inOvertime(n, r.week)));
  } finally {
    M.reconfigure(M.defaultStaffConfig());
  }
});

// Default: straordinario off → 3 pomeriggi extra superano la capacità (domanda 8 > 7) → infeasibile.
test('straordinario off di default: domanda troppo alta è infeasibile', () => {
  const seed = M.createBaseWeek('2026-06-08');
  for (const k of ['mon', 'tue', 'wed']) seed.days.find(d => d.key === k).exceptions.extraAfternoon = true;
  const r = M.solveWeek(seed);
  assert.equal(r.solved, false, 'senza straordinario non deve essere risolvibile');
  assert.equal(M.inOvertime('Manuela', r.week ?? seed), false, 'nessuno in straordinario di default');
});

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
