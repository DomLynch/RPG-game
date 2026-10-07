// The Origins writer service (origins/server). Env: DATABASE_URL (the frankendom_origins role), SUPABASE_URL, SUPABASE_ANON_KEY, PORT (default 8788),
// ORIGINS_CONTENT (the story bundle, read once at start by origins/server/handlers.ts; unset = quest_advance and talk_pick answer 503).
import process from 'node:process';
import console from 'node:console';
import { supabaseVerify } from '../origins/server/auth.ts';
import { psqlDb } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';
import { content } from '../origins/server/handlers.ts';

const { DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, PORT = '8788' } = process.env;
if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_ANON_KEY) { console.error('origins-writer: set DATABASE_URL, SUPABASE_URL and SUPABASE_ANON_KEY'); process.exit(1); }
createWriter({ db: psqlDb(DATABASE_URL), verify: supabaseVerify(SUPABASE_URL, SUPABASE_ANON_KEY) }).listen(Number(PORT), '127.0.0.1', () => console.log(`origins-writer listening on 127.0.0.1:${PORT}; story content: ${content ? `${content.quests.size} quests, ${content.talks.size} NPCs` : 'none (503)'}`));
