// The Origins writer service (origins/server). Env: DATABASE_URL (the frankendom_origins role), SUPABASE_URL, SUPABASE_ANON_KEY, PORT (default 8788),
// ORIGINS_CONTENT (the story bundle, read once here at start; a bundle that does not load stops the writer; unset = quest_advance and talk_pick answer 503),
// PRESENCE_URL (default http://127.0.0.1:8793, the port ops/install-presence.sh gives presence; never 8788, which is this writer's own PORT) and PRESENCE_INTERNAL_KEY (the shared secret of presence's GET /internal/where):
// the writer's only source of a player's place (launch gate X1). Without the key every player counts as away from the Exchange, so every Exchange-only rule refuses.
// consume and apply_upgrade (the item ops) are served from Region 1's own content (origins/server/content-ops.ts): consume always; apply_upgrade answers 501 "no smith in this content" until Region 1 authors a smith service + its cost table. Region 1 content that does not load is logged and those two ops are absent.
// ORIGINS_ENCOUNTERS=1 (turns on encounter_start/touch/settle, world creature fights: migration 202610080002 + Region 1 content must load; unset, the three ops answer 503 "encounter verify not installed"),
// ORIGINS_REWARDS=1 (needs ORIGINS_ENCOUNTERS=1; a verified kill then also pays its CP and loot in the settle's one transaction, origins/server/mob-rewards.ts; unset, fights are RECORDED only and pay nothing),
// ORIGINS_WRITER_INTERNAL_KEY (optional: turns on the internal saved-location routes presence calls, key + loopback; unset, those routes do not exist).
// The live-ops rows (migration 202610120023): a switch row `op:<name>` off answers that op 503 within a minute, no restart; no rows or no migration = every switch on.
// ORIGINS_LOCATION_FLUSH_MS (default 90000, 60000..120000, or 0 = the kill switch: every post written through): presence's saved positions are held in a dirty map and written as ONE statement per interval (and on SIGTERM).
import process from 'node:process';
import console from 'node:console';
import { supabaseVerify } from '../origins/server/auth.ts';
import { psqlDb } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';
import { createLocationFlusher } from '../origins/server/location-flush.ts';
import { createLiveOps } from '../origins/server/live-ops.ts';
import { heroLimitOf } from '../origins/server/worn-gear.ts';
import { readStoryContent } from '../origins/server/content.ts';
import { storyOps } from '../origins/server/handlers.ts';
import { presenceWhere } from '../origins/presence/where.ts';
import { itemOps } from '../origins/server/content-ops.ts';
import { loadEncounterContent } from '../origins/encounters/encounters.ts';
import { encounterOps } from '../origins/server/encounter.ts';
import { createVerdictTally } from '../origins/server/world-verify.ts';
import { createVerifyPool } from '../origins/server/world-verify-pool.ts';
import { worldSpawnOps, zoneKeyProblems } from '../origins/server/world-spawns.ts';
import { resolveFromRegion1 } from '../origins/server/encounter-setup.ts';
import { verifyEncounter } from '../origins/server/encounter-verify.ts';
import { mobRewards } from '../origins/server/mob-rewards.ts';
import { killWear } from '../origins/server/wear-settle.ts';
// The kill's pay (CP + loot) from Region 1's content; the flag already requires that content to load (resolveFromRegion1 throws otherwise).
// Zone 1 world spawns (202610080014): ON unless ORIGINS_SPAWNS=0 (the kill switch); without the migration every op answers 503.
const verifyPool = createVerifyPool();
const tally = createVerdictTally();
setInterval(() => { const t = tally.snapshot(); if (t.total) console.log(`world records since ${t.since}: ${t.verified}/${t.total} verified ${JSON.stringify(t.outcomes)}`); }, 3_600_000).unref();
const spawnDeps = () => { const c = loadEncounterContent(); if (!c.ok) throw new Error('encounter content does not load'); return { content: c.value, verifyRecord: (job) => verifyPool.verify(job), tally, heroOf: (account, character) => heroLimitOf(db, account, character) }; };
const regionWear = () => { const c = loadEncounterContent(); if (!c.ok) throw new Error('encounter content does not load'); return killWear(c.value); };
const regionRewards = () => { const c = loadEncounterContent(); if (!c.ok) throw new Error('encounter content does not load'); return mobRewards(c.value); };

const { DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, PORT = '8788', ORIGINS_DB_POOL = '4' } = process.env;   // ORIGINS_DB_POOL: persistent psql sessions (0 = one psql per op)
if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_ANON_KEY) { console.error('origins-writer: set DATABASE_URL, SUPABASE_URL and SUPABASE_ANON_KEY'); process.exit(1); }
const zoneProblems = zoneKeyProblems(); if (zoneProblems.length) { console.error(`origins-writer: the zone registry breaks the spawn key rule, not starting:\n  ${zoneProblems.join('\n  ')}`); process.exit(1); }   // a bad new zone folder fails at install, not at the first kill
const content = process.env.ORIGINS_CONTENT ? readStoryContent(process.env.ORIGINS_CONTENT) : null;   // throws on a bad bundle: the writer does not start
const presenceKey = process.env.PRESENCE_INTERNAL_KEY;
if (!presenceKey) console.log('origins-writer: PRESENCE_INTERNAL_KEY is not set: no player counts as at the Exchange, every Exchange-only action is refused');
const where = presenceKey ? presenceWhere(process.env.PRESENCE_URL ?? 'http://127.0.0.1:8793', presenceKey) : async () => ({ online: false });
const flushMs = Number(process.env.ORIGINS_LOCATION_FLUSH_MS ?? '90000');
if (!(flushMs === 0 || (Number.isInteger(flushMs) && flushMs >= 60_000 && flushMs <= 120_000))) { console.error('origins-writer: ORIGINS_LOCATION_FLUSH_MS is 0 or 60000..120000'); process.exit(1); }
const db = psqlDb(DATABASE_URL, 'psql', 30_000, Number(ORIGINS_DB_POOL));
const flusher = process.env.ORIGINS_WRITER_INTERNAL_KEY && flushMs > 0 ? createLocationFlusher(db, flushMs) : undefined;
flusher?.start();
const liveOps = createLiveOps(db);
liveOps.start();
const server = createWriter({ db, verify: supabaseVerify(SUPABASE_URL, SUPABASE_ANON_KEY), where, handlers: { ...itemOps(loadEncounterContent()), ...storyOps(content), ...worldSpawnOps(process.env.ORIGINS_SPAWNS === '0' ? null : { ...spawnDeps(), refuseUnchecked: process.env.ORIGINS_SPAWN_REFUSE_UNCHECKED === '1', scorecardOnlyUnverified: process.env.ORIGINS_WORLD_RECORD_SCORECARD_ONLY === '1' }), ...encounterOps(process.env.ORIGINS_ENCOUNTERS === '1' ? { resolve: resolveFromRegion1(), verify: verifyEncounter, ...(process.env.ORIGINS_REWARDS === '1' ? { rewards: regionRewards(), wear: regionWear() } : {}) } : null) }, internal: process.env.ORIGINS_WRITER_INTERNAL_KEY ? { key: process.env.ORIGINS_WRITER_INTERNAL_KEY, flusher, worldRecords: tally, liveOps } : undefined, liveOps }).listen(Number(PORT), '127.0.0.1', () => console.log(`origins-writer listening on 127.0.0.1:${PORT}; story content: ${content ? `${content.quests.size} quests, ${content.talks.size} NPCs` : 'none (503)'}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => { server.close(); liveOps.stop(); (flusher ? flusher.stop() : Promise.resolve()).finally(() => process.exit(0)); });
