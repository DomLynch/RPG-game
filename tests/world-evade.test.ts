// Evade (Strategy + Lead 2026-10-17; donor AzerothCore EnterEvadeMode): a creature whose last EVADE_WHIFFS attack cycles all ended without contact walks home, untargetable, and heals to full.
// Contact is the creature's own landed, blocked, parried or dodged blow; a swing on air or an approach the prey left before the swing is a whiff; a stagger is neither. Pure simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVADE_HEAL_TO_FULL, EVADE_WHIFFS, creature, newWorld, player, stepCombat, type Event, type Input, type World } from '../src/fight/world.ts';

const DT = 1 / 60, dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const swinging = (c: { phase: string }) => c.phase === 'windup' || c.phase === 'active';
// A hero steps out of the troll's reach when it winds up and back in to hit it when it does not (the kite), or blocks each swing and trades (stand-and-trade).
const BOTS: Record<string, (w: World, k: number) => Input> = {
  kite: (w, k) => { const h = w.fighters[0]!, c = w.fighters[1]!, d = dist(h, c) || 1; return swinging(c) && d < 8 ? { x: (h.x - c.x) / d, z: (h.z - c.z) / d, run: true } : d > 11 ? { x: (c.x - h.x) / d, z: (c.z - h.z) / d, run: true } : { x: 0, z: 0, attack: k % 20 === 0 ? 'light' : null }; },
  stand: (w, k) => (swinging(w.fighters[1]!) && dist(w.fighters[0]!, w.fighters[1]!) < 5 ? { x: 0, z: 0, guard: true } : { x: 0, z: 0, attack: k % 20 === 0 ? 'light' : null }),
};
function run(bot: string, seed: number, seconds: number) {
  const a = seed * 0.37;
  let w = newWorld([player('hero', 0, 0, 0, 3, null, { weapon: 'longsword' }), creature('c0', 'cave-troll', Math.sin(a) * 7, Math.cos(a) * 7, a + Math.PI, 3)]);
  const evaded: Event[] = [], hitWhileHome: number[] = [], healthAtEvade: number[] = [];
  for (let k = 0; k < seconds / DT; k++) {
    const wasHome = w.fighters[1]!.returning, r = stepCombat(w, { hero: BOTS[bot]!(w, k) }, DT);
    w = r.world;
    for (const e of r.events) {
      if (e.type === 'Evaded') { evaded.push(e); healthAtEvade.push(w.fighters[1]!.health / w.fighters[1]!.maxHealth); }
      if (wasHome && e.type === 'Hit' && e.victim === 'c0') hitWhileHome.push(k);
    }
    if (w.fighters[0]!.phase === 'dead' || w.fighters[1]!.phase === 'dead') break;
  }
  return { evaded, hitWhileHome, healthAtEvade };
}

test('evade: the rows are K attack cycles and heal-to-full, and the default is the shipped 4 / true', () => {
  assert.equal(EVADE_WHIFFS, 4);
  assert.equal(EVADE_HEAL_TO_FULL, true);
});

test('evade: a hero who steps out of reach at every wind-up and hits in between sees the troll give up; the walk home is untargetable and ends at full health', () => {
  const seeds = [1, 2, 3, 4].map((s) => run('kite', s, 120));
  assert.ok(seeds.some((r) => r.evaded.length > 0), 'the kite makes the troll whiff K cycles and it evades at least once in four runs');
  for (const r of seeds) {
    assert.deepEqual(r.hitWhileHome, [], 'a creature walking home takes no blow');
    for (const hp of r.healthAtEvade) assert.equal(hp, 1, 'it arrives home at full health');
  }
});

test('evade: a hero who blocks and trades is never evaded (its swings meet a blow or a block, and a stagger-locked creature does not count)', () => {
  for (const seed of [1, 2, 3]) assert.equal(run('stand', seed, 60).evaded.length, 0, `seed ${seed}: the fight runs its course`);
});
