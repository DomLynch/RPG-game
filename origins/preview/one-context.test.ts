// One WebGL context at a time in the open world (Web, 2026-10-07): leaving a fight there releases the duel's renderer and context. createScene needs WebGL, so the live count is read in a
// browser (a getContext tally over a fight and its leave: scripts in the PR); this pins the shape so the release cannot be dropped.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

test('closeDuel(release) disposes the duel renderer, loses its context and drops the stage; main.ts releases only in the open world', () => {
  const duel = read('./pit-duel.ts'), body = duel.slice(duel.indexOf('export function closeDuel('), duel.indexOf('function frame('));
  assert.match(body, /closeDuel\(release = false\)/, 'off by default: the Pit keeps its stage for the rematch');
  assert.match(body, /if \(release && stage\) \{ stage\.view\.renderer\.dispose\(\); stage\.view\.renderer\.forceContextLoss\(\); stage\.canvas\.remove\(\); stage = null; \}/);
  assert.match(read('./main.ts'), /duel\?\.closeDuel\(!!frontier\)/, 'leaveFight releases when the page has a frontier');
});
