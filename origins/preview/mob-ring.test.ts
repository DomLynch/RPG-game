import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldCombat } from '../../src/fight/index.ts';
import { AGGRO_M } from '../../src/fight/threat.ts';
import { aggroTest, mobSpecs, newMob, type Mob } from './mobs.ts';
import { frontierBuild, frontierPlan } from './frontier-plan.ts';
import type { MobDrive, MobPick, Mobs } from './mobs-view.ts';
import type { MobSpec } from './mobs.ts';

// One notice ring for every creature: the sim's AGGRO_M (threat-defs.json awareness.notice). The sim hunts inside it, and the view's ring test, its debug ring and engage-ahead use the same number, not the zone row's own `aggro` (deprecated, row.ts). So a creature never stands "noticing" from a range the sim will not hunt from.
const F = frontierPlan(), specs = mobSpecs(F, frontierBuild(F));
const roamer = { home: { x: 0, z: 0 }, roam: 4, aggro: AGGRO_M };

test('every shipped creature spec carries the sim\'s notice ring', () => {
  assert.ok(specs.length > 5, `${specs.length} specs`);
  for (const s of specs) assert.equal(s.aggro, AGGRO_M, `${s.id}: ${s.aggro}`);
});

/** A wolf `d` metres from a hero who stands still: does the sim hunt, and does the view's ring test say it is watching? */
function at(d: number): { hunting: boolean; watching: boolean } {
  const spec = { id: 'wolf-1', body: 'wolf', name: 'wolf-1', level: 1, named: false } as unknown as MobSpec;
  const mobs = { within: (x: number, z: number, r: number): MobPick[] => (Math.hypot(0 - x, d - z) <= r ? [{ spec, x: 0, z: d, dist: Math.hypot(0 - x, d - z) } as unknown as MobPick] : []), drive: (_id: string, _p: MobDrive | null) => {}, fell: () => {}, play: () => 0.5 } as unknown as Mobs;
  const wc = createWorldCombat({ mobs: () => mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} });
  for (let i = 0; i < 30; i++) wc.update(1 / 60, { x: 0, z: 0, facing: 0 });
  const m: Mob = { ...newMob(roamer, 0), x: 0, z: d };
  return { hunting: wc.debug().find((f) => f.id === 'wolf-1')?.hunting ?? false, watching: aggroTest(m, roamer, { x: 0, z: 0 }) };
}

test('at 8.9 m the creature is watching AND hunting; at 9.2 m it is neither', () => {
  assert.deepEqual(at(AGGRO_M - 0.1), { hunting: true, watching: true });
  assert.deepEqual(at(AGGRO_M + 0.2), { hunting: false, watching: false });
});
