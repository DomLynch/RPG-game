import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldCombat } from '../../src/fight/index.ts';
import { STEP, blendPose } from '../../src/fight/world-combat.ts';
import type { MobDrive, MobPick, Mobs } from './mobs-view.ts';
import type { MobSpec } from './mobs.ts';

// The fight runs on a fixed 60 Hz step; the view draws every frame. A frame with no tick used to hand the creature the same pose again (it froze), and a frame with two ticks moved it double, so on a 120 Hz screen a creature moved one frame and stood the next. The drawn pose is now blended between the last two ticks by acc / STEP.
const wolf = { id: 'wolf-1', body: 'wolf', name: 'wolf-1', level: 11, named: false } as unknown as MobSpec;
function fakeMobs() {
  const driven = new Map<string, MobDrive>();
  const mobs = { within: (x: number, z: number, r: number): MobPick[] => (Math.hypot(0 - x, 8 - z) <= r ? [{ spec: wolf, x: 0, z: 8, dist: Math.hypot(0 - x, 8 - z) } as unknown as MobPick] : []), drive: (id: string, p: MobDrive | null) => void (p ? driven.set(id, p) : driven.delete(id)), fell: () => {}, play: () => 0.5 } as unknown as Mobs;
  return { mobs, driven };
}
/** The drawn z of the wolf after every frame at `hz`, from the frame it first closes in until it is within `stop` metres of the hero. */
function approach(hz: number, stop = 3): { z: number[]; ticks: number[] } {
  const f = fakeMobs(), ticks: number[] = [];
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {}, onCreatureTick: (_s, t) => void ticks.push(t.z) });
  const z: number[] = [], hero = { x: 0, z: 0, facing: 0 };
  for (let i = 0; i < hz * 6; i++) { wc.update(1 / hz, hero); const d = f.driven.get('wolf-1'); if (d && d.z > stop) z.push(d.z); }
  return { z, ticks };
}

test('blendPose: halfway is halfway, the facing takes the short arc, and a jump over the snap distance is not blended', () => {
  const a = { x: 0, z: 0, facing: 0 }, b = { x: 1, z: 2, facing: Math.PI / 2 };
  assert.deepEqual(blendPose(a, b, 0.5, 3), { x: 0.5, z: 1, facing: Math.PI / 4 });
  assert.deepEqual(blendPose(a, b, 0, 9), a); assert.deepEqual(blendPose(a, b, 1, 9), b);
  const wrap = blendPose({ x: 0, z: 0, facing: Math.PI - 0.1 }, { x: 0, z: 0, facing: -Math.PI + 0.1 }, 0.5, 3).facing;
  assert.ok(Math.abs(Math.abs(wrap) - Math.PI) < 1e-9, `the short way round ±π, not through 0 (${wrap})`);
  assert.deepEqual(blendPose(a, { x: 20, z: 0, facing: 1 }, 0.5, 3), { x: 20, z: 0, facing: 1 }, 'a snap is not a glide');
  assert.deepEqual(blendPose(undefined, b, 0.5, 3), b, 'no pose before: the current one');
  assert.deepEqual(blendPose(a, b, 7, 9), b); assert.deepEqual(blendPose(a, b, -1, 9), a);
});

test('at 120 Hz the drawn creature moves EVERY frame (no frozen frame between ticks), and as far per second as at 60 Hz', () => {
  const hi = approach(120), lo = approach(60);
  assert.ok(hi.z.length > 40, `the wolf was drawn closing in for ${hi.z.length} frames`);
  const steps = hi.z.slice(1).map((v, i) => hi.z[i]! - v);   // metres closed per frame (the wolf comes toward the hero, z falls)
  const frozen = steps.filter((s) => s < 1e-9).length;
  assert.equal(frozen, 0, `${frozen} of ${steps.length} 120 Hz frames drew the creature where it already was`);
  assert.ok(Math.max(...steps) < 2.2 * Math.min(...steps.filter((s) => s > 0)), 'and no frame moves it double the others');
  const perSecond = (a: { z: number[] }, hz: number) => (a.z[0]! - a.z.at(-1)!) / (a.z.length / hz);
  assert.ok(Math.abs(perSecond(hi, 120) - perSecond(lo, 60)) / perSecond(lo, 60) < 0.08, `speed at 120 Hz ${perSecond(hi, 120).toFixed(2)} m/s against ${perSecond(lo, 60).toFixed(2)} m/s at 60 Hz`);
});

test('the sim is untouched: onCreatureTick still gets the tick\'s own pose (raw, never a blend), the same fight at 60 and 120 Hz', () => {
  const hi = approach(120), lo = approach(60);
  assert.ok(hi.ticks.length > 100 && lo.ticks.length > 100, 'the creature is ticked every frame it is up');
  const final = (a: { ticks: number[] }) => a.ticks.at(-1)!;
  assert.ok(Math.abs(final(hi) - final(lo)) < 0.5, `the tick pose ends in the same place: ${final(hi).toFixed(2)} against ${final(lo).toFixed(2)}`);
  assert.equal(STEP, 1 / 60);
});
