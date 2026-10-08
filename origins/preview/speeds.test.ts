// The speed table (origins/preview/speeds.ts): the relations Dom's rule needs, and consistency with the sim's own movement (a world fight that replays must not assume anything the sim does not do).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advance, initialState, STEP } from '../../src/sim.ts';
import { OPPONENTS } from '../../src/moves.ts';
import { COMMIT_RANGE_M, DISENGAGE_M, DISENGAGE_S, ENGAGE_GAP_MAX_M, GIVE_UP_UNSEEN_S, LEASH, OUT_OF_COMBAT_S, SPEEDS, chaseSpeed, leashOf } from './speeds.ts';
import { TUNING } from './mobs.ts';

const simSpeed = (run: boolean, pace = 1): number => {   // m/s the sim really moves a fighter, measured through advance()
  const far = { x: 100, z: 100 }, from = { ...initialState(), x: 0, z: 0 };
  const to = advance(from, { x: 0, z: 1, yaw: 0, run } as never, far, pace);
  return Math.hypot(to.x - from.x, to.z - from.z) / STEP;
};

test('the table: a creature chases slower than a running player, the wolf faster; the wolf gives up sooner (shorter leash)', () => {
  assert.ok(SPEEDS.creature.chase < SPEEDS.player.run, 'running away works from every creature but the wolf');
  assert.ok(SPEEDS.creature.wolfChase > SPEEDS.player.run, 'the wolf is the exception');
  assert.ok(SPEEDS.creature.amble < SPEEDS.player.walk && SPEEDS.player.walk < SPEEDS.player.run);
  assert.ok(LEASH.wolf < LEASH.default);
  assert.equal(chaseSpeed('wolf'), 6.0); assert.equal(chaseSpeed('boar'), 4.5); assert.equal(leashOf('wolf'), 15); assert.equal(leashOf('bear'), 30);
  assert.equal(GIVE_UP_UNSEEN_S, 10); assert.equal(OUT_OF_COMBAT_S, 6);
});

test('the disengage lies beyond every way a fight can start: the max engage gap and the commit range', () => {
  assert.equal(DISENGAGE_M, 12); assert.equal(DISENGAGE_S, 3);
  assert.ok(DISENGAGE_M > ENGAGE_GAP_MAX_M && DISENGAGE_M > COMMIT_RANGE_M);
});

test('one table: the world layer reads the same walk the creatures use (mobs.ts TUNING.walk is the table\'s amble)', () => {
  assert.equal(TUNING.walk, SPEEDS.creature.amble);
});

test('consistent with the sim: the player\'s run is the sim\'s run, and no world chase is faster than the sim\'s own sprint for that creature', () => {
  assert.ok(Math.abs(simSpeed(true) - SPEEDS.player.run) < 1e-9, `the sim runs ${simSpeed(true)} m/s`);
  for (const [id, o] of Object.entries(OPPONENTS)) {
    if (!['wolf', 'boar', 'bear', 'goblin'].includes(id)) continue;
    const sprint = simSpeed(true, o.speed);
    assert.ok(chaseSpeed(id) <= sprint + 1e-9, `${id}: world chase ${chaseSpeed(id)} m/s must not exceed the sim sprint ${sprint.toFixed(2)} m/s`);
  }
});
