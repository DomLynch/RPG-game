// Zone exits (the beta dungeon, Lead 2026-10-17): a door from a point in one zone page to a point in another. A zone page walks only its own zones (frontier-plan.ts), so a join to a zone the page does not own has no
// crossing; an exit row is that crossing as data: step on `landmark` (a landmark of world zone `zone`) and the page fades, saves and loads zone package `to` standing on its landmark `arrive`. `warp` names the presence
// landmark (warp-landmarks.json) the server moves the player to, since a client never says where it stands. Zones 2-4's dead joins can use the same rows. Pure; the page side is origins/preview/zone-exit.ts.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './exit-rows.json' with { type: 'json' };
import MANIFEST from './exit-rows.manifest.json' with { type: 'json' };

export type ExitRow = { readonly id: string; readonly zone: string; readonly landmark: string; readonly to: string; readonly arrive: string; readonly warp: string; readonly radiusM: number; readonly arriveM: number; readonly label: string };

export function loadExits(raw: { exits?: readonly unknown[] }): readonly ExitRow[] {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'exit-rows.json')]);
  const rows = (raw.exits ?? []) as readonly ExitRow[];
  for (const r of rows) { if (!(r.radiusM > 0)) throw Error(`exit "${r.id}": radiusM must be above 0`); if (!(r.arriveM > r.radiusM)) throw Error(`exit "${r.id}": arriveM must be past radiusM, or an arrival bounces back`); }
  return rows;
}
export const EXITS: readonly ExitRow[] = loadExits(DEFS);

/** The exits a page of zone package `pkg` can show: the doors it stands on (their `landmark` in its world zones) and the landing spots it must keep (the `arrive` of an exit that leads here). */
export const exitSpots = (pkg: string, worldZones: readonly string[], rows: readonly ExitRow[] = EXITS): ReadonlySet<string> =>
  new Set([...rows.filter((r) => worldZones.includes(r.zone)).map((r) => r.landmark), ...rows.filter((r) => r.to === pkg).map((r) => r.arrive)]);
