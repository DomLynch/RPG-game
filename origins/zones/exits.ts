// Zone exits (the beta dungeon, Lead 2026-10-17): a door from a point in one zone page to a point in another. A zone page walks only its own zones (frontier-plan.ts), so a join to a zone the page does not own has no
// crossing; an exit row is that crossing as data: step on `landmark` (a landmark of world zone `zone`) and the page fades, saves and loads zone package `to` standing on its landmark `arrive`. `warp` names the presence
// landmark (warp-landmarks.json) the server moves the player to, since a client never says where it stands. Zones 2-4's dead joins can use the same rows. Pure; the page side is origins/preview/zone-exit.ts.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import { REGISTRY } from './registry.ts';
import DEFS from './exit-rows.json' with { type: 'json' };
import MANIFEST from './exit-rows.manifest.json' with { type: 'json' };

export type ExitRow = { readonly id: string; readonly zone: string; readonly landmark: string; readonly to: string; readonly arrive: string; readonly warp: string; readonly radiusM: number; readonly arriveM: number; readonly label: string };

/** The exits: exit-rows.json plus each zone row's own `exits` list (a package brings its doors with it). An exit id and a warp id are unique across every zone and file; the registry refuses a duplicate id, and a duplicate warp is refused here. */
export function loadExits(raw: { exits?: readonly unknown[] }, zones: Readonly<Record<string, { exits?: readonly ExitRow[] }>> = REGISTRY): readonly ExitRow[] {
  const merged = { exits: [...(raw.exits ?? []), ...Object.values(zones).flatMap((z) => z.exits ?? [])] };
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, merged, 'exit-rows.json')]);
  const rows = merged.exits as readonly ExitRow[];
  const warps = new Set<string>();
  for (const r of rows) { if (warps.has(r.warp)) throw Error(`exit "${r.id}": warp "${r.warp}" is already another exit's`); warps.add(r.warp); }
  for (const r of rows) if (!Object.hasOwn(zones, r.to)) throw Error(`exit "${r.id}": "${r.to}" is not a zone package`);
  for (const r of rows) { if (!(r.radiusM > 0)) throw Error(`exit "${r.id}": radiusM must be above 0`); if (!(r.arriveM > r.radiusM)) throw Error(`exit "${r.id}": arriveM must be past radiusM, or an arrival bounces back`); }
  return rows;
}
export const EXITS: readonly ExitRow[] = loadExits(DEFS);

/** The exits a page of zone package `pkg` can show: the doors it stands on (their `landmark` in its world zones) and the landing spots it must keep (the `arrive` of an exit that leads here). */
export const exitSpots = (pkg: string, worldZones: readonly string[], rows: readonly ExitRow[] = EXITS): ReadonlySet<string> =>
  new Set([...rows.filter((r) => worldZones.includes(r.zone)).map((r) => r.landmark), ...rows.filter((r) => r.to === pkg).map((r) => r.arrive)]);
