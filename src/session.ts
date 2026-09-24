import type { SupabaseClient } from '@supabase/supabase-js';
// The signed-in session as account.ts publishes it once the account SDK has mounted (it loads lazily, on the journal): both null until
// then and for a guest. Readers (main.ts Share) treat null as "guest": nothing here ever blocks startup or a fight.
// `awards`: the server's awards (cloud-profile.ts readAwards) once account.ts has read them — null until then and for a guest, which
// fights naked (src/gear-stats.ts serverLoadout). account.ts fires 'frankendom:awards' when it changes.
export const session: { db: SupabaseClient | null; userId: string | null; awards: Map<string, number> | null } = { db: null, userId: null, awards: null };
