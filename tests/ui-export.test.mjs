import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

// Logica importata dal modulo ES; gli assert di stringa restano su index.html (CSS) / src/app.js (UI/PDF).
import * as M from '../src/scheduler.js';
function loadLogic() { return M; }

test('mobile bottom bar reserves the iPhone safe area', () => {
  assert.match(html, /height:\s*calc\(60px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(html, /padding:\s*0 10px env\(safe-area-inset-bottom\)/);
  assert.match(html, /padding-bottom:\s*calc\(68px \+ env\(safe-area-inset-bottom\)\)/);
});

test('intermediate shifts use a stronger purple accent', () => {
  assert.match(html, /\.shift-select\.shift-midday\s*\{\s*border-left:\s*3px solid #7b55b3;/);
});

test('PDF export uses day rows, assistant columns, variations and graphic badges', () => {
  assert.match(app, /const head=\[\['Giorno',\.\.\.ASSISTANT_NAMES\]\];/);
  assert.match(app, /const body=week\.days\.map\(day=>/);
  assert.match(app, /function getDayVariationLabel\(day\)/);
  assert.match(app, /function drawPdfBadge\(doc,x,y,code\)/);
  assert.match(app, /getShiftBadgeCodes\(shift\)/);
  assert.doesNotMatch(app, /mini legenda|Legenda/i);
});

test('shift hours derive from entry/exit with a 30min break only on long shifts (span >= 7h30)', () => {
  const { getShift } = loadLogic();
  // span < 7h30: nessuna pausa, ore = durata
  assert.equal(getShift({ s: 510, e: 750 }).hours, 4);   // 08:30-12:30
  assert.equal(getShift({ s: 510, e: 810 }).hours, 5);   // 08:30-13:30
  assert.equal(getShift({ s: 510, e: 930 }).hours, 7);   // 08:30-15:30 (span 7h, corto)
  assert.equal(getShift({ s: 510, e: 930 }).isLong, false);
  // span >= 7h30: turno lungo, 30min di pausa scalata
  assert.equal(getShift({ s: 510, e: 960 }).hours, 7);   // 08:30-16:00 (span 7h30 → 7h)
  assert.equal(getShift({ s: 510, e: 960 }).isLong, true);
  assert.equal(getShift({ s: 630, e: 1140 }).hours, 8);  // 10:30-19:00 (span 8h30 → 8h)
  assert.equal(getShift('OFF').hours, 0);
});

test('UI: il modale team contiene i controlli preferenze', () => {
  assert.match(app, /preferredDayOff/, 'select giorno libero preferito');
  assert.match(app, /avoidClose/, 'checkbox evita chiusura');
  assert.match(app, /avoidOpen/, 'checkbox evita apertura');
  assert.match(app, /preferredWindow/, 'select finestra preferita');
});

test('app: costruisce il ledger equità dalle settimane salvate', () => {
  assert.match(app, /buildEquityLedger/, 'usa buildEquityLedger');
});

test('solveWeek produces a valid standard week with exact contractual hours', () => {
  const M = loadLogic();
  const r = M.solveWeek(M.createBaseWeek('2026-06-08'));
  assert.equal(r.solved, true, 'la settimana standard deve essere risolvibile');
  assert.equal(M.validateWeek(r.week).length, 0, 'nessun avviso di validazione');
  const stats = M.getAssistantStats(r.week);
  assert.equal(stats.Lucrezia.hours, 38);
  assert.equal(stats.Manuela.hours, 25);
  assert.equal(stats.Madalina.hours, 24);
});
