// Play -> Zone 1 (src/zone1-hop.ts): only an exactly plain `/` with a saved fighter and the lesson done goes; everything else stays on the arena as today.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZONE1_IS_DEFAULT, ZONE1_URL, zone1AfterLesson, zone1Hop } from '../src/zone1-hop.ts';

const base = { search: '', pathname: '/', hasFighter: true, lessonDone: true };
test('the hop is OFF until World\'s no-query Zone 1 default is live (flip ZONE1_IS_DEFAULT and this pin together)', () => {
  assert.equal(ZONE1_IS_DEFAULT, false);
  assert.equal(zone1Hop(base), null);
  assert.equal(zone1AfterLesson(), null);
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
