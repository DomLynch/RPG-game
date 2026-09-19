import test from 'node:test';
import assert from 'node:assert/strict';
import { FINISHER_POSE, selectFinisher, type FinisherId } from '../src/finishers.ts';
import type { Finish } from '../src/duel.ts';
import type { HitLocation } from '../src/blade.ts';
import type { MoveId, WeaponId } from '../src/moves.ts';

// Finishers & gore v1 (owner-authorized 2026-09-17; blade-kill rule owner-decided 2026-09-18 on PR #112 and broadened the
// same day after the owner's live playtest; two-finisher rotation owner-decided 2026-09-18, grown to four with Run Through
// and the plain death in the mix, owner 2026-09-18 ~23:30): selection is a pure function of the Killed event. These tests
// pin the rule; the mutation receipts are the discriminations (swap any null-row field and the pick changes).
const kill = (move: MoveId, location: HitLocation, victim: 0 | 1 = 1, draw = false): Finish => ({ victim, location, move, heading: 1.1, ...(draw ? { draw: true } : {}) });
const LONGSWORDS: readonly [WeaponId, WeaponId] = ['longsword', 'longsword'];
const SHIPPED = ['splitCrown', 'decapitation', 'runThrough', 'plainDeath', 'quietOne', 'opened'] as const;

test('selection is the owner rule: ANY blade kill plays an outcome, whatever the move or location', () => {
  // owner 2026-09-18: every blade kill draws one of the five — Split Crown, Decapitation, Run Through, The Quiet One, or plain death —
  // picked by the kill event's seed. Light, thrust, riposte, heavy, critical, any location.
  for (const [move, location] of [['light_right', 'torso'], ['light_left', 'head'], ['thrust', 'torso'], ['riposte', 'legs'], ['heavy_overhead', 'torso'], ['heavy_overhead', 'head'], ['heavy_riposte', 'legs'], ['heavy_counter', 'head'], ['critical', 'torso'], ['critical', 'head'], ['light_right', 'legs']] as [MoveId, HitLocation][])
    assert.ok(SHIPPED.includes(selectFinisher(kill(move, location), LONGSWORDS)), `${move} @ ${location} draws a shipped outcome`);
});

test('the rotation is seeded from the kill event: same event, same outcome; the spread covers all six', () => {
  // pinned picks (the hash in selectFinisher — swap the seed and these change)
  assert.equal(selectFinisher(kill('heavy_overhead', 'torso'), LONGSWORDS), 'quietOne');
  assert.equal(selectFinisher(kill('light_right', 'torso'), LONGSWORDS), 'decapitation');
  assert.equal(selectFinisher(kill('light_right', 'head'), LONGSWORDS), 'runThrough');
  assert.equal(selectFinisher(kill('thrust', 'head'), LONGSWORDS), 'opened');
  // every outcome is reachable across the kill-event space
  const picks = new Set<FinisherId>();
  for (const move of ['light_right', 'light_left', 'thrust', 'riposte', 'heavy_overhead', 'heavy_riposte', 'heavy_counter', 'critical'] as MoveId[])
    for (const location of ['head', 'torso', 'legs'] as HitLocation[])
      picks.add(selectFinisher(kill(move, location), LONGSWORDS));
  assert.deepEqual([...picks].sort(), [...SHIPPED].sort());
  // determinism: the same event twice is the same outcome
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

test('available finisher scenes have real poses; unimplemented outcomes use plain Death', () => {
  const poses = Object.entries(FINISHER_POSE) as [FinisherId, 'splitCrown' | 'decapitation' | 'runThrough' | 'quietOne' | 'opened' | 'disarmed' | null][];
  assert.deepEqual(poses.map(([id]) => id), ['splitCrown', 'decapitation', 'runThrough', 'plainDeath', 'quietOne', 'opened', 'hamstrung', 'execution', 'disarmed']);
  assert.equal(FINISHER_POSE.splitCrown, 'splitCrown');
  assert.equal(FINISHER_POSE.decapitation, 'decapitation');   // reuses the Split Crown body collapse; the severed head is the gore layer
  assert.equal(FINISHER_POSE.runThrough, 'runThrough');       // impaled on the blade, held beat gripping it, kneels with it still embedded
  assert.equal(FINISHER_POSE.quietOne, 'quietOne');
  assert.equal(FINISHER_POSE.opened, 'opened');
  assert.equal(FINISHER_POSE.disarmed, 'disarmed');
  assert.equal(FINISHER_POSE.plainDeath, null);               // the default fall, in the rotation by the owner's call — null = the plain Death clip
  for (const [id, pose] of poses) if (!['splitCrown', 'decapitation', 'runThrough', 'quietOne', 'opened', 'disarmed'].includes(id)) assert.equal(pose, null, `${id} plays the plain Death`);
});
