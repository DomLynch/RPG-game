// Zone 2 is GENERATED from its data row (origins/zone-rows/zone2.row.json, scripts/new-zone.mjs --from): the committed folder is byte-for-byte what the row makes, and loading it gives exactly the data the
// hand-written folder gave (a hash of the loaded zone, taken BEFORE the swap). Step 4 of track B (Lead + Strategy merge gate: this test and tests/k7-engine-parity.test.ts green on the same head).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { ZONES_DIR } from '../scripts/gen-zones.mjs';
import { newZone } from '../scripts/new-zone.mjs';
import { loadZone } from '../origins/zones/loader.ts';

const ROW = JSON.parse(readFileSync(new URL('../origins/zone-rows/zone2.row.json', import.meta.url), 'utf8'));   // outside origins/zones/: that folder holds only zone<N>/ packages
// sha256 of the loaded Zone 2 (the fields below, as JSON) from the hand-written folder at trunk 968f996f3, before it was generated from the row. Re-pinned 2026-10-10: ember-wolf campSize [2,4] -> [2,2] (pack balance, scripts/pack-battery.ts), the only change.
const ZONE2_BEFORE_THE_SWAP = '62358aa4f49187670e69ca195074865133bef4aa88f80448071693de0d470e4c';

test('regenerating Zone 2 from its row gives the committed files, byte for byte', () => {
  const scratch = mkdtempSync(`${tmpdir()}/zone2-row-`);
  try {
    newZone({ n: 2, row: ROW, dir: `${scratch}/` });
    const made = readdirSync(`${scratch}/zone2`).sort(), committed = readdirSync(`${ZONES_DIR}zone2`).sort();
    assert.deepEqual(made, committed, 'the same files (a hand-added file in zone2/ is not in the row)');
    for (const f of made) assert.equal(readFileSync(`${ZONES_DIR}zone2/${f}`, 'utf8'), readFileSync(`${scratch}/zone2/${f}`, 'utf8'), `${f}: edit the row (origins/zone-rows/zone2.row.json) and regenerate, not the file`);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('the generated Zone 2 loads to exactly the data the hand-written Zone 2 did', () => {
  const z = loadZone('2'), body = { id: z.id, level: z.level, name: z.name, names: z.names, world: z.world, spawns: z.spawns, kit: z.kit, looks: z.looks, mobLooks: z.mobLooks, place: z.place };
  assert.equal(createHash('sha256').update(JSON.stringify(body)).digest('hex'), ZONE2_BEFORE_THE_SWAP);
});
