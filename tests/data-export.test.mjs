import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as M from '../src/scheduler.js';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('weekToCSV: intestazione, una riga per giorno e riga totale ore', () => {
  const r = M.solveWeek(M.createBaseWeek('2026-06-08'));
  const csv = M.weekToCSV(r.week);
  const lines = csv.split('\r\n');
  assert.match(lines[0], /^Giorno;Data;/);
  assert.ok(lines[0].includes('Lucrezia'), 'colonna per assistente');
  assert.equal(lines.length, 1 + r.week.days.length + 1, 'header + giorni + totale');
  assert.match(lines.at(-1), /^Totale ore;;/);
  const stats = M.getAssistantStats(r.week);
  assert.ok(lines.at(-1).split(';').includes(String(stats.Lucrezia.hours)));
});

test('numIt: virgola come separatore decimale per Excel italiano', () => {
  assert.equal(M.numIt(25.5), '25,5');
  assert.equal(M.numIt(38), '38');
});

test('csvEscape: racchiude tra virgolette i campi con separatore o virgolette', () => {
  assert.equal(M.csvEscape('semplice'), 'semplice');
  assert.equal(M.csvEscape('a;b'), '"a;b"');
  assert.equal(M.csvEscape('vir"golette'), '"vir""golette"');
});

test('monthBounds: estremi corretti, anche febbraio bisestile', () => {
  assert.deepEqual(M.monthBounds(2026, 6), { start: '2026-06-01', end: '2026-06-30' });
  assert.deepEqual(M.monthBounds(2026, 2), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(M.monthBounds(2024, 2), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(M.monthBounds(2026, 12), { start: '2026-12-01', end: '2026-12-31' });
});

test('summarizePeriod: aggrega solo i giorni nel periodo', () => {
  const r = M.solveWeek(M.createBaseWeek('2026-06-08'));
  const inRange = M.summarizePeriod([r.week], '2026-06-08', '2026-06-14');
  assert.equal(inRange.Lucrezia.hours, 38);
  assert.equal(inRange.Manuela.hours, 25);
  const outRange = M.summarizePeriod([r.week], '2026-07-01', '2026-07-31');
  assert.equal(outRange.Lucrezia.hours, 0);
  assert.equal(outRange.Lucrezia.workDays, 0);
});

test('summaryToCSV: intestazione e una riga per assistente', () => {
  const r = M.solveWeek(M.createBaseWeek('2026-06-08'));
  const totals = M.summarizePeriod([r.week], '2026-06-08', '2026-06-14');
  const csv = M.summaryToCSV(totals);
  const lines = csv.split('\r\n');
  assert.match(lines[0], /^Assistente;Ore;Giorni;/);
  assert.equal(lines.length, 1 + Object.keys(totals).length);
});

test('app: cabla CSV, riepilogo mensile e backup/ripristino', () => {
  assert.match(app, /function exportCSV\(/);
  assert.match(app, /function exportBackup\(/);
  assert.match(app, /function importBackup\(/);
  assert.match(app, /function openMonthlySummary\(/);
  assert.match(app, /function openToolsMenu\(/);
  assert.match(app, /injectToolsButton\(\)/);
  assert.match(app, /weekToCSV|summarizePeriod|summaryToCSV/);
});

test('index.html: stili del menu strumenti e della tabella mensile', () => {
  assert.match(html, /\.tool-item\s*\{/);
  assert.match(html, /\.month-table\s*\{/);
});
