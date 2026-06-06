import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import * as M from '../src/scheduler.js';

after(() => { M.reconfigure(M.defaultStaffConfig()); });

// defaultStaffConfig include un oggetto preferences (vuoto) per ogni persona.
test('defaultStaffConfig: ogni persona ha preferences', () => {
  const cfg = M.defaultStaffConfig();
  for (const n of Object.keys(cfg)) assert.ok(cfg[n].preferences && typeof cfg[n].preferences === 'object');
});

// preferenceCost: 0 se nessuno ha preferenze.
test('preferenceCost: 0 senza preferenze', () => {
  M.reconfigure(M.defaultStaffConfig());
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  assert.equal(M.preferenceCost(wk), 0);
});

// avoidClose: penalizza chi è impostato a 'evita chiusura' e chiude.
test('preferenceCost: avoidClose penalizza le chiusure', () => {
  const cfg = M.defaultStaffConfig();
  const closer = M.CLOSE_PREF_PERSON || Object.keys(cfg)[0];
  cfg[closer].preferences = { avoidClose: true };
  M.reconfigure(cfg);
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const closes = M.getAssistantStats(wk)[closer].closes;
  // Se quella persona chiude almeno una volta, il costo è > 0; altrimenti 0. In entrambi i casi = closes * peso.
  assert.equal(M.preferenceCost(wk) > 0, closes > 0);
});

// preferredDayOff: penalizza se la persona lavora il giorno che preferisce libero.
test('preferenceCost: preferredDayOff penalizza il lavoro quel giorno', () => {
  const cfg = M.defaultStaffConfig();
  const p = Object.keys(cfg)[0];
  cfg[p].preferences = { preferredDayOff: 'mon' };
  M.reconfigure(cfg);
  const wk = M.solveWeek(M.createBaseWeek('2026-06-08')).week;
  const monShift = M.getShift(wk.days.find(d => d.key === 'mon').assignments[p]);
  assert.equal(M.preferenceCost(wk) > 0, monShift.hours > 0);
});
