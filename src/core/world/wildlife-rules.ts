// The wildlife row validator's bounds as data (World, hard-coding audit #3055 item 11): the rarity weights, the rare chance range, the respawn range and each behaviour field's [min, max], one row each
// (id, value, unit) through the shared loader (src/core/registry.ts). Every default equals the literal it replaced (tests/wildlife-rules.test.ts pins them). Unlike world-rules-defs.json a value may be 0
// (rare weight 0, roam min 0), and this file is not part of the world digest: it bounds what a content row may say, it is not read by a tick. Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../registry.ts';
import DEFS from './wildlife-rules-defs.json' with { type: 'json' };
import MANIFEST from './wildlife-rules-defs.manifest.json' with { type: 'json' };

export type WildlifeRule = { readonly id: string; readonly value: number; readonly unit: string };
const NAMED = ['rareChanceMin', 'rareChanceMax', 'respawnMin', 'respawnMax', 'aggroMin', 'aggroMax', 'leashMin', 'leashMax', 'roamMin', 'roamMax', 'spreadMin', 'spreadMax', 'pullMin', 'pullMax'] as const;
/** The one loader: rows keyed by id (a duplicate id or a missing or mistyped field is refused), every bound the validator reads by name must exist and be a number >= 0. */
export function loadWildlifeRules(raw: { rules?: readonly unknown[] }): readonly WildlifeRule[] {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'wildlife-rules-defs.json')]);
  const rows = (raw.rules ?? []) as readonly WildlifeRule[];
  for (const r of rows) if (!(Number.isFinite(r.value) && r.value >= 0)) throw Error(`wildlife-rules "${r.id}": value is a number >= 0`);
  for (const must of NAMED) if (!rows.some((r) => r.id === must)) throw Error(`wildlife-rules: the validator reads the "${must}" rule by name, so it needs a row`);
  return rows;
}
// The mob rarity tiers (wildlife-rarity table): a tier's draw weight, whether it is the default tier of a row that names none, and whether it `replaces`
// (a replacer is never drawn on its own: it stands in a placeholder's camp, so its row names the placeholder). The validator reads these flags, not tier names.
export type WildlifeRarity = { readonly id: string; readonly weight: number; readonly default?: boolean; readonly replaces?: boolean };
/** The tier loader: a duplicate id or missing/mistyped field is refused, weights are >= 0, exactly one default tier and at least one replacer. */
export function loadWildlifeRarities(raw: { rarities?: readonly unknown[] }): readonly WildlifeRarity[] {
  loadRegistry([tableFromFile(MANIFEST.tables[1] as unknown as Manifest, raw, 'wildlife-rules-defs.json')]);
  const rows = (raw.rarities ?? []) as readonly WildlifeRarity[];
  for (const r of rows) if (!(Number.isFinite(r.weight) && r.weight >= 0)) throw Error(`wildlife-rules rarity "${r.id}": weight is a number >= 0`);
  if (rows.filter((r) => r.default).length !== 1) throw Error('wildlife-rules: exactly one rarity tier is the default');
  if (!rows.some((r) => r.replaces)) throw Error('wildlife-rules: a rarity tier must replace (the rare tier stands in a placeholder camp)');
  return rows;
}
export const WILDLIFE_RARITIES: readonly WildlifeRarity[] = loadWildlifeRarities(DEFS);
export const WILDLIFE_RULES: readonly WildlifeRule[] = loadWildlifeRules(DEFS);
export const wildlifeRule = (id: (typeof NAMED)[number]): number => WILDLIFE_RULES.find((r) => r.id === id)!.value;
