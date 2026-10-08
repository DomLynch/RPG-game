import test from 'node:test';
import assert from 'node:assert/strict';
import { ME, createWorldCombat, kindOf } from './world-combat.ts';
import type { MobDrive, MobPick, Mobs } from './mobs-view.ts';
import type { MobSpec } from './mobs.ts';

const spec = (id: string, body: string): MobSpec => ({ id, body, name: id, level: 11, named: false } as unknown as MobSpec);
function fakeMobs(list: Array<{ spec: MobSpec; x: number; z: number }>) {
  const driven = new Map<string, MobDrive>(), fell: string[] = [];
  const mobs = { within: (x: number, z: number, r: number): MobPick[] => list.filter((m) => !fell.includes(m.spec.id) && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })), drive: (id: string, p: MobDrive | null) => void (p ? driven.set(id, p) : driven.delete(id)), fell: (id: string) => void fell.push(id) } as unknown as Mobs;
  return { mobs, driven, fell };
}
const run = (wc: ReturnType<typeof createWorldCombat>, hero: { x: number; z: number; facing: number }, seconds: number, dt = 1 / 30) => { for (let t = 0; t < seconds; t += dt) wc.update(dt, hero); };

test('kindOf: only roster bodies can be fought; the rest wander', () => {
  assert.equal(kindOf('wolf'), 'wolf'); assert.equal(kindOf('not-a-body'), null);
});

test('a wolf that comes within the ring joins the loop, hunts, telegraphs, bites; the hero is hit once its tell has played', () => {
  const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 0, z: 8 }]); let hit = 0, tell = 0, died = 0;
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => void died++, onHeroHit: () => void hit++, onSwing: () => {}, onTelegraph: () => void tell++ });
  run(wc, { x: 0, z: 0, facing: 0 }, 6);
  assert.ok(f.driven.has('wolf-1'), 'driven by the loop'); assert.ok(tell >= 1 && hit >= 1, `tell ${tell} before hit ${hit}`); assert.ok(wc.hero().health < wc.hero().max); assert.equal(died, 0);
  assert.equal(wc.target()?.name, 'wolf-1'); assert.ok(wc.inCombat());
});

test('the hero cuts it dead: onSwing, a fall that takes ~1.4 s, then onKill once, and the creature is released', () => {
  const f = fakeMobs([{ spec: { ...spec('wolf-1', 'wolf'), level: 1 }, x: 0, z: 1.2 }]); const kills: string[] = []; let swings = 0;   // level 1: a level-11 wolf outlasts this test under the Pit-copied engine (#1894); the mount flow is what is tested
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: (s) => { f.fell.push(s.id); kills.push(s.id); }, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => void swings++ });
  for (let i = 0; i < 400 && kills.length === 0; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((x) => x.id === 'wolf-1'); wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); } }   // auto-aim at the creature as the page does (it circles now)
  assert.ok(swings >= 1); assert.deepEqual(kills, ['wolf-1']); assert.ok(!f.driven.has('wolf-1'), 'released after the fall'); assert.equal(wc.target(), null);
});

test('walking away: past the wolf leash it gives up and walks home (no kill, no death), then leaves the loop', () => {
  const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 0, z: 6 }]); let kills = 0, died = 0;
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => void kills++, onHeroDied: () => void died++, onHeroHit: () => {}, onSwing: () => {} });
  const hero = { x: 0, z: 0, facing: 0 }; for (let t = 0; t < 40; t += 1 / 30) { hero.z -= 7 / 30; wc.update(1 / 30, hero); }
  assert.equal(kills, 0); assert.equal(died, 0); assert.ok(!f.driven.has('wolf-1'), 'back out of the loop once home and far');
});

test('the hero dies once: onHeroDied, nothing hunts him afterwards, and reset stands him up fresh', () => {
  const f = fakeMobs([{ spec: spec('bear-1', 'bear'), x: 0, z: 1.0 }]); let died = 0;
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => void died++, onHeroHit: () => {}, onSwing: () => {} });
  run(wc, { x: 0, z: 0, facing: 0 }, 120); assert.equal(died, 1); assert.ok(wc.hero().dead);
  wc.reset({ x: 0, z: 3, facing: 0 }); assert.equal(wc.hero().health, wc.hero().max); assert.ok(!wc.hero().dead);
  assert.equal(ME, 'me');
});

test('Evaded: a creature that gave up and is home and healed is released at once (back to wander), not kept in the loop', () => {
  const f = fakeMobs([{ spec: spec('wolf-1', 'wolf'), x: 0, z: 6 }]); const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  const hero = { x: 0, z: 0, facing: 0 }; let sawDriven = false, releasedAt = -1;
  for (let t = 0; t < 60; t += 1 / 30) { hero.z -= 7 / 30; wc.update(1 / 30, hero); if (f.driven.has('wolf-1')) sawDriven = true; else if (sawDriven && releasedAt < 0) releasedAt = t; }
  assert.ok(sawDriven && releasedAt > 0, 'it was in the loop, then released');
  assert.ok(!wc.debug().some((x) => x.id === 'wolf-1'), 'gone from the world after Evaded');
});
