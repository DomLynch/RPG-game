import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanName, type Profile } from './profile.ts';
import { isOpponentId, type OpponentId } from './roster.ts';
import { cleanLoot, emptyLoot, type Loot } from './loot.ts';

export type CloudProfile = { display_name: string; encounter: OpponentId | null; revision: number; victory_marks: number; loot: Loot };
const columns = 'display_name,encounter,revision,victory_marks,loot';
export function cloudProfile(value: unknown): CloudProfile {
  const row = value as Partial<CloudProfile> | null;
  if (!row || typeof row.display_name !== 'string' || row.display_name !== cleanName(row.display_name)
    || (row.encounter !== null && !isOpponentId(row.encounter)) || !Number.isSafeInteger(row.revision) || row.revision! < 1
    || !Number.isSafeInteger(row.victory_marks) || row.victory_marks! < 0 || !row.loot || typeof row.loot !== 'object') throw Error('Invalid saved fighter');
  return { ...(row as CloudProfile), loot: cleanLoot(row.loot) };
}
// Device identity and practice results are never uploaded. Career marks travel with the save as a client-reported beta count —
// a display value, never rank authority for anything competitive (GAME_SPEC: server-owned results are a separate deliverable).
export function fighterDetails(profile: Profile) {
  return { display_name: cleanName(profile.name), encounter: profile.encounter ?? null, victory_marks: profile.career?.victoryMarks ?? 0, loot: profile.loot ?? emptyLoot() };
}
export async function readFighter(db: SupabaseClient, userId: string): Promise<CloudProfile | null> {
  const { data, error } = await db.from('fighter_profiles').select(columns).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? cloudProfile(data) : null;
}
export async function writeFighter(db: SupabaseClient, userId: string, profile: Profile, revision: number | null): Promise<CloudProfile> {
  const table = db.from('fighter_profiles'), details = fighterDetails(profile);
  const query = revision === null ? table.insert({ user_id: userId, ...details })
    : table.update(details).eq('user_id', userId).eq('revision', revision);
  const { data, error } = await query.select(columns).maybeSingle();
  if (error) throw error;
  if (!data) throw Error('Save changed on another device');
  return cloudProfile(data);
}
// Admin roster membership: the journal's test tools show only to listed accounts. The client can read its own row and nothing
// else (RLS); rows are inserted by the owner in SQL, so there is no write path here.
export async function readAdmin(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await db.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return !!data && (data as { user_id?: unknown }).user_id === userId;
}
