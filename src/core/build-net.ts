// The build field's two ops (Backend #2426: build_get, build_set), browser-safe like gear-net.ts. A build is the character's LEVEL (the server's, never ours) and where each point went (`placed`, a dial or skill id -> points).
// build_set answers the new view; a refusal (409: the build moved, or this rank's re-spread is spent) comes back as an Offline, and the caller reads the build again to tell the two apart.
import { call, type Offline, type Opts } from './writer-call.ts';

export type BuildView = { level: number; placed: Record<string, number>; respreadRank: number; version: number };
export const isOffline = (r: BuildView | Offline): r is Offline => 'offline' in r;
const whole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
export function viewOf(result: unknown): BuildView | null {
  const r = result as { level?: unknown; placed?: unknown; respreadRank?: unknown; version?: unknown } | null;
  if (!r || !whole(r.level) || !whole(r.version) || !whole(r.respreadRank) || typeof r.placed !== 'object' || r.placed === null || Array.isArray(r.placed)) return null;
  const placed: Record<string, number> = {};
  for (const [id, n] of Object.entries(r.placed)) { if (!whole(n)) return null; if (n) placed[id] = n; }
  return { level: r.level, placed, respreadRank: r.respreadRank, version: r.version };
}
export const getBuild = (token: string | null, character: string, opts: Opts = {}) => call('build_get', { character }, token, viewOf, opts);
export const setBuild = (token: string | null, character: string, placed: Record<string, number>, version: number, opts: Opts = {}) => call('build_set', { character, placed, version }, token, viewOf, opts);
