import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('mobile bottom bar reserves the iPhone safe area', () => {
  assert.match(html, /height:\s*calc\(60px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(html, /padding:\s*0 10px env\(safe-area-inset-bottom\)/);
  assert.match(html, /padding-bottom:\s*calc\(68px \+ env\(safe-area-inset-bottom\)\)/);
});

test('intermediate shifts use a stronger purple accent', () => {
  assert.match(html, /\.shift-select\.shift-midday\s*\{\s*border-left:\s*3px solid #7b55b3;/);
});

test('PDF export uses day rows, assistant columns, variations and graphic badges', () => {
  assert.match(html, /const head=\[\['Giorno',\.\.\.ASSISTANT_NAMES\]\];/);
  assert.match(html, /const body=week\.days\.map\(day=>/);
  assert.match(html, /function getDayVariationLabel\(day\)/);
  assert.match(html, /function drawPdfBadge\(doc,x,y,code\)/);
  assert.match(html, /getShiftBadgeCodes\(shift\)/);
  assert.doesNotMatch(html, /mini legenda|Legenda/i);
});
