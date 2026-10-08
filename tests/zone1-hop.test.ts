// Play -> Zone 1 (src/zone1-hop.ts): only an exactly plain `/` with a saved fighter and the lesson done goes; everything else stays on the arena as today.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONE1_IS_DEFAULT, ZONE1_URL, zone1AfterLesson, zone1Hop } from '../src/zone1-hop.ts';

const base = { search: '', pathname: '/', hasFighter: true, lessonDone: true };
test('the hop is ON by default (Dom 2026-10-08: Zone 1 is the game); ZONE1_IS_DEFAULT is the one switch, flip it and this pin together', () => {
  assert.equal(ZONE1_IS_DEFAULT, true);
  assert.equal(zone1Hop(base), ZONE1_URL);
  assert.equal(zone1AfterLesson(), ZONE1_URL);
  assert.equal(ZONE1_URL, '/zone1/', 'a clean address, never a /preview/ link or a ?flag in the bar (Dom 2026-10-08)');
});
test('off: the switch back stays the old arena path', () => {
  assert.equal(zone1Hop(base, false), null);
  assert.equal(zone1AfterLesson(false), null);
});
test('on: a returning player on a plain / goes to Zone 1', () => {
  assert.equal(zone1Hop(base, true), ZONE1_URL);
});
test('on: a new player (no saved fighter, or the lesson not done) stays for the lesson', () => {
  assert.equal(zone1Hop({ ...base, hasFighter: false }, true), null);
  assert.equal(zone1Hop({ ...base, lessonDone: false }, true), null);
});
test('on: any query, a share link or /arena/ stays exactly as today', () => {
  for (const search of ['?fight=1', '?duel=abc', '?record=x', '?stances=off', '?debug=1', '?']) assert.equal(zone1Hop({ ...base, search }, true), null, search);
  for (const pathname of ['/s/abc123', '/arena/', '/arena', '/game/', '/preview/origins/']) assert.equal(zone1Hop({ ...base, pathname }, true), null, pathname);
});
test('on: the lesson\'s end goes to Zone 1; off it keeps ?fight=1', () => {
  assert.equal(zone1AfterLesson(true), ZONE1_URL);
  assert.equal(zone1AfterLesson(false), null);
});
test('Zone 1 shows the Frontier at /zone1/ with no query (the preview\'s REGION is on unless ?region=0), and the conf serves it there', async () => {
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8'), /const REGION = new URLSearchParams\(location\.search\)\.get\('region'\) !== '0';/, 'trunk\'s default-on region (#1862): /zone1/ needs no query');
  const conf = readFileSync(new URL('../deploy/frankendom.com.conf', import.meta.url), 'utf8');
  assert.match(conf, /location = \/zone1\/ \{[^}]*try_files \/preview\/origins\/index\.html =404;/);
  assert.match(conf, /location = \/zone1 \{ return 301 \/zone1\/; \}/);
});
