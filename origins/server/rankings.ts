// POST /origins/rankings {board, limit?}: the leaderboards the Pit's stone, the ☰ boards and Web's hub boards read (Dom 2026-10-08; Lead's GO on the shape).
// One response shape for every board, so Web builds one renderer: {board, at, rows: [{rank, name, value}]}. Read-only over what is already recorded
// (migration 202610080009 origins_rankings); no account id leaves the writer. Each board is cached `cacheMs` (one database read per board per minute, however
// many players look) and each account may read `perMinute` times a minute (the cache bounds the database, this bounds the route). Ranks are standard
// competition ranks (1, 2, 2, 4): equal values share a rank.
import type { Db } from './db.ts';
import { BadRequest, Refused } from './errors.ts';
import type { Handler } from './handlers.ts';
import { levelOfCredit } from '../progression/model.ts';

export const BOARDS = ['level', 'kills', 'pvp', 'pit'] as const;   // 'sets' waits on one set definition in the content (owner pending)
export type Board = (typeof BOARDS)[number];
export type Row = { rank: number; name: string; value: number };
export const MAX_ROWS = 50;

const HAS_RANKINGS = `select to_regprocedure('public.origins_rankings(text,integer)') is not null as rankings \\gset\n`;
export async function readBoard(db: Db, board: Board): Promise<{ name: string; value: number }[] | 'absent'> {
  const out = await db.run(`${HAS_RANKINGS}\\if :rankings\nselect public.origins_rankings(:'b', ${MAX_ROWS})::text;\n\\else\nselect 'absent';\n\\endif\n`, { b: board });
  return out === 'absent' ? 'absent' : (JSON.parse(out) as { name: string; value: number | string }[]).map((r) => ({ name: String(r.name), value: Number(r.value) }));
}

export function ranked(rows: readonly { name: string; value: number }[]): Row[] {
  const out: Row[] = [];
  rows.forEach((r, i) => out.push({ rank: i > 0 && rows[i - 1]!.value === r.value ? out[i - 1]!.rank : i + 1, name: r.name, value: r.value }));
  return out;
}

export function rankingsOps(opts: { now?: () => number; cacheMs?: number; perMinute?: number } = {}): Record<string, Handler> {
  const now = opts.now ?? Date.now, cacheMs = opts.cacheMs ?? 60_000, perMinute = opts.perMinute ?? 30;
  const cache = new Map<Board, { at: number; rows: Row[] }>(), reads = new Map<string, { start: number; n: number }>();
  const rankings: Handler = async ({ db, account }, body) => {
    const board = body.board, limit = body.limit === undefined ? MAX_ROWS : body.limit;
    if (typeof board !== 'string' || !(BOARDS as readonly string[]).includes(board)) throw new BadRequest(`board: one of ${BOARDS.join(', ')}`);
    if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > MAX_ROWS) throw new BadRequest(`limit: 1..${MAX_ROWS}`);
    const t = now();
    for (const [k, v] of reads) if (t - v.start >= 60_000) reads.delete(k);   // the map holds only accounts that read in the last minute
    const mine = reads.get(account) ?? { start: t, n: 0 };
    if (++mine.n > perMinute) throw new Refused(429, `rankings: at most ${perMinute} reads a minute`, 'rate-limit');
    reads.set(account, mine);
    let hit = cache.get(board as Board);
    if (!hit || t - hit.at >= cacheMs) {
      const rows = await readBoard(db, board as Board);
      if (rows === 'absent') throw new Refused(503, 'rankings are not installed (migration 202610080009)', 'not-installed');
      hit = { at: t, rows: ranked(board === 'level' ? rows.map((r) => ({ name: r.name, value: levelOfCredit(r.value) })) : rows) };
      cache.set(board as Board, hit);
    }
    return { board, at: new Date(hit.at).toISOString(), rows: hit.rows.slice(0, limit as number) };
  };
  return { rankings };
}
