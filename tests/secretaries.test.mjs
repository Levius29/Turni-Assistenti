import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import * as M from '../src/scheduler.js';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

// Seconda tabella (segretarie): stesso motore, roster e storage separati.
after(() => { M.reconfigure(M.defaultStaffConfig()); });

test('defaultSecretaryConfig: Gaia 40h e Giorgia 25h, settimana standard risolvibile', () => {
  M.reconfigure(M.defaultSecretaryConfig());
  assert.deepEqual(M.ASSISTANT_NAMES, ['Gaia', 'Giorgia']);
  const r = M.solveWeekOptimized(M.createBaseWeek('2026-06-08'));
  assert.equal(r.solved, true, 'la settimana standard delle segretarie deve essere risolvibile');
  const stats = M.getAssistantStats(r.week);
  assert.equal(stats.Gaia.hours, 40);
  assert.equal(stats.Giorgia.hours, 25);
  assert.equal(M.validateWeek(r.week).length, 0, 'nessun avviso');
});

test('segretarie: festività condivisa riduce le ore, copertura garantita negli altri giorni', () => {
  M.reconfigure(M.defaultSecretaryConfig());
  const seed = M.createBaseWeek('2026-06-08');
  seed.days.find(d => d.key === 'wed').exceptions.holiday = true;
  const r = M.solveWeekOptimized(seed);
  assert.equal(r.solved, true);
  assert.equal(M.getAssistantStats(r.week).Gaia.hours, M.effectiveWeeklyHours('Gaia', r.week));
  assert.equal(M.validateWeek(r.week).length, 0);
});

// Regressione "si blocca": con 2 persone il generatore deve poter usare le giornate intere,
// altrimenti sabato aperto / ferie / 2× sono matematicamente impossibili (una resta sola).
test('segretarie: sabato aperto, ferie di Giorgia e 2× Pom. sono risolvibili', () => {
  M.reconfigure(M.defaultSecretaryConfig());
  const cases = [
    ['sabato aperto', s => { s.days.find(d => d.key === 'sat').exceptions.satOpen = true; }],
    ['ferie Giorgia', s => { s.days.find(d => d.key === 'mon').absences = { Giorgia: 'vacation' }; }],
    ['2× Pom.', s => { s.days.find(d => d.key === 'mon').exceptions.extraAfternoon = true; }],
  ];
  for (const [label, mut] of cases) {
    const seed = M.createBaseWeek('2026-06-08');
    mut(seed);
    const r = M.solveWeekOptimized(seed);
    assert.equal(r.solved, true, `${label}: deve essere risolvibile`);
    assert.equal(M.validateWeek(r.week).length, 0, `${label}: nessun avviso`);
  }
});

test('roster a 3+ persone: il generatore resta entro 8h30 (performance)', () => {
  M.reconfigure(M.defaultStaffConfig());
  const week = M.createEmptyWeek('2026-06-08');
  const monday = week.days.find(d => d.key === 'mon');
  assert.ok(!M.getAllowedShifts('Lucrezia', monday).some(a => a !== 'OFF' && (a.e - a.s) > M.AUTO_MAX_SPAN));
  M.reconfigure(M.defaultSecretaryConfig());
  assert.ok(M.getAllowedShifts('Gaia', monday).some(a => a !== 'OFF' && (a.e - a.s) > M.AUTO_MAX_SPAN),
    'con 2 persone le giornate intere sono disponibili anche al generatore');
});

test('app: infrastruttura roster cablata (tabs, swipe, storage separato, PDF doppio)', () => {
  assert.match(app, /const ROSTERS=\{/);
  assert.match(app, /turni-segretarie\.weeks\.v1/);
  assert.match(app, /function switchRoster\(/);
  assert.match(app, /roster-tabs/);
  assert.match(app, /touchend/, 'swipe per cambiare tabella');
  assert.match(app, /studioFactsSeed/, 'festività/sabato ereditati alla creazione settimana');
  assert.match(app, /mirrorStudioFacts/, 'festività/sabato riflessi sull\'altra tabella');
  assert.match(app, /drawRosterTable\(doc,weekOf\('segretarie'\)/, 'PDF con la tabella Segretarie');
  assert.match(app, /orientation:'portrait'/, 'PDF su foglio singolo verticale');
  assert.match(app, /secWeeks/, 'backup e sync includono entrambe le tabelle');
});
