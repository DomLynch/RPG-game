// Server-owned warps (docs/specs/origins/frontier-presence.md; Lead 2026-10-16, ruling A). A client never says WHERE it stands after a jump: it names a landmark, and presence looks the place up in
// this data table (warp-landmarks.json: the Zone 1 start, the way back to the Exchange gate, the town respawn) and moves the player itself. Every row must stand in a zone row and clear of every
// trade area, so a warp can never put a player where the Exchange-only rules (X1) or the first-pose rule (X2) say a player may not be. Pure; the shape is AzerothCore's
// areatrigger_teleport / game_graveyard tables: the server holds the destination, the client only names the trigger.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './warp-landmarks.json' with { type: 'json' };
import MANIFEST from './warp-landmarks.manifest.json' with { type: 'json' };
import { CENTRE_CM } from './frame.ts';
import { clearOfTradeAreas, zoneAt } from './zones.ts';

export type WarpRow = { readonly id: string; readonly x: number; readonly z: number; readonly unit: string };
export function loadWarps(raw: { landmarks?: readonly unknown[] }): ReadonlyMap<string, { x: number; z: number }> {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'warp-landmarks.json')]);
  const out = new Map<string, { x: number; z: number }>();
  for (const r of (raw.landmarks ?? []) as readonly WarpRow[]) {
    if (r.unit !== 'm') throw Error(`warp-landmarks "${r.id}": the unit is m (Concord metres)`);
    const x = Math.round(CENTRE_CM + r.x * 100), z = Math.round(CENTRE_CM + r.z * 100);
    if (!zoneAt(x, z)) throw Error(`warp-landmarks "${r.id}": not inside any zone row`);
    const c = clearOfTradeAreas(x, z);
    if (c.x !== x || c.z !== z) throw Error(`warp-landmarks "${r.id}": inside a trade area`);
    out.set(r.id, { x, z });
  }
  return out;
}
const WARPS = loadWarps(DEFS);

// Paired doors (Lead 2026-10-17, the dungeon is walk-in only): a warp to either end of a door pair is accepted only from within `withinM` of the OTHER end, so a landmark that is a door's end is never a
// free teleport. A landmark in no pair keeps today's behaviour (a free warp, rate-limited). Data: the `doors` rows of warp-landmarks.json.
export type DoorRule = { readonly from: string; readonly withinCm: number };
export function loadDoors(raw: { doors?: readonly unknown[] }, landmarks: ReadonlyMap<string, { x: number; z: number }>): ReadonlyMap<string, DoorRule> {
  loadRegistry([tableFromFile(MANIFEST.tables[1] as unknown as Manifest, raw, 'warp-landmarks.json')]);
  const out = new Map<string, DoorRule>();
  for (const r of (raw.doors ?? []) as readonly { id: string; a: string; b: string; withinM: number }[]) {
    for (const end of [r.a, r.b]) if (!landmarks.has(end)) throw Error(`warp door "${r.id}": no landmark "${end}"`);
    if (!(r.withinM > 0) || r.a === r.b) throw Error(`warp door "${r.id}": withinM must be above 0 and the ends must differ`);
    for (const end of [r.a, r.b]) if (out.has(end)) throw Error(`warp door "${r.id}": landmark "${end}" is already in a door pair`);
    out.set(r.b, { from: r.a, withinCm: Math.round(r.withinM * 100) });
    out.set(r.a, { from: r.b, withinCm: Math.round(r.withinM * 100) });
  }
  return out;
}
const DOORS = loadDoors(DEFS, WARPS);
/** Whether a player standing at (x, z) presence centimetres may warp to `to`: always, unless `to` is a door end, then only from within the door's reach of the other end. */
export function warpAllowed(to: string, x: number, z: number): boolean {
  const rule = DOORS.get(to);
  if (!rule) return true;
  const from = WARPS.get(rule.from);
  return from !== undefined && Math.hypot(x - from.x, z - from.z) <= rule.withinCm;
}
/** The landmark's place in presence centimetres (the v2 frame), or null for an id the table does not hold. */
export const warpPlace = (id: string): { x: number; z: number } | null => WARPS.get(id) ?? null;
export const warpIds = (): string[] => [...WARPS.keys()];
