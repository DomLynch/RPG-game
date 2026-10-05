// One public.fight_results row per finished computer fight of a signed-in fighter (migration 202610050001; the Pit's skull walls).
// Cosmetic: the wall and its win/loss counts, never awards, rewards, rank or loot (those stay server-checked). user_id is the server's
// (auth.uid()) and is never sent. Fire and forget: a refused or failed post (the table not applied yet, the hourly cap, the network) is
// dropped, because the wall is a mirror and the fighter's own profile keeps the real progress.
import type { SupabaseClient } from '@supabase/supabase-js';
import { isLegendOpponent, legendForLevel, portraitKey } from './legends.ts';
import type { OpponentId } from './moves.ts';

export type FightResultRow = { kind: 'ai'; opponent_key: string; opponent_name: string; opponent_level: number; opponent_gear: Record<string, never>; result: 'win' | 'loss' | 'draw' };

// Null for an opponent without a legend face (nothing for the wall to hang) or a level outside the table's range.
export function fightResultRow(opponent: OpponentId, level: number, outcome: 'win' | 'loss' | 'draw'): FightResultRow | null {
  if (!isLegendOpponent(opponent) || !Number.isFinite(level) || level < 1 || level > 1000) return null;
  return { kind: 'ai', opponent_key: portraitKey(opponent, level), opponent_name: legendForLevel(opponent, level).name.slice(0, 40), opponent_level: Math.trunc(level), opponent_gear: {}, result: outcome };
}

export async function postFightResult(db: SupabaseClient, row: FightResultRow | null): Promise<void> {
  if (!row) return;
  try { await db.from('fight_results').insert(row); } catch { /* a mirror: dropped */ }
}
