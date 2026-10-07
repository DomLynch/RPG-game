// Fixtures for code that asks presence where an account stands (the writer's tests): no sockets, no service, the same WhereFn type as the real client.
import { zoneAt } from './zones.ts';
import type { Where, WhereFn } from './where.ts';

export const offline = (): Where => ({ online: false });
export const unplaced = (layer = 1): Where => ({ online: true, layer, placed: false });   // presence no longer answers this (X2 stage 1: every player has a position); kept for the parser until the type is narrowed
export const standingAt = (x: number, z: number, ageMs = 0, layer = 1, zone: string | null = zoneAt(x, z)): Where => ({ online: true, layer, placed: true, x, z, zone, ageMs });   // the zone defaults to what presence would compute from x, z

// An account missing from the table is offline. `broken` makes every call throw, as a presence service that is down does.
export function fakeWhere(table: Record<string, Where>, broken = false): WhereFn {
  return async account => { if (broken) throw new Error('presence: unreachable'); return table[account] ?? offline(); };
}
