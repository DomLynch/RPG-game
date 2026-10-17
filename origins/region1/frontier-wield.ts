// The Frontier drops' bridge to the engine's LootId (Lead 2026-10-17; Characters & Art picked the looks): an `item:frontier.*` piece has no LootId of its own, so the sheet, the paperdoll and the fight
// (worn-gear.ts skips an item with no LootId) ignored it and a drop never moved a fight number. One row per Frontier item names the existing opponent piece it wears and weighs as (nearest slot,
// then material; no new art). Same shape and loader rules as starter-wield.ts; the piece stays the Frontier item (its own id), only the stand-in LootId is borrowed. Its RUNG is the mint's
// (loot-tier.json), not the row's.
import { isLootId, loadRegistry, tableFromFile, type LootId, type Manifest } from '../../src/core/server.ts';
import DATA from './frontier-wield.json' with { type: 'json' };
import MANIFEST from './frontier-wield.manifest.json' with { type: 'json' };

/** The one loader: rows keyed by item id (a duplicate id or a missing field is refused), the item must be a Frontier item and the LootId one this game knows. */
export function loadFrontierWield(raw: { wield?: readonly unknown[] }): ReadonlyMap<string, LootId> {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'frontier-wield.json')]);
  const rows = (raw.wield ?? []) as readonly { id: string; lootId: string }[];
  for (const r of rows) {
    if (!r.id.startsWith('item:frontier.')) throw Error(`frontier-wield "${r.id}": only an item:frontier.* item takes a stand-in LootId here`);
    if (!isLootId(r.lootId)) throw Error(`frontier-wield "${r.id}": "${r.lootId}" is not a LootId this game knows`);
  }
  return new Map(rows.map((r) => [r.id, r.lootId as LootId]));
}
export const FRONTIER_WIELD: ReadonlyMap<string, LootId> = loadFrontierWield(DATA);
