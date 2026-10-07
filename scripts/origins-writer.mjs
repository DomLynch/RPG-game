// The Origins writer service (origins/server). Env: DATABASE_URL (the frankendom_origins role), SUPABASE_URL, SUPABASE_ANON_KEY, PORT (default 8788),
// ORIGINS_CONTENT (the story bundle, read once here at start; a bundle that does not load stops the writer; unset = quest_advance and talk_pick answer 503),
// PRESENCE_URL (default http://127.0.0.1:8793, the port ops/install-presence.sh gives presence; never 8788, which is this writer's own PORT) and PRESENCE_INTERNAL_KEY (the shared secret of presence's GET /internal/where):
// the writer's only source of a player's place (launch gate X1). Without the key every player counts as away from the Exchange, so every Exchange-only rule refuses.
// ORIGINS_ENCOUNTERS=1 (turns on encounter_start/touch/settle, world creature fights: migration 202610080002 + Region 1 content must load; unset, the three ops answer 503 "encounter verify not installed"),
// ORIGINS_WRITER_INTERNAL_KEY (optional: turns on the internal saved-location routes presence calls, key + loopback; unset, those routes do not exist).
import process from 'node:process';
import console from 'node:console';
import { supabaseVerify } from '../origins/server/auth.ts';
import { psqlDb } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';
import { readStoryContent } from '../origins/server/content.ts';
import { handlers, storyOps } from '../origins/server/handlers.ts';
import { presenceWhere } from '../origins/presence/where.ts';
import { encounterOps } from '../origins/server/encounter.ts';
import { resolveFromRegion1 } from '../origins/server/encounter-setup.ts';
import { verifyEncounter } from '../origins/server/encounter-verify.ts';

const { DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, PORT = '8788' } = process.env;
if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_ANON_KEY) { console.error('origins-writer: set DATABASE_URL, SUPABASE_URL and SUPABASE_ANON_KEY'); process.exit(1); }
const content = process.env.ORIGINS_CONTENT ? readStoryContent(process.env.ORIGINS_CONTENT) : null;   // throws on a bad bundle: the writer does not start
const presenceKey = process.env.PRESENCE_INTERNAL_KEY;
if (!presenceKey) console.log('origins-writer: PRESENCE_INTERNAL_KEY is not set: no player counts as at the Exchange, every Exchange-only action is refused');
const where = presenceKey ? presenceWhere(process.env.PRESENCE_URL ?? 'http://127.0.0.1:8793', presenceKey) : async () => ({ online: false });
createWriter({ db: psqlDb(DATABASE_URL), verify: supabaseVerify(SUPABASE_URL, SUPABASE_ANON_KEY), where, handlers: { ...handlers, ...storyOps(content), ...encounterOps(process.env.ORIGINS_ENCOUNTERS === '1' ? { resolve: resolveFromRegion1(), verify: verifyEncounter } : null) }, internal: process.env.ORIGINS_WRITER_INTERNAL_KEY ? { key: process.env.ORIGINS_WRITER_INTERNAL_KEY } : undefined }).listen(Number(PORT), '127.0.0.1', () => console.log(`origins-writer listening on 127.0.0.1:${PORT}; story content: ${content ? `${content.quests.size} quests, ${content.talks.size} NPCs` : 'none (503)'}`));
