// Server-owned warps (docs/specs/origins/frontier-presence.md; Lead 2026-10-16, ruling A). A client never says WHERE it stands after a jump: it names a landmark, and presence looks the place up in
// this data table (warp-landmarks.json: the Zone 1 start, the way back to the Exchange gate, the town respawn) and moves the player itself. Every row must stand in a zone row and clear of every
// trade area, so a warp can never put a player where the Exchange-only rules (X1) or the first-pose rule (X2) say a player may not be. Pure; the shape is AzerothCore's
// areatrigger_teleport / game_graveyard tables: the server holds the destination, the client only names the trigger.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './warp-landmarks.json' with { type: 'json' };
import MANIFEST from './warp-landmarks.manifest.json' with { type: 'json' };
import { CENTRE_CM } from './frame.ts';
import { clearOfTradeAreas, zoneAt } from './zones.ts';
import { EXITS, type ExitRow } from '../zones/exits.ts';
import { arrival } from '../preview/zone-exit.ts';
import { frontierPlan } from '../preview/frontier-plan.ts';

export type WarpRow = { readonly id: string; readonly x: number; readonly z: number; readonly unit: string };
export function loadWarps(raw: { landmarks?: readonly unknown[] }): ReadonlyMap<string, { x: number; z: number }> {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'warp-landmarks.json')]);
  const out = new Map<string, { x: number; z: number }>();
  for (const r of (raw.landmarks ?? []) as readonly WarpRow[]) {
    if (r.unit !== 'm') throw Error(`warp-landmarks "${r.id}": the unit is m (Concord metres)`);
    out.set(r.id, placeOf(`warp-landmarks "${r.id}"`, r.x, r.z));
  }
  return out;
}
// A place in Concord metres as presence centimetres, held to the one rule every warp keeps: inside a zone row and clear of the trade areas.
function placeOf(who: string, mx: number, mz: number): { x: number; z: number } {
  const x = Math.round(CENTRE_CM + mx * 100), z = Math.round(CENTRE_CM + mz * 100);
  if (!zoneAt(x, z)) throw Error(`${who}: not inside any zone row`);
  const c = clearOfTradeAreas(x, z);
  if (c.x !== x || c.z !== z) throw Error(`${who}: inside a trade area`);
  return { x, z };
}
// The warps the zone exits own (origins/zones/exit-rows.json, Lead 2026-10-17): the exit's `warp` id is where a crossing lands, which is the zone page's own arrival point (arriveM inside the `arrive`
// landmark of the far zone), so the position is DERIVED from the zone plan and never copied here. A warp id must be new: not in the table and not another exit's.
export function exitWarps(rows: readonly ExitRow[], taken: ReadonlySet<string> = new Set()): ReadonlyMap<string, { x: number; z: number }> {
  const out = new Map<string, { x: number; z: number }>();
  for (const r of rows) {
    if (taken.has(r.warp) || out.has(r.warp)) throw Error(`exit-rows "${r.id}": the warp id "${r.warp}" is already a warp landmark`);
    const a = arrival(frontierPlan(true, r.to), r.to, r.id, rows);
    if (!a) throw Error(`exit-rows "${r.id}": zone ${r.to} has no landing (arrive landmark "${r.arrive}")`);
    out.set(r.warp, placeOf(`exit-rows "${r.id}"`, a.x, a.z));
  }
  return out;
}
const TABLE = loadWarps(DEFS);
const WARPS = new Map([...TABLE, ...exitWarps(EXITS, new Set(TABLE.keys()))]);
/** The landmark's place in presence centimetres (the v2 frame), or null for an id the table does not hold. */
export const warpPlace = (id: string): { x: number; z: number } | null => WARPS.get(id) ?? null;
export const warpIds = (): string[] => [...WARPS.keys()];
