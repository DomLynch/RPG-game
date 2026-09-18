import test from 'node:test';
import assert from 'node:assert/strict';
import { FINISHER_POSE, selectFinisher, type FinisherId } from '../src/finishers.ts';
import type { Finish } from '../src/duel.ts';
import type { HitLocation } from '../src/blade.ts';
import type { MoveId, WeaponId } from '../src/moves.ts';

// Finishers & gore v1 (owner-authorized 2026-09-17; blade-kill rule owner-decided 2026-09-18 on PR #112 and broadened the
// same day after the owner's live playtest; two-finisher rotation owner-decided 2026-09-18): selection is a pure function of
// the Killed event. These tests pin the rule; the mutation receipts are the discriminations (swap any null-row field and
// the pick changes).
const kill = (move: MoveId, location: HitLocation, victim: 0 | 1 = 1, draw = false): Finish => ({ victim, location, move, heading: 1.1, ...(draw ? { draw: true } : {}) });
const LONGSWORDS: readonly [WeaponId, WeaponId] = ['longsword', 'longsword'];
const SHIPPED = ['splitCrown', 'decapitation'] as const;

test('selection is the owner rule: ANY blade kill plays a finisher, whatever the move or location', () => {
  // owner 2026-09-18: every blade kill gets a finisher — light, thrust, riposte, heavy, critical, any location — picked
  // from the shipped rotation by the kill event's seed
  for (const [move, location] of [['light_right', 'torso'], ['light_left', 'head'], ['thrust', 'torso'], ['riposte', 'legs'], ['heavy_overhead', 'torso'], ['heavy_overhead', 'head'], ['heavy_riposte', 'legs'], ['heavy_counter', 'head'], ['critical', 'torso'], ['critical', 'head'], ['light_right', 'legs']] as [MoveId, HitLocation][])
    assert.ok(SHIPPED.includes(selectFinisher(kill(move, location), LONGSWORDS)), `${move} @ ${location} plays a shipped finisher`);
});

test('the rotation is seeded from the kill event: same event, same finisher; different events pick both', () => {
  // pinned picks (the hash in selectFinisher — swap the seed and these change)
  assert.equal(selectFinisher(kill('heavy_overhead', 'torso'), LONGSWORDS), 'splitCrown');
  assert.equal(selectFinisher(kill('light_right', 'torso'), LONGSWORDS), 'decapitation');
  assert.equal(selectFinisher(kill('critical', 'head'), LONGSWORDS), 'splitCrown');
  assert.equal(selectFinisher(kill('critical', 'torso'), LONGSWORDS), 'decapitation');
  // both finishers are reachable across the kill-event space
  const picks = new Set<FinisherId>();
  for (const move of ['light_right', 'thrust', 'riposte', 'heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical'] as MoveId[])
    for (const location of ['head', 'torso', 'legs'] as HitLocation[])
      picks.add(selectFinisher(kill(move, location), LONGSWORDS));
  assert.deepEqual([...picks].sort(), [...SHIPPED].sort());
  // determinism: the same event twice is the same finisher
  const finish = kill('heavy_overhead', 'head');
  assert.equal(selectFinisher(finish, LONGSWORDS), selectFinisher({ ...finish }, LONGSWORDS));
});

test('no ceremony for a draw, the player\'s own death, or a killing kick', () => {
  assert.equal(selectFinisher(kill('heavy_overhead', 'head', 1, true), LONGSWORDS), null);
  assert.equal(selectFinisher(kill('light_right', 'torso', 0), LONGSWORDS), null);   // v2 review
  assert.equal(selectFinisher(kill('kick', 'torso'), LONGSWORDS), null);
  assert.equal(selectFinisher(kill('kick', 'legs'), LONGSWORDS), null);
  assert.equal(selectFinisher(kill('heavy_overhead', 'head', 0), LONGSWORDS), null);   // v2 review
});

test('selection is deterministic and reads only the event and the weapons', () => {
  const finish = kill('heavy_overhead', 'head');
  assert.equal(selectFinisher(finish, LONGSWORDS), selectFinisher({ ...finish }, LONGSWORDS));
  assert.ok(SHIPPED.includes(selectFinisher(kill('light_right', 'torso'), ['longsword', 'trident'])));   // v1: one table for every weapon
  assert.ok(SHIPPED.includes(selectFinisher(kill('thrust', 'legs'), LONGSWORDS)));   // the owner 2026-09-18 rule: blade kills are move- and location-independent
  assert.notEqual(selectFinisher(kill('heavy_overhead', 'torso'), LONGSWORDS), selectFinisher(kill('kick', 'torso'), LONGSWORDS));
  assert.notEqual(selectFinisher(kill('light_right', 'head'), LONGSWORDS), selectFinisher(kill('light_right', 'head', 0), LONGSWORDS));
});

test('Split Crown and Decapitation have shipped poses; every other finisher falls back to the plain Death', () => {
  const poses = Object.entries(FINISHER_POSE) as [FinisherId, 'splitCrown' | 'decapitation' | null][];
  assert.deepEqual(poses.map(([id]) => id), ['splitCrown', 'decapitation', 'runThrough', 'quietOne', 'opened', 'hamstrung', 'execution']);
  assert.equal(FINISHER_POSE.splitCrown, 'splitCrown');
  assert.equal(FINISHER_POSE.decapitation, 'decapitation');   // reuses the Split Crown body collapse; the severed head is the gore layer
  for (const [id, pose] of poses) if (id !== 'splitCrown' && id !== 'decapitation') assert.equal(pose, null, `${id} waits for its clip`);
});
