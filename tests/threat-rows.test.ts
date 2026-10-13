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
export const SEEN = { pairs: 0, threatEntries: 0 };   // proof the scenarios exercise the rule at all
export function playOut(make: () => ReturnType<typeof newWorld>, seed: number, ticks = 1800): string {
  let world = make();
  const rand = lcg(seed), h = createHash('sha256');
  for (let t = 0; t < ticks; t++) {
    const inputs: Record<string, Input> = {};
    for (const f of world.fighters) if (f.side === 'player') inputs[f.id] = { x: Math.round(rand() * 2 - 1), z: Math.round(rand() * 2 - 1), run: rand() < 0.3, attack: rand() < 0.4 ? ATTACKS[1 + Math.floor(rand() * 4)] : null, guard: rand() < 0.15 };
    world = stepCombat(world, inputs, 1 / 60).world;
    h.update(JSON.stringify(pairs(world).map((p) => [p.player, p.foe, p.primary])));
    for (const f of world.fighters) if (f.threat) h.update(JSON.stringify([t, f.id, Object.entries(f.threat).map(([k, v]) => [k, Math.round(v.threat * 1e3), Math.round(v.damage * 1e3)])]));   // every tick: a creature forgets its table when it resets, so the final state alone would be empty
    SEEN.pairs += pairs(world).length; SEEN.threatEntries += world.fighters.reduce((n, f) => n + Object.keys(f.threat ?? {}).length, 0);
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

test('the pinned scenarios really pick foes and build threat tables (a pin over an empty fight would prove nothing)', () => {
  assert.ok(SEEN.pairs > 1000 && SEEN.threatEntries > 1000, JSON.stringify(SEEN));
});

test('the rows equal the literals they replaced, and the old exports still carry them', async () => {
  const { AGGRO_M, SIGHT_M, GIVE_UP_UNSEEN_S, threatOf, THREAT_SOURCES, AWARENESS } = await import('../src/fight/threat.ts');
  assert.deepEqual([AGGRO_M, SIGHT_M, GIVE_UP_UNSEEN_S], [9, 14, 10]);
  assert.equal(threatOf('damage', 37.5), 37.5, 'threat is damage dealt, weight 1');
  assert.deepEqual(THREAT_SOURCES.map((s) => s.id), ['damage']);
  assert.deepEqual(AWARENESS.map((a) => [a.id, a.unit]), [['notice', 'm'], ['sight', 'm'], ['giveUp', 's']]);
  const world = await import('../src/fight/world.ts'), speeds = await import('../src/fight/speeds.ts');
  assert.deepEqual([world.AGGRO_M, world.SIGHT_M, speeds.GIVE_UP_UNSEEN_S], [9, 14, 10], 'world.ts and speeds.ts re-export the rows, not their own literals');
});

test('a new threat source is one row; the loader refuses a duplicate, a missing damage row and sight inside notice', async () => {
  const { loadThreatDefs } = await import('../src/fight/threat.ts');
  const DEFS = (await import('../src/fight/threat-defs.json', { with: { type: 'json' } })).default as { sources: object[]; awareness: object[] };
  const ok = loadThreatDefs({ ...DEFS, sources: [...DEFS.sources, { id: 'taunt', weight: 5 }] });
  assert.deepEqual(ok.sources.map((s) => s.id), ['damage', 'taunt'], 'a taunt source is one row');
  assert.throws(() => loadThreatDefs({ ...DEFS, sources: [...DEFS.sources, { id: 'damage', weight: 2 }] }), /damage/, 'a duplicate id is refused');
  assert.throws(() => loadThreatDefs({ ...DEFS, sources: [{ id: 'taunt', weight: 5 }] }), /"damage"/, 'the world reads damage by name');
  assert.throws(() => loadThreatDefs({ ...DEFS, awareness: [{ id: 'notice', value: 20, unit: 'm' }, { id: 'sight', value: 14, unit: 'm' }, { id: 'giveUp', value: 10, unit: 's' }] }), /sight/, 'sight is at least notice');
  assert.throws(() => loadThreatDefs({ ...DEFS, sources: [{ id: 'damage', weight: -1 }] }), /weight/, 'a negative weight is refused');
});

test('a different damage weight changes the fights (the rows are what the world reads)', async () => {
  const { THREAT_SOURCES } = await import('../src/fight/threat.ts');
  const row = THREAT_SOURCES.find((s) => s.id === 'damage') as { weight: number };
  const all = () => Object.values(SCENARIOS).flatMap((make) => SEEDS.map((seed) => playOut(make, seed)));
  const before = all();
  row.weight = 0;   // the "edit one row" probe: with damage worth no threat the threat tables (and so some picks) are different
  try { assert.ok(all().some((h, i) => h !== before[i]), 'at least one pinned fight reads the weight'); } finally { row.weight = 1; }
  assert.deepEqual(all(), before, 'restored');
});
