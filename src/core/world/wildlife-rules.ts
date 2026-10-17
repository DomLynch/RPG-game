// The wildlife row validator's bounds as data (World, hard-coding audit #3055 item 11): the rarity weights, the rare chance range, the respawn range and each behaviour field's [min, max], one row each
// (id, value, unit) through the shared loader (src/core/registry.ts). Every default equals the literal it replaced (tests/wildlife-rules.test.ts pins them). Unlike world-rules-defs.json a value may be 0
// (rare weight 0, roam min 0), and this file is not part of the world digest: it bounds what a content row may say, it is not read by a tick. Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../registry.ts';
import DEFS from './wildlife-rules-defs.json' with { type: 'json' };
import MANIFEST from './wildlife-rules-defs.manifest.json' with { type: 'json' };

export type WildlifeRule = { readonly id: string; readonly value: number; readonly unit: string };
const NAMED = ['rarityCommon', 'rarityUncommon', 'rarityRare', 'rareChanceMin', 'rareChanceMax', 'respawnMin', 'respawnMax', 'aggroMin', 'aggroMax', 'leashMin', 'leashMax', 'roamMin', 'roamMax', 'spreadMin', 'spreadMax', 'pullMin', 'pullMax'] as const;
/** The one loader: rows keyed by id (a duplicate id or a missing or mistyped field is refused), every bound the validator reads by name must exist and be a number >= 0. */
export function loadWildlifeRules(raw: { rules?: readonly unknown[] }): readonly WildlifeRule[] {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'wildlife-rules-defs.json')]);
  const rows = (raw.rules ?? []) as readonly WildlifeRule[];
  for (const r of rows) if (!(Number.isFinite(r.value) && r.value >= 0)) throw Error(`wildlife-rules "${r.id}": value is a number >= 0`);
  for (const must of NAMED) if (!rows.some((r) => r.id === must)) throw Error(`wildlife-rules: the validator reads the "${must}" rule by name, so it needs a row`);
  return rows;
}
export const WILDLIFE_RULES: readonly WildlifeRule[] = loadWildlifeRules(DEFS);
export const wildlifeRule = (id: (typeof NAMED)[number]): number => WILDLIFE_RULES.find((r) => r.id === id)!.value;
