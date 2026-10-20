import '../../tests/lib/era-off.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldCombat } from '../../src/fight/index.ts';
import type { MobDrive, MobPick, Mobs } from './mobs-view.ts';
import type { MobSpec } from './mobs.ts';

// Dom 2026-10-20: hold-for-heavy "works in the Pit, not in Zone 1". The page hands the walk a 'heavy' action after a 220 ms hold (input.ts fireHeavy; the T4 probe's combat().acts shows it); this pins the other half:
// what the world sim does with wc.press('heavy') versus wc.press('light') against the same creature.
const spec = (id: string, body: string): MobSpec => ({ id, body, name: id, level: 1, named: false } as unknown as MobSpec);
function fakeMobs(list: Array<{ spec: MobSpec; x: number; z: number; hunting?: boolean }>) {
  const driven = new Map<string, MobDrive>(), fell: string[] = [];
  const mobs = { within: (x: number, z: number, r: number): MobPick[] => list.filter((m) => !fell.includes(m.spec.id) && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })), drive: (id: string, p: MobDrive) => { driven.set(id, p); }, fell: (id: string) => { fell.push(id); }, play: () => {} } as unknown as Mobs;
  return { mobs, driven, fell };
}
const swing = (kind: 'light' | 'heavy'): { moves: string[]; damage: number } => {
  const f = fakeMobs([{ spec: spec('goblin-1', 'goblin'), x: 0, z: 1.2, hunting: true }]);
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {} });
  const hero = { x: 0, z: 0, facing: 0 }; const dt = 1 / 30;
  for (let t = 0; t < 1.5; t += dt) wc.update(dt, hero);   // joined, and let the first exchanges settle
  while (wc.hero().phase !== 'ready') wc.update(dt, hero);
  const hp0 = wc.target()?.hp ?? 0; wc.takeContacts(); wc.press(kind);
  const moves: string[] = [];
  for (let t = 0; t < 2.5; t += dt) { wc.update(dt, hero); for (const c of wc.takeContacts()) for (const e of c.events) if (e.type === 'AttackStarted' && e.actor === 0) moves.push(String(e.move)); }
  return { moves, damage: hp0 - (wc.target()?.hp ?? 0) };
};

test('a world press of kind heavy starts the heavy swing, not the light (the world sim half of hold-for-heavy)', () => {
  const light = swing('light'), heavy = swing('heavy');
  assert.ok(light.moves.length > 0, `the light press swings: ${JSON.stringify(light)}`);
  assert.ok(heavy.moves.length > 0, `the heavy press swings: ${JSON.stringify(heavy)}`);
  assert.notDeepEqual(heavy.moves[0], light.moves[0], `heavy and light are different moves: ${JSON.stringify({ light, heavy })}`);
  assert.match(String(heavy.moves[0]), /heavy/, 'the move is a heavy');
});
