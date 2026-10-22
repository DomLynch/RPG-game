// The Pit's legends as Region 1 characters (Combat, 2026-10-22; Dom: Dungeon 1 is the Gladiator Pit, so its creatures are the Pit ladder's own legends, 10 per rank). This file is the only code that reads legend-foes.json and
// the only place a legend becomes a character, and it writes NO character row: it maps the legend tables (src/fight/legend-families.ts: LEGEND_FAMILIES + legendText) over the character TEMPLATE row of legend-foes.json, filling
//   {id}         the rule's idPrefix + the legend's own id (a prefix, so no legend can collide with a creature's id; `character:legend.` is the contracts' legacy form)
//   {name} {source} {backstory}   the legend row's name, source citation and backstory
//   {opponent}   the legend's FAMILY body; {rank} the legend's rank, its world level (1..10; the Pit's own archetype row at that ladder level prices it, no world-level row)
// The rule row also names the progression row a legend pays (`killRow`) and the one shared loot table (`lootTable`; its loot-table row lists these characters in `rolledBy`, derived in content.ts, not typed).
// Pure. content.ts merges the results into the bundle, KILL_ROWS and the loot registry, so the registry, the writer's fightSetup and the kill rewards see a legend like any open-world creature.
import { tableFromFile, loadRegistry, type Manifest } from '../../src/core/server.ts';
import { LEGEND_FAMILIES, legendText } from '../../src/fight/safe.ts';
import RULES from './legend-foes.json' with { type: 'json' };
import MANIFEST from './legend-foes.manifest.json' with { type: 'json' };

export type PitLegendRule = { readonly id: string; readonly idPrefix: string; readonly role: string; readonly killRow: string; readonly lootTable: string; readonly template: Readonly<Record<string, unknown>> };
const TABLE = tableFromFile(MANIFEST.tables[0] as unknown as Manifest, RULES, 'legend-foes.json');
loadRegistry([TABLE]);
if (TABLE.rows.length !== 1) throw Error('legend-foes.json: exactly one rule row (the Pit legend rule)');
export const PIT_LEGEND_RULE = TABLE.rows[0] as unknown as PitLegendRule;

/** The character id of a legend (a legend's id is its spell row's id, the one legend key). */
export const legendCharacterId = (legendId: string): string => `${PIT_LEGEND_RULE.idPrefix}${legendId}`;

type Vars = Readonly<Record<string, string | number>>;
/** The template with its `{name}` placeholders filled: a string that is exactly one placeholder takes the variable's own type (a number stays a number), a placeholder inside a longer string is spliced in. A placeholder the vars lack is an error, never an empty hole. */
const fill = (node: unknown, vars: Vars, at = 'template'): unknown => {
  if (typeof node === 'string') {
    const whole = /^\{(\w+)\}$/.exec(node);
    if (whole) { if (!(whole[1]! in vars)) throw Error(`legend-foes: ${at} names {${whole[1]}}, which a legend does not have`); return vars[whole[1]!]; }
    return node.replace(/\{(\w+)\}/g, (_m, k: string) => { if (!(k in vars)) throw Error(`legend-foes: ${at} names {${k}}, which a legend does not have`); return String(vars[k]); });
  }
  if (Array.isArray(node)) return node.map((x, i) => fill(x, vars, `${at}[${i}]`));
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, fill(v, vars, `${at}.${k}`)]));
  return node;
};

type Derived = { readonly id: string; readonly legendId: string; readonly rank: number; readonly opponent: string; readonly record: Record<string, unknown> };
const DERIVED: readonly Derived[] = LEGEND_FAMILIES.flatMap((f) => f.legends.map((e): Derived => {
  const text = legendText(e.legendId);
  if (!text) throw Error(`legend-foes: legend ${e.legendId} of family ${f.id} has no legend row (name, source, backstory)`);
  const id = legendCharacterId(e.legendId);
  return { id, legendId: e.legendId, rank: e.rank, opponent: f.opponent, record: fill(PIT_LEGEND_RULE.template, { id, name: text.name, source: text.source, backstory: text.backstory, opponent: f.opponent, rank: e.rank }) as Record<string, unknown> };
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
