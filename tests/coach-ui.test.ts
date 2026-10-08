// The Coach on the page (src/coach-ui.ts, TOP10 row 8 Web): the toggle saves per device, a press hands the fight over the SAME tick it happened (the Coach is not stepped, the player's intent is read),
// the events carry tick and reason, the spans reach the build string, ?coach=off is the kill switch. Fake start/stop events, no sim: the page contract only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COACH_KEY, coachKilled, createCoachSession, loadCoachPref, type CoachEvent } from '../src/coach-ui.ts';
import { initialPractice } from '../src/combat.ts';
import { idleIntent } from '../src/duel.ts';
import { OPPONENTS, opponentAt } from '../src/moves.ts';

const store = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };
const duel = () => initialPractice(7, opponentAt(OPPONENTS.veteran, 6), 'longsword', null).duel;
const mine = () => ({ ...idleIntent(), action: 'heavy' as const });

test('the pref is a per-device bit, off until the player turns it on; a broken store reads as off', () => {
  assert.equal(loadCoachPref(store()), false);
  assert.equal(loadCoachPref(store({ [COACH_KEY]: '1' })), true);
  assert.equal(loadCoachPref({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} }), false);
});

test('toggle on mid-fight emits start(tick, stance); a press stops it the same tick with reason tap and the player\'s own intent is the one stepped', () => {
  const events: CoachEvent[] = [], s = createCoachSession(store(), (e) => events.push(e));
  s.begin(7, 'defensive', 0);
  assert.equal(s.on, false);
  s.set(true, 40);
  assert.deepEqual(events, [{ type: 'start', tick: 40, stance: 'defensive' }]);
  assert.notDeepEqual(s.pick(duel(), mine), mine(), 'while on, the coach\'s intent is used, never the player\'s');
  s.set(false, 90, 'tap');
  assert.deepEqual(events[1], { type: 'stop', tick: 90, reason: 'tap' });
  assert.deepEqual(s.pick(duel(), mine), mine(), 'the tap that took over is that tick\'s input');
  assert.equal(s.pref, false, 'the chip tells the truth after a take-over');
});

test('a saved ON pref arms the next fight from tick 0; the tag and the menu give their own reasons; end closes an open span', () => {
  const st = store({ [COACH_KEY]: '1' }), events: CoachEvent[] = [], s = createCoachSession(st, (e) => events.push(e));
  s.begin(7, 'neutral', 0);
  assert.equal(s.on, true); assert.equal(events[0]!.type, 'start');
  s.set(false, 10, 'tag'); s.set(true, 20); s.set(false, 30, 'menu'); s.set(true, 40); s.end(55);
  assert.deepEqual(events.map((e) => e.type === 'stop' ? e.reason : e.type), ['start', 'tag', 'start', 'menu', 'start', 'end']);
  assert.equal(s.coached, true);
  assert.equal(s.build('abc1234', 'k9z'), 'abc1234 coach:neutral@0-10,20-30,40-55 kit:k9z');
});

test('a fight the Coach never played has no marker and an untouched build string; a replay or watched fight is not coachable', () => {
  const s = createCoachSession(store({ [COACH_KEY]: '1' }), () => {});
  s.begin(7, 'neutral', 0, false);
  assert.equal(s.on, false); assert.equal(s.coached, false); assert.equal(s.build('abc1234', null), 'abc1234');
});

test('?coach=off is a kill switch: the Coach never starts, whatever was saved', () => {
  assert.equal(coachKilled('?region=1&coach=off'), true); assert.equal(coachKilled('?coach=on'), false); assert.equal(coachKilled(''), false);
  const events: CoachEvent[] = [], s = createCoachSession(store({ [COACH_KEY]: '1' }), (e) => events.push(e), true);
  s.begin(7, 'neutral', 0); s.set(true, 5);
  assert.equal(s.on, false); assert.deepEqual(events, []);
});
