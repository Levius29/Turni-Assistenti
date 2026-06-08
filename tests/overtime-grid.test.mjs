import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as M from '../src/scheduler.js';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('overtime requiresShift: il pomeriggio extra deve usare esattamente il turno fisso', () => {
  const cfg = M.defaultStaffConfig();
  cfg.Manuela.overtime = { weeklyHours: 29, maxAfternoons: 2, requiresShift: { s: 15 * 60, e: 19 * 60 } };
  M.reconfigure(cfg);
  assert.equal(M.OVERTIME_PERSON, 'Manuela');
  assert.equal(M.worksOvertimeShift('Manuela', { s: 900, e: 1140 }), true);
  assert.equal(M.worksOvertimeShift('Manuela', { s: 840, e: 1140 }), false);

  const wk = M.createBaseWeek('2026-06-08');
  const set = (key, a) => { wk.days.find(d => d.key === key).assignments.Manuela = a; };
  // Due pomeriggi (oltre il max base di 1), nessuno dei due è 15:00-19:00 → avviso atteso.
  set('mon', { s: 14 * 60, e: 19 * 60 });
  set('tue', { s: 14 * 60, e: 18 * 60 });
  const re = /straordinario pomeridiano richiede turno/;
  assert.ok(M.validateWeek(wk).some(w => re.test(w.message)), 'avviso quando il pom. extra non è il turno fisso');
  // Ora uno dei due usa esattamente 15:00-19:00 → avviso sparito.
  set('mon', { s: 15 * 60, e: 19 * 60 });
  assert.ok(!M.validateWeek(wk).some(w => re.test(w.message)), 'nessun avviso col turno fisso corretto');

  M.reconfigure(M.defaultStaffConfig());
});

test('app: la griglia verticale usa colonne dinamiche sul numero di assistenti', () => {
  assert.match(app, /gridTemplateColumns=`58px repeat\(\$\{ASSISTANT_NAMES\.length\}/);
  assert.doesNotMatch(html, /\.mobile-grid > div:nth-child\(4n\)/);
  assert.match(html, /\.mobile-grid > \.mg-end/);
});

test('app: la scheda Team espone e preserva il turno fisso dello straordinario', () => {
  assert.match(app, /data-k="otReqStart"/);
  assert.match(app, /data-k="otReqEnd"/);
  assert.match(app, /requiresShift/);
  // Abilitando lo straordinario, un requiresShift già presente non viene perso.
  assert.match(app, /cc\.overtime\?\.requiresShift\?\{requiresShift:cc\.overtime\.requiresShift\}/);
});
