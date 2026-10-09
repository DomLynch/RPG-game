// node origins/presence/main.ts — the presence service. OFF unless ORIGINS_PRESENCE=1 (Lead/Strategy flag GO); with it off nothing listens.
// Env: SUPABASE_URL + SUPABASE_ANON_KEY (token check), PRESENCE_PORT (default 8793, ops/install-presence.sh's port; 8788 is the writer's), PRESENCE_HOST (default 127.0.0.1), PRESENCE_INTERNAL_KEY (optional: turns on GET /internal/where for the writer; unset, that route does not exist).
// WRITER_URL + ORIGINS_WRITER_INTERNAL_KEY (optional, both or neither): the position save (origins/presence/saves.ts) and the saved place at join (the writer's /internal/location);
// unset, nothing is saved and a join starts from presence's own memory or the spawn. PRESENCE_SAVE_MS overrides the 5-minute checkpoint.
// Load test only: ORIGINS_PRESENCE_TEST_AUTH=1 accepts the token `bot-<name>` as that account, and is refused when SUPABASE_URL is set or the bind is not
// loopback, so it cannot be left on by mistake in the real service. PRESENCE_SOFT / PRESENCE_HARD / PRESENCE_MAX_LAYERS / PRESENCE_LOG_MS override the layer caps for a run.
import { supabaseVerify } from '../server/auth.ts';
import { createPresence, LIMITS } from './server.ts';
import { RULES } from './interest.ts';
import { writerSavedLocation, writerSaveLocation } from '../server/location.ts';

if (process.env.ORIGINS_PRESENCE !== '1') { console.log('presence: OFF (set ORIGINS_PRESENCE=1 to start); nothing is listening'); process.exit(0); }
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, ORIGINS_PRESENCE_TEST_AUTH: testAuth } = process.env;
const host = process.env.PRESENCE_HOST ?? '127.0.0.1', port = Number(process.env.PRESENCE_PORT ?? 8793);
let verify: (token: string) => Promise<string | null>;
if (testAuth === '1') {
  if (url || host !== '127.0.0.1') throw new Error('ORIGINS_PRESENCE_TEST_AUTH is for the loopback load test only (unset SUPABASE_URL, bind 127.0.0.1)');
  verify = async (token: string) => { const m = /^bot-([a-z0-9]{1,8})$/.exec(token); return m ? `00000000-0000-4000-8000-${m[1].padStart(12, '0')}` : null; };
} else {
  if (!url || !anon) throw new Error('set SUPABASE_URL and SUPABASE_ANON_KEY');
  verify = supabaseVerify(url, anon);
}
const num = (name: string, fallback: number): number => Number(process.env[name] ?? fallback);
const rules = { ...RULES, softCap: num('PRESENCE_SOFT', RULES.softCap), hardCap: num('PRESENCE_HARD', RULES.hardCap) };
const limits = testAuth === '1' ? { ...LIMITS, ipSockets: 1000, ipJoinsPerMinute: 100000 } : LIMITS;
const writerUrl = process.env.WRITER_URL, writerKey = process.env.ORIGINS_WRITER_INTERNAL_KEY || undefined;
if (!writerUrl !== !writerKey) throw new Error('set WRITER_URL and ORIGINS_WRITER_INTERNAL_KEY together (or neither: no position save)');
const served = writerUrl && writerKey ? writerSavedLocation(writerUrl, writerKey) : null, save = writerUrl && writerKey ? writerSaveLocation(writerUrl, writerKey) : undefined;
const locate = served ? async (account: string) => { const s = await served(account); return s.saved ? { x: s.x, z: s.z } : null; } : undefined;
console.log(save ? `presence: position save ON (writer ${writerUrl}, every ${num('PRESENCE_SAVE_MS', 300_000) / 1000} s, on leave and zone change)` : 'presence: position save OFF (no WRITER_URL)');
const presence = createPresence({ locate, save, saveEveryMs: num('PRESENCE_SAVE_MS', 300_000), verify, rules, limits, internalKey: process.env.PRESENCE_INTERNAL_KEY || undefined, logEveryMs: num('PRESENCE_LOG_MS', 60_000), maxLayers: num('PRESENCE_MAX_LAYERS', 8), ipHeader: host === '127.0.0.1' && testAuth !== '1' });
presence.server.listen(port, host, () => console.log(`presence listening on ${host}:${presence.port()} (layers: soft ${rules.softCap}, hard ${rules.hardCap})`));
