import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanName, type Profile } from './profile.ts';
import { isOpponentId, type OpponentId } from './roster.ts';

export type CloudProfile = { display_name: string; encounter: OpponentId | null; revision: number };
const columns = 'display_name,encounter,revision';
export function cloudProfile(value: unknown): CloudProfile {
  const row = value as Partial<CloudProfile> | null;
  if (!row || typeof row.display_name !== 'string' || row.display_name !== cleanName(row.display_name)
    || (row.encounter !== null && !isOpponentId(row.encounter)) || !Number.isSafeInteger(row.revision) || row.revision! < 1) throw Error('Invalid saved fighter');
  return row as CloudProfile;
}
// Device identity, practice results and career marks are never uploaded as account authority.
export function fighterDetails(profile: Profile) {
  return { display_name: cleanName(profile.name), encounter: profile.encounter ?? null };
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
