// Migration 202610080002 (world creature fights): the five functions on a disposable PostgreSQL cluster with every migration applied, driven as BOTH writer roles (the writer connects as
// frankendom_verifier since 202610080001; frankendom_origins is the other grant). Proves: start holds the server's parameters and claims the creature; one open fight per account; a creature
// has one live claimant and a stale claim is taken over; touch continues the same token and seed inside the grace and is refused after it; settle consumes the token, closes the run, releases the
// creature and writes the batch in ONE transaction (a bad batch rolls all of it back; a second settle is refused); the sweep settles an expired fight once as a loss by abandonment under the same
// event id, skips a row another transaction holds, and a settle after it is refused; nothing is reachable except through the definer functions; the down-script removes the new objects only.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

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

  // ---- the down-script removes the new objects only -----------------------------------------------------------------------------------------
  psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  eq(psql(`select count(*) from pg_proc where proname like 'origins_encounter\\_%' and proname not in ('origins_issue_encounter', 'origins_consume_encounter')`), '0', 'down: the five functions are gone');
  eq(psql(`select count(*) from pg_class where relname in ('origins_encounter_runs', 'origins_creature_claims')`), '0', 'down: the two tables are gone');
  eq(psql(`select count(*) from pg_class where relname = 'origins_encounters'`), '1', 'down: origins_encounters and its issue/consume functions stay');
  eq(psql(`select count(*) from pg_proc where proname in ('origins_issue_encounter', 'origins_consume_encounter')`), '2', 'down: issue and consume stay');
  psql(readFileSync(join(dir, UP), 'utf8'));
  eq(psql(`select count(*) from pg_proc where proname like 'origins_encounter\\_%' and proname not in ('origins_issue_encounter', 'origins_consume_encounter')`), '5', 'up again after down: the five functions are back');
  console.log(`origins-encounter-check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
