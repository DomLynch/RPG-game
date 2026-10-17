import assert from 'node:assert/strict';
import test from 'node:test';
import { REGION1_NPCS } from '../origins/region1/npcs.ts';
import { SHOP_HOURS, type NpcRow } from '../origins/npcs/row.ts';
import { ROLE_RING, CROWD } from '../origins/crowd/crowd.ts';
import { WILDLIFE_ROWS } from '../src/core/world/wildlife-rows.ts';
import type { MobRow } from '../src/core/world/row.ts';

// The content tables that were TypeScript literals are now json rows (Dom's data-layer rule 2026-10-13). Each test pins the loaded rows, byte for byte (JSON text, so key order counts), to the literal it replaced.

test('region1 NPC rows equal the literals they replaced', () => {
  const was: readonly NpcRow[] = [
    { npc: 'character:banker-exchange', roles: ['banker'], zone: 'exchange', at: 'bank', hours: 'always', outfit: { pieces: ['robe', 'sleeves', 'belt', 'cap'], tint: 0x6b7f5e } },
    { npc: 'character:provisioner-exchange', roles: ['vendor'], zone: 'exchange', at: 'forge', hours: SHOP_HOURS, shop: 'service:exchange-provisioner', outfit: { pieces: ['tunic', 'apron', 'belt', 'hat'], tint: 0x8a6f4a } },
    { npc: 'character:innkeeper-exchange', roles: ['innkeeper'], zone: 'exchange', at: 'inn', hours: 'always', outfit: { pieces: ['tunic', 'sleeves', 'apron', 'belt'], tint: 0x7a5c6a } },
    { npc: 'character:recorder-marrow', roles: ['recorder'], zone: 'exchange', at: 'contract-board', hours: SHOP_HOURS },
    { npc: 'character:smith-quarter', roles: ['smith'], zone: 'exchange-quarter', at: 'quarter-forge', hours: SHOP_HOURS },
    { npc: 'character:healer-quarter', roles: ['healer'], zone: 'exchange-quarter', at: 'quarter-healer', hours: SHOP_HOURS },
    { npc: 'character:fence-quarter', roles: ['fence'], zone: 'exchange-quarter', at: 'quarter-fence', hours: [20, 4] },
  ];
  assert.equal(JSON.stringify(REGION1_NPCS), JSON.stringify(was));
});

test('the crowd role rings equal the literals they replaced', () => {
  const was = {
    duellist: { radius: 5, pace: 0.006 },
    brute: { radius: 5.5, pace: 0.003 },
    skirmisher: { radius: CROWD.ring.min, pace: 0.012 },
    leader: { radius: CROWD.ring.max, pace: 0.002 },
  };
  assert.equal(JSON.stringify(ROLE_RING), JSON.stringify(was));
});

test('the wildlife rows equal the literals they replaced', () => {
  const pending = { pending: 'Content/Strategy to cite (legends-rule)' };
  const was: readonly MobRow[] = [
    { id: 'character:cinder-hound', later: true, source: pending, role: 'beast', loot: 'loottable:cinder-hound', level: [12, 14], behaviour: { aggro: 9, roam: 7, spread: 10, campSize: [2, 3] } },
  ];
  assert.equal(JSON.stringify(WILDLIFE_ROWS), JSON.stringify(was));
});
