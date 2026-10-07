// S1 load test, the writer half (docs/specs/origins/launch-gates.md S1; Lead's shape: 10 ops/s sustained plus a 30-op burst). The REAL Origins writer (origins/server: HTTP -> handlers -> psql
// as the frankendom_origins role -> the real migrations) on a disposable socket-only PostgreSQL cluster, in the harness of scripts/origins-writer-check.mjs. Only Supabase Auth is faked (a token
// table) and the writer's DATABASE_URL / SUPABASE_* are never read, so it touches nothing real: no production, no Supabase, no paid call.
//   node scripts/writer-loadtest.mjs [--rate=10] [--seconds=30] [--burst=30] [--accounts=200] [--warmup=3]      (PG_BIN=/usr/lib/postgresql/16/bin on the VPS, run as the postgres user)
// Load shape: an OPEN loop (arrivals on a fixed clock, never waiting for the previous answer, so a slow writer shows as a growing latency and not as a lower rate), spread uniformly over --accounts
// accounts, 70% `open` and 30% `open {character}` (choose the active character, then the snapshot: the two ops every session starts with). Then, after the sustained phase drains, a BURST of
// --burst ops fired in the same instant. Reported per phase: ops, status counts, latency p50/p95/p99/max (ms), the psql processes spawned per op (every op is a psql process: the cost behind
// finding E), and the box's load average before and after. A run on a busy box is flagged UNQUIET and its numbers are not for the report: S1's figures need a quiet window.
// The writer is called directly (no nginx), so the edge's limit_req (5 r/s per IP, burst 10, ops/nginx/frankendom-origins-limits.conf) is NOT in these numbers: ten ops a second from ONE address
// would meet that limit, ten from many players would not; the per-IP behaviour is a separate nginx check.
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
/* global fetch, performance */

const arg = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`--${name}=`)); return hit ? Number(hit.split('=')[1]) : fallback; };
const RATE = arg('rate', 10), SECONDS = arg('seconds', 30), BURST = arg('burst', 30), ACCOUNTS = arg('accounts', 200), WARMUP = arg('warmup', 3);
const dir = 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-origins-loadtest-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 600_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const uuid = i => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null;
const ms = n => n === null ? null : Math.round(n * 10) / 10;
const quiet = () => loadavg()[0] <= cpus().length * 0.5;

let started = false, server;
try {
  run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o', `-k ${root} -c listen_addresses='' -c max_connections=400`, '-w', 'start']); started = true;
  const ids = Array.from({ length: ACCOUNTS }, (_, i) => uuid(i + 1));
  psql(`create extension if not exists pgcrypto;
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    insert into auth.users select id from unnest(array[${ids.map(i => `'${i}'::uuid`).join(',')}]) id;`);
  psql(readdirSync(dir).filter(n => n.endsWith('.sql')).sort().map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled';
    insert into public.origins_access(account) select id from unnest(array[${ids.map(i => `'${i}'::uuid`).join(',')}]) id;
    insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) select id, 'P' || row_number() over (), (row_number() over ()) % 12, '{"owned":[],"equipped":{}}'::jsonb from unnest(array[${ids.map(i => `'${i}'::uuid`).join(',')}]) id;`);

  const real = psqlDb(`postgresql://frankendom_origins@/postgres?host=${root}`, pg('psql'));
  let spawns = 0;
  const db = { run: (sql, vars) => { spawns++; return real.run(sql, vars); } };
  server = createWriter({ db, verify: async t => { const i = /^t(\d+)$/.exec(t)?.[1]; return i ? ids[Number(i)] ?? null : null; }, handlers });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/origins/`;
  const post = async (op, i, body) => {
    const t0 = performance.now();
    try { const res = await fetch(base + op, { method: 'POST', headers: { authorization: `Bearer t${i}`, 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }); await res.text(); return { status: res.status, ms: performance.now() - t0 }; }
    catch { return { status: 0, ms: performance.now() - t0 }; }
  };

  // Setup, not measured: every account makes its one character (the writer makes it the active one).
  const chars = new Array(ACCOUNTS);
  for (let i = 0; i < ACCOUNTS; i += 10) await Promise.all(Array.from({ length: Math.min(10, ACCOUNTS - i) }, async (_, k) => {
    const n = i + k, res = await fetch(base + 'create_character', { method: 'POST', headers: { authorization: `Bearer t${n}`, 'content-type': 'application/json' }, body: JSON.stringify({ name: `Hero${n}` }) });
    const j = await res.json(); if (!j.ok) throw Error(`setup: create_character ${n}: ${JSON.stringify(j)}`); chars[n] = j.result.id;
  }));
  const op = (n, r) => r < 0.7 ? post('open', n, {}) : post('open', n, { character: chars[n] });
  for (let w = 0; w < WARMUP * RATE; w++) await op(w % ACCOUNTS, 0);   // warm the writer and the cluster (not measured)

  const phase = async (name, fire) => {
    const load0 = loadavg()[0], spawn0 = spawns, t0 = performance.now();
    const results = await fire();
    const wall = (performance.now() - t0) / 1000, lat = results.map(r => r.ms).sort((a, b) => a - b), status = {};
    for (const r of results) status[r.status] = (status[r.status] ?? 0) + 1;
    return { phase: name, ops: results.length, wallS: Math.round(wall * 10) / 10, status, p50: ms(pct(lat, 50)), p95: ms(pct(lat, 95)), p99: ms(pct(lat, 99)), max: ms(lat.at(-1) ?? null), psqlSpawns: spawns - spawn0, spawnsPerOp: Math.round((spawns - spawn0) / Math.max(1, results.length) * 100) / 100, load1Before: Math.round(load0 * 10) / 10, load1After: Math.round(loadavg()[0] * 10) / 10 };
  };
  const sustained = await phase('sustained', async () => {
    const pending = [], t0 = performance.now(), total = RATE * SECONDS;
    for (let k = 0; k < total; k++) {   // arrivals on a fixed clock: the k-th op is due at k / RATE seconds, whatever the writer is doing
      const due = t0 + (k / RATE) * 1000, wait = due - performance.now(); if (wait > 0) await sleep(wait);
      pending.push(op(Math.floor(Math.random() * ACCOUNTS), Math.random()));
    }
    return Promise.all(pending);
  });
  const burst = await phase('burst', () => Promise.all(Array.from({ length: BURST }, (_, k) => op((k * 7) % ACCOUNTS, Math.random()))));
  const report = { rate: RATE, seconds: SECONDS, burst: BURST, accounts: ACCOUNTS, cores: cpus().length, quiet: quiet(), phases: [sustained, burst] };
  console.log(JSON.stringify(report, null, 1));
  console.log(`writer-loadtest: ${quiet() ? 'quiet box' : 'UNQUIET BOX (load1 above half the cores): these numbers are not for the S1 report'}; sustained ${RATE}/s p99 ${sustained.p99} ms, burst ${BURST} p99 ${burst.p99} ms, ${sustained.spawnsPerOp} psql spawns per op`);
} finally {
  server?.close();
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
