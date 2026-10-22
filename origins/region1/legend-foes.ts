// The Pit's legends as Region 1 characters (Combat, 2026-10-22; Dom: Dungeon 1 is the Gladiator Pit, so its creatures are the Pit ladder's own legends, 10 per rank). This file is the only code that reads legend-foes.json and
// the only place a legend becomes a character: one `character-definition` per legend of the legend tables (src/fight/legend-families.ts: LEGEND_FAMILIES + legendText), with
//   id            the rule's idPrefix + the legend's own id (a prefix, so no legend can collide with a creature's id)
//   name, lore    the legend row's name, source citation and backstory (nothing about a single legend is written here)
//   form          one open-world form (encounter: null): the FAMILY's body at the legend's RANK as its world level (1..10; the Pit's own archetype row at that ladder level prices it, no world-level row)
//   kill row      the rule's `killRow`, the same progression row an ordinary mob pays
//   loot          the rule's one shared loot table (the loot table row lists these characters in its `rolledBy`, derived in content.ts, not typed)
// Pure. content.ts merges the results into FOES, KILL_ROWS and the loot registry, so the registry, the writer's fightSetup and the kill rewards see a legend like any open-world creature.
import { tableFromFile, loadRegistry, type Manifest } from '../../src/core/server.ts';
import { LEGEND_FAMILIES, legendText } from '../../src/fight/safe.ts';
import RULES from './legend-foes.json' with { type: 'json' };
import MANIFEST from './legend-foes.manifest.json' with { type: 'json' };

export type PitLegendRule = { readonly id: string; readonly idPrefix: string; readonly form: string; readonly role: string; readonly assetDir: string; readonly killRow: string; readonly lootTable: string };
const TABLE = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, RULES, 'legend-foes.json');
loadRegistry([TABLE]);
if (TABLE.rows.length !== 1) throw Error('legend-foes.json: exactly one rule row (the Pit legend rule)');
export const PIT_LEGEND_RULE = TABLE.rows[0] as unknown as PitLegendRule;

/** The character id of a legend (a legend's id is its spell row's id, the one legend key). */
export const legendCharacterId = (legendId: string): string => `${PIT_LEGEND_RULE.idPrefix}${legendId}`;

type Derived = { readonly id: string; readonly legendId: string; readonly rank: number; readonly opponent: string; readonly record: Record<string, unknown> };
const DERIVED: readonly Derived[] = LEGEND_FAMILIES.flatMap((f) => f.legends.map((e): Derived => {
  const text = legendText(e.legendId);
  if (!text) throw Error(`legend-foes: legend ${e.legendId} of family ${f.id} has no legend row (name, source, backstory)`);
  const id = legendCharacterId(e.legendId);
  return {
    id, legendId: e.legendId, rank: e.rank, opponent: f.opponent,
    record: {
      kind: 'character-definition', schemaVersion: 1, id, name: text.name, lore: { source: text.source, summary: text.backstory }, faction: null, essential: false, relationships: [], questRoles: [],
      presentations: [{ id: 'default', asset: `${PIT_LEGEND_RULE.assetDir}/${f.opponent}.glb` }],
      encounterForms: [{ id: PIT_LEGEND_RULE.form, opponent: f.opponent, level: e.rank, encounter: null }], routine: [],
    },
  };
}));
if (new Set(DERIVED.map((d) => d.id)).size !== DERIVED.length) throw Error('legend-foes: a legend is in two families (its character id would repeat)');

/** One Region 1 character-definition per legend, in family then rank order. */
export const LEGEND_FOES: Record<string, unknown>[] = DERIVED.map((d) => d.record);
/** Every legend character's id (the loot table's `rolledBy`). */
export const LEGEND_CHARACTER_IDS: readonly string[] = DERIVED.map((d) => d.id);
/** The progression row each legend character pays (character id -> row id). */
export const LEGEND_KILL_ROWS: Record<string, string> = Object.fromEntries(DERIVED.map((d) => [d.id, PIT_LEGEND_RULE.killRow]));
/** What a zone's spawn row takes from a legend character: its citation (the legend id, whose row the registry holds), the rule's role and shared loot table, and its world level, its rank. Undefined for a character that is no legend. */
export const legendRowBase = (characterId: string): { source: { legendId: string }; role: string; loot: string; level: readonly [number, number] } | undefined => {
  const d = DERIVED.find((x) => x.id === characterId);
  return d ? { source: { legendId: d.legendId }, role: PIT_LEGEND_RULE.role, loot: PIT_LEGEND_RULE.lootTable, level: [d.rank, d.rank] } : undefined;
};
/** A legend character's body and world level (its rank), for the zone rows that place it. */
export const legendFoeOf = (characterId: string): { legendId: string; opponent: string; rank: number } | null => { const d = DERIVED.find((x) => x.id === characterId); return d ? { legendId: d.legendId, opponent: d.opponent, rank: d.rank } : null; };
