// Engine-slice wording on PRs (scripts/pr-wording.mjs): the word list, the allowed phrases, code spans, and the 24 h clock. No GitHub call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENGINE_PATH_RE, judge, scan } from '../scripts/pr-wording.mjs';

test('today\'s three slips fail', () => {
  assert.deepEqual(scan('each copying the Pit\'s code exactly'), ['copying', 'the Pit\'s']);
  assert.deepEqual(scan('missing compared with the Pit, each already being built'), ['built']);
  assert.deepEqual(scan('the Pit\'s own animations'), ['the Pit\'s']);
  assert.deepEqual(scan('the Pit’s own animations'), ['the Pit’s'], 'a curly apostrophe too');
});

test('#2014\'s real title passes: code moving out of the Pit into the engine is the wanted direction', () => {
  assert.deepEqual(scan('moving the Pit\'s gore and finisher code into src/fight'), []);
  assert.deepEqual(scan('S1: moves the Pit\'s six gore files to `src/fight`'), []);
  assert.deepEqual(scan('the Pit\'s gore code stays where it is'), ['the Pit\'s'], 'without the move into src/fight it is still flagged');
  assert.deepEqual(scan('moving the Pit\'s gore. It is copied into src/fight'), ['the Pit\'s', 'copied'], 'the allowance does not cross a sentence');
});

test('the rest of the list, the allowed phrases, and code spans', () => {
  for (const s of ['ported from the Pit', 'we rebuild it', 'implements the arc', 'a Pit-side feature', 'it builds the HUD']) assert.ok(scan(s).length, s);
  for (const s of ['the Pit client reads it', 'a Pit-only flag', 'the Pit\'s live circle', 'serves on port 5173', 'moving the hud into src/fight/hud.ts']) assert.deepEqual(scan(s), [], s);
  assert.deepEqual(scan('receipt: `npm run build` exit 0\n```\nvite build\n```'), [], 'code is not prose');
});

test('warn first, fail once the first warning is 24 h old, ok when clean', () => {
  const t0 = Date.parse('2026-10-09T12:00:00Z'), h = 3600_000;
  assert.equal(judge([], null, t0), 'ok');
  assert.equal(judge([], t0, t0 + 48 * h), 'ok', 'fixed wording passes whatever the clock says');
  assert.equal(judge(['built'], null, t0), 'warn', 'the first hit starts the clock');
  assert.equal(judge(['built'], t0, t0 + 23 * h), 'warn');
  assert.equal(judge(['built'], t0, t0 + 24 * h), 'fail');
});

test('only engine paths are checked, and CI runs it on title and body edits', () => {
  for (const f of ['src/fight/hud.ts', 'origins/combat/zone1.test.ts']) assert.ok(ENGINE_PATH_RE.test(f), f);
  for (const f of ['src/hud.ts', 'origins/preview/main.ts', 'docs/src/fight/x.md']) assert.ok(!ENGINE_PATH_RE.test(f), f);
  const wf = readFileSync(new URL('../.github/workflows/pr-wording.yml', import.meta.url), 'utf8');
  assert.match(wf, /types: \[opened, edited, synchronize, reopened\]/); assert.match(wf, /node scripts\/pr-wording\.mjs/); assert.match(wf, /pull-requests: write/);
});
