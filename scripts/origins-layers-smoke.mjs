// NOT PROD. End-to-end smoke of per-layer spawns + damage share + dynamic respawn through the writer's real handlers (worldSpawnOps) on a DISPOSABLE PostgreSQL cluster with every migration applied:
// two accounts, each with an honest scripted-hero wolf fight recorded by the real world combat engine, replayed by the real verifier (verifyWorldRecord), each engages and kills ONE Zone 1 creature in its
// own layer (A in layer 1 with 2 players, B in layer 2 with 40 players), then the DATABASE is read back: the ledger, the damage rows, and the spawn rows by layer with their respawn clocks (layer 2's is the
// dynamic one, layer 1's the row's). Then the hop: A, who killed the instance in layer 1, tries to kill it in layer 2 after layer 2's SHORTENED respawn has passed but inside the ROW's: it must be refused (cooldown).
// Run on the VPS: runuser -u frankrows -- env PG_BIN=/usr/lib/postgresql/16/bin node --experimental-strip-types scripts/origins-layers-smoke.mjs
import '../tests/lib/era-off.ts';   // FIRST: the scripted hero is the legacy-rules bot (the same fixture the verifier's tests use); record and replay run under the same rules in this process, as the tests do
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { encodeWorldRecord } from '../src/fight/server.ts';
import { createWorldCombat as live } from '../src/fight/world-combat.ts';
import { verifyWorldRecord } from '../origins/server/world-verify.ts';
import { worldSpawnOps, defaultZoneSpawns, minKillMs } from '../origins/server/world-spawns.ts';
import { dynamicRespawnS } from '../origins/server/dynamic-respawn.ts';
import { loadEncounterContent } from '../origins/encounters/encounters.ts';
import { DbError } from '../origins/server/db.ts';
import { Refused } from '../origins/server/errors.ts';

const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-layers-smoke-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const fail = message => { throw Error(message); };
let checks = 0;
const eq = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); else console.log(`ok  ${what}`); };
const [A, B] = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// the writer's Db over the disposable cluster, as the writer's own role (the same psql contract as psqlDb: vars as -v, errors as DbError(code))
const db = { run: (sql, vars = {}) => new Promise((resolve, reject) => {
  const args = ['-h', root, '-d', 'postgres', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];
  for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`);
  const child = spawn(pg('psql'), [...args, '-f', '-'], { env: { ...env, LC_ALL: 'C.UTF-8' }, stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '', err = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; });
  child.on('close', status => { if (status === 0) return resolve(out.trim()); const m = /ERROR:\s+(\w{5}):\s+(.*)/.exec(err); reject(new DbError(m?.[1] ?? 'psql', m?.[2] ?? err.trim().slice(0, 300))); });
  child.stdin.end(`set role frankendom_origins;\n${sql}`);
}) };

const loaded = loadEncounterContent(); if (!loaded.ok) fail('content');
const content = loaded.value, all = defaultZoneSpawns(content);
const base = [...all.values()].find(s => s.spec.character === 'character:ash-wolf');
const wolf = { ...base, spec: { ...base.spec, level: 1 } };   // a level-1 Zone 1 wolf: the scripted hero kills it (the same fixture the verifier's own tests use)
const spawns = new Map([[wolf.spec.id, wolf]]);

async function honest() {
  const fell = []; let rec = null;
  const at = { x: wolf.spec.home.x, z: wolf.spec.home.z }, spec = { id: wolf.spec.id, body: 'wolf', level: 1, name: 'wolf' };
  const mobs = { within: (x, z, r) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} };
  const wc = live({ mobs: () => mobs, onKill: s => { fell.push(s.id); rec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {} });
  const hero = { x: at.x, z: at.z - 1.4, facing: 0 };
  for (let i = 0; i < 400 && !fell.length; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find(q => q.id === spec.id); hero.facing = w ? Math.atan2(w.x - hero.x, w.z - hero.z) : 0; wc.update(1 / 30, hero); } }
  if (!rec) fail('the scripted hero did not kill the wolf');
  return encodeWorldRecord(rec);
}
let fightS = 0;   // the recorded fight's own length, set below: the verifier refuses a record LONGER than the wall time since the token was issued ('overlong'), so each kill waits the fight out

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
    grant usage on schema public,auth to anon,authenticated;
    insert into auth.users values ('${A}'), ('${B}');`);
  psql(readdirSync(dir).filter(n => n.endsWith('.sql')).sort().map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));   // EVERY migration, as prod is now
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ('${A}'), ('${B}');`);
  const pcs = Object.fromEntries([[A, 'Aria'], [B, 'Bran']].map(([a, n]) => [a, psql(`set role frankendom_origins; select public.origins_create_character('${a}', '${n}');`).split('\n').pop().replace(/^"|"$/g, '')]));

  const record = await honest();
  const ticks = verifyWorldRecord(record, { spec: wolf.spec }, 'wolf', undefined, 1_000_000);
  void ticks;
  fightS = Number((await ticks)?.ticks ?? 0) / 60;
  const waitMs = () => Math.max(minKillMs(wolf.hp), fightS * 1000) + 3000;
  console.log(`recorded fight ${fightS.toFixed(1)} s; each kill waits ${(waitMs() / 1000).toFixed(0)} s after its token was issued`);
  const players = { 1: 2, 2: 40 };   // A's layer holds 2 players (the row respawn), B's holds 40 (dynamic: row x 10/40, floored at 15 s)
  const layerOf = { [A]: 1, [B]: 2 };
  const ops = worldSpawnOps({ content, spawns, spawnLayers: true, damageShare: true, dynamicRespawn: true, layerCounts: async () => ({ layers: [1, 2], players }),
    verifyRecord: job => verifyWorldRecord(job.text, job.spawn, job.kind, job.limit, job.maxTicks), log: l => console.log(`  writer: ${l}`) });
  const ctx = account => ({ db, account, where: async () => ({ online: true, layer: layerOf[account], placed: false }) });
  const engage = async a => ops.engage(ctx(a), { character: pcs[a], instance: wolf.spec.id });
  const kill = async (a, token) => ops.kill_report(ctx(a), { token, hits: 60, record });

  const rowS = wolf.respawnS, dynS = dynamicRespawnS(rowS, players[2]);
  console.log(`not prod: disposable cluster ${root}; wolf ${wolf.spec.id} row respawn ${rowS} s, crowded-layer (40 players) respawn ${dynS} s`);
  eq(dynS < rowS && dynS >= 15, true, 'fixture: the 40-player layer respawns faster than the row, not below the 15 s floor');

  const ea = await engage(A), eb = await engage(B);
  eq([ea.token?.length > 10, eb.token?.length > 10], [true, true], 'A (layer 1) and B (layer 2) each engage the same creature and get their own token');
  eq(psql(`select string_agg(layer::text, ',' order by layer) from public.origins_spawns where instance = '${wolf.spec.id}'`), '1,2', 'the database holds one spawn row PER LAYER for that creature');
  await sleep(waitMs());   // the time floor AND the record's own length: nothing is accepted faster than the fight could have been played

  const ka = await kill(A, ea.token), kb = await kill(B, eb.token);
  eq([ka.result ?? ka.status, kb.result ?? kb.status], ['killed', 'killed'], 'both kills accepted (real replay verdict on each honest record)');
  const spawnRows = psql(`select layer || ':' || (not alive) || ':' || round(extract(epoch from (respawn_at - killed_at)))::int from public.origins_spawns where instance = '${wolf.spec.id}' order by layer`).split('\n');
  eq(spawnRows, [`1:true:${rowS}`, `2:true:${dynS}`], 'spawn rows by layer: both dead; layer 1 on the ROW respawn, layer 2 (40 players) on the dynamic respawn');
  eq(psql(`select count(*) from public.origins_beta_ledger where event_id in ('enc:${ea.token}', 'enc:${eb.token}') and bronze > 0`), '2', 'the ledger paid bronze for both kills (CP stays 0 here: the fixture accounts have no career row, cpReason no-career)');
  eq(psql(`select count(*) from public.origins_spawn_damage where token in ('${ea.token}', '${eb.token}') and damage > 0`), '2', 'damage rows written for both kills (damage share)');
  eq(psql(`select count(*) from public.origins_events where kind = 'mob' and (payload->>'world')::boolean and payload->>'record' = 'verified'`), '2', 'both events carry record = verified');

  // the hop: A killed it in layer 1 just now. Wait past layer 2's dynamic respawn (it is dead again alive), stay inside the ROW's, A moves to layer 2 and engages + kills: refused.
  await sleep((dynS + 2) * 1000);
  layerOf[A] = 2;
  let hopped = 'paid';
  try { const eh = await engage(A); await sleep(minKillMs(wolf.hp) + 500); const kh = await kill(A, eh.token); hopped = kh.result ?? kh.status ?? 'paid'; }
  catch (e) { hopped = e instanceof Refused ? `${e.status}:${e.code}` : `error:${e.message}`; }
  eq(hopped.includes('cooldown') || hopped.includes('dead'), true, `the hop (A, layer 1 -> 2, past the shortened respawn, inside the row's) is refused, not paid (got ${hopped})`);
  eq(psql(`select count(*) from public.origins_beta_ledger where account = '${A}' and bronze > 0`), '1', 'A has exactly ONE paid kill: the hop paid nothing');
  console.log(`\norigins-layers-smoke (NOT PROD, disposable cluster): ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
