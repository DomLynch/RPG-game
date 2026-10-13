// The player's title (Backend #2523: title_get {character} -> { fame, karma, title }; the title is Characters' titleFor(fame, karma) computed server-side), browser-safe like build-net.ts.
// Read-only. The page shows only the title: an empty or missing one is no line at all, never a placeholder.
import { call, type Offline, type Opts } from './writer-call.ts';

export type Renown = { fame: number; karma: number; title: string };
export const titleIsOffline = (r: Renown | Offline): r is Offline => 'offline' in r;
// Shape only: a malformed answer is null (no title line), never half a title.
export function renownOf(result: unknown): Renown | null {
  const r = result as { fame?: unknown; karma?: unknown; title?: unknown } | null;
  if (!r || !Number.isInteger(r.fame) || !Number.isInteger(r.karma) || typeof r.title !== 'string' || r.title.length > 80 || /[\u0000-\u001f<>]/.test(r.title)) return null;
  return { fame: r.fame as number, karma: r.karma as number, title: r.title.trim() };
}
export const getTitle = (token: string | null, character: string, opts: Opts = {}) => call('title_get', { character }, token, renownOf, opts);
