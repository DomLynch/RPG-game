// Threat as data (Row 9 of the top-30 table, EQEmu hate list / AzerothCore ThreatManager: a hate source carries a modifier). The existing fights must pick the SAME foe tick for tick: a scripted
// two-player, three-creature world is stepped 1800 ticks and the sequence of who-fights-whom (pairs) plus every creature's threat table is hashed. The expected hashes were taken on trunk
// BEFORE the rows existed; they must not move when the rows are read instead of the literals. Structure only (ids and rounded threat), never raw float state, so Node 22 and 25 agree.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { creature, newWorld, pairs, player, stepCombat, type Input } from '../src/fight/world.ts';

const SCENARIOS: Record<string, () => ReturnType<typeof newWorld>> = {
  'two players, three wolves': () => newWorld([player('a', 0, 0, 0), player('b', 3, 0.5, Math.PI), creature('w1', 'wolf', 6, 1), creature('w2', 'wolf', -5, 2), creature('w3', 'wolf', 4, -6)]),
  'one player, goblin and wolf': () => newWorld([player('a', 0, 0, 0), creature('g1', 'goblin', 7, 0), creature('w1', 'wolf', -6, 3)]),
};
const lcg = (seed: number) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32; };
const ATTACKS = [null, 'light', 'heavy', 'thrust', 'kick'] as const;
export function playOut(make: () => ReturnType<typeof newWorld>, seed: number, ticks = 1800): string {
  let world = make();
  const rand = lcg(seed), h = createHash('sha256');
  for (let t = 0; t < ticks; t++) {
    const inputs: Record<string, Input> = {};
    for (const f of world.fighters) if (f.side === 'player') inputs[f.id] = { x: Math.round(rand() * 2 - 1), z: Math.round(rand() * 2 - 1), run: rand() < 0.3, attack: rand() < 0.4 ? ATTACKS[1 + Math.floor(rand() * 4)] : null, guard: rand() < 0.15 };
    world = stepCombat(world, inputs, 1 / 60).world;
    h.update(JSON.stringify(pairs(world).map((p) => [p.player, p.foe, p.primary])));
  }
  for (const f of world.fighters) h.update(JSON.stringify([f.id, Object.entries(f.threat ?? {}).map(([k, v]) => [k, Math.round(v.threat * 1e3), Math.round(v.damage * 1e3)])]));
  return h.digest('hex').slice(0, 16);
}
const EXPECTED: Record<string, string[]> = { 'two players, three wolves': ['?', '?', '?'], 'one player, goblin and wolf': ['?', '?', '?'] };
const SEEDS = [11, 222, 3333];
for (const [name, make] of Object.entries(SCENARIOS)) {
  test(`existing fights pick the same foe tick for tick: ${name}`, () => {
    const got = SEEDS.map((s) => playOut(make, s));
    if (process.env.PRINT_THREAT_HASHES) console.log(`HASHES ${JSON.stringify({ [name]: got })}`);
    assert.deepEqual(got, EXPECTED[name]);
  });
}
