// The QA account (Strategy ruling via Lead, 2026-10-18): its world kills, ground takes and encounter wins COUNT (every check and every soak tally sees them) but pay event-only: nothing it earns
// is persisted. The account is marked in the database (fighter_profiles.is_test, migration 202610110021: client-unwritable, already off the duel ladder), never by an id in code or in a repo row.
// A lookup that fails, or a database without the migration, is 'unknown' and the op pays as normal: only the QA account could be affected and the pre-launch wipe covers it. The state is logged
// as `qa=yes|no|?` so the soak shows how often the lookup was blind. Never throws.
import type { Db } from './db.ts';
import * as store from './store.ts';

export type QaState = 'yes' | 'no' | '?';
export async function qaOf(db: Db, account: string): Promise<QaState> {
  try {
    const mark = await store.accountIsTest(db, account);
    return mark === null ? '?' : mark ? 'yes' : 'no';
  } catch { return '?'; }
}
