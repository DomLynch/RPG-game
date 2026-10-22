// Migration 20261022110000 (the town is zone 0): the generated column origins_spawns.zone on a disposable PostgreSQL cluster with every migration applied. Proves: a key `z0:x` reads as zone '0' (before the
// migration it read as '1', silently); the rule is otherwise 202610090017's (bare key = '1', z2: = '2', z10: = '10', z1000: = '1000'); a key that starts like a zone but does not parse (`z01:x`, `z2x`) still
// reads as '1', which is why the writer REFUSES such keys before they reach the database (zoneOfKey, tested in origins/server/world-spawns.test.ts); the zone index exists; the down script gives 202610090017's rule back
// (`z0:x` reads as '1' again) and keeps the index. Rows are written directly: the column is the point, the kill path is proven by origins-spawns-check.mjs.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const UP = '20261022110000_origins_spawn_zone_zero.sql';
const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-zone0-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const fail = message => { throw Error(message); };
let checks = 0;
const eq = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const KEYS = ['wolves-1', 'z0:town-1', 'z2:wolves-1', 'z10:x', 'z700:wolves-1', 'z1000:wolves-1', 'z01:x', 'z2wolves-1', 'z0'];
const zones = () => Object.fromEntries(psql(`select instance || '=' || zone from public.origins_spawns order by instance collate "C"`).split('\n').map(l => l.split('=')).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

let started = false;
try {
  run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o', `-k ${root} -c listen_addresses=''`, '-w', 'start']); started = true;
  psql(`create extension if not exists pgcrypto;
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;`);
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(UP)) fail(`${UP} is missing from ${dir}`);
  const before = files.filter(n => n < UP);
  psql(before.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));   // everything up to (not including) this migration: 202610090017's rule
  const insert = () => psql(`delete from public.origins_spawns; ${KEYS.map(k => `insert into public.origins_spawns (instance, kind) values ('${k}', 'character:ash-wolf');`).join(' ')}`);
  insert();
  eq(zones()['z0:town-1'], '1', 'before: a z0: key was stored as zone 1 (the silent wrong answer this migration removes)');
  psql(readFileSync(join(dir, UP), 'utf8'));
  psql(files.filter(n => n > UP).map(n => readFileSync(join(dir, n), 'utf8')).join('\n') || 'select 1;');
  insert();
  const want = { 'wolves-1': '1', 'z0:town-1': '0', 'z2:wolves-1': '2', 'z10:x': '10', 'z700:wolves-1': '700', 'z1000:wolves-1': '1000', 'z01:x': '1', 'z2wolves-1': '1', 'z0': '1' };
  eq(Object.entries(zones()), Object.entries(want).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)), 'after: z0: reads as zone 0, every other key as before');
  eq(psql(`select count(*) from pg_indexes where tablename = 'origins_spawns' and indexname = 'origins_spawns_zone'`), '1', 'the zone index is back');
  eq(psql(`select is_generated from information_schema.columns where table_name = 'origins_spawns' and column_name = 'zone'`), 'ALWAYS', 'the column is still generated');
  psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  insert();
  eq(zones()['z0:town-1'], '1', 'down: 202610090017\'s rule again (z0: reads as zone 1)');
  eq([zones()['z2:wolves-1'], zones()['z1000:wolves-1']], ['2', '1000'], 'down: the other keys unchanged');
  eq(psql(`select count(*) from pg_indexes where tablename = 'origins_spawns' and indexname = 'origins_spawns_zone'`), '1', 'down: the index is kept');
  console.log(`origins-spawn-zone-check: ${checks} checks passed`);
} finally {
  if (started) { try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already stopped */ } }
  rmSync(root, { recursive: true, force: true });
}
