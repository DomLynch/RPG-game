// O1 ids: the scheme, every rejection path, and the legacy mappings proved against today's tables (every LootId, every legend key,
// every roster opponent round-trips).
import assert from 'node:assert/strict';
import test from 'node:test';
import { LOOT_IDS, RETIRED_LOOT } from '../../src/loot.ts';
import { PORTRAIT_KEYS } from '../../src/legends.ts';
import { ROSTER } from '../../src/roster.ts';
import type { Result } from './core.ts';
import {
  NAMESPACES, accountIdFromAuthUid, characterIdFromLegendKey, characterIdFromOpponent, isId, itemIdFromLegacyLoot, legacyLootOfItemId,
  legendKeyOfCharacterId, opponentOfCharacterId, parseId, type CharacterId, type ItemId,
} from './ids.ts';

const codeOf = (r: Result<unknown>): string => (r.ok ? 'ok' : r.issues[0]!.code);

test('ids: one valid id parses in every namespace', () => {
  const samples: Record<(typeof NAMESPACES)[number], string> = {
    account: 'account:0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', pc: 'pc:dom-1', character: 'character:courier-vell', faction: 'faction:ferry-court',
    quest: 'quest:stolen-name', region: 'region:ash-frontier', encounter: 'encounter:ruin-vigil', item: 'item:grave-iron', inst: 'inst:5f0c-1',
    loottable: 'loottable:ghoul', container: 'container:trade.42', service: 'service:exchange-forge', costtable: 'costtable:forge',
  };
  for (const ns of NAMESPACES) assert.equal(codeOf(parseId(samples[ns], ns)), 'ok', ns);
  assert.equal(isId('quest:stolen-name', 'quest'), true);
  assert.equal(isId('quest:stolen-name', 'region'), false);
});

test('ids: every malformed id is refused with an explicit code', () => {
  const cases: [unknown, Parameters<typeof parseId>[1], string][] = [
    [42, 'item', 'bad-id'],
    [null, 'item', 'bad-id'],
    ['grave-iron', 'item', 'bad-id'], // no namespace
    [':grave-iron', 'item', 'bad-id'], // empty namespace
    ['weapon:sword', 'item', 'bad-id'], // unknown namespace
    ['faction:ferry-court', 'item', 'wrong-namespace'],
    ['item:Grave-Iron', 'item', 'bad-id'], // upper case outside the legacy embedding
    ['item:', 'item', 'bad-id'],
    [`item:${'a'.repeat(97)}`, 'item', 'bad-id'],
    ['item:-lead', 'item', 'bad-id'],
    ['item:has space', 'item', 'bad-id'],
    ['item:loot.veteran', 'item', 'bad-id'], // legacy form without a slot
    ['item:loot.Veteran.Helmet', 'item', 'bad-id'], // opponent must be lowercase
    ['item:loot.veteran.Sword', 'item', 'legacy-unknown'], // well formed, names nothing
    ['character:legend.veteran-11', 'character', 'legacy-unknown'],
    ['character:legend.minotaur-1', 'character', 'legacy-unknown'], // not a legend opponent
    ['character:opponent.dragon', 'character', 'legacy-unknown'],
    ['account:not-a-uuid', 'account', 'bad-id'],
    ['account:0B8E2A6C-1F3D-4C5E-9A7B-2C4D6E8F0A1B', 'account', 'bad-id'],
  ];
  for (const [value, ns, code] of cases) assert.equal(codeOf(parseId(value, ns, 'x')), code, JSON.stringify(value));
});

test('ids: every current and retired LootId maps to item:loot.<id> and back, byte for byte', () => {
  assert.ok(LOOT_IDS.size > 70, 'the table under test is the real one');
  for (const lootId of LOOT_IDS) {
    const mapped = itemIdFromLegacyLoot(lootId);
    assert.ok(mapped.ok, lootId);
    assert.equal(mapped.value, `item:loot.${lootId}`);
    assert.ok(parseId(mapped.value, 'item').ok, `${mapped.value} parses as an item id`);
    assert.equal(legacyLootOfItemId(mapped.value), lootId);
  }
  for (const retired of RETIRED_LOOT) assert.ok(itemIdFromLegacyLoot(retired).ok, `retired ${retired} still maps (a roster change never deletes an item)`);
});

test('ids: an unknown loot id never maps, and a new item id has no legacy twin', () => {
  for (const bad of ['veteran.Sword', 'dragon.Helmet', 'veteran', '', 7, null]) assert.equal(codeOf(itemIdFromLegacyLoot(bad)), 'legacy-unknown', String(bad));
  assert.equal(legacyLootOfItemId('item:grave-iron' as ItemId), null);
});

test('ids: every legend key maps to character:legend.<key> and back', () => {
  assert.equal(PORTRAIT_KEYS.length, 100);
  for (const key of PORTRAIT_KEYS) {
    const mapped = characterIdFromLegendKey(key);
    assert.ok(mapped.ok, key);
    assert.equal(mapped.value, `character:legend.${key}`);
    assert.ok(parseId(mapped.value, 'character').ok);
    assert.equal(legendKeyOfCharacterId(mapped.value), key);
  }
  for (const bad of ['veteran-0', 'veteran-11', 'veteran3', 'minotaur-1', 3]) assert.equal(codeOf(characterIdFromLegendKey(bad)), 'legacy-unknown', String(bad));
  assert.equal(legendKeyOfCharacterId('character:courier-vell' as CharacterId), null);
});

test('ids: every roster opponent maps to character:opponent.<id> and back', () => {
  for (const opponent of Object.keys(ROSTER)) {
    const mapped = characterIdFromOpponent(opponent);
    assert.ok(mapped.ok, opponent);
    assert.equal(opponentOfCharacterId(mapped.value), opponent);
  }
  assert.equal(codeOf(characterIdFromOpponent('dragon')), 'legacy-unknown');
  assert.equal(opponentOfCharacterId('character:legend.veteran-1' as CharacterId), null);
});

test('ids: a Supabase uid maps to account:<uuid>; any other spelling is refused', () => {
  const uid = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b';
  const mapped = accountIdFromAuthUid(uid);
  assert.ok(mapped.ok);
  assert.equal(mapped.value, `account:${uid}`);
  assert.equal(codeOf(accountIdFromAuthUid(uid.toUpperCase())), 'bad-id');
  assert.equal(codeOf(accountIdFromAuthUid('dom')), 'bad-id');
});
