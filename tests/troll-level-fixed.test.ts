// Strategy's ruling (2026-10-16): the Cave Troll's level is FIXED from its zone row (3), never from the hero, so "an L16 sheeted hero against the troll" means against the LEVEL-3 troll and he wins ~always.
// Nothing in the world loop scales a creature to the hero: a creature's level is its spawn's (origins/preview/mobs.ts: the row's level band by distance, a camp boss its form's level) and world.ts creature() takes that level and
// nothing about the hero. This pins the row level, and runs the real world loop (stepCombat) with an L16 hero (his level's build points + a plate set) against the troll at that level.
import test from 'node:test';
import assert from 'node:assert/strict';
import GOLDEN from '../origins/preview/mobs.golden.json' with { type: 'json' };
import { creature, newWorld, player, stepCombat, type Input } from '../src/fight/world.ts';
import { rungSheet } from '../scripts/lib/rung-sheet.ts';

const troll = (GOLDEN as { id: string; character: string; level: number }[]).find((m) => m.character === 'character:cave-troll')!;
const guard = (w: ReturnType<typeof newWorld>, k: number): Input => {
  const f = w.fighters.find((x) => x.side === 'creature' && x.phase !== 'dead');
  return f && (f.phase === 'windup' || f.phase === 'active') ? { x: 0, z: 0, guard: true } : { x: 0, z: 0, attack: k % 20 === 0 ? 'light' : null };
};
function fight(heroLevel: number, rung: number, seed: number): { won: boolean; trollLevel: number } {
  const sheet = rungSheet(rung, heroLevel), a = seed * 0.37 + 0.3;
  const foe = creature('c0', 'cave-troll', Math.sin(a) * 6, Math.cos(a) * 6, a + Math.PI, troll.level);
  let w = newWorld([player('hero', 0, 0, 0, heroLevel, null, { weapon: 'longsword', ...(sheet ? { sheet } : {}) }), foe]);
  for (let k = 0; k < 120 * 60; k++) {
    w = stepCombat(w, { hero: guard(w, k) }, 1 / 60).world;
    if (w.fighters[0]!.phase === 'dead') return { won: false, trollLevel: troll.level };
    if (w.fighters.every((f) => f.side !== 'creature' || f.phase === 'dead')) return { won: true, trollLevel: troll.level };
  }
  return { won: false, trollLevel: troll.level };
}

test('building the world with a level-1 or a level-16 hero leaves the troll the same fighter: nothing in the loop reads the hero to size a creature', () => {
  const trollIn = (heroLevel: number) => newWorld([player('hero', 0, 0, 0, heroLevel, null, { weapon: 'longsword' }), creature('c0', 'cave-troll', 4, 4, 0, troll.level)]).fighters[1]!;
  const a = trollIn(1), b = trollIn(16);
  assert.deepEqual([a.maxHealth, a.poise, a.level], [b.maxHealth, b.poise, b.level]);
});

test('the troll spawns at its zone row\'s level 3, and an L16 sheeted hero beats that troll in the real world loop on every seed', () => {
  assert.equal(troll.level, 3, 'the spawn list pins the troll at level 3 (mobs.golden.json)');
  const results = Array.from({ length: 8 }, (_, i) => fight(16, 4, i + 1));
  assert.ok(results.every((r) => r.trollLevel === 3));
  assert.equal(results.filter((r) => r.won).length, 8, 'an L16 hero with a rung-4 set wins ~always against the level-3 troll');
});
