// The PAGE-SAFE half of the legend bosses (World, 2026-10-13): what the page needs to draw and start a placed legend: the fight id, the placement rows, and a legend's name / body / level read from the legend
// families. Nothing here imports origins/server or src/fight/server.ts (the spell catalogue and the writer's door stay out of the built page; tests/preview-no-server.test.ts guards the whole
// origins/preview tree). Whether a legend has a spell row is the SERVER's question (origins/boss/legend-boss.ts, which filters this list by the grimoire and loads the placement rows against the real zones).
import { LEGEND_FAMILIES, legendText, rungTopLevel } from '../../src/fight/safe.ts';
import SPAWNS from './legend-spawns.json' with { type: 'json' };

export type LegendBoss = { readonly legend: string; readonly name: string; readonly fight: string; readonly enemy: string; readonly family: string; readonly region: string; readonly rank: number; readonly level: number };
export const bossFightId = (legend: string): string => `boss:${legend}`;
/** Every legend a family wears, in family then rank order, as a boss view (a legend's fight is its family's body at the TOP level of its rank's rung). */
export const LEGEND_VIEWS: readonly LegendBoss[] = LEGEND_FAMILIES.flatMap((f) => f.legends.map((e): LegendBoss => ({ legend: e.legendId, name: legendText(e.legendId)?.name ?? e.legendId, fight: bossFightId(e.legendId), enemy: f.opponent, family: f.id, region: f.region, rank: e.rank, level: rungTopLevel(e.rank) })));
const VIEW = new Map(LEGEND_VIEWS.map((b) => [b.legend, b] as const));
/** A legend key's boss view, or null (no family wears it). Not a promise it can be fought: the server resolves only a legend with a spell row AND a placement row. */
export const legendView = (legend: string): LegendBoss | null => VIEW.get(legend) ?? null;

// legend-spawns.json: one row per standing legend boss, keyed by its own id: {order, legend, zone (a zone id), at (a landmark of that zone), dx/dz optional metres off the landmark}. The loader that checks it against the real zones is the server half.
export type LegendSpawn = { readonly id: string; readonly order: number; readonly legend: string; readonly zone: string; readonly at: string; readonly dx?: number; readonly dz?: number };   // dx/dz: metres off the landmark (a landmark may sit on a prop; the legend stands beside it)
export const LEGEND_SPAWNS: readonly LegendSpawn[] = Object.entries((SPAWNS as { spawns: Record<string, Omit<LegendSpawn, 'id'>> }).spawns).map(([id, r]) => ({ id, ...r })).sort((a, b) => a.order - b.order);   // validated against the real zones by origins/boss/legend-boss.test.ts
export const legendSpawnsIn = (zone: string, spawns: readonly LegendSpawn[] = LEGEND_SPAWNS): LegendSpawn[] => spawns.filter((s) => s.zone === zone);
