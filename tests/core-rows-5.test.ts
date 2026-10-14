// Five more Characters numbers as rows (Dom's data-layer rule): the loot panel's tap guard and the gear room's framing keep the values they had in code.
import assert from 'node:assert/strict';
import test from 'node:test';
import { TAP_GUARD_MS } from '../src/core/loot-panel.ts';
import { KEEPALIVE_CAP, checkLootRules } from '../src/core/loot.ts';
import { KEEPALIVE_BYTES } from '../src/core/loot-claims.ts';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import lootRaw from '../src/core/loot-rules.json' with { type: 'json' };
import lootMan from '../src/core/loot-rules.manifest.json' with { type: 'json' };
import roomRaw from '../src/core/gear-room-rules.json' with { type: 'json' };
import roomMan from '../src/core/gear-room-rules.manifest.json' with { type: 'json' };

test('the loot panel tap guard keeps its 300 ms', () => assert.equal(TAP_GUARD_MS, 300));

test('the gear room row keeps the framing it had in code (gear-room.ts imports three, so the row is pinned here)', () => {
  assert.deepEqual(roomRaw.gearRoomRule, [{ id: 'gear-room', bodyM: 2.15, aimY: 0.98, backdrop: '#0d0b09', turnRadPerPx: 0.012 }]);
  assert.equal(parseInt(roomRaw.gearRoomRule[0]!.backdrop.slice(1), 16), 0x0d0b09);
});

test('both rows files load through the registry', () => {
  for (const [raw, man, name] of [[lootRaw, lootMan, 'loot-rules.json'], [roomRaw, roomMan, 'gear-room-rules.json']] as const)
    assert.ok(loadRegistry(man.tables.map((t) => tableFromFile(t as unknown as Manifest, raw, name))));
});

test('keepaliveBytes may not pass the 64 KB platform cap (a retune cannot exceed it)', () => {
  const row = lootRaw.lootRule[0]!;
  assert.equal(KEEPALIVE_CAP, 65536);
  assert.deepEqual(lootRaw.platformCap, [{ id: 'keepalive-body', bytes: 65536 }]);
  assert.ok(KEEPALIVE_BYTES <= KEEPALIVE_CAP);
  assert.doesNotThrow(() => checkLootRules([row]));
  assert.doesNotThrow(() => checkLootRules([{ ...row, keepaliveBytes: 65536 }]));
  assert.throws(() => checkLootRules([{ ...row, keepaliveBytes: 65537 }]), /keepaliveBytes/);
  assert.throws(() => checkLootRules([{ ...row, keepaliveBytes: 0 }]), /keepaliveBytes/);
});
