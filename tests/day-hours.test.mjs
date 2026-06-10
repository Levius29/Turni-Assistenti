import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import * as M from '../src/scheduler.js';

// Orario di apertura/chiusura personalizzabile per singolo giorno (exceptions.openMin/closeMin).
after(() => { M.reconfigure(M.defaultStaffConfig()); });

test('dayOpenMin/dayCloseMin: default standard, personalizzati se impostati', () => {
  const week = M.createEmptyWeek('2026-06-08');
  const mon = week.days.find(d => d.key === 'mon');
  assert.equal(M.dayOpenMin(mon), M.STUDIO_OPEN);
  assert.equal(M.dayCloseMin(mon), M.STUDIO_CLOSE);
  mon.exceptions.openMin = 570; mon.exceptions.closeMin = 1050; // 09:30–17:30
  assert.equal(M.dayOpenMin(mon), 570);
  assert.equal(M.dayCloseMin(mon), 1050);
});

test('getAllowedShifts rispetta la finestra del giorno', () => {
  M.reconfigure(M.defaultStaffConfig());
  const week = M.createEmptyWeek('2026-06-08');
  const mon = week.days.find(d => d.key === 'mon');
  mon.exceptions.openMin = 600; mon.exceptions.closeMin = 1080; // 10:00–18:00
  for (const n of M.ASSISTANT_NAMES) {
    for (const a of M.getAllowedShifts(n, mon, true, true)) {
      if (a === 'OFF') continue;
      assert.ok(a.s >= 600 && a.e <= 1080, `${n}: turno ${a.s}-${a.e} fuori dalla finestra 10:00-18:00`);
    }
  }
});

test('solver: giorno con orario ridotto risolvibile, apertura e chiusura su quell\'orario', () => {
  M.reconfigure(M.defaultStaffConfig());
  const seed = M.createBaseWeek('2026-06-08');
  const tue = seed.days.find(d => d.key === 'tue');
  tue.exceptions.openMin = 570;   // apre 09:30
  tue.exceptions.closeMin = 1080; // chiude 18:00
  const r = M.solveWeekOptimized(seed);
  assert.equal(r.solved, true, 'settimana con martedì 09:30-18:00 risolvibile');
  assert.equal(M.validateWeek(r.week).length, 0, 'nessun avviso');
  const day = r.week.days.find(d => d.key === 'tue');
  const shifts = M.ASSISTANT_NAMES.map(n => M.getShift(day.assignments[n])).filter(s => s.hours > 0);
  assert.ok(shifts.every(s => s.startMin >= 570 && s.endMin <= 1080), 'tutti i turni dentro la finestra');
  assert.equal(shifts.filter(s => s.startMin === 570).length, 1, 'esattamente una apre alle 09:30');
  assert.ok(shifts.some(s => s.endMin === 1080), 'qualcuno chiude alle 18:00');
});

test('validateWeek segnala i turni fuori dall\'orario del giorno', () => {
  M.reconfigure(M.defaultStaffConfig());
  const r = M.solveWeek(M.createBaseWeek('2026-06-08'));
  const mon = r.week.days.find(d => d.key === 'mon');
  mon.exceptions.closeMin = 1020; // chiude alle 17:00 ma i turni arrivano alle 19:00
  assert.ok(M.validateWeek(r.week).some(w => /fuori orario/.test(w.message)));
});
