import test from 'node:test';
import assert from 'node:assert/strict';
import { FINISHER_POSE, selectFinisher, type FinisherId } from '../src/finishers.ts';
import type { Finish } from '../src/duel.ts';
import type { HitLocation } from '../src/blade.ts';
import type { MoveId, WeaponId } from '../src/moves.ts';

// Finishers & gore v1 (owner-authorized 2026-09-17): selection is a pure function of the Killed event. These tests pin
// every row of the spec's table; the mutation receipts are the row discriminations (swap any field and the pick changes).
const kill = (move: MoveId, location: HitLocation, victim: 0 | 1 = 1, draw = false): Finish => ({ victim, location, move, heading: 1.1, ...(draw ? { draw: true } : {}) });
const LONGSWORDS: readonly [WeaponId, WeaponId] = ['longsword', 'longsword'];

test('selection is the spec table: critical, legs, head, torso', () => {
  assert.equal(selectFinisher(kill('critical', 'head'), LONGSWORDS), 'execution');
  assert.equal(selectFinisher(kill('critical', 'torso'), LONGSWORDS), 'execution');   // the posture-break kill is ceremonial wherever it lands
  assert.equal(selectFinisher(kill('light_right', 'legs'), LONGSWORDS), 'hamstrung');
  assert.equal(selectFinisher(kill('heavy_overhead', 'legs'), LONGSWORDS), 'hamstrung');
  assert.equal(selectFinisher(kill('heavy_overhead', 'head'), LONGSWORDS), 'splitCrown');
  assert.equal(selectFinisher(kill('heavy_riposte', 'head'), LONGSWORDS), 'splitCrown');
  assert.equal(selectFinisher(kill('heavy_counter', 'head'), LONGSWORDS), 'splitCrown');
  assert.equal(selectFinisher(kill('light_right', 'head'), LONGSWORDS), 'quietOne');
  assert.equal(selectFinisher(kill('light_left', 'head'), LONGSWORDS), 'quietOne');
  assert.equal(selectFinisher(kill('thrust', 'torso'), LONGSWORDS), 'runThrough');
  assert.equal(selectFinisher(kill('riposte', 'torso'), LONGSWORDS), 'runThrough');   // the riposte is the punish thrust
  assert.equal(selectFinisher(kill('heavy_overhead', 'torso'), LONGSWORDS), 'opened');
  assert.equal(selectFinisher(kill('light_right', 'torso'), LONGSWORDS), 'quietOne');
});

test('no ceremony for a draw, the player\'s own death, or a killing kick', () => {
  assert.equal(selectFinisher(kill('heavy_overhead', 'head', 1, true), LONGSWORDS), null);
  assert.equal(selectFinisher(kill('heavy_overhead', 'head', 0), LONGSWORDS), null);   // v2 review
  assert.equal(selectFinisher(kill('kick', 'torso'), LONGSWORDS), null);
});

test('selection is deterministic and reads only the event and the weapons', () => {
  const finish = kill('heavy_overhead', 'head');
  assert.equal(selectFinisher(finish, LONGSWORDS), selectFinisher({ ...finish }, LONGSWORDS));
  assert.equal(selectFinisher(kill('heavy_overhead', 'head'), ['longsword', 'trident']), 'splitCrown');   // v1: one table for every weapon
  assert.notEqual(selectFinisher(kill('heavy_overhead', 'head'), LONGSWORDS), selectFinisher(kill('heavy_overhead', 'torso'), LONGSWORDS));
  assert.notEqual(selectFinisher(kill('heavy_overhead', 'head'), LONGSWORDS), selectFinisher(kill('light_right', 'head'), LONGSWORDS));
});

test('only Split Crown has a shipped clip in v1; every other finisher falls back to the plain Death', () => {
  const poses = Object.entries(FINISHER_POSE) as [FinisherId, 'splitCrown' | null][];
  assert.deepEqual(poses.map(([id]) => id), ['splitCrown', 'runThrough', 'quietOne', 'opened', 'hamstrung', 'execution']);
  assert.equal(FINISHER_POSE.splitCrown, 'splitCrown');
  for (const [id, pose] of poses) if (id !== 'splitCrown') assert.equal(pose, null, `${id} waits for its clip`);
});
