// The Origins writer service (origins/server). Env: DATABASE_URL (the frankendom_origins role), SUPABASE_URL, SUPABASE_ANON_KEY, PORT (default 8788),
// ORIGINS_CONTENT (the story bundle, read once here at start; a bundle that does not load stops the writer; unset = quest_advance and talk_pick answer 503),
// PRESENCE_URL (default http://127.0.0.1:8788, origins/presence/main.ts's default bind) and PRESENCE_INTERNAL_KEY (the shared secret of presence's GET /internal/where):
// the writer's only source of a player's place (launch gate X1). Without the key every player counts as away from the Exchange, so every Exchange-only rule refuses.
import process from 'node:process';
import console from 'node:console';
import { supabaseVerify } from '../origins/server/auth.ts';
import { psqlDb } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';
import { readStoryContent } from '../origins/server/content.ts';
import { handlers, storyOps } from '../origins/server/handlers.ts';
import { presenceWhere } from '../origins/presence/where.ts';

const { DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, PORT = '8788' } = process.env;
if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_ANON_KEY) { console.error('origins-writer: set DATABASE_URL, SUPABASE_URL and SUPABASE_ANON_KEY'); process.exit(1); }
const content = process.env.ORIGINS_CONTENT ? readStoryContent(process.env.ORIGINS_CONTENT) : null;   // throws on a bad bundle: the writer does not start
const presenceKey = process.env.PRESENCE_INTERNAL_KEY;
if (!presenceKey) console.log('origins-writer: PRESENCE_INTERNAL_KEY is not set: no player counts as at the Exchange, every Exchange-only action is refused');
const where = presenceKey ? presenceWhere(process.env.PRESENCE_URL ?? 'http://127.0.0.1:8788', presenceKey) : async () => ({ online: false });
createWriter({ db: psqlDb(DATABASE_URL), verify: supabaseVerify(SUPABASE_URL, SUPABASE_ANON_KEY), where, handlers: { ...handlers, ...storyOps(content) } }).listen(Number(PORT), '127.0.0.1', () => console.log(`origins-writer listening on 127.0.0.1:${PORT}; story content: ${content ? `${content.quests.size} quests, ${content.talks.size} NPCs` : 'none (503)'}`));
