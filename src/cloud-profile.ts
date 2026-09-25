import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanName, type Profile } from './profile.ts';
import { isOpponentId, type OpponentId } from './roster.ts';
import { cleanLoot, emptyLoot, mergeLoot, sameKill, type Loot } from './loot.ts';
import { marksOf } from './career.ts';

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
// Key-order-independent text of a loot part, so two saves compare by content.
const canon = (value: unknown): string => JSON.stringify(value ?? {}, (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
// Does the device hold something the cloud lacks? Name, opponent, more marks, a piece the cloud does not own — and, since the wear
// slice, the equipped set and each piece's provenance (a Watch link arrives after the piece): wearing a helmet is a change to save.
// Owned stays a "gained" test (the merge is a union); equipped and taken compare whole, the device being the authority for both.
export function profileDiffers(profile: Profile, cloud: CloudProfile): boolean {
  const mine = fighterDetails(profile), loot = cleanLoot(mine.loot), theirs = cleanLoot(cloud.loot);   // both sides cleaned: unknown ids never count as a change
  return mine.display_name !== cloud.display_name || mine.encounter !== cloud.encounter || mine.victory_marks > cloud.victory_marks
    || loot.owned.some(id => !theirs.owned.includes(id)) || canon(loot.equipped) !== canon(theirs.equipped) || canon(loot.pack) !== canon(theirs.pack) || canon(loot.taken) !== canon(theirs.taken) || loot.skill !== theirs.skill
    || (loot.declined ?? []).some(k => !theirs.declined?.some(c => sameKill(c, k)));   // a refused offer the cloud lacks, like a new piece
}
// What the device may never take from the account by writing over it: the higher mark count and every piece of loot on either
// side. Every refresh and every write absorbs these first (audit 2026-09-23: an older device's ordinary refresh differed on a name
// and wrote 10 marks over the account's 20, then said "saved"). Name, opponent, the equipped set provenance and the pack stay the device's.
// (The sign-in merge in account.ts is the one place the account's equipped set comes down to a device; mergeLoot does that.)
export function absorbCloud(profile: Profile, cloud: CloudProfile): Profile {
  const victoryMarks = Math.max(marksOf(profile), cloud.victory_marks);
  // The pack is the device's too, like the worn set: wearing a piece out of the pack must not have the cloud's older pack put it back.
  const merged = mergeLoot(profile.loot, cloud.loot);
  const loot = cleanLoot({ ...merged, equipped: profile.loot?.equipped ?? {}, ...(profile.loot?.pack ? { pack: profile.loot.pack } : {}) });
  return { ...profile, ...(victoryMarks ? { career: { victoryMarks } } : {}), ...(loot.owned.length || loot.declined || loot.skill ? { loot } : {}) };
}
// One cloud write at a time. A save asked for while one is in flight does not start a second write against the same revision (that
// is a guaranteed conflict); it marks the queue and, once the current write lands, the LATEST device profile is written once more.
// Resolves true when every queued write landed, false on the first failure (the caller reads the error state; nothing is retried here).
export function createSaveQueue(write: (profile: Profile) => Promise<void>): (latest: () => Profile) => Promise<boolean> {
  let running: Promise<boolean> | null = null, again = false;
  return latest => {
    if (running) { again = true; return running; }
    running = (async () => {
      try {
        do { again = false; await write(latest()); } while (again);
        return true;
      } catch { return false; } finally { running = null; again = false; }
    })();
    return running;
  };
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
