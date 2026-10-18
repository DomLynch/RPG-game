// The creature height ladder (Dom 2026-10-18, via Lead: "size is a cheap trick", so a creature's size rises with its zone's tier): each zone tier has a cap on the DRAWN height of a creature, in metres. Drawn height is the
// body's rest-pose height (the GLB's bounds, the `bodies` rows, measured by scripts/body-heights.mjs and pinned by the GLB's hash) times the scale the creature is drawn at (the zone row's mob look, else the catalogue's
// render.scale): not the raw scale factor. A creature over its zone's cap is refused by the zone validator (zoneProblems) unless a named exception row (with its reason) lets it through. Pure: rows in, problems out.
// Length is recorded beside height (the same script) but only height is checked: Dom is deciding whether "size" means the biggest dimension.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import { catalogueRow } from '../../src/fight/index.ts';   // the engine's door (K7: a zone reaches the catalogue through it)
import DEFS from './height-ladder.json' with { type: 'json' };
import MANIFEST from './height-ladder.manifest.json' with { type: 'json' };

export type HeightTier = { readonly id: string; readonly fromZone: number; readonly capM: number };
export type BodyHeight = { readonly id: string; readonly heightM: number; readonly lengthM: number; readonly glb: string; readonly sha256: string };
export type HeightException = { readonly id: string; readonly zone: string; readonly character: string; readonly reason: string };
type Raw = { ladder?: readonly unknown[]; bodies?: readonly unknown[]; exceptions?: readonly unknown[] };

/** The one loader: each table is checked by the registry (a duplicate id or a missing or mistyped field is refused), then the numbers (positive) and the ladder's order (tiers ascend by zone, from Zone 1). */
export function loadHeightLadder(raw: Raw) {
  loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((t) => tableFromFile(t, raw as never, 'height-ladder.json')));
  const ladder = [...((raw.ladder ?? []) as readonly HeightTier[])].sort((a, b) => a.fromZone - b.fromZone), bodies = (raw.bodies ?? []) as readonly BodyHeight[], exceptions = (raw.exceptions ?? []) as readonly HeightException[];
  for (const t of ladder) if (!(Number.isInteger(t.fromZone) && t.fromZone >= 1 && t.capM > 0)) throw Error(`height-ladder tier "${t.id}": fromZone is a whole number >= 1 and capM is a number > 0`);
  if (ladder.length === 0 || ladder[0]!.fromZone !== 1) throw Error('height-ladder: the first tier starts at Zone 1');
  if (new Set(ladder.map((t) => t.fromZone)).size !== ladder.length) throw Error('height-ladder: two tiers start at the same zone');
  for (let i = 1; i < ladder.length; i++) if (ladder[i]!.capM < ladder[i - 1]!.capM) throw Error(`height-ladder: size rises with the tier, so "${ladder[i]!.id}" may not cap lower than the tier before`);
  for (const b of bodies) if (!(b.heightM > 0 && b.lengthM > 0)) throw Error(`height-ladder body "${b.id}": heightM and lengthM are numbers > 0`);
  return { ladder, bodies, exceptions };
}
export const HEIGHT_LADDER = loadHeightLadder(DEFS);

/** The cap (m) for a zone level: the last tier that starts at or below it. */
export const heightCap = (level: number): { tier: string; capM: number } => { let t = HEIGHT_LADDER.ladder[0]!; for (const x of HEIGHT_LADDER.ladder) if (x.fromZone <= level) t = x; return { tier: t.id, capM: t.capM }; };

/** How tall a body is drawn at a scale (m), or null when no row measures that body. An omitted scale is the body's catalogue render.scale. */
export function drawnHeight(opponent: string, scale?: number): number | null {
  const body = HEIGHT_LADDER.bodies.find((b) => b.id === opponent);
  return body ? body.heightM * (scale ?? catalogueRow(opponent)?.render.scale ?? 1) : null;
}

type ZoneForHeights = { readonly id: string; readonly level: number; readonly mobLooks?: { readonly looks: Readonly<Record<string, { readonly opponent: string; readonly scale?: number }>> }; readonly spawns: { readonly rows: readonly { readonly id: string }[] } };
/** Every creature row of the zone drawn above its tier's cap, unless a named exception covers it. A row whose body no `bodies` row measures is not checked (it cannot be drawn tall without a body to scale). */
export function heightProblems(z: ZoneForHeights, ladder: ReturnType<typeof loadHeightLadder> = HEIGHT_LADDER): string[] {
  const bad: string[] = [], { tier, capM } = heightCap(z.level);
  for (const r of z.spawns.rows) {
    const look = z.mobLooks?.looks[r.id], h = drawnHeight(look?.opponent ?? r.id.replace(/^character:/, ''), look?.scale);
    if (h === null || h <= capM) continue;   // the cap is the troll's drawn height rounded UP to the millimetre, so float noise cannot trip it
    if (ladder.exceptions.some((e) => e.zone === z.id && e.character === r.id)) continue;
    bad.push(`creature ${r.id}: drawn ${h} m, over zone ${z.level}'s cap of ${capM} m (${tier}): lower its scale, or name an exception row in height-ladder.json with Dom's reason`);
  }
  return bad;
}
