import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import * as M from '../src/scheduler.js';

const schedulerSrc = readFileSync(new URL('../src/scheduler.js', import.meta.url), 'utf8');

// Riconfigura il team a runtime (API reale usata dalla config UI) e verifica che tutta
// la logica derivata sia generica su N persone. Ripristina il default a fine file.
const STAFF4 = {
  Ana:  { weeklyHours: 30, minAfternoons: 1, maxAfternoons: 2, canWorkLong: true,  maxWorkDays: 5, afternoonThresholdMin: 1020, escalationPriority: 1, closePref: { preferred: 2, max: 3 } },
  Bea:  { weeklyHours: 25, minAfternoons: 1, maxAfternoons: 1, canWorkLong: false, workDays: 5, afternoonThresholdMin: 900, escalationPriority: 3, overtime: { weeklyHours: 28, maxAfternoons: 2, requiresShift: { s: 900, e: 1140 } } },
  Cris: { weeklyHours: 24, minAfternoons: 2, maxAfternoons: 3, canWorkLong: false, workDays: 5, afternoonThresholdMin: 960, escalationPriority: 2 },
  Dina: { weeklyHours: 20, minAfternoons: 0, maxAfternoons: 2, canWorkLong: false, workDays: 5, afternoonThresholdMin: 900, escalationPriority: 4 },
};

after(() => { M.reconfigure(M.defaultStaffConfig()); });

test('reconfigure: nomi e ruoli derivati dalla config', () => {
  M.reconfigure(structuredClone(STAFF4));
  assert.deepEqual(M.ASSISTANT_NAMES, ['Ana', 'Bea', 'Cris', 'Dina']);
  assert.equal(M.OVERTIME_PERSON, 'Bea');
  assert.equal(M.CLOSE_PREF_PERSON, 'Ana');
});

test('reconfigure: AFTERNOON_TIERS generati nell\'ordine di escalationPriority', () => {
  M.reconfigure(structuredClone(STAFF4));
  // base {Ana1,Bea1,Cris2,Dina0} poi escala Ana(p1)->2, Cris(p2)->3, Bea(p3,ot)->2, Dina(p4)->2
  const tiers = M.AFTERNOON_TIERS;
  assert.equal(tiers.length, 5);
  assert.deepEqual(tiers[0].caps, { Ana: 1, Bea: 1, Cris: 2, Dina: 0 });
  assert.deepEqual(tiers[1].caps, { Ana: 2, Bea: 1, Cris: 2, Dina: 0 });
  assert.deepEqual(tiers[2].caps, { Ana: 2, Bea: 1, Cris: 3, Dina: 0 });
  assert.deepEqual(tiers[3].caps, { Ana: 2, Bea: 2, Cris: 3, Dina: 0 });
  assert.equal(tiers[3].ot, true, 'il tier che alza Bea (overtime) deve avere ot:true');
  assert.deepEqual(tiers[4].caps, { Ana: 2, Bea: 2, Cris: 3, Dina: 2 });
  assert.equal(tiers[4].ot, false);
});

test('reconfigure: getDayCombos enumera combinazioni per 4 persone', () => {
  M.reconfigure(structuredClone(STAFF4));
  const week = M.createEmptyWeek('2026-06-08');
  const monday = week.days.find(d => d.key === 'mon');
  const combos = M.getDayCombos(week, monday, 0);
  assert.ok(combos.length > 0, 'deve produrre combinazioni valide per un giorno feriale');
  for (const c of combos.slice(0, 5)) {
    for (const n of M.ASSISTANT_NAMES) assert.ok(n in c && n in c.d, `combo deve coprire ${n}`);
  }
});

test('solveWeek: nessun nome proprio cablato nei tetti dei tier', () => {
  // Regressione: il pre-check dei tier sommava tier.caps.Lucrezia+Manuela+Madalina,
  // che con un team rinominato dava NaN e disattivava lo skip dei tier impossibili.
  assert.doesNotMatch(schedulerSrc, /tier\.caps\.(Lucrezia|Manuela|Madalina)/);
});

test('reconfigure: tornando al default ripristina le 3 persone', () => {
  M.reconfigure(structuredClone(STAFF4));
  M.reconfigure(M.defaultStaffConfig());
  assert.deepEqual(M.ASSISTANT_NAMES, ['Lucrezia', 'Manuela', 'Madalina']);
  assert.equal(M.OVERTIME_PERSON, null); // straordinario off di default (configurabile dal Team)
});
