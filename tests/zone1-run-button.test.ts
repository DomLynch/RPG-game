// Running in Zone 1 is the stick pushed to the edge (and Shift); no RUN button in the world (Dom 2026-10-08, via Strategy). The Pit's own RUN button is untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../origins/preview/index.html', import.meta.url), 'utf8'), main = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');
test('the world mode hides the run button and draws no replacement', () => {
  const hide = html.split('\n').find((l) => l.includes('#duel.world #opponent-name') && l.includes('display: none')) ?? '';
  assert.ok(hide.includes('#duel.world #run-button'), '#run-button is on the world hide list');
  assert.ok(!/#duel\.world #run-button[^{]*\{ display: block/.test(html), 'no rule shows it again');
  assert.ok(!html.includes("content: 'RUN'"));
});
test('the world hints say push to the edge to run and no longer mention a RUN button', () => {
  assert.equal((main.match(/Push to the edge to run\./g) ?? []).length, 2, 'both in-world hints');
  assert.match(html, /Push to the edge to run\./, 'the page\'s first-load hint');
  assert.ok(!/hold RUN/.test(main + html));
});
