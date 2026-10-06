// The Origins writer service (origins/server). Env: DATABASE_URL (the frankendom_origins role), SUPABASE_URL, SUPABASE_ANON_KEY, PORT (default 8788).
import process from 'node:process';
import console from 'node:console';
import { supabaseVerify } from '../origins/server/auth.ts';
import { psqlDb } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';

const { DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, PORT = '8788' } = process.env;
if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_ANON_KEY) { console.error('origins-writer: set DATABASE_URL, SUPABASE_URL and SUPABASE_ANON_KEY'); process.exit(1); }
createWriter({ db: psqlDb(DATABASE_URL), verify: supabaseVerify(SUPABASE_URL, SUPABASE_ANON_KEY) }).listen(Number(PORT), '127.0.0.1', () => console.log(`origins-writer listening on 127.0.0.1:${PORT}`));
