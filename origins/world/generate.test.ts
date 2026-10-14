// Seeded generation: determinism, every generated zone valid and inside its declared ranges (a 500-seed property run), generated
// regions whose every connection resolves, and template refusals.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateRegion, generateZone, prng, type Template } from './generate.ts';
import { resolveRegion } from './resolve.ts';

const WILDS: Template = {
  base: {
    layout: { entry: { u: 0.5, v: 0.05, facing: 180 }, camp: { u: 0.3, v: 0.6 }, lair: { u: 0.7, v: 0.9 } },
    passages: { trail: { from: 'entry', width: 4, length: 12 } },
    spawns: { boss: 'lair' },
    terrain: { biome: 'ash-waste', heightMin: -5, heightMax: 30 },
  },
  vary: {
    'zoneSize.width': [60, 230], 'zoneSize.depth': [60, 230], 'density.npcs': [0, 0.3], 'density.props': [0.2, 3], 'density.creatures': [0.1, 2],
    'difficulty.levelMin': [1, 5], 'difficulty.levelMax': [5, 30], 'difficulty.lootTier': [1, 4], 'spawns.respawnSeconds': [60, 900],
  },
  jitter: 0.08,
};

test('the PRNG is deterministic, in [0, 1), and seeds differ', () => {
  const a = prng(42), b = prng(42), c = prng(43), xs = Array.from({ length: 1000 }, a);
  assert.deepEqual(Array.from({ length: 1000 }, b), xs);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notEqual(c(), prng(42)());
});

test('same template + seed → the identical zone; 500 seeds all valid, in range, and distinct', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 500; seed++) {
    const z = generateZone(WILDS, seed * 7919);
    assert.ok(z.ok, `seed ${seed}: ${JSON.stringify(!z.ok && z.issues)}`);
    assert.deepEqual(generateZone(WILDS, seed * 7919), z);
    for (const [path, [lo, hi]] of Object.entries(WILDS.vary)) {
      const [g, k] = path.split('.') as [string, string], v = (z.value as unknown as Record<string, Record<string, number>>)[g]![k]!;
      assert.ok(v >= lo && v <= hi, `${path}=${v}`);
    }
    for (const [name, l] of Object.entries(z.value.layout)) {
      const base = WILDS.base.layout![name]!;
      assert.ok(Math.abs(l.u - (base.u ?? 0.5)) <= 0.08 + 1e-9 && Math.abs(l.v - (base.v ?? 0.5)) <= 0.08 + 1e-9, name);
    }
    seen.add(JSON.stringify(z.value));
  }
  assert.equal(seen.size, 500);
});

test('overrides apply on top of the draw and are validated with it', () => {
  const z = generateZone(WILDS, 1, { rules: { safe: true }, zoneSize: { width: 99 } });
  assert.ok(z.ok);
  assert.equal(z.value.zoneSize.width, 99);
  assert.equal(z.value.rules.safe, true);
  assert.equal(generateZone(WILDS, 1, { spawns: { boss: 'missing' } }).ok, false);
});

test('a template landmark that leaves u/v out starts from the default 0.5, as in a zone file (jitter 0 and jittered)', () => {
  const bare = { ...WILDS, base: { ...WILDS.base, layout: { ...WILDS.base.layout, well: {}, post: { facing: 90 } } } };
  const still = generateZone({ ...bare, jitter: 0 }, 3);
  assert.ok(still.ok, JSON.stringify(!still.ok && still.issues));
  assert.deepEqual(still.value.layout.well, { u: 0.5, v: 0.5, facing: 0 });
  assert.deepEqual(still.value.layout.post, { u: 0.5, v: 0.5, facing: 90 });
  const moved = generateZone(bare, 3);
  assert.ok(moved.ok, JSON.stringify(!moved.ok && moved.issues));
  assert.ok(Math.abs(moved.value.layout.well!.u - 0.5) <= 0.08 + 1e-9 && Math.abs(moved.value.layout.well!.v - 0.5) <= 0.08 + 1e-9);
});

test('templates and seeds are checked before any draw', () => {
  const bad = (t: Partial<Template>, seed = 1) => {
    const r = generateZone({ ...WILDS, ...t }, seed);
    return r.ok ? [] : r.issues.map((i) => `${i.code} ${i.path}`);
  };
  assert.deepEqual(bad({ vary: { 'zoneSize.width': [5, 50] } }), ['out-of-range vary.zoneSize.width']);
  assert.deepEqual(bad({ vary: { 'zoneSize.width': [90, 80] } }), ['out-of-range vary.zoneSize.width']);
  assert.deepEqual(bad({ vary: { 'rules.safe': [0, 1], '__proto__.x': [0, 1], 'layout.u': [0, 1] } }), ['unknown-field vary.rules.safe', 'unknown-field vary.__proto__.x', 'unknown-field vary.layout.u']);
  assert.deepEqual(bad({ jitter: 0.6 }), ['out-of-range jitter']);
  for (const seed of [-1, 1.5, 2 ** 32, NaN]) assert.deepEqual(bad({}, seed), ['out-of-range seed']);
});

test('a generated region of N zones: every connection resolves both ways, and it is the same for the same seed', () => {
  for (const [seed, n] of [[1, 1], [2, 2], [3, 20], [4, 120]] as const) {
    const data = generateRegion(WILDS, seed, n);
    assert.ok(data.ok);
    assert.deepEqual(generateRegion(WILDS, seed, n), data);
    const region = resolveRegion(data.value, 'region:generated');
    assert.ok(region.ok, JSON.stringify(!region.ok && region.issues.slice(0, 3)));
    assert.equal(region.value.size, n);
    let links = 0;
    for (const zone of region.value.values()) links += Object.keys(zone.connections).length;
    assert.ok(links >= 2 * (n - 1), `${n} zones, ${links} link ends`);
  }
  assert.equal(generateRegion(WILDS, 1, 0).ok, false);
});
