import type { SupabaseClient } from '@supabase/supabase-js';
// The signed-in session as account.ts publishes it once the account SDK has mounted (it loads lazily, on the journal): both null until
// then and for a guest. Readers (main.ts Share) treat null as "guest": nothing here ever blocks startup or a fight.
// `marks` is the account's server figure (cloud-profile.ts readStanding); null for a guest and whenever the server has none.
export const session: { db: SupabaseClient | null; userId: string | null; marks: number | null } = { db: null, userId: null, marks: null };
