import assert from 'node:assert/strict';
import test from 'node:test';
import * as M from '../src/scheduler.js';

// Festività: studio chiuso quel giorno, tutti OFF, ore ridotte pro-quota, settimana valida.
test('festività: studio chiuso, tutti OFF, ore ridotte', () => {
  const seed = M.createBaseWeek('2026-06-08');
  seed.days.find(d => d.key === 'wed').exceptions.holiday = true;
  const r = M.solveWeek(seed);
  assert.equal(r.solved, true, 'la settimana con una festività deve essere risolvibile');
  const wed = r.week.days.find(d => d.key === 'wed');
  for (const n of M.ASSISTANT_NAMES) assert.equal(wed.assignments[n], 'OFF', `${n} deve essere OFF in festività`);
  const stats = M.getAssistantStats(r.week);
  assert.equal(stats.Lucrezia.hours, M.effectiveWeeklyHours('Lucrezia', r.week), 'ore Lucrezia = target ridotto');
  assert.ok(M.effectiveWeeklyHours('Lucrezia', r.week) < 38, 'il target deve essere ridotto');
  assert.equal(M.validateWeek(r.week).length, 0, 'nessun avviso');
});

// Assenza personale (ferie): persona OFF quel giorno, ore PIENE recuperate negli altri giorni.
test('assenza personale: OFF quel giorno, ore recuperate, un giorno in meno', () => {
  const seed = M.createBaseWeek('2026-06-08');
  seed.days.find(d => d.key === 'mon').absences = { Madalina: 'vacation' };
  const r = M.solveWeek(seed);
  assert.equal(r.solved, true, 'deve essere risolvibile recuperando le ore in 4 giorni');
  const mon = r.week.days.find(d => d.key === 'mon');
  assert.equal(mon.assignments.Madalina, 'OFF', 'Madalina assente lunedì');
  const stats = M.getAssistantStats(r.week);
  assert.equal(stats.Madalina.hours, 24, 'ore piene recuperate (no riduzione per assenza personale)');
  assert.equal(stats.Madalina.workDays, 4, 'un giorno lavorativo in meno');
  assert.equal(M.validateWeek(r.week).length, 0, 'nessun avviso');
});

// getAllowedShifts: festività e assenza forzano solo 'OFF'.
test('getAllowedShifts forza OFF per festività e assenza', () => {
  const w = M.createBaseWeek('2026-06-08');
  const mon = w.days.find(d => d.key === 'mon');
  mon.absences = { Manuela: 'sick' };
  assert.deepEqual(M.getAllowedShifts('Manuela', mon, true), ['OFF']);
  const tue = w.days.find(d => d.key === 'tue');
  tue.exceptions.holiday = true;
  for (const n of M.ASSISTANT_NAMES) assert.deepEqual(M.getAllowedShifts(n, tue, true), ['OFF']);
});

// Bug fix: rigenerando, le assenze personali (ferie/malattia) devono essere preservate come le festività.
test('applyPreviousWeekState preserva le assenze personali', () => {
  const prev = M.createBaseWeek('2026-06-08');
  prev.days.find(d => d.key === 'mon').absences = { Madalina: 'vacation' };
  const seed = M.createBaseWeek('2026-06-08');
  M.applyPreviousWeekState(seed, prev);
  assert.equal(seed.days.find(d => d.key === 'mon').absences.Madalina, 'vacation', 'assenza riportata nella nuova settimana');
});

// End-to-end: dopo "Genera", chi era assente resta OFF quel giorno.
test('regenerateWeekWithFeedback: assenza personale resta OFF dopo rigenerazione', () => {
  const prev = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  prev.days.find(d => d.key === 'mon').absences = { Madalina: 'vacation' };
  const { week } = M.regenerateWeekWithFeedback('2026-06-08', prev);
  assert.equal(week.days.find(d => d.key === 'mon').assignments.Madalina, 'OFF', 'Madalina assente lunedì anche dopo Genera');
  assert.equal(M.validateWeek(week).length, 0, 'settimana valida');
});
