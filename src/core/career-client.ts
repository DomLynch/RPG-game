import type { SupabaseClient } from '@supabase/supabase-js';

// The career service's READS for the screens (Backend's slice 2b, migration 202610110019, live since BA2): the player's scorecard (scorecard_rows(), an invoker
// function: the caller's own rows only) and the boards (leaderboards(p_limit), authenticated only). The ladder itself
// is NOT read: pit_ladder is pinned to career-ladder.ts rankFor by a test, so the screens draw it from the core. Same contract as readStanding (cloud-profile.ts):
// null when the server has no answer (offline, signed out, the function missing, a malformed row), never a throw, so a screen draws "unavailable" and keeps the device's own figures.
export type ScoreRow = { opponent: string; fights: number; wins: number; losses: number; draws: number; left: number; last: string[] };
export type BoardName = 'duel_rating' | 'duel_wins';
// Strategy ruling C (2026-10-11) as agreed with Backend: leaderboards(p_limit) returns (board text, place int, display_name text, score int, fighter_id int). Today display_name holds
// 'Fighter #<public_no>' (set on the server, so no real name travels) and fighter_id is the public integer; when the name filter goes live the server swaps real names into display_name and the
// UI does not change. `who` is that field rendered AS GIVEN, never rewritten here.
export type BoardRow = { board: BoardName; place: number; who: string; fighterId: number; score: number };
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64;

// The account's own public fighter number (fighter_profiles.public_no, Backend's migration 0020: identity, never reused, not client-writable). Own row only (RLS). null when it cannot be read
// (a guest, offline, the column not applied yet, a column-level grant that hides it): the profile then shows no number, never a wrong one.
export async function readPublicNo(db: Pick<SupabaseClient, 'from' | 'auth'>): Promise<number | null> {
  try {
    const id = (await db.auth.getSession()).data.session?.user.id;
    if (!id) return null;
    const { data, error } = await db.from('fighter_profiles').select('public_no').eq('user_id', id).maybeSingle();
    const n = (data as { public_no?: unknown } | null)?.public_no;
    return !error && count(n) && n > 0 ? n : null;
  } catch { return null; }
}

export async function readScorecard(db: Pick<SupabaseClient, 'rpc'>): Promise<ScoreRow[] | null> {
  try {
    const { data, error } = await db.rpc('scorecard_rows');
    if (error || !Array.isArray(data)) return null;
    const rows: ScoreRow[] = [];
    for (const r of data as Record<string, unknown>[]) {
      const last = r?.last;
      if (!text(r?.opponent) || !count(r.fights) || !count(r.wins) || !count(r.losses) || !count(r.draws) || !count(r.left_count) || !Array.isArray(last)) return null;
      rows.push({ opponent: r.opponent, fights: r.fights, wins: r.wins, losses: r.losses, draws: r.draws, left: r.left_count, last: last.filter((l): l is string => typeof l === 'string') });
    }
    return rows;
  } catch { return null; }
}

export async function readLeaderboards(db: Pick<SupabaseClient, 'rpc'>, limit = 20): Promise<BoardRow[] | null> {
  try {
    const { data, error } = await db.rpc('leaderboards', { p_limit: Math.max(1, Math.min(50, Math.trunc(limit))) });
    if (error || !Array.isArray(data)) return null;
    const rows: BoardRow[] = [];
    for (const r of data as Record<string, unknown>[]) {
      if ((r?.board !== 'duel_rating' && r?.board !== 'duel_wins') || !count(r.place) || r.place < 1 || !text(r.display_name) || !count(r.fighter_id) || !count(r.score)) return null;
      rows.push({ board: r.board, place: r.place, who: r.display_name, fighterId: r.fighter_id, score: r.score });
    }
    return rows;
  } catch { return null; }
}
