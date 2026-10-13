// The spell book's one op (Backend #2504: grimoire_get {} -> { spells: [{ legend, bricks }] }), browser-safe like build-net.ts. Read-only: spells are taken only by the server's verified encounter settle.
import { call, type Offline, type Opts } from './writer-call.ts';

export type Bricks = { root: string; modifiers: string[]; suffix: string | null };
export type Spell = { legend: string; bricks: Bricks };
export const bookIsOffline = (r: Spell[] | Offline): r is Offline => 'offline' in r;
const word = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
// Shape only: a malformed answer is null (the screen then says it could not read the book), never a half book.
export function bookOf(result: unknown): Spell[] | null {
  const spells = (result as { spells?: unknown } | null)?.spells;
  if (!Array.isArray(spells)) return null;
  const out: Spell[] = [];
  for (const s of spells as { legend?: unknown; bricks?: { root?: unknown; modifiers?: unknown; suffix?: unknown } | null }[]) {
    const b = s?.bricks;
    if (!word(s?.legend) || !b || !word(b.root) || !Array.isArray(b.modifiers) || !b.modifiers.every(word) || !(b.suffix === null || word(b.suffix))) return null;
    out.push({ legend: s.legend, bricks: { root: b.root, modifiers: [...b.modifiers as string[]], suffix: b.suffix as string | null } });
  }
  return out;
}
export const getGrimoire = (token: string | null, opts: Opts = {}) => call('grimoire_get', {}, token, bookOf, opts);
