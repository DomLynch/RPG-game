import type { SupabaseClient } from '@supabase/supabase-js';
import { readFighter, writeFighter } from './cloud-profile.ts';
import { cleanName } from './profile.ts';

// The signed-in rename for a page with no account mount (the zone's Career card): the account's own saved fighter, read and written back at the revision it was read at, with the
// name the only change (marks, loot and opponent are the cloud's own values, so nothing can lower the account: the rule absorbCloud keeps for the Pit). Returns the name as saved, or
// null when there is no session, no saved fighter yet, the revision moved (another device saved first) or the write failed: the caller keeps the name on the device and says so.
export async function renameAccount(db: Pick<SupabaseClient, 'from' | 'auth'>, name: string): Promise<string | null> {
  try {
    const userId = (await db.auth.getSession()).data.session?.user.id;
    if (!userId) return null;
    const cloud = await readFighter(db as SupabaseClient, userId);
    if (!cloud) return null;
    const saved = await writeFighter(db as SupabaseClient, userId, { version: 1, id: userId, name: cleanName(name), ...(cloud.encounter ? { encounter: cloud.encounter } : {}), career: { victoryMarks: cloud.victory_marks }, loot: cloud.loot }, cloud.revision);
    return saved.display_name;
  } catch { return null; }
}
