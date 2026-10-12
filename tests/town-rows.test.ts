// Towns are rows (origins/region1/towns.json): the rows are byte-identical to the old code, and a new trade, temperament or town is one row.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { BUNDLE, LOCAL } from '../origins/region1/content.ts';
import { loadRegion1, type Local } from '../origins/region1/load.ts';
import { REGION1_WORLD } from '../origins/region1/world.ts';

const TOWNS_SHA = 'edfe8162dc5b9092bb61570ff8cd1f4591000eb460f4995695bf39a09bbe47b1';
const load = (edit: (l: Local) => void) => { const l = structuredClone(LOCAL) as Local; edit(l); return loadRegion1(REGION1_WORLD, BUNDLE, l); };
const codes = (r: ReturnType<typeof loadRegion1>) => (r.ok ? [] : r.issues.map((i) => `${i.code} ${i.path}`));

test('the town rows equal the pre-rows code byte for byte', () => {
  assert.equal(createHash('sha256').update(JSON.stringify(LOCAL.towns)).digest('hex'), TOWNS_SHA);
});

test('a new trade is one definitions row, an unknown trade, temperament or title is a data error', () => {
  const ok = load((l) => { l.townDefs.trades!.armourer = {}; l.towns[1]!.services.push({ trade: 'armourer', npc: 'character:smith-cinder', at: 'hold-forge' }); });
  assert.ok(!codes(ok).some((c) => c.startsWith('unknown-id')), JSON.stringify(codes(ok)));
  assert.ok(codes(load((l) => { l.towns[1]!.services[0]!.trade = 'armourer'; })).some((c) => c.startsWith('unknown-id') && c.includes('trade')));
  assert.ok(codes(load((l) => { l.towns[0]!.ruler.temperament = 'brooding'; })).some((c) => c.startsWith('unknown-id') && c.includes('temperament')));
  assert.ok(codes(load((l) => { l.towns[0]!.ruler.title = 'doge'; })).some((c) => c.startsWith('unknown-id') && c.includes('title')));
});

test('an unknown town field passes through in ext instead of being refused', () => {
  const r = load((l) => { (l.towns[2] as Record<string, unknown>)['mod:market'] = { day: 'friday' }; });
  assert.ok(r.ok, JSON.stringify(codes(r)));
  assert.deepEqual(r.value.towns[2]!.ext, { 'mod:market': { day: 'friday' } });
  assert.deepEqual(r.value.towns[0]!.ext, {});
});
