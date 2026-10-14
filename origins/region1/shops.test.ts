import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { REGION1_SHOPS } from './shops.ts';
import { BUNDLE } from './content.ts';
import { validateShopList } from '../shops/shop.ts';
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DATA from './shops.json' with { type: 'json' };
import MANIFEST from './shops.manifest.json' with { type: 'json' };

// Taken from trunk a379108ed (after Backend's #2586 added zone and class), where the list was built in shops.ts: the move to shops.json must change no value.
const TRUNK_SHA = '4ae46a4b06d9fa44e8bffb253ea988ffe20fc53fa98af4ceb14c4aee3ef59a18';

test('the shop rows read back byte-identical to the list shops.ts built in code', () => {
  assert.equal(createHash('sha256').update(JSON.stringify([...REGION1_SHOPS])).digest('hex'), TRUNK_SHA);
});

test('every shop list validates and every item it sells is a bundle record', () => {
  const ids = new Set((BUNDLE as unknown as readonly { id: string }[]).map((r) => r.id));
  for (const list of REGION1_SHOPS.values()) assert.deepEqual(validateShopList(list, (id) => ids.has(id)), []);
});

test('a shop row with a missing or mistyped field fails the loader', () => {
  const load = (shops: unknown[]) => () => loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, { shops }, 'shops.json')]);
  const row = DATA.shops[0]!;
  assert.doesNotThrow(load([row]));
  assert.throws(load([{ ...row, rows: [{ item: 'item:x', max: 1, restockSeconds: 60 }] }]), /rows\[\]\.price|price/);
  assert.throws(load([{ ...row, revision: 'one' }]), /revision/);
});
