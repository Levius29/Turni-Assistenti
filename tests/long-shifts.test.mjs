import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import * as M from '../src/scheduler.js';

// Limite di turni lunghi a settimana (maxLongShifts): oltre il tetto serve lo straordinario.
// Ripristina il team di default a fine file.
after(() => { M.reconfigure(M.defaultStaffConfig()); });

test('maxLongShifts: validateWeek segnala le lunghe oltre il limite', () => {
  M.reconfigure(M.defaultStaffConfig());
  const r = M.solveWeek(M.createBaseWeek('2026-06-08'));
  const lg = M.getAssistantStats(r.week).Lucrezia.longShifts;
  assert.ok(lg >= 1, 'la settimana standard usa turni lunghi per Lucrezia');
  const cfg = M.defaultStaffConfig();
  cfg.Lucrezia.maxLongShifts = lg - 1;
  M.reconfigure(cfg);
  assert.ok(M.validateWeek(r.week).some(w => /troppe lunghe/.test(w.message)));
});

test('maxLongShifts + straordinario: le lunghe extra sono coperte e la persona è in straordinario', () => {
  M.reconfigure(M.defaultStaffConfig());
  const r = M.solveWeek(M.createBaseWeek('2026-06-08'));
  const lg = M.getAssistantStats(r.week).Lucrezia.longShifts;
  const cfg = M.defaultStaffConfig();
  cfg.Lucrezia.maxLongShifts = lg - 1;
  cfg.Lucrezia.overtime = { weeklyHours: 38, maxAfternoons: 3, maxLongShifts: lg };
  M.reconfigure(cfg);
  assert.ok(!M.validateWeek(r.week).some(w => /troppe lunghe/.test(w.message)));
  assert.equal(M.inOvertime('Lucrezia', r.week), true);
});

test('turni fino a tutta la giornata: 08:30-19:00 = 10h pagate, solo per chi fa le lunghe', () => {
  M.reconfigure(M.defaultStaffConfig());
  assert.equal(M.getShift({ s: 510, e: 1140 }).hours, 10);
  assert.equal(M.getShift({ s: 510, e: 1140 }).isLong, true);
  const week = M.createEmptyWeek('2026-06-08');
  const monday = week.days.find(d => d.key === 'mon');
  assert.ok(M.getAllowedShifts('Lucrezia', monday).some(a => a !== 'OFF' && a.s === 510 && a.e === 1140),
    'la giornata intera è tra i turni ammessi di chi può fare le lunghe');
  assert.ok(!M.getAllowedShifts('Manuela', monday).some(a => a !== 'OFF' && (a.e - a.s) >= M.LONG_SPAN),
    'chi non fa le lunghe resta sotto le 7h30 di presenza');
});

test('maxLongShifts: il solver rispetta il tetto di lunghe', () => {
  // 38h in 5 giorni richiedono almeno 3 lunghe (giorno corto max 7h, lungo max 8h pagate):
  // col tetto a 3 il solver deve trovare una settimana valida senza mai superarlo.
  const cfg = M.defaultStaffConfig();
  cfg.Lucrezia.maxLongShifts = 3;
  M.reconfigure(cfg);
  const r = M.solveWeekOptimized(M.createBaseWeek('2026-06-08'));
  assert.equal(r.solved, true, 'settimana risolvibile con tetto lunghe 3');
  assert.ok(M.getAssistantStats(r.week).Lucrezia.longShifts <= 3);
  assert.equal(M.validateWeek(r.week).length, 0);
});
