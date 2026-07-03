import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import * as M from '../src/scheduler.js';

// Generatore ADATTIVO: quando la settimana perfetta è impossibile, produce la migliore
// possibile (ore <= contratto, massimizzate) invece di bloccarsi, e spiega cosa manca.
after(() => { M.reconfigure(M.defaultStaffConfig()); });

test('adaptive: caso normale invariato (nessun adattamento)', () => {
  M.reconfigure(M.defaultStaffConfig());
  const r = M.solveWeekAdaptive(M.createBaseWeek('2026-06-08'));
  assert.equal(r.solved, true);
  assert.ok(!r.adjusted, 'con vincoli soddisfacibili non si adatta nulla');
  assert.equal(M.validateWeek(r.week).length, 0);
});

test('adaptive: target irraggiungibile → migliore settimana possibile con shortfall dichiarato', () => {
  // Lucrezia 38h con max 2 lunghe: massimo raggiungibile 2×8+3×7 = 37h → -1h dichiarata.
  const cfg = M.defaultStaffConfig();
  cfg.Lucrezia.maxLongShifts = 2;
  M.reconfigure(cfg);
  const r = M.solveWeekAdaptive(M.createBaseWeek('2026-06-08'));
  assert.equal(r.solved, true, 'deve comunque produrre una settimana');
  assert.equal(r.adjusted, true, 'settimana adattata');
  const st = M.getAssistantStats(r.week);
  assert.equal(st.Lucrezia.hours, 37, 'ore massimizzate sotto il target');
  assert.equal(r.shortfalls.Lucrezia, 1);
  assert.match(M.adjustedMessage(r.shortfalls), /Lucrezia −1h/);
  // Gli altri restano a contratto pieno e la copertura è garantita (nessun avviso di copertura).
  assert.equal(st.Manuela.hours, 25);
  assert.equal(st.Madalina.hours, 24);
  assert.ok(M.validateWeek(r.week).every(w => /Lucrezia: 37h su 38h/.test(w.message)),
    'unico avviso residuo: le ore mancanti di Lucrezia');
});

test('diagnosi: una persona sola che non può coprire il giorno viene spiegata', () => {
  M.reconfigure(M.defaultSecretaryConfig());
  const seed = M.createBaseWeek('2026-06-08');
  seed.days.find(d => d.key === 'mon').absences = { Gaia: 'vacation' };
  const r = M.solveWeekAdaptive(seed);
  assert.equal(r.solved, false);
  assert.match(r.reason, /unica disponibile/, 'messaggio actionable con la causa e il rimedio');
});
