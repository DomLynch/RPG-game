// The writer load test with the world-kill path (Lead 2026-10-19: "drive VERIFIED kills"). Same harness as scripts/writer-loadtest.mjs: the REAL Origins writer on a disposable socket-only
// PostgreSQL cluster, the real migrations, only Supabase Auth faked (a token table); no DATABASE_URL / SUPABASE_* is read, so nothing real can be touched. On top of `open` it drives Zone 1's
// spawn ops: spawn_state (the poll), and the kill cycle engage -> wait the time-to-kill floor -> kill_report with a REAL recorded kill attached, which the writer replays in the REAL verify pool
// (one worker, as production) and tallies verified / refused.
//   node scripts/writer-mix-loadtest.mjs [--rate=200] [--seconds=60] [--accounts=1000] [--pool=4] [--kill-share=0.1] [--clones=0] [--warmup=3]      (PG_BIN=/usr/lib/postgresql/16/bin; run as the postgres user)
// --rate: arrivals per second on a fixed clock (open loop), each one a kill cycle (probability --kill-share) or a read: 25% open, 75% spawn_state.
// --clones=0: the REAL 24-spawn Zone 1 set (shared rows, respawn 75-300 s: kills are scarce, most engages answer 'dead', exactly as in production).
// --clones=N (N >= 24): N clones of the wolf spawn, one per kill cycle in turn, so kills are NOT scarce: this measures the kill transaction and the replay queue under a kill rate the real zone cannot
//   produce (what per-layer spawn copies would allow). Use --kill-share=1 there (spawn_state would list N spawns).
// Reported per op: count, status counts, p50/p95/p99/max (ms); the kill outcomes; the verify tally (verified vs refused) and the pool queue after the drain; psql scripts per arrival; host load. A run on a
// host with load above half its cores is flagged UNQUIET.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { cpus, loadavg, tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { setTimeout as sleep } from 'node:timers/promises';
import { psqlDb } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';
import { handlers } from '../origins/server/handlers.ts';
import { encodeWorldRecord } from '../src/fight/server.ts';
import { createWorldCombat as live } from '../src/fight/world-combat.ts';
import { loadEncounterContent } from '../origins/encounters/encounters.ts';
import { worldSpawnOps, defaultZoneSpawns, minHits, minKillMs } from '../origins/server/world-spawns.ts';
import { createVerdictTally } from '../origins/server/world-verify.ts';
import { createVerifyPool } from '../origins/server/world-verify-pool.ts';
/* global fetch, performance */

const arg = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`--${name}=`)); return hit ? Number(hit.split('=')[1]) : fallback; };
const RATE = arg('rate', 200), SECONDS = arg('seconds', 60), ACCOUNTS = arg('accounts', 1000), POOL = arg('pool', 4), KILL_SHARE = arg('kill-share', 0.1), CLONES = arg('clones', 0), WARMUP = arg('warmup', 3);
const dir = 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-origins-mixtest-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 600_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const uuid = i => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null;
const r1 = n => n === null ? null : Math.round(n * 10) / 10;
const quiet = () => loadavg()[0] <= cpus().length * 0.5;
if (CLONES !== 0 && CLONES < 24) throw new Error('--clones is 0 (the real set) or at least 24');

// The honest recorded kill (the same scripted hero as origins/server/world-verify.test.ts): a level-1 wolf.
const content = (() => { const c = loadEncounterContent(); if (!c.ok) throw new Error('encounter content does not load'); return c.value; })();
const realSet = defaultZoneSpawns(content), baseWolf = [...realSet.values()].find(s => s.spec.character === 'character:ash-wolf');
async function honestRecord(sp = baseWolf) {   // a record is bound to ITS spawn (id and home): replayed against any other spawn it reads 'no kill', at about the same CPU cost (measured 55 ms vs 44 ms)
  const fell = []; let rec = null; const at = { x: sp.spec.home.x, z: sp.spec.home.z }, spec = { id: sp.spec.id, body: 'wolf', level: 1, name: 'wolf' };
  const mobs = { within: (x, z, r) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} };
  const wc = live({ mobs: () => mobs, onKill: s => { fell.push(s.id); rec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {} });
  const hero = { x: at.x, z: at.z - 1.4, facing: 0 };
  for (let i = 0; i < 400 && !fell.length; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find(q => q.id === spec.id); hero.facing = w ? Math.atan2(w.x - hero.x, w.z - hero.z) : 0; wc.update(1 / 30, hero); } }
  if (!rec) { if (sp === baseWolf) throw new Error('the scripted hero did not kill the wolf'); return null; }   // some ids (their fight seed) beat the scripted hero: that spawn simply has no honest record
  return { text: await encodeWorldRecord(rec), seconds: rec.steps.length / 60 };
}
const { text: recordText, seconds: recordSeconds } = await honestRecord();   // the writer refuses a record longer than the engagement is old ('overlong'), so a kill cycle waits the fight's real length
// One honest record per spawn, made before the run so the work is not in the measurement. The real set: the wolves get one (every other spawn, a bear or a goblin, has none and sends the base wolf's,
// which the replay refuses with 'no kill': that is the unverified share). The clones: only wolf ids the scripted hero can beat are kept (about half of them), so EVERY clone kill carries a record that verifies.
const recordOf = new Map(); let spawnSet;
if (CLONES === 0) { spawnSet = realSet; for (const [id, sp] of spawnSet) if (sp.spec.character === 'character:ash-wolf') { const h = id === baseWolf.spec.id ? { text: recordText } : await honestRecord(sp); if (h) recordOf.set(id, h.text); } }
else {
  spawnSet = new Map();
  for (let n = 0; spawnSet.size < CLONES && n < CLONES * 4; n++) { const id = `wolves-${n + 100}`, sp = { ...baseWolf, spec: { ...baseWolf.spec, id } }, h = await honestRecord(sp); if (h) { spawnSet.set(id, sp); recordOf.set(id, h.text); } }
  if (spawnSet.size < CLONES) throw new Error(`only ${spawnSet.size} of ${CLONES} clone spawns have an honest record`);
}
const spawnIds = [...spawnSet.keys()];
console.log(JSON.stringify({ honestRecords: recordOf.size, spawnsInSet: spawnSet.size }));

let started = false, server, pool;
try {
  run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o', `-k ${root} -c listen_addresses='' -c max_connections=400`, '-w', 'start']); started = true;
  const ids = Array.from({ length: ACCOUNTS }, (_, i) => uuid(i + 1)), idList = `array[${ids.map(i => `'${i}'::uuid`).join(',')}]`;
  psql(`create extension if not exists pgcrypto;
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    insert into auth.users select id from unnest(${idList}) id;`);
  psql(readdirSync(dir).filter(n => n.endsWith('.sql')).sort().map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled';
    update public.origins_world_config set kills_per_min = 60, kills_per_hour = 3600;   -- the table's own maximum: a per-account cap must not be what this test measures
    insert into public.origins_access(account) select id from unnest(${idList}) id;
    insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) select id, 'P' || row_number() over (), (row_number() over ()) % 12, '{"owned":[],"equipped":{}}'::jsonb from unnest(${idList}) id;`);

  const real = psqlDb(`postgresql://frankendom_origins@/postgres?host=${root}`, pg('psql'), 30_000, POOL);
  let scripts = 0;   // psql SCRIPTS run (one per db.run); with --pool>0 these reuse sessions
  const db = { run: (sql, vars) => { scripts++; return real.run(sql, vars); } };
  pool = createVerifyPool(); const tally = createVerdictTally();
  const spawnOps = worldSpawnOps({ content, verifyRecord: job => pool.verify(job), tally, spawns: spawnSet, log: () => {} });
  server = createWriter({ db, verify: async t => { const i = /^t(\d+)$/.exec(t)?.[1]; return i ? ids[Number(i)] ?? null : null; }, where: async () => ({ online: false }), handlers: { ...handlers, ...spawnOps } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/origins/`;
  const stats = {};   // op -> [{status, ms}]
  const post = async (op, i, body, count = true) => {
    const t0 = performance.now(); let status = 0, json = null;
    try { const res = await fetch(base + op, { method: 'POST', headers: { authorization: `Bearer t${i}`, 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }); status = res.status; json = await res.json().catch(() => null); } catch { /* status 0 */ }
    const ms = performance.now() - t0; if (count) (stats[op] ??= []).push({ status, ms }); return { status, ms, json };
  };

  const chars = new Array(ACCOUNTS);   // setup, not measured: every account makes its one character
  for (let i = 0; i < ACCOUNTS; i += 10) await Promise.all(Array.from({ length: Math.min(10, ACCOUNTS - i) }, async (_, k) => {
    const n = i + k, r = await post('create_character', n, { name: `Hero${n}` }, false); if (!r.json?.ok) throw Error(`setup: create_character ${n}: ${JSON.stringify(r.json)}`); chars[n] = r.json.result.id;
  }));
  for (let w = 0; w < WARMUP * Math.min(RATE, 50); w++) await post('open', w % ACCOUNTS, {}, false);   // warm the writer and the cluster (not measured)

  const outcomes = {}; const bump = k => { outcomes[k] = (outcomes[k] ?? 0) + 1; }; let cycle = 0;
  const killCycle = async n => {
    const instance = CLONES === 0 ? spawnIds[Math.floor(Math.random() * spawnIds.length)] : spawnIds[cycle++ % spawnIds.length], spawn = spawnSet.get(instance);
    const e = await post('engage', n, { character: chars[n], instance });
    if (e.status !== 200 || !e.json?.result?.token) { bump(`engage ${e.status} ${e.json?.reason ?? e.json?.error ?? ''}`.trim()); return; }
    await sleep(Math.max(minKillMs(spawn.hp) + 30, recordSeconds * 1000 + 300));   // the DB's time-to-kill floor, and the recorded fight's own length (13.5 s here), so the replay is not 'overlong'
    const k = await post('kill_report', n, { token: e.json.result.token, hits: minHits(spawn.hp), record: recordOf.get(instance) ?? recordText });
    bump(k.status === 200 ? 'killed' : `kill_report ${k.status} ${k.json?.reason ?? k.json?.error ?? ''}`.trim());
  };
  const arrival = n => {
    const r = Math.random();
    if (r < KILL_SHARE) return killCycle(n);
    return r < KILL_SHARE + (1 - KILL_SHARE) * 0.25 ? post('open', n, Math.random() < 0.3 ? { character: chars[n] } : {}) : post('spawn_state', n, {});
  };
  const load0 = loadavg()[0], scripts0 = scripts, t0 = performance.now(), total = RATE * SECONDS, pending = [];
  for (let k = 0; k < total; k++) {   // arrivals on a fixed clock: the k-th is due at k / RATE s, whatever the writer is doing
    const wait = t0 + (k / RATE) * 1000 - performance.now(); if (wait > 0) await sleep(wait);
    pending.push(arrival(Math.floor(Math.random() * ACCOUNTS)));
  }
  await Promise.all(pending); const wallS = (performance.now() - t0) / 1000;
  for (let i = 0; i < 300 && (pool.stats().queued > 0 || pool.stats().running); i++) await sleep(100);   // let the replay queue drain (up to 30 s) so the tally is complete
  const perOp = Object.fromEntries(Object.entries(stats).map(([op, rows]) => {
    const lat = rows.map(r => r.ms).sort((a, b) => a - b), status = {}; for (const r of rows) status[r.status] = (status[r.status] ?? 0) + 1;
    return [op, { n: rows.length, status, p50: r1(pct(lat, 50)), p95: r1(pct(lat, 95)), p99: r1(pct(lat, 99)), max: r1(lat.at(-1) ?? null) }];
  }));
  const bad = Object.entries(perOp).flatMap(([op, s]) => Object.entries(s.status).filter(([c]) => Number(c) >= 500 || Number(c) === 0).map(([c, n]) => `${op} ${c} x${n}`));
  const overP95 = Object.entries(perOp).filter(([, s]) => (s.p95 ?? 0) > 500).map(([op, s]) => `${op} p95 ${s.p95} ms`);
  const report = { rate: RATE, seconds: SECONDS, accounts: ACCOUNTS, pool: POOL, killShare: KILL_SHARE, spawnSet: CLONES === 0 ? `real Zone 1 (${spawnIds.length} spawns)` : `${CLONES} cloned wolf spawns`, wallS: r1(wallS), arrivals: total,
    perOp, killOutcomes: outcomes, verifyTally: tally.snapshot().outcomes ?? tally.snapshot(), verifyQueueAfterDrain: pool.stats(), psqlScriptsPerArrival: r1((scripts - scripts0) / Math.max(1, total)), cores: cpus().length, load1Before: r1(load0), load1After: r1(loadavg()[0]), quiet: quiet(),
    broke: bad.length || overP95.length ? { errors5xxOr0: bad, p95Over500ms: overP95 } : null };
  console.log(JSON.stringify(report, null, 1));
  console.log(`writer-mix-loadtest: ${quiet() ? 'quiet box' : 'UNQUIET BOX (load1 above half the cores)'}; ${report.broke ? 'BROKE: ' + JSON.stringify(report.broke) : 'no 5xx, no p95 over 500 ms'}`);
} finally {
  pool?.close(); server?.close();
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
process.exit(0);
