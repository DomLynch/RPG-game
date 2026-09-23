import test from 'node:test';
import assert from 'node:assert/strict';
import { DWARF_BONES, GOBLIN_BONES, PROPORTION_TABLES } from '../scripts/warrior-recipe.mjs';

// `unscale: "<name>"` in loot.json inverts a fighter's re-proportioning field through the piece's own weights
// (scripts/build-warrior.mjs). The lookup used to be a hand-kept `{ dwarf: DWARF_BONES }` while the goblin's table sat
// inline in `BUILD`, which is narrowed to one fighter per run — so `unscale: "goblin"` threw `loot: no proportion table
// for goblin` and a goblin-cut piece failed the BUILD, not the fit. This pins the two sides to one list.
type Bones = Record<string, readonly number[]>;
const tables = PROPORTION_TABLES as Record<string, Bones>;

test('loot unscale: every re-proportioned fighter is registered, and each table is per-bone [x, y, z] scales', () => {
  assert.deepEqual(Object.keys(tables).sort(), ['dwarf', 'goblin'], 'the registered tables are exactly the re-proportioned fighters');
  assert.equal(tables.goblin, GOBLIN_BONES, 'the goblin resolves to the same table his body is built from — not a copy that could drift');
  assert.equal(tables.dwarf, DWARF_BONES, 'and so does the dwarf');
  for (const [id, bones] of Object.entries(tables)) {
    const entries = Object.entries(bones);
    assert.ok(entries.length, `${id}: a bones table with no bones is not a re-proportioning`);
    for (const [bone, scale] of entries) {
      assert.equal(scale.length, 3, `${id}.${bone}: a per-bone scale is [x, y, z]`);
      for (const n of scale) assert.ok(Number.isFinite(n) && n > 0, `${id}.${bone}: ${n} must be a positive finite scale`);
    }
  }
});

test('loot unscale: the goblin carries the shape the Boots fit was measured against', () => {
  // The Goblin lane measured calf 385.4 mm against the hero's 458.8 — ratio .8400 — and the foot identical after one
  // rigid shift. That only holds while the legs are y-only: girth untouched is why a shaft pins by FRACTION of calf
  // length rather than absolute height. If these ever change, the boot fit is stale, not merely different.
  for (const bone of ['thigh_l', 'thigh_r', 'calf_l', 'calf_r']) assert.deepEqual(GOBLIN_BONES[bone as keyof typeof GOBLIN_BONES], [1, .84, 1], `${bone}: short legs, girth untouched`);
  assert.ok(!('foot_l' in GOBLIN_BONES) && !('foot_r' in GOBLIN_BONES), 'his feet are NOT re-proportioned — a shoe cut on the hero fits, a shaft does not');
});

test('loot unscale: a fighter who was never re-proportioned stays unregistered, so an unscale against him is still an error', () => {
  for (const id of ['hero', 'veteran', 'pitborn', 'nightborn', 'executioner']) assert.equal(tables[id], undefined, `${id} has no proportion table — unscaling against him is a manifest mistake, not a fit`);
});
