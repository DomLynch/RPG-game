// Zones 1 and 2 are DATA ROWS (origins/zone-rows/zone<N>.row.json), read by the registry with no per-zone TypeScript. The loaded zone is exactly what the hand-written folders gave: Zone 2 by the hash taken at trunk
// 968f996f3 (Lead + Strategy merge gate: this test and tests/k7-engine-parity.test.ts green on the same head). (Whole-zone hashes of Zones 1 and 2, resolved tree included, were equal before and after the folders became rows: the PR body has them.)
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { loadZone } from '../origins/zones/loader.ts';

// sha256 of the loaded Zone 2 (the fields below, as JSON). Re-pinned 2026-10-10: ember-wolf campSize [2,4] -> [2,2] and a four-wolf ruin camp (spawns reach-pack-a/b at reach-ruin).
// Re-pinned 2026-10-12 (stage 1 of mob looks into rows): Zone 2's row now carries its own mobLooks copies of the five kinds it shared with the central table (scavenger, brood, ghoul, bear, boar, byte for byte); the hash of every look Zone 2 can show is unchanged (a1d3c89b21b319b7 before and after, see the PR). The previous pin was f2812659d4eaa140.
const ZONE2_BEFORE_THE_SWAP = 'fefc8060b662812faff8ee880aee658343da393620ac4ee60534e8a764f9c69d';

test('Zone 2 loads to exactly the data the hand-written Zone 2 did', () => {
  const z = loadZone('2'), body = { id: z.id, level: z.level, name: z.name, names: z.names, world: z.world, spawns: z.spawns, kit: z.kit, looks: z.looks, mobLooks: z.mobLooks, place: z.place };
  assert.equal(createHash('sha256').update(JSON.stringify(body)).digest('hex'), ZONE2_BEFORE_THE_SWAP);
});
