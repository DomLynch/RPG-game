// Running in Zone 1 must be discoverable (Dom 2026-10-08): the Pit's RUN button shows in the world, and the first-load hint says how to run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../origins/preview/index.html', import.meta.url), 'utf8'), main = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8');
test('the world mode no longer hides the run button and shows it as a thumb button of the cluster', () => {
  const hide = html.split('\n').find((l) => l.includes('#duel.world #opponent-name') && l.includes('display: none')) ?? '';
  assert.ok(hide.includes('#duel.world #reset-button'), 'the hide list is still the one that hides the fight chrome');
  assert.ok(!hide.includes('#run-button'), '#run-button is not in the hide list');
  assert.match(html, /#duel\.world #run-button[^{]*\{ display: block !important;/);
  assert.match(html, /#duel\.world #run-button::after \{ content: 'RUN'/);
});
test('the world hints say how to run: push to the edge, or hold RUN', () => {
  assert.equal((main.match(/Push to the edge to run, or hold RUN\./g) ?? []).length, 2, 'both in-world hints');
  assert.match(html, /Push to the edge to run, or hold RUN\./, 'the page\'s first-load hint');
});
