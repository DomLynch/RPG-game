// Fixtures for code that asks presence where an account stands (the writer's tests): no sockets, no service, the same WhereFn type as the real client.
import { CONCORD, CONCORD_REGION, concordMounts } from '../world/concord.ts';
import { toMetres, toWorld } from '../world/derive.ts';
import { resolveZone } from '../world/resolve.ts';
import { CENTRE_CM, zoneAt } from './zones.ts';
import type { Where, WhereFn } from './where.ts';

export const offline = (): Where => ({ online: false });
export const unplaced = (layer = 1): Where => ({ online: true, layer, placed: false });   // presence no longer answers this (X2 stage 1: every player has a position); kept for the parser until the type is narrowed
export const standingAt = (x: number, z: number, ageMs = 0, layer = 1, zone: string | null = zoneAt(x, z)): Where => ({ online: true, layer, placed: true, x, z, zone, ageMs });   // the zone defaults to what presence would compute from x, z

// An account missing from the table is offline. `broken` makes every call throw, as a presence service that is down does.
export function fakeWhere(table: Record<string, Where>, broken = false): WhereFn {
  return async account => { if (broken) throw new Error('presence: unreachable'); return table[account] ?? offline(); };
}

// A Concord landmark (concord.ts layouts: 'centre' of the pit-yard, 'bank' or 'forge' of the exchange...) as a presence position in centimetres, from the same frame
// zones.ts uses, so a test stands a player exactly where the world puts the thing and never hard-codes a coordinate.
export function landmarkAt(zone: 'pit-yard' | 'exchange', landmark: string): [number, number] {
  const mounts = concordMounts(), params = resolveZone(CONCORD, CONCORD_REGION, zone);
  if (!mounts.ok || !params.ok) throw new Error(`fixtures: zone ${zone} does not resolve`);
  const lm = toMetres(params.value).landmarks[landmark];
  if (!lm) throw new Error(`fixtures: ${zone} has no landmark ${landmark}`);
  const w = toWorld(lm, zone === 'pit-yard' ? mounts.value.pit : mounts.value.exchange);
  return [CENTRE_CM + w.x * 100, CENTRE_CM + w.z * 100];
}
