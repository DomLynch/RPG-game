// Running in Zone 1 is the stick pushed to the edge (and Shift); no RUN button in the world (Dom 2026-10-08, via Strategy). The Pit's own RUN button is untouched.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../origins/preview/index.html', import.meta.url), 'utf8'), main = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');
test('the world mode hides the run button and draws no replacement', () => {
  const hide = html.split('\n').find((l) => l.includes('#duel.world #run-button') && l.includes('display: none')) ?? '';
  assert.ok(hide.includes('#duel.world #run-button'), '#run-button is on the world hide list');
  assert.ok(!/#duel\.world #run-button[^{]*\{ display: block/.test(html), 'no rule shows it again');
  assert.ok(!html.includes("content: 'RUN'"));
});
test('the world hints say push to the edge to run and no longer mention a RUN button', () => {
  const hints = JSON.parse(readFileSync(new URL('../origins/preview/hint-copy.json', import.meta.url), 'utf8')) as { traits: Record<string, { walk: string; watch: string }> };   // the in-world hints are rows now (hint-copy.json), chosen by zone trait
  const lines = Object.values(hints.traits).flatMap((t) => [t.walk, t.watch]);
  assert.ok(lines.length >= 4 && lines.every((t) => t.includes('Push to the edge to run.')), 'every in-world hint, for every trait');
  assert.match(html, /Push to the edge to run\./, 'the page\'s first-load hint');
  assert.ok(!/hold RUN/.test(main + html + lines.join(' ')));
});
