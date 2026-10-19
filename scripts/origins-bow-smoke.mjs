// NOT PROD. End-to-end smoke of the BOW in an open-world fight against the LEDGER, through the writer's real handlers on a DISPOSABLE PostgreSQL cluster with every migration applied (the pattern of
// scripts/origins-layers-smoke.mjs, but under the LIVE rules: the sandbox era is ON, no era-off). Account A gets `item:starter.bow` in the MAIN HAND the way a player does (the real ground_take of
// ground:zone1.bow-1, then the real gear_equip), a scripted hero fights a Zone 1 wolf with weapon 'bow' from range (plain arrows: see the gap below), the real world combat engine records it, and the writer's
// kill_report replays it with the real verifier, whose hero limit is heroLimitOf(db, ...) read from the ledger: the record is `verified` against weapon 'bow' and the kill is paid. Account B (no bow in the ledger)
// submits the same kind of bow record on another wolf: the verifier refuses it as 'weapon' (not verified), so a bow record is only accepted from a ledger that holds a bow.
//
// KNOWN GAP, not asserted as a pass: POWER SHOT (skill 'cleave' on a bow carrier) cannot fire in an open-world fight today. The bow special needs the fighter's specialShare (duel.ts bowRow, sandbox-rules bowSpecialOf),
// but src/fight/open-fight.ts heroSheeted() sets specialShare only for a hero carrying a spell, and duel.ts disables the bow row for a spell carrier; a world hero with special 'cleave' + bow throws the MELEE cleave row,
// which whiffs at range. The fix is a sim change (record-version bump) in Combat's lane. This script reports `power shot landed: false` honestly and flips to asserting it once the engine can fire it.
// Run on the VPS: runuser -u frankrows -- env PG_BIN=/usr/lib/postgresql/16/bin node --experimental-strip-types scripts/origins-bow-smoke.mjs
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { encodeWorldRecord } from '../src/fight/server.ts';
import { createWorldCombat } from '../src/fight/world-combat.ts';
import { cumulative } from '../src/core/server.ts';   // the server door (tests/core-boundary C1: no deep core import)
import { verifyWorldRecord } from '../origins/server/world-verify.ts';
import { heroLimitOf } from '../origins/server/worn-gear.ts';
import { groundOps } from '../origins/server/ground-take.ts';
import { itemOps } from '../origins/server/content-ops.ts';
import { worldSpawnOps, defaultZoneSpawns, minKillMs } from '../origins/server/world-spawns.ts';
import { loadEncounterContent } from '../origins/encounters/encounters.ts';
import { DbError } from '../origins/server/db.ts';

const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-bow-smoke-'));
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
const content = loaded.value;
const wolves = [...defaultZoneSpawns(content).values()].filter(s => s.spec.character === 'character:ash-wolf').slice(0, 2).map(s => ({ ...s, spec: { ...s.spec, level: 1 } }));   // two level-1 Zone 1 wolves: one per account
const spawns = new Map(wolves.map(w => [w.spec.id, w]));

/** The scripted bow hero: weapon 'bow', special 'cleave'. He backs off whenever the wolf is nearer than 2.4 m (the missile gap is 1.8 m) and looses a plain arrow (press) from beyond 1.9 m. Returns the record text,
 *  its length and whether a POWER SHOT arrow really landed (skill_cleave missile hit: false in the open world today, see the header). */
async function honestBow(wolf) {
  const fell = []; let rec = null, heroDied = false, started = -1, ticks = 0, power = false, castAt = -1;
  const at = { x: wolf.spec.home.x, z: wolf.spec.home.z }, spec = { id: wolf.spec.id, body: 'wolf', level: 1, name: 'wolf' };
  const mobs = { within: (x, z, r) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} };
  const wc = createWorldCombat({ mobs: () => mobs, onKill: s => { fell.push(s.id); rec = wc.record(); }, onHeroDied: () => { heroDied = true; }, onHeroHit: () => {},
    hero: () => ({ level: 1, weapon: 'bow', special: 'cleave' }),
    onEvent: e => { if (e.type === 'FightStarted' && started < 0) started = ticks; const t = JSON.stringify(e); if (castAt >= 0 && ticks >= castAt && /issile/.test(t) && /skill_cleave|cleave/.test(t)) { power = true; } if (process.env.BOW_DEBUG && castAt >= 0 && ticks >= castAt && ticks < castAt + 90) console.log(`  ev ${ticks - castAt} ${t.slice(0, 200)}`); } });
  const hero = { x: at.x, z: at.z - 6, facing: 0 };
  for (let i = 0; i < 60 * 240 && !fell.length && !heroDied; i++) {
    const w = wc.debug().find(q => q.id === spec.id); let d = 99;
    if (w) { hero.facing = Math.atan2(w.x - hero.x, w.z - hero.z); d = Math.hypot(w.x - hero.x, w.z - hero.z); if (d < 2.4) { hero.x -= (w.x - hero.x) / d * 6 / 60; hero.z -= (w.z - hero.z) / d * 6 / 60; } at.x = w.x; at.z = w.z; }
    if (d >= 1.9 && started >= 0 && wc.hero().phase === 'ready') { if (castAt < 0 && ticks - started >= 125) { castAt = ticks; wc.cast(); } else if (i % 7 === 0) wc.press(); }   // one SKILL press (Power Shot) once the special is ready (2 s in), plain arrows otherwise
    wc.update(1 / 60, hero); ticks++;
  }
  if (!rec) fail('the scripted bow hero did not kill the wolf');
  return { text: await encodeWorldRecord(rec), fightS: rec.steps.length / 60, power };
}

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
  // The take mints the bow at the zone's level band (Legionary) and gear_equip refuses a Recruit ('needs rank Legionary'); origins_create_character makes no career row, so give A one (fixture step, superuser psql, as origins-writer-check.mjs does).
  psql(`insert into public.origins_career(account, seed_credit, world_credit) values ('${A}', 0, ${cumulative(11)}) on conflict (account) do update set world_credit = excluded.world_credit, version = public.origins_career.version + 1;`);

  // A takes the bow off the ground and wields it, through the real ops
  const ground = groundOps({ content, log: l => console.log(`  writer: ${l}`) }), items = itemOps(loaded);
  const ctxOf = a => ({ db, account: a, where: async () => ({ online: true, layer: 1, placed: false }) });
  const taken = await ground.ground_take(ctxOf(A), { character: pcs[A], instance: 'ground:zone1.bow-1' });
  eq(taken.result, 'taken', 'A takes ground:zone1.bow-1 (real ground_take)');
  const piece = (await items.gear_open(ctxOf(A), { character: pcs[A] })).pieces.find(p => p.item === 'item:starter.bow');
  await items.gear_equip(ctxOf(A), { character: pcs[A], id: piece.id });
  eq(psql(`select loc_kind || ':' || coalesce(loc_slot, '-') from public.origins_items where loc_owner = '${pcs[A]}' and item = 'item:starter.bow'`), 'equipped:main', 'the ledger holds the bow in the MAIN HAND (real gear_equip)');
  eq([(await heroLimitOf(db, A, pcs[A])).weapon, (await heroLimitOf(db, B, pcs[B])).weapon === 'bow'], ['bow', false], 'heroLimitOf: A fights with weapon bow from the ledger, B (no bow) does not');

  const recA = await honestBow(wolves[0]), recB = await honestBow(wolves[1]);
  console.log(`not prod: disposable cluster ${root}; bow fights ${recA.fightS.toFixed(1)} s and ${recB.fightS.toFixed(1)} s; power shot landed: ${recA.power} (false on trunk before RV83: see the header; true on RV83 / #3375)`);
  // the unit verifier alone first: the record is bow, and the ledger's limit decides
  eq([(await verifyWorldRecord(recA.text, wolves[0], 'wolf', { weapon: 'bow' })).ok, (await verifyWorldRecord(recA.text, wolves[0], 'wolf', { weapon: 'knife' })).reason], [true, 'weapon'], 'verifier: the bow record passes a bow limit and is refused (weapon) against any other');

  const ops = worldSpawnOps({ content, spawns, spawnLayers: false, damageShare: true, heroOf: (account, character, version) => heroLimitOf(db, account, character, version),
    verifyRecord: job => verifyWorldRecord(job.text, job.spawn, job.kind, job.limit, job.maxTicks), log: l => console.log(`  writer: ${l}`) });
  const engage = (a, w) => ops.engage(ctxOf(a), { character: pcs[a], instance: w.spec.id });
  const ea = await engage(A, wolves[0]), eb = await engage(B, wolves[1]);
  await sleep(Math.max(minKillMs(wolves[0].hp), Math.max(recA.fightS, recB.fightS) * 1000) + 3000);   // the record may not be longer than the wall time since the token
  const ka = await ops.kill_report(ctxOf(A), { token: ea.token, hits: 60, record: recA.text }), kb = await ops.kill_report(ctxOf(B), { token: eb.token, hits: 60, record: recB.text });
  eq([ka.result, kb.result], ['killed', 'killed'], 'both kills accepted by the writer (a bad record still pays share 1, damage 0, as today)');
  const verdictOf = tok => psql(`select e.payload->>'record' from public.origins_events e where e.event_id = 'enc:${tok}'`);
  eq(verdictOf(ea.token), 'verified', 'A: the bow record is VERIFIED against the ledger (main hand = bow) and the kill is paid on it');
  eq(verdictOf(eb.token) === 'verified', false, `B: the same bow record without a bow in the ledger is NOT verified (${verdictOf(eb.token)})`);
  eq(psql(`select count(*) from public.origins_beta_ledger where event_id = 'enc:${ea.token}' and bronze > 0`), '1', 'A: the ledger paid the kill');
  // The Power Shot case: EXPECTED-FAIL until RV83 (Lead: the specialShare fix, branch combat/world-bow-specials, WSV 62). When the engine can fire it, this flips to a pass and the line below says so.
  if (!recA.power && process.env.BOW_EXPECT_POWER === '1') fail('POWER SHOT did not land (BOW_EXPECT_POWER=1: the engine must fire it, RV83 or later)');   // flip to the default once RV83 (#3375) is on trunk
  console.log(recA.power ? 'ok  POWER SHOT (cleave via the bow) landed an arrow in the open world, and the record verified against the ledger' : 'EXPECTED-FAIL (until RV83): POWER SHOT cannot fire in an open-world fight (heroSheeted sets specialShare only for a spell carrier); not counted as a failure');
  console.log(`\norigins-bow-smoke (NOT PROD, disposable cluster): ${checks} checks passed; power shot: ${recA.power ? 'PASS' : 'EXPECTED-FAIL until RV83'}`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
