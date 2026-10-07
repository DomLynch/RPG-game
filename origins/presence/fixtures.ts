// Fixtures for code that asks presence where an account stands (the writer's tests): no sockets, no service, the same WhereFn type as the real client.
import type { Where, WhereFn } from './where.ts';

export const offline = (): Where => ({ online: false });
export const unplaced = (layer = 1): Where => ({ online: true, layer, placed: false });
export const standingAt = (x: number, z: number, ageMs = 0, layer = 1): Where => ({ online: true, layer, placed: true, x, z, ageMs });

// An account missing from the table is offline. `broken` makes every call throw, as a presence service that is down does.
export function fakeWhere(table: Record<string, Where>, broken = false): WhereFn {
  return async account => { if (broken) throw new Error('presence: unreachable'); return table[account] ?? offline(); };
}
