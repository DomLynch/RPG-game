// Migration 202610080002 (world creature fights): the five functions on a disposable PostgreSQL cluster with every migration applied, driven as BOTH writer roles (the writer connects as
// frankendom_verifier since 202610080001; frankendom_origins is the other grant). Proves: start holds the server's parameters and claims the creature; one open fight per account; a creature
// has one live claimant and a stale claim is taken over; touch continues the same token and seed inside the grace and is refused after it; settle consumes the token, closes the run, releases the
// creature and writes the batch in ONE transaction (a bad batch rolls all of it back; a second settle is refused); the sweep settles an expired fight once as a loss by abandonment under the same
// event id, skips a row another transaction holds, and a settle after it is refused; nothing is reachable except through the definer functions; the down-script removes the new objects only.
// Also: the rewards hook's real lines (mob-rewards.ts) pay CP + loot once with the settle, and bronze through migration 202610080004's origins_metal_of read.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { fightSetup, loadEncounterContent, lookupOf, rollLoot } from '../origins/encounters/encounters.ts';
import { openInventory } from '../origins/inventory/inventory.ts';
import { mobBatch } from '../origins/server/mob-rewards.ts';
import { heldSql, spellRefusal } from '../origins/server/spell-gate.ts';

const UP = '202610080002_origins_encounter_runs.sql';
const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-origins-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const psqlAsync = sql => new Promise(resolve => {
  const child = spawn(pg('psql'), ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-X', '-q', '-A', '-t'], { env });   // verbose: the SQLSTATE rides in the message, as the writer reads it
  let out = '', err = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; }); child.on('close', code => resolve({ code, out: out.trim(), err }));
  child.stdin.end(sql);
});
const [A, B, C] = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'];
const fail = message => { throw Error(message); };
let checks = 0;
const eq = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
// A statement as a role; the SQLSTATE-ish O-code of its refusal, or null when it succeeded.
const as = (role, sql) => psqlAsync(`set role ${role}; ${sql}`);
const code = async (role, sql) => { const r = await as(role, sql); return r.code === 0 ? null : /(O\d{4}|\b42501\b|permission denied)/.exec(r.err)?.[1] ?? r.err.trim().slice(0, 120); };
const tok = n => `tok-${n}-`.padEnd(24, 'x');
const START = (acct, pc, t, seed, enemy, level, extra = {}) => `select public.origins_encounter_start('${acct}', '${pc}', '${t}', ${seed}, '${enemy}', ${level}, ${extra.tick ?? 0}, ${extra.bar ?? 'null'}, '${JSON.stringify(extra.flags ?? [])}'::jsonb, ${extra.layer ? `'${extra.layer}'` : 'null'}, ${extra.instance ? `'${extra.instance}'` : 'null'})::text;`;
const EV = (t, acct, pc, result) => `[{"op":"event","event_id":"enc:${t}","kind":"mob","account":"${acct}","character":"${pc}","payload":{"result":"${result}","verified":true}}]`;
const SETTLE = (acct, t, result, ticks, batch) => `select public.origins_encounter_settle('${acct}', '${t}', '${result}', ${ticks}, '${batch}'::jsonb)::text;`;
const state = t => ((o) => ({ used: o.used, settled: o.settled, result: o.result, claims: o.claims, events: o.events }))(JSON.parse(psql(`select jsonb_build_object('used', e.used_at is not null, 'settled', r.settled_at is not null, 'result', r.result, 'claims', (select count(*) from public.origins_creature_claims where token = e.token), 'events', (select count(*) from public.origins_events where event_id = 'enc:' || e.token))::text from public.origins_encounters e join public.origins_encounter_runs r on r.token = e.token where e.token = '${t}'`)));
const age = t => psql(`update public.origins_encounters set expires_at = now() - interval '1 second' where token = '${t}'`);

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
    insert into auth.users values ('${A}'), ('${B}'), ('${C}');`);
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(UP)) fail(`${UP} is missing from ${dir}`);
  psql(files.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));   // every migration, 0002 included
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ('${A}'), ('${B}'), ('${C}');`);
  const mk = (account, name) => psql(`set role frankendom_origins; select public.origins_create_character('${account}', '${name}');`).split('\n').pop();
  const [pcA, pcB, pcC] = [mk(A, 'Aria'), mk(B, 'Bran'), mk(C, 'Cass')];
  const V = 'frankendom_verifier', O = 'frankendom_origins';

  // ---- grants: both writer roles execute every function; nobody else; no table is reachable directly ---------------------------------
  const FNS = ['origins_encounter_start(uuid,text,text,bigint,text,int,int,int,jsonb,text,text)', 'origins_encounter_get(uuid,text)', 'origins_encounter_touch(uuid,text,int)', 'origins_encounter_settle(uuid,text,text,int,jsonb)', 'origins_encounter_expire(int)'];
  for (const fn of FNS) eq(psql(`select has_function_privilege('${V}', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('${O}', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('anon', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('authenticated', '${fn}'::regprocedure, 'execute')::int::text`), '1100', `grants: ${fn} is for the two writer roles only`);
  for (const t of ['origins_encounter_runs', 'origins_creature_claims']) {
    eq(psql(`select has_table_privilege('${V}', 'public.${t}', 'select')::int::text || has_table_privilege('${O}', 'public.${t}', 'select')::int::text || has_table_privilege('anon', 'public.${t}', 'select')::int::text || has_table_privilege('authenticated', 'public.${t}', 'select')::int::text`), '0000', `grants: no role reads ${t} directly`);
  }

  // ---- start: the server's parameters, as each writer role ------------------------------------------------------------------------------
  const s1 = JSON.parse((await as(V, START(A, pcA, tok(1), 4242, 'knight', 6, { tick: 77, bar: 900, flags: [{ kind: 'one-health-bar' }, { kind: 'flee-at', percent: 30 }], instance: 'camp:wolf-3' }))).out.split('\n').pop());
  eq([s1.token, s1.seed, s1.enemy, s1.level, s1.start_tick, s1.bar, s1.flags.length, s1.layer, s1.instance, s1.grace_s, s1.settled, s1.used], [tok(1), 4242, 'knight', 6, 77, 900, 2, null, 'camp:wolf-3', 120, false, false], 'start (as the verifier): the server holds every parameter');
  const s2 = JSON.parse((await as(O, START(B, pcB, tok(2), 99, 'veteran', 30, { instance: 'camp:boar-1' }))).out.split('\n').pop());
  eq([s2.token, s2.enemy, s2.level], [tok(2), 'veteran', 30], 'start (as the origins role) works too');

  // ---- practice (migration 202610130026): the skills-by-use pool is written only by the 6-arg settle, once per key, on a win, capped, focus doubles --------------------------
  const PR = (t, skill, amount, capXp, key = `practice:enc:${t}:${skill}`) => `[{"skill":"${skill}","amount":${amount},"capXp":${capXp},"key":"${key}"}]`;
  const SETTLE6 = (acct, t, result, batch, practice) => `select public.origins_encounter_settle('${acct}', '${t}', '${result}', 400, '${batch}'::jsonb, '${practice}'::jsonb)::text;`;
  const xpOf = skill => psql(`select coalesce((select xp from public.origins_skill_xp where character = '${pcC}' and skill = '${skill}'), -1)`);
  eq(await code(V, START(C, pcC, tok(40), 7001, 'knight', 6)), null, 'practice: a fight starts');
  eq(await code(V, SETTLE6(C, tok(40), 'lost', EV(tok(40), C, pcC, 'lost'), PR(tok(40), 'sword', 10, 100))), 'O0002', 'practice: a loss cannot carry practice');
  eq(await code(V, SETTLE6(C, tok(40), 'won', EV(tok(40), C, pcC, 'won'), PR(tok(40), 'sword', 10, 100, 'practice:enc:other:sword'))), 'O0002', 'practice: a key not made from this token is refused');
  eq(state(tok(40)).used, false, 'practice: the refusals consumed nothing (the token is still open)');
  eq(await code(V, SETTLE6(C, tok(40), 'won', EV(tok(40), C, pcC, 'won'), PR(tok(40), 'sword', 10, 100))), null, 'practice: a verified win pays');
  eq(xpOf('sword'), '10', 'practice: ten xp banked');
  eq(await code(V, SETTLE6(C, tok(40), 'won', EV(tok(40), C, pcC, 'won'), PR(tok(40), 'sword', 10, 100))), 'O0009', 'practice: a retried settle is refused and pays nothing more');
  eq(xpOf('sword'), '10', 'practice: still ten');
  eq(psql(`select count(*) from public.origins_skill_practice where key = 'practice:enc:${tok(40)}:sword'`), '1', 'practice: one ledger row');
  psql(`update public.origins_skill_xp set focus = true where character = '${pcC}' and skill = 'sword'`);
  eq(await code(V, START(C, pcC, tok(41), 7002, 'knight', 6)), null, 'practice: a second fight starts');
  eq(await code(V, SETTLE6(C, tok(41), 'won', EV(tok(41), C, pcC, 'won'), PR(tok(41), 'sword', 10, 100))), null, 'practice: a focused win settles');
  eq(xpOf('sword'), '30', 'practice: focus doubled the second win');
  eq(await code(V, START(C, pcC, tok(42), 7003, 'knight', 6)), null, 'practice: a third fight starts');
  eq(await code(V, SETTLE6(C, tok(42), 'won', EV(tok(42), C, pcC, 'won'), PR(tok(42), 'sword', 10, 35))), null, 'practice: a win at the ceiling settles');
  eq(xpOf('sword'), '35', 'practice: the placed points are the ceiling');
  // two fights of one character settling AT THE SAME MOMENT (opened by hand: start refuses a second open fight per account): the first holds its transaction open, the second must queue on the xp row and read the first's xp.
  for (const n of [43, 44]) psql(`insert into public.origins_encounters (token, account, character, seed, enemy, enemy_level, expires_at) values ('${tok(n)}', '${C}', '${pcC}', ${n}, 'knight', 6, now() + interval '10 minutes'); insert into public.origins_encounter_runs (token) values ('${tok(n)}')`);
  psql(`update public.origins_skill_xp set xp = 0, focus = false where character = '${pcC}' and skill = 'sword'`);
  const first = as(V, `begin; ${SETTLE6(C, tok(43), 'won', EV(tok(43), C, pcC, 'won'), PR(tok(43), 'sword', 10, 15))} select pg_sleep(2); commit;`);
  await new Promise(r => setTimeout(r, 700));
  const second = as(V, SETTLE6(C, tok(44), 'won', EV(tok(44), C, pcC, 'won'), PR(tok(44), 'sword', 10, 15)));
  const [r1, r2] = await Promise.all([first, second]);
  eq([r1.code, r2.code], [0, 0], 'practice race: both settles succeed');
  eq(xpOf('sword'), '15', 'practice race: two concurrent settles end AT the ceiling, not over it (the second queued on the xp row)');
  eq(psql(`select string_agg(paid::text, ',' order by paid desc) from public.origins_skill_practice where key in ('practice:enc:${tok(43)}:sword', 'practice:enc:${tok(44)}:sword')`), '10,5', 'practice race: paid 10 then 5');
  eq(await code('anon', `select * from public.origins_skill_xp`), '42501', 'practice: no client reads the pool');
  // ---- 0029: the pool is readable and flaggable only through the definer functions (RLS closes the table to the writer roles) ----------------------------------------------
  for (const role of [V, O]) {
    const r = await as(role, `select public.origins_skill_pool('${C}', '${pcC}')::text;`); eq(r.code, 0, `skill pool: the ${role} role can call the reader`);
    eq(JSON.stringify(JSON.parse(r.out.trim().split('\n').pop()).sword), '{"xp":15,"focus":false}', `skill pool (${role}): the banked xp and focus per skill`);
  }
  eq(psql(`set role ${V}; select count(*) from public.origins_skill_xp;`).split('\n').pop(), '0', 'skill pool: a plain select by the writer still sees no rows (so the reader is the only way)');
  eq(psql(`set role ${V}; select coalesce(public.origins_skill_pool('${A}', '${pcC}')::text, 'null');`).split('\n').pop(), 'null', 'skill pool: not the account\'s character -> null');
  eq(JSON.parse(psql(`set role ${O}; select public.origins_skill_focus('${C}', '${pcC}', 'sword', true)::text;`).split('\n').pop()).focus, true, 'skill focus: flipped on');
  eq(psql(`select focus::text from public.origins_skill_xp where character = '${pcC}' and skill = 'sword'`), 'true', 'skill focus: stored');
  eq(JSON.parse(psql(`set role ${O}; select public.origins_skill_focus('${C}', '${pcC}', 'axe', true)::text;`).split('\n').pop()).xp, 0, 'skill focus: a skill with no xp yet gets a row at 0 xp');
  eq(await code(O, `select public.origins_skill_focus('${C}', '${pcC}', 'Not A Skill', true);`), 'O0002', 'skill focus: a malformed skill is refused');
  eq(psql(`set role ${O}; select coalesce(public.origins_skill_focus('${A}', '${pcC}', 'sword', false)::text, 'null');`).split('\n').pop(), 'null', 'skill focus: not the account\'s character -> null, nothing flipped');
  eq(await code(V, `select public.origins_skill_focus('${C}', '${pcC}', 'sword', false);`), '42501', 'skill focus: the verifier role cannot flip it (least privilege)');
  eq(await code('anon', `select public.origins_skill_pool('${C}', '${pcC}');`), '42501', 'skill pool: no client reads it');
  eq(await code('authenticated', `select public.origins_skill_focus('${C}', '${pcC}', 'sword', false);`), '42501', 'skill focus: no client flips it');
  psql(`update public.origins_skill_xp set focus = false where character = '${pcC}'`);
  eq(await code('authenticated', SETTLE6(C, tok(42), 'won', '[]', '[]')), '42501', 'practice: no client calls the settle');

  // ---- grimoire (migration 202610130027): a spell is taken only by the 7-arg settle, on a win, once per account and legend ----------------------------------------
  const SP = (legend, bricks = '{"root":"crack","modifiers":[],"suffix":null}', key = `spell:${legend}`) => `[{"legend":"${legend}","bricks":${bricks},"key":"${key}"}]`;
  const SETTLE7 = (acct, t, result, batch, spells) => `select public.origins_encounter_settle('${acct}', '${t}', '${result}', 400, '${batch}'::jsonb, '[]'::jsonb, '${spells}'::jsonb)::text;`;
  const spellsOf = acct => psql(`select coalesce(string_agg(legend, ',' order by legend), '') from public.origins_grimoire where account = '${acct}'`);
  eq(await code(V, START(C, pcC, tok(50), 8001, 'knight', 6)), null, 'grimoire: a fight starts');
  eq(await code(V, SETTLE7(C, tok(50), 'lost', EV(tok(50), C, pcC, 'lost'), SP('eloko'))), 'O0002', 'grimoire: a loss cannot take a spell');
  eq(await code(V, SETTLE7(C, tok(50), 'won', EV(tok(50), C, pcC, 'won'), SP('eloko', undefined, 'spell:other'))), 'O0002', 'grimoire: a key not made from the legend is refused');
  eq(await code(V, SETTLE7(C, tok(50), 'won', EV(tok(50), C, pcC, 'won'), SP('eloko', '[]'))), 'O0002', 'grimoire: bricks that are no {root, modifiers, suffix} object are refused');
  eq(await code(V, SETTLE7(C, tok(50), 'won', EV(tok(50), C, pcC, 'won'), SP('eloko', '{"modifiers":[],"suffix":null}'))), 'O0002', 'grimoire: bricks without a root are refused');
  eq(spellsOf(C), '', 'grimoire: the refusals took nothing');
  eq(state(tok(50)).used, false, 'grimoire: the refusals consumed nothing');
  eq(await code(V, SETTLE7(C, tok(50), 'won', EV(tok(50), C, pcC, 'won'), SP('eloko'))), null, 'grimoire: a verified win takes the spell');
  eq(spellsOf(C), 'eloko', 'grimoire: one spell');
  eq(await code(V, SETTLE7(C, tok(50), 'won', EV(tok(50), C, pcC, 'won'), SP('eloko'))), 'O0009', 'grimoire: a retried settle is refused');
  { const r = await as(V, `select json_build_object('grimoire', coalesce(public.origins_grimoire_get('${C}'::uuid)::jsonb, '{}'::jsonb), 'xp', coalesce((select json_object_agg(skill, xp) from public.origins_skill_xp where character = '${pcC}'), '{}'::json))::text;`); eq(r.code, 0, 'spell check: the writer role can read the grimoire and the pool in one query'); eq(Object.keys(JSON.parse(r.out.trim().split('\n').pop()).grimoire).join(','), 'eloko', 'spell check: the query returns the taken spell'); }
  eq(await code(V, START(C, pcC, tok(51), 8002, 'knight', 6)), null, 'grimoire: a second fight starts');
  eq(await code(V, SETTLE7(C, tok(51), 'won', EV(tok(51), C, pcC, 'won'), SP('eloko'))), null, 'grimoire: the same legend again settles');
  eq(psql(`select count(*) from public.origins_grimoire where account = '${C}'`), '1', 'grimoire: the same legend twice grants once');
  eq(await code(V, START(C, pcC, tok(52), 8003, 'knight', 6)), null, 'grimoire: a third fight starts');
  eq(await code(V, SETTLE7(C, tok(52), 'won', EV(tok(52), C, pcC, 'won'), SP('kehua', '{"root":"longShadow","modifiers":[],"suffix":null}'))), null, 'grimoire: another legend settles');
  eq(spellsOf(C), 'eloko,kehua', 'grimoire: two legends, two rows');
  eq(psql(`select (public.origins_grimoire_get('${C}'))::jsonb -> 'kehua'`), '{"root": "longShadow", "suffix": null, "modifiers": []}', 'grimoire: get returns the bricks per legend');
  eq(await code('anon', `select * from public.origins_grimoire`), '42501', 'grimoire: no client reads the book');
  eq(await code('authenticated', SETTLE7(C, tok(52), 'won', '[]', '[]')), '42501', 'grimoire: no client calls the settle');

  // ---- the spell gate's reads (#2487), as BOTH writer roles: the practice pool is RLS-closed to them (a plain select sees no rows), so the xp a spell record is checked against must come through the definer reader origins_skill_pool (0029) ----
  if (files.includes('202610130029_skill_pool_access.sql')) {
    psql(`insert into public.origins_skill_xp(character, skill, xp) values ('${pcA}', 'wind', 500); insert into public.origins_grimoire(account, legend, bricks, source_event) values ('${A}', 'alvis', '{"root":"gale","modifiers":[],"suffix":null}'::jsonb, 'enc:spell-gate-check');`);
    const stored = { placed: { wind: 10 } }, spell = { id: 'alvis', skill: 5 }, rec = (skill = 5) => ({ spell: { ...spell, skill }, characterId: pcA.replace(/^pc:/, ''), buildVersion: 1 });
    for (const role of [V, O]) {
      eq((await as(role, 'select count(*) from public.origins_skill_xp;')).out.trim().split('\n').pop(), '0', `${role}: a plain select of the practice pool sees no rows (RLS), which is why the gate must not read it`);
      const held = JSON.parse((await as(role, `${heldSql(A, pcA)};`)).out.trim().split('\n').pop());
      eq([held.xp.wind, Object.keys(held.grimoire)], [500, ['alvis']], `${role}: the held read returns the practised xp and the owned spell through origins_skill_pool`);
      const load = { held: async () => held, build: async () => stored };
      eq(await spellRefusal(rec(5), A, load), null, `${role}: a practised skill within the ceiling is accepted`);
      eq(/casts at 6, past the 5/.test(String(await spellRefusal(rec(6), A, load))), true, `${role}: a skill past the ceiling is refused`);
      const other = JSON.parse((await as(role, `${heldSql(B, pcA)};`)).out.trim().split('\n').pop());
      eq(other.xp, {}, `${role}: another account reads no xp for this character`);
    }
  }

  psql(readFileSync(join(dir, '..', 'down', '202610130027_grimoire_core_down.sql'), 'utf8'));
  eq(psql(`select (to_regprocedure('public.origins_encounter_settle(uuid,text,text,int,jsonb,jsonb,jsonb)') is null)::text || '/' || count(*) from pg_class where relname = 'origins_grimoire'`), 'true/0', 'grimoire down: the 7-arg settle and the table are gone');
  eq(psql(`select (to_regprocedure('public.origins_encounter_settle(uuid,text,text,int,jsonb,jsonb)') is not null)::text`), 'true', 'grimoire down: the 6-arg settle stays');

  eq(await code(V, START(A, pcA, tok(3), 1, 'knight', 6)), 'O0014', 'one open fight per account: a second start is refused');
  eq(await code(V, START(C, pcC, tok(4), 1, 'knight', 6, { instance: 'camp:wolf-3' })), 'O0014', 'one live claimant per creature instance');
  eq(await code(V, START(C, pcC, tok(5), 1, 'knight', 6, { instance: 'camp:wolf-4' })), null, 'a different creature is free');
  eq(await code(V, START(A, pcB, tok(6), 1, 'knight', 6)), 'O0007', 'a character that is not the account\'s is refused');
  const lvl = await as(V, START(B, pcB, tok(7), 1, 'knight', 999));
  eq([lvl.code !== 0, /check constraint/.test(lvl.err)], [true, true], 'a level out of range is refused by the table');
  const got = JSON.parse((await as(V, `select public.origins_encounter_get('${A}', '${tok(1)}')::text;`)).out.split('\n').pop());
  eq([got.seed, got.bar, got.instance], [4242, 900, 'camp:wolf-3'], 'get: the writer reads the same parameters back');
  eq((await as(V, `select coalesce(public.origins_encounter_get('${B}', '${tok(1)}')::text, 'null');`)).out.split('\n').pop(), 'null', 'get: another account\'s token is invisible');

  // ---- touch: the same token and seed inside the grace, refused after it -----------------------------------------------------------------
  const before = psql(`select expires_at from public.origins_encounters where token = '${tok(1)}'`);
  await psql(`select pg_sleep(1.1)`);
  const t1 = JSON.parse((await as(V, `select public.origins_encounter_touch('${A}', '${tok(1)}', 250)::text;`)).out.split('\n').pop());
  eq([t1.token, t1.seed, t1.last_tick], [tok(1), 4242, 250], 'touch: the SAME token and seed continue, with the tick advanced');
  eq(psql(`select expires_at > '${before}'::timestamptz from public.origins_encounters where token = '${tok(1)}'`), 't', 'touch: the grace restarts');
  eq(JSON.parse((await as(V, `select public.origins_encounter_touch('${A}', '${tok(1)}', 100)::text;`)).out.split('\n').pop()).last_tick, 250, 'touch: the last tick never goes backwards');
  eq(await code(V, `select public.origins_encounter_touch('${B}', '${tok(1)}', 1);`), 'O0009', 'touch: another account\'s token is refused');

  // ---- settle: one transaction; a bad batch rolls all of it back --------------------------------------------------------------------------
  eq(await code(V, SETTLE(A, tok(1), 'draw', 10, '[]')), 'O0002', 'settle: only won or lost');
  eq(await code(V, SETTLE(A, tok(1), 'won', 321, EV(tok(1), B, pcB, 'won'))), 'O0010', 'settle: an event outside the account aborts');
  eq(state(tok(1)), { used: false, settled: false, result: null, claims: 1, events: 0 }, 'settle: and the whole transaction rolled back (token live, run open, creature still claimed)');
  eq(await code(V, SETTLE(A, tok(1), 'won', 321, EV(tok(1), A, pcA, 'won'))), null, 'settle: the verified batch commits');
  eq(state(tok(1)), { used: true, settled: true, result: 'won', claims: 0, events: 1 }, 'settle: token consumed, run closed, creature released, event enc:<token> written');
  eq(psql(`select kind || '/' || (payload ->> 'result') from public.origins_events where event_id = 'enc:${tok(1)}'`), 'mob/won', 'settle: the event is kind mob');
  eq(await code(V, SETTLE(A, tok(1), 'won', 321, EV(tok(1), A, pcA, 'won'))), 'O0009', 'settle: a second settle is refused and writes nothing more');
  eq(await code(V, START(A, pcA, tok(8), 5, 'knight', 6, { instance: 'camp:wolf-3' })), null, 'after the settle the account and the creature are free again');

  // ---- the sweep: an expired fight is one abandonment, once, under the same event id ---------------------------------------------------------
  age(tok(2)); age(tok(8));
  eq(await code(V, `select public.origins_encounter_touch('${B}', '${tok(2)}', 5);`), 'O0009', 'expired: a touch after the grace is refused');
  eq(await code(V, SETTLE(B, tok(2), 'won', 5, EV(tok(2), B, pcB, 'won'))), 'O0009', 'expired: a settle after the grace is refused (a win cannot arrive late)');
  // a row another transaction holds is skipped, not waited on and not double-handled
  const holder = psqlAsync(`begin; select 1 from public.origins_encounters where token = '${tok(2)}' for update; select pg_sleep(2.5); commit;`);
  await psql(`select pg_sleep(0.8)`);
  const t0 = Date.now();
  const swept1 = (await as(V, `select public.origins_encounter_expire(50);`)).out.split('\n').pop();
  eq([swept1, Date.now() - t0 < 2000], ['1', true], 'sweep: settles the free expired fight and SKIPS the locked one without waiting');
  await holder;
  const swept2 = (await as(O, `select public.origins_encounter_expire(50);`)).out.split('\n').pop();
  eq(swept2, '1', 'sweep: the skipped one is settled on the next pass (as the other role)');
  eq((await as(V, `select public.origins_encounter_expire(50);`)).out.split('\n').pop(), '0', 'sweep: nothing left, nothing settled twice');
  eq(state(tok(2)), { used: true, settled: true, result: 'abandoned', claims: 0, events: 1 }, 'sweep: abandoned, token used, creature released, one event');
  eq(psql(`select payload ->> 'result' || '/' || (payload ->> 'ticks') from public.origins_events where event_id = 'enc:${tok(2)}'`), 'abandoned/0', 'sweep: the event says abandoned');
  eq(state(tok(8)).result, 'abandoned', 'sweep: both expired fights are abandonments');
  eq(await code(V, START(B, pcB, tok(9), 7, 'knight', 6, { instance: 'camp:boar-1' })), null, 'after the sweep the creature is free (it resets: nobody inherits a half-dead mob)');

  // ---- a stale claim (its fight expired, not yet swept) is taken over by the next claimant -------------------------------------------------------
  psql(`insert into public.origins_creature_claims (instance, token) values ('camp:stale', '${tok(5)}') on conflict (instance) do update set token = excluded.token;`);
  age(tok(5));
  eq(await code(V, START(A, pcA, tok(11), 9, 'knight', 6, { instance: 'camp:stale' })), null, 'a stale claim (its fight expired) is taken over');
  eq(psql(`select token from public.origins_creature_claims where instance = 'camp:stale'`), tok(11), 'and the claim now names the new fight');

  // ---- the rewards hook's real lines (mob-rewards.ts mobBatch): CP + loot commit with the settle, once; a stale career aborts all of it --------------
  const content = loadEncounterContent().value, lookup = lookupOf(content);
  const creature = Object.keys(content.local.creatureLoot).filter(id => fightSetup(id, content).ok).sort((x, y) => fightSetup(y, content).value.opponent.level - fightSetup(x, content).value.opponent.level)[0], foe = fightSetup(creature, content).value.opponent;
  let seed = 1; while (!(rollLoot(content.local.creatureLoot[creature], seed, content, { foeLevel: foe.level }).value.items.length > 0)) seed++;
  psql(`set role frankendom_origins; select public.origins_snapshot('${C}', 0, 5000);`);
  const open = () => JSON.parse(psql(`set role ${V}; select public.origins_open('${C}')::text;`).split('\n').pop());
  const linesFor = (t, career) => {
    const inv = openInventory({ owner: pcC, account: `account:${C}`, items: [], packSize: 64, bankSize: 1000 }, lookup).value;
    return mobBatch({ account: C, character: pcC, token: t, fight: creature, seed, enemy: foe.body, level: foe.level, twist: null }, { career, inventory: inv }, content, '2026-10-08T10:00:00.000Z');
  };
  const items = () => Number(psql(`select count(*) from public.origins_items where holder_account = '${C}' and retired_at is null`));
  const careerBefore = open().career;
  const paid = linesFor(tok(20), careerBefore);
  eq([paid.summary.cp > 0, paid.summary.drops.length > 0, paid.batch.some(l => l.op === 'metal')], [true, true, false], 'rewards: the kill pays CP and loot, and no metal yet');
  eq(await code(V, START(C, pcC, tok(20), seed, foe.body, foe.level)), null, 'rewards: a fight against the creature starts');
  eq(await code(V, SETTLE(C, tok(20), 'won', 400, JSON.stringify([...JSON.parse(EV(tok(20), C, pcC, 'won')), ...paid.batch]))), null, 'rewards: the settle with the reward lines commits');
  const careerAfter = open().career;
  eq([items(), Number(careerAfter.world_credit) - Number(careerBefore.world_credit), careerAfter.version - careerBefore.version], [paid.summary.drops.length, paid.summary.cp, 1], 'rewards: the drops are minted and the CP booked, once');
  eq(await code(V, SETTLE(C, tok(20), 'won', 400, JSON.stringify([...JSON.parse(EV(tok(20), C, pcC, 'won')), ...paid.batch]))), 'O0009', 'rewards: a retried settle is refused');
  eq([items(), open().career.version], [paid.summary.drops.length, careerAfter.version], 'rewards: and pays nothing twice');
  eq(await code(V, START(C, pcC, tok(21), seed + 1, foe.body, foe.level)), null, 'rewards: a second fight starts');
  const stale = linesFor(tok(21), careerBefore);   // priced on the career row as it was BEFORE the first kill: its expected_version is stale
  eq(await code(V, SETTLE(C, tok(21), 'won', 400, JSON.stringify([...JSON.parse(EV(tok(21), C, pcC, 'won')), ...stale.batch]))), 'O0002', 'rewards: a stale career version aborts the settle');
  eq([state(tok(21)).used, state(tok(21)).settled, items()], [false, false, paid.summary.drops.length], 'rewards: nothing was written and the token is still open for a retry');

  eq(await code(V, SETTLE(C, tok(21), 'won', 400, EV(tok(21), C, pcC, 'won'))), null, 'rewards: the stale fight settles once priced again (here: the event only), freeing the account');
  // ---- bronze (migration 202610080004 origins_metal_of): the read the `metal` op's version needs, granted to the two writer roles only --------------
  const fnPriv = role => psql(`select has_function_privilege('${role}', 'public.origins_metal_of(uuid)', 'execute')`);
  eq([fnPriv(V), fnPriv(O), fnPriv('anon'), fnPriv('authenticated')], ['t', 't', 'f', 'f'], 'metal_of: the writer roles execute it, anon and authenticated do not (default privileges revoked)');
  const metalOf = () => JSON.parse(psql(`set role ${V}; select coalesce(public.origins_metal_of('${C}')::text, 'null');`).split('\n').pop());
  eq(metalOf(), null, 'metal_of: no row before the first award');
  let bseed = 1; while (!(rollLoot(content.local.creatureLoot[creature], bseed, content, { foeLevel: foe.level }).value.metal > 0)) bseed++;
  const bronzeFight = async (t, s, metal, career) => {
    eq(await code(V, START(C, pcC, t, s, foe.body, foe.level)), null, `bronze: fight ${t} starts`);
    const inv = openInventory({ owner: pcC, account: `account:${C}`, items: [], packSize: 64, bankSize: 1000 }, lookup).value;
    const p = mobBatch({ account: C, character: pcC, token: t, fight: creature, seed: s, enemy: foe.body, level: foe.level, twist: null }, { career, inventory: inv, metal }, content, '2026-10-08T10:00:00.000Z');
    return { p, settle: () => code(V, SETTLE(C, t, 'won', 400, JSON.stringify([...JSON.parse(EV(t, C, pcC, 'won')), ...p.batch.filter(l => l.op === 'metal')]))) };
  };
  const b1 = await bronzeFight(tok(22), bseed, metalOf(), open().career);
  eq(b1.p.batch.filter(l => l.op === 'metal').length, 1, 'bronze: the kill carries one metal award');
  eq(await b1.settle(), null, 'bronze: the first award inserts the balance row with the settle');
  eq(metalOf(), { bronze: b1.p.summary.bronze, version: 1 }, 'bronze: balance and version after the first award');
  const b2 = await bronzeFight(tok(23), bseed, metalOf(), open().career);
  eq(await b2.settle(), null, 'bronze: a later award names the version and commits');
  eq(metalOf(), { bronze: b1.p.summary.bronze + b2.p.summary.bronze, version: 2 }, 'bronze: the balance adds up, version 2');
  eq(psql(`select count(*) || '/' || sum(delta_bronze) from public.origins_metal_ledger where account = '${C}'`), `2/${b1.p.summary.bronze + b2.p.summary.bronze}`, 'bronze: two ledger lines, conserved');
  const b3 = await bronzeFight(tok(24), bseed, { bronze: 0, version: 1 }, open().career);   // priced on a stale balance version
  eq(await b3.settle(), 'O0002', 'bronze: a stale balance version aborts the settle');
  eq([state(tok(24)).settled, metalOf().version], [false, 2], 'bronze: nothing written, the token still open');
  psql(readFileSync(join(dir, '..', 'down', '202610080004_origins_metal_of_down.sql'), 'utf8'));
  eq(psql(`select to_regprocedure('public.origins_metal_of(uuid)') is null`), 't', 'metal_of down: the function is gone');
  eq(psql(`select count(*) from public.origins_metal_ledger where account = '${C}'`), '2', 'metal_of down: no data touched');
  psql(readFileSync(join(dir, '202610080004_origins_metal_of.sql'), 'utf8'));

  // ---- respawn window (migration 202610080006 origins_last_paid_kill): the time since the account's last PAID kill of a fight, from committed events -----
  eq(await code(V, SETTLE(C, tok(24), 'won', 400, EV(tok(24), C, pcC, 'won'))), null, 'respawn: the stale bronze fight settles (event only), freeing the account');
  const lpPriv = role => psql(`select has_function_privilege('${role}', 'public.origins_last_paid_kill(uuid, text)', 'execute')`);
  eq([lpPriv(V), lpPriv(O), lpPriv('anon'), lpPriv('authenticated')], ['t', 't', 'f', 'f'], 'last_paid_kill: the writer roles execute it, anon and authenticated do not');
  const lastPaid = f => JSON.parse(psql(`set role ${V}; select coalesce(public.origins_last_paid_kill('${C}', '${f}')::text, 'null');`).split('\n').pop());
  const EVP = (t, fight, wasPaid) => `[{"op":"event","event_id":"enc:${t}","kind":"mob","account":"${C}","character":"${pcC}","payload":{"result":"won","verified":true,"fight":"${fight}","paid":${wasPaid}}}]`;
  eq(lastPaid(creature), null, 'last_paid_kill: no paid kill of this fight yet (the earlier events carry no fight key)');
  eq(await code(V, START(C, pcC, tok(25), seed + 2, foe.body, foe.level)), null, 'respawn: a fight starts');
  eq(await code(V, SETTLE(C, tok(25), 'won', 400, EVP(tok(25), creature, true))), null, 'respawn: a paid kill settles');
  const ms = lastPaid(creature);
  eq(typeof ms === 'number' && ms >= 0 && ms < 60_000, true, `last_paid_kill: milliseconds since the paid kill, on the database clock (got ${ms})`);
  eq(await code(V, START(C, pcC, tok(26), seed + 3, foe.body, foe.level)), null, 'respawn: another fight starts');
  eq(await code(V, SETTLE(C, tok(26), 'won', 400, EVP(tok(26), 'character:other-kind', false))), null, 'respawn: an unpaid kill settles');
  eq(lastPaid('character:other-kind'), null, 'last_paid_kill: an unpaid kill opens no window');
  eq(psql(`select count(*) from pg_indexes where indexname = 'origins_events_paid_mob'`), '1', 'last_paid_kill: the partial index exists');
  psql(readFileSync(join(dir, '..', 'down', '202610080006_origins_last_paid_kill_down.sql'), 'utf8'));
  eq(psql(`select (to_regprocedure('public.origins_last_paid_kill(uuid,text)') is null)::text || '/' || (select count(*) from pg_indexes where indexname = 'origins_events_paid_mob')`), 'true/0', 'last_paid_kill down: the function and the index are gone');
  eq(psql(`select count(*) from public.origins_events where event_id = 'enc:${tok(25)}'`), '1', 'last_paid_kill down: no event touched');
  psql(readFileSync(join(dir, '202610080006_origins_last_paid_kill.sql'), 'utf8'));

  psql(readFileSync(join(dir, '..', 'down', '202610130029_skill_pool_access_down.sql'), 'utf8'));
  eq(psql(`select (to_regprocedure('public.origins_skill_pool(uuid,text)') is null)::text || '/' || (to_regprocedure('public.origins_skill_focus(uuid,text,text,boolean)') is null)::text || '/' || count(*) from pg_class where relname = 'origins_skill_xp'`), 'true/true/1', 'skill pool down: both functions gone, the pool table untouched');
  psql(readFileSync(join(dir, '..', 'down', '202610130026_skill_practice_down.sql'), 'utf8'));
  eq(psql(`select (to_regprocedure('public.origins_encounter_settle(uuid,text,text,int,jsonb,jsonb)') is null)::text || '/' || count(*) from pg_class where relname in ('origins_skill_xp', 'origins_skill_practice')`), 'true/0', 'practice down: the 6-arg settle and both tables are gone');
  eq(psql(`select (to_regprocedure('public.origins_encounter_settle(uuid,text,text,int,jsonb)') is not null)::text`), 'true', 'practice down: the 5-arg settle stays');

  // ---- the down-script removes the new objects only -----------------------------------------------------------------------------------------
  psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  eq(psql(`select count(*) from pg_proc where proname like 'origins_encounter\\_%' and proname not in ('origins_issue_encounter', 'origins_consume_encounter')`), '0', 'down: the five functions are gone');
  eq(psql(`select count(*) from pg_class where relname in ('origins_encounter_runs', 'origins_creature_claims')`), '0', 'down: the two tables are gone');
  eq(psql(`select count(*) from pg_class where relname = 'origins_encounters'`), '1', 'down: origins_encounters and its issue/consume functions stay');
  eq(psql(`select count(*) from pg_proc where proname in ('origins_issue_encounter', 'origins_consume_encounter')`), '2', 'down: issue and consume stay');
  psql(readFileSync(join(dir, UP), 'utf8'));
  eq(psql(`select count(*) from pg_proc where proname like 'origins_encounter\\_%' and proname not in ('origins_issue_encounter', 'origins_consume_encounter')`), '5', 'up again after down: the five functions are back');
  psql(readFileSync(join(dir, '202610130026_skill_practice.sql'), 'utf8'));
  psql(readFileSync(join(dir, '202610130027_grimoire_core.sql'), 'utf8'));
  eq(psql(`select (to_regprocedure('public.origins_encounter_settle(uuid,text,text,int,jsonb,jsonb,jsonb)') is not null)::text`), 'true', 'grimoire up again: the 7-arg settle is back');
  console.log(`origins-encounter-check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
