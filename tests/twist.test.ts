import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialDuel, type Duel, type Finish } from '../src/duel.ts';
import { noTwist, oneBarHealth, stepTwist, type TwistFlag } from '../src/twist.ts';

const KILL: Finish = { victim: 1, location: 'torso', move: 'light_right', heading: 0 };
const at = (tick: number, foeHealth: number, dead = false): Duel => {
  const d = initialDuel();
  const foe = { ...d.fighters[1], health: foeHealth };
  return { ...d, tick, fighters: [d.fighters[0], foe], finish: dead ? KILL : null };
};
const max = initialDuel().fighters[1].maxHealth;
const peg: TwistFlag[] = [{ kind: 'flee-at', percent: 30, catchSeconds: 15 }];
const mere: TwistFlag[] = [{ kind: 'flee-at', percent: 30 }];

test('no flag, no twist: nothing is raised at any health', () => {
  assert.deepEqual(stepTwist(at(10, 1), [], noTwist()), { twist: noTwist(), events: [] });
  assert.deepEqual(stepTwist(at(10, 1), [{ kind: 'one-health-bar' }], noTwist()).events, []);
});

test('flee-at: above the percent nothing happens; at it the foe flees and a catch window opens (Peg Powler)', () => {
  assert.deepEqual(stepTwist(at(100, max * .31), peg, noTwist()).events, []);
  const r = stepTwist(at(100, max * .3), peg, noTwist());
  assert.deepEqual(r.events, [{ tick: 100, type: 'FoeFled', atPercent: 30 }, { tick: 100, type: 'CatchWindowStart', endsAt: 100 + 900 }]);
  assert.equal(r.twist.outcome, null);
});

test('flee-at: caught inside the window is the normal defeat, not Escaped', () => {
  const fled = stepTwist(at(100, max * .3), peg, noTwist()).twist;
  const r = stepTwist(at(400, 0, true), peg, fled);
  assert.deepEqual(r.events, [{ tick: 400, type: 'CatchWindowEnd', caught: true }]);
  assert.equal(r.twist.outcome, 'caught');
});

test('flee-at: a window that runs out is Escaped (forfeit), once', () => {
  const fled = stepTwist(at(100, max * .3), peg, noTwist()).twist;
  assert.deepEqual(stepTwist(at(999, max * .3), peg, fled).events, []);
  const r = stepTwist(at(1000, max * .3), peg, fled);
  assert.deepEqual(r.events, [{ tick: 1000, type: 'CatchWindowEnd', caught: false }, { tick: 1000, type: 'Escaped' }]);
  assert.equal(r.twist.outcome, 'escaped');
  assert.deepEqual(stepTwist(at(1001, max * .3), peg, r.twist).events, []);
});

test('flee-at without catchSeconds (Grendel\'s Mother): FoeFled ends the fight at once; no window, no Escaped, no kill', () => {
  const r = stepTwist(at(200, max * .25), mere, noTwist());
  assert.deepEqual(r.events, [{ tick: 200, type: 'FoeFled', atPercent: 30 }]);
  assert.equal(r.twist.outcome, 'fled');
  assert.equal(stepTwist(at(201, max * .25), mere, r.twist).events.length, 0);
});

test('a blow that kills outright is a kill, not a flight', () => {
  assert.deepEqual(stepTwist(at(50, 0, true), peg, noTwist()).events, []);
  assert.deepEqual(stepTwist(at(50, 0, true), mere, noTwist()).events, []);
});

test('one-health-bar v1 stub: the foes\' healths are one pool; without the flag the first foe\'s own bar', () => {
  assert.equal(oneBarHealth([{ kind: 'one-health-bar' }], [100, 100, 150]), 350);
  assert.equal(oneBarHealth([], [100, 100, 150]), 100);
});
