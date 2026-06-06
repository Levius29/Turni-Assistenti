import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Carica lo scheduler con una STAFF_CONFIG diversa, sostituendo il blocco config nel sorgente
// e importando il modulo modificato via data-URL. Prova che la logica è generica su N persone
// (nessun nome proprio cablato nel solver).
const src = readFileSync(new URL('../src/scheduler.js', import.meta.url), 'utf8');

function loadWithStaff(staffLiteral) {
  const replaced = src.replace(/export const STAFF_CONFIG = \{[\s\S]*?\n  \};/, `export const STAFF_CONFIG = ${staffLiteral};`);
  assert.notEqual(replaced, src, 'il blocco STAFF_CONFIG deve essere sostituito');
  return import('data:text/javascript;base64,' + Buffer.from(replaced).toString('base64'));
}

const STAFF4 = `{
  Ana:  { weeklyHours: 30, minAfternoons: 1, maxAfternoons: 2, canWorkLong: true,  maxWorkDays: 5, afternoonThresholdMin: 1020, escalationPriority: 1, closePref: { preferred: 2, max: 3 } },
  Bea:  { weeklyHours: 25, minAfternoons: 1, maxAfternoons: 1, canWorkLong: false, workDays: 5, afternoonThresholdMin: 900, escalationPriority: 3, overtime: { weeklyHours: 28, maxAfternoons: 2, requiresShift: { s: 900, e: 1140 } } },
  Cris: { weeklyHours: 24, minAfternoons: 2, maxAfternoons: 3, canWorkLong: false, workDays: 5, afternoonThresholdMin: 960, escalationPriority: 2 },
  Dina: { weeklyHours: 20, minAfternoons: 0, maxAfternoons: 2, canWorkLong: false, workDays: 5, afternoonThresholdMin: 900, escalationPriority: 4 }
}`;

test('team generico: nomi e ruoli derivati dalla config', async () => {
  const M = await loadWithStaff(STAFF4);
  assert.deepEqual(M.ASSISTANT_NAMES, ['Ana', 'Bea', 'Cris', 'Dina']);
  assert.equal(M.OVERTIME_PERSON, 'Bea');
  assert.equal(M.CLOSE_PREF_PERSON, 'Ana');
});

test('team generico: AFTERNOON_TIERS generati nell\'ordine di escalationPriority', async () => {
  const M = await loadWithStaff(STAFF4);
  // base {Ana1,Bea1,Cris2,Dina0} poi escala Ana(p1)->2, Cris(p2)->3, Bea(p3,ot)->2, Dina(p4)->2
  const tiers = M.AFTERNOON_TIERS;
  assert.equal(tiers.length, 5);
  assert.deepEqual(tiers[0].caps, { Ana: 1, Bea: 1, Cris: 2, Dina: 0 });
  assert.equal(tiers[0].ot, false);
  assert.deepEqual(tiers[1].caps, { Ana: 2, Bea: 1, Cris: 2, Dina: 0 });
  assert.deepEqual(tiers[2].caps, { Ana: 2, Bea: 1, Cris: 3, Dina: 0 });
  assert.deepEqual(tiers[3].caps, { Ana: 2, Bea: 2, Cris: 3, Dina: 0 });
  assert.equal(tiers[3].ot, true, 'il tier che alza Bea (overtime) deve avere ot:true');
  assert.deepEqual(tiers[4].caps, { Ana: 2, Bea: 2, Cris: 3, Dina: 2 });
  assert.equal(tiers[4].ot, false);
});

test('team generico: getDayCombos enumera combinazioni per 4 persone', async () => {
  const M = await loadWithStaff(STAFF4);
  const week = M.createEmptyWeek('2026-06-08');
  const monday = week.days.find(d => d.key === 'mon');
  const combos = M.getDayCombos(week, monday, 0);
  assert.ok(combos.length > 0, 'deve produrre combinazioni valide per un giorno feriale');
  // ogni combo ha un assegnamento per ciascuna delle 4 persone + delta .d
  for (const c of combos.slice(0, 5)) {
    for (const n of M.ASSISTANT_NAMES) assert.ok(n in c && n in c.d, `combo deve coprire ${n}`);
  }
});
