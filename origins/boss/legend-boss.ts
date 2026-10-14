// Legend bosses (World, Lead's top item 2026-10-13): the grimoire grants a spell on a VERIFIED win of `boss:<legend>` (origins/server/grimoire.ts), so the server has to be able to RESOLVE that fight.
// A legend's fight is its opponent family's body at its rank: the legend key (a spell row's id without `spell:`, the ONE key of src/fight/legend-families.ts) names a family and a rank, the family
// names the body (OPPONENTS id), and the rank names the level (the TOP level of that Pit rung, the hardest the legend wears). Only a legend with a spell row is a boss (a spellless legend teaches
// nothing, so there is nothing to earn). Donors: EQEmu's named spawns (a rare is a spawn entry with its own npc_type) and the Pit's own rank ladder for the stats. Pure: no DOM, no clock, no storage.
import { isSpellless } from '../../src/fight/server.ts';
import { legendOfFight } from '../server/grimoire.ts';   // the one place that knows which legend has a spell row (the guard in grimoire.test.ts keeps the spell catalogue behind it)
import { LEGEND_VIEWS, bossFightId, type LegendBoss } from './legend-view.ts';   // the page-safe half: the fight id, the placement rows, the name/body/level view
export { LEGEND_SPAWNS, bossFightId, legendSpawnsIn, type LegendBoss, type LegendSpawn } from './legend-view.ts';

const ALL: readonly LegendBoss[] = LEGEND_VIEWS.filter((b) => !isSpellless(b.legend) && legendOfFight(bossFightId(b.legend)) !== null);
const BY_LEGEND = new Map(ALL.map((b) => [b.legend, b] as const));

/** Every legend boss, in family then rank order. */
export const LEGEND_BOSSES: readonly LegendBoss[] = ALL;
/** The boss fight a legend key names, or null (no such legend, a spellless legend, or a legend no family wears). */
export const legendBoss = (legend: string): LegendBoss | null => BY_LEGEND.get(legend) ?? null;
/** One region's legend bosses (`region:ash-frontier`). */
export const legendBossesOf = (region: string): readonly LegendBoss[] => ALL.filter((b) => b.region === region);

// ---- where a legend boss stands: the spawn row kind ---------------------------------------------------------------------------------------------------
// legend-spawns.json: one row per standing legend boss, keyed by its own id: {order, legend (a legend boss key), zone (a zone id), at (a landmark of that zone)}. A legend can stand at several
// places (several rows). `zone` is a plan zone id (cinder-fields) and `at` one of that zone's plan landmarks (ash-pits). The first-pass rows are for the owner to move, one row each; the loader refuses a legend
// that is not a boss, an unknown zone and a landmark the zone does not have. The page starts the fight with `bossFightId(legend)` through encounter_start, so a win settles as boss:<legend> and takes the spell.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import type { LegendSpawn } from './legend-view.ts';
import MANIFEST from './legend-spawns.manifest.json' with { type: 'json' };

export type LegendSpawnKnown = { zones: ReadonlySet<string>; landmarks(zone: string): ReadonlySet<string> };
/** The one loader: the registry's duplicate/missing/mistyped checks, then the cross-rules (a real legend boss, a real zone, a landmark that zone has). */
export function loadLegendSpawns(raw: { spawns?: unknown }, known: LegendSpawnKnown): readonly LegendSpawn[] {
  const table = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'legend-spawns.json');
  loadRegistry([table]);
  const rows = (table.rows as unknown as LegendSpawn[]).slice().sort((a, b) => a.order - b.order);
  for (const r of rows) {
    if (!legendBoss(r.legend)) throw Error(`legend-spawns "${r.id}": ${r.legend} is not a legend boss (it needs a spell row and a family)`);
    if (!known.zones.has(r.zone)) throw Error(`legend-spawns "${r.id}": ${r.zone} is not a zone`);
    if (!known.landmarks(r.zone).has(r.at)) throw Error(`legend-spawns "${r.id}": ${r.zone} has no landmark ${r.at}`);
  }
  return rows;
}
