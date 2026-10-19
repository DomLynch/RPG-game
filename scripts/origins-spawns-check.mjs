// Migrations 202610080014 (Zone 1 world spawns, detached from the Pit) and 202610080015 (the beta wipe): the functions on a disposable PostgreSQL cluster with every migration applied, driven as BOTH writer roles.
// Proves: grants (writer roles only, no table reachable directly); engage creates the spawn and issues a single-use token, re-engaging returns the same token, at most max_open per
// account; touch extends and is refused after use/expiry; a kill report refuses too fast and over the caps WITHOUT writing, then consumes the token, marks the spawn dead with the
// respawn clock and applies the batch in ONE transaction (a bad batch rolls everything back); a second report is O0009; the other player's engage on the same creature answers 'dead';
// a dead spawn refuses engage until its respawn passes, then revives as generation + 1; many-on-one (Proof 3): three tokens open at once, each kill accepted on its own time floor; the beta wipe reverses exactly the ledger's items, bronze and CP and leaves every other
// row byte-identical, runs once, and no writer role can call it; the down-scripts remove exactly the new objects.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const UP = '202610080014_origins_world_spawns.sql';
const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-spawns-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const psqlAsync = sql => new Promise(resolve => {
  const child = spawn(pg('psql'), ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-X', '-q', '-A', '-t'], { env });
  let out = '', err = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; }); child.on('close', code => resolve({ code, out: out.trim(), err }));
  child.stdin.end(sql);
});
const [A, B] = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
const fail = message => { throw Error(message); };
let checks = 0;
const eq = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const as = (role, sql) => psqlAsync(`set role ${role}; ${sql}`);
const val = async (role, sql) => { const r = await as(role, sql); if (r.code !== 0) fail(`${sql}: ${r.err.trim().slice(0, 200)}`); return JSON.parse(r.out.split('\n').pop()); };
const code = async (role, sql) => { const r = await as(role, sql); return r.code === 0 ? null : /(O\d{4}|\b42501\b|permission denied)/.exec(r.err)?.[1] ?? r.err.trim().slice(0, 120); };
const tok = n => `spawn-tok-${n}-`.padEnd(24, 'x');
const ENGAGE = (acct, pc, t, inst, kind = 'character:ash-wolf') => `select public.origins_spawn_engage('${acct}', '${pc}', '${t}', '${inst}', '${kind}')::text;`;
const EV = (t, acct, pc) => `[{"op":"event","event_id":"enc:${t}","kind":"mob","account":"${acct}","character":"${pc}","payload":{"result":"won","world":true,"beta":true}}]`;
const KILL = (acct, t, minMs, respawnS, batch, ledger = '{"reach":"unchecked"}') => `select public.origins_spawn_kill('${acct}', '${t}', ${minMs}, ${respawnS}, '${batch}'::jsonb, '${ledger}'::jsonb)::text;`;
const ledger = t => psql(`select coalesce((select reach_status || '/' || cp || '/' || bronze || '/' || cardinality(item_ids) from public.origins_beta_ledger where event_id = 'enc:${t}'), 'none')`);
const events = t => psql(`select count(*) from public.origins_events where event_id = 'enc:${t}'`);
const used = t => psql(`select coalesce(result, 'open') from public.origins_spawn_engages where token = '${t}'`);
const backdate = (t, s) => psql(`update public.origins_spawn_engages set issued_at = issued_at - interval '${s} seconds' where token = '${t}'`);

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
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(UP)) fail(`${UP} is missing from ${dir}`);
  psql(files.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ('${A}'), ('${B}');`);
  const mk = (account, name) => psql(`set role frankendom_origins; select public.origins_create_character('${account}', '${name}');`).split('\n').pop();
  const [pcA, pcB] = [mk(A, 'Aria'), mk(B, 'Bran')];
  const V = 'frankendom_verifier', O = 'frankendom_origins';

  // ---- grants ------------------------------------------------------------------------------------------------------------------------------
  const FNS = ['origins_spawn_state(text[])', 'origins_spawn_engage(uuid,text,text,text,text)', 'origins_spawn_engage_get(uuid,text)', 'origins_spawn_touch(uuid,text)', 'origins_spawn_kill(uuid,text,int,int,jsonb,jsonb)'];
  for (const fn of FNS) eq(psql(`select has_function_privilege('${V}', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('${O}', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('anon', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('authenticated', '${fn}'::regprocedure, 'execute')::int::text`), '1100', `grants: ${fn} is for the two writer roles only`);
  eq(psql(`select (has_function_privilege('anon', 'origins_spawn_view(origins_spawns)'::regprocedure, 'execute') or has_function_privilege('${V}', 'origins_spawn_view(origins_spawns)'::regprocedure, 'execute'))::text`), 'false', 'grants: the view helper is nobody\'s');
  for (const t of ['origins_world_config', 'origins_spawns', 'origins_spawn_engages', 'origins_beta_ledger']) {
    eq(psql(`select has_table_privilege('${V}', 'public.${t}', 'select')::int::text || has_table_privilege('${O}', 'public.${t}', 'select')::int::text || has_table_privilege('anon', 'public.${t}', 'select')::int::text || has_table_privilege('authenticated', 'public.${t}', 'select')::int::text`), '0000', `grants: no role reads ${t} directly`);
  }

  // ---- engage / state / touch ------------------------------------------------------------------------------------------------------------------
  eq(await val(V, `select public.origins_spawn_state(array['wolves-1'])::text;`).then(s => s.spawns), [], 'state: a never-engaged spawn is not listed (alive, generation 0)');
  const e1 = await val(V, ENGAGE(A, pcA, tok(1), 'wolves-1'));
  eq([e1.token, e1.instance, e1.generation, e1.kind], [tok(1), 'wolves-1', 0, 'character:ash-wolf'], 'engage: a token for a live spawn, generation 0');
  eq((await val(O, ENGAGE(A, pcA, tok(2), 'wolves-1'))).token, tok(1), 'engage again (the other role): the SAME open token, no second one');
  eq(await code(V, ENGAGE(A, pcB, tok(3), 'wolves-2')), 'O0007', 'engage: a character that is not the account\'s is refused');
  eq(await code(V, ENGAGE(A, pcA, tok(3), 'wolves-1', 'character:boar')), 'O0002', 'engage: the kind is the spawn\'s own');
  for (const n of [2, 3, 4]) await val(V, ENGAGE(A, pcA, tok(10 + n), `wolves-${n}`));
  eq(await val(V, ENGAGE(A, pcA, tok(15), 'wolves-5')), { refused: 'too-many' }, 'engage: at most 4 open per account');
  eq(psql(`select count(*) from public.origins_spawn_engages where token = '${tok(15)}'`), '0', 'engage: a refusal writes no token');
  const before = psql(`select expires_at from public.origins_spawn_engages where token = '${tok(1)}'`);
  psql(`select pg_sleep(0.05)`);
  await val(V, `select public.origins_spawn_touch('${A}', '${tok(1)}')::text;`);
  eq(psql(`select (expires_at > '${before}'::timestamptz)::text from public.origins_spawn_engages where token = '${tok(1)}'`), 'true', 'touch: the token lives 120 s past the last touch');
  eq(await code(V, `select public.origins_spawn_touch('${B}', '${tok(1)}');`), 'O0009', 'touch: another account\'s token is refused');
  eq(await val(V, `select coalesce(public.origins_spawn_engage_get('${B}', '${tok(1)}'), 'null'::jsonb)::text;`), null, 'engage_get: another account\'s token is invisible');

  // B engages the same creature: allowed (first valid kill wins)
  const eb = await val(V, ENGAGE(B, pcB, tok(20), 'wolves-1'));
  eq(eb.generation, 0, 'two players may engage one creature');

  // ---- kill report: refusals write nothing ---------------------------------------------------------------------------------------------------
  eq(await val(V, KILL(A, tok(1), 60_000, 75, EV(tok(1), A, pcA))), { refused: 'too-fast' }, 'kill: faster than the time-to-kill floor is refused');
  eq([used(tok(1)), events(tok(1))], ['open', '0'], 'kill: a too-fast report consumes nothing and writes nothing');
  eq(await code(V, KILL(A, tok(1), 0, 75, `[{"op":"event","event_id":"enc:${tok(1)}","kind":"nope","account":"${A}","character":"${pcA}","payload":{}}]`)) !== null, true, 'kill: a bad batch fails');
  eq([used(tok(1)), events(tok(1)), psql(`select alive::text from public.origins_spawns where instance = 'wolves-1'`)], ['open', '0', 'true'], 'kill: a failed batch rolls back the token, the spawn and the event');
  eq(ledger(tok(1)), 'none', 'kill: a failed batch leaves no beta-ledger row');
  eq(await code(V, KILL(A, tok(1), 0, 75, EV(tok(1), A, pcA), '{"reach":"maybe"}')), 'O0002', 'kill: a ledger without a reach status is refused');
  eq([used(tok(1)), events(tok(1)), ledger(tok(1))], ['open', '0', 'none'], 'kill: ... and rolls back the token, the event and the ledger');
  psql(`update public.origins_world_config set kills_per_min = 1`);
  psql(`insert into public.origins_spawns (instance, kind) values ('cap-1', 'character:ash-wolf'); insert into public.origins_spawn_engages (token, account, character, instance, generation, expires_at, used_at, result) values ('${tok(90)}', '${A}', '${pcA}', 'cap-1', 0, now(), now(), 'killed')`);
  eq(await val(V, KILL(A, tok(1), 0, 75, EV(tok(1), A, pcA))), { refused: 'cap' }, 'kill: over the kills-per-minute cap is refused');
  eq(used(tok(1)), 'open', 'kill: a capped report consumes nothing');
  psql(`delete from public.origins_spawn_engages where token = '${tok(90)}'; update public.origins_world_config set kills_per_min = 6`);

  // ---- kill report: consumes, marks dead, pays once ---------------------------------------------------------------------------------------------
  backdate(tok(1), 30);
  const k1 = await val(V, KILL(A, tok(1), 20_000, 75, EV(tok(1), A, pcA)));
  eq([k1.result, k1.instance, typeof k1.respawnAt], ['killed', 'wolves-1', 'string'], 'kill: consumed, the spawn is dead with a respawn time');
  eq([used(tok(1)), events(tok(1)), psql(`select alive::text || '/' || generation || '/' || (respawn_at > now() + interval '70 seconds')::text from public.origins_spawns where instance = 'wolves-1'`)], ['killed', '1', 'false/0/true'], 'kill: token used, event written once, spawn dead ~75 s');
  eq(ledger(tok(1)), 'unchecked/0/0/0', 'kill: ONE beta-ledger row in the same transaction (no career_set, mint or bronze in this batch: all 0)');
  eq(await code(V, KILL(A, tok(1), 0, 75, EV(tok(1), A, pcA))), 'O0009', 'kill: a second report is refused');
  eq(await val(V, KILL(B, tok(20), 0, 75, EV(tok(20), B, pcB))), { refused: 'dead', respawnAt: k1.respawnAt }, 'kill: the other player\'s report answers dead');
  eq(used(tok(20)), 'dead', 'kill: the loser\'s token is closed');
  eq(ledger(tok(20)), 'none', 'kill: a dead report writes no ledger row');
  eq((await val(V, ENGAGE(B, pcB, tok(21), 'wolves-1'))).refused, 'dead', 'engage: a dead spawn refuses until its respawn');
  const st = await val(V, `select public.origins_spawn_state(array['wolves-1','wolves-9'])::text;`);
  eq(st.spawns.map(s => [s.instance, s.alive, s.generation]), [['wolves-1', false, 0]], 'state: the dead spawn and its respawn time');

  backdate(tok(12), 30);
  psql(`set role frankendom_origins; select public.origins_snapshot('${A}', 0, 5000);`);   // A's career row (the CP the kill books lands in world_credit)
  const career = (acct, add) => { const c = JSON.parse(psql(`select row_to_json(c)::text from public.origins_career c where account = '${acct}'`)); return JSON.stringify({ op: 'career_set', account: acct, expected_version: c.version, world_credit: Number(c.world_credit) + add, rested: c.rested, rested_at: c.rested_at, heat: c.heat, story: c.story, beaten: c.beaten }); };
  const mint = `{"op":"mint","item":{"id":"it-beta-1","item":"item:ash-pelt","quantity":1,"tier":0,"upgrade_level":0,"loc":{"kind":"pack","owner":"${pcA}","index":0},"bound_to":null,"mint_key":"loot:enc.beta0001:0","provenance":{"mintKey":"loot:enc.beta0001:0"},"history":[],"single_copy":false}}`;
  // condition 1: a batch with any op outside event/mint/metal/career_set is refused and writes nothing
  eq(await code(V, KILL(A, tok(12), 0, 75, `[${EV(tok(12), A, pcA).slice(1, -1)},{"op":"character_set","account":"${A}"}]`)), 'O0002', 'kill: an op outside the allowlist is refused');
  eq([used(tok(12)), events(tok(12)), ledger(tok(12))], ['open', '0', 'none'], 'kill: ... and writes nothing');
  const paidKill = await as(V, KILL(A, tok(12), 0, 75, `[${EV(tok(12), A, pcA).slice(1, -1)},${mint},{"op":"metal","account":"${A}","delta_bronze":7,"reason":"award","event_id":"enc:${tok(12)}"},${career(A, 30)}]`, '{"reach":"checked","cp":999999}'));
  if (paidKill.code !== 0) fail(`kill (paying batch): ${paidKill.err.trim().slice(0, 200)}`);
  eq(ledger(tok(12)), 'checked/30/7/1', 'kill: the ledger reads the minted ids and bronze from the batch, and cp from the career row (30, not the 999999 the ledger input claimed)');

  // ---- respawn: generation + 1 ----------------------------------------------------------------------------------------------------------------------
  psql(`update public.origins_spawns set respawn_at = now() - interval '1 second' where instance = 'wolves-1'`);
  eq((await val(V, `select public.origins_spawn_state(array['wolves-1'])::text;`)).spawns[0].alive, true, 'state: past its respawn the spawn reads alive');
  const e2 = await val(V, ENGAGE(B, pcB, tok(22), 'wolves-1'));
  eq([e2.token, e2.generation], [tok(22), 1], 'engage after respawn: a new generation');
  psql(`update public.origins_spawn_engages set expires_at = now() - interval '1 second' where token = '${tok(22)}'`);
  eq(await code(V, KILL(B, tok(22), 0, 75, EV(tok(22), B, pcB))), 'O0009', 'kill: an expired token is refused');
  eq(await code(V, `select public.origins_spawn_touch('${B}', '${tok(22)}');`), 'O0009', 'touch: an expired token is refused');

  // ---- 20261018081137 the V5 kill receipt (the stamp apply assigned in production; the file was first named 20261018090000): what became of a token that is no longer open, from the stored rows, this account only ---------------------------------
  const RECEIPT = '20261018081137_origins_spawn_receipt.sql', receipt = (acct, t) => val(O, `select coalesce(public.origins_spawn_receipt('${acct}', '${t}'), 'null'::jsonb)::text;`);
  const RFN = 'origins_spawn_receipt(uuid,text)';
  eq(psql(`select has_function_privilege('${O}', '${RFN}'::regprocedure, 'execute')::int::text || has_function_privilege('${V}', '${RFN}'::regprocedure, 'execute')::int::text || has_function_privilege('anon', '${RFN}'::regprocedure, 'execute')::int::text || has_function_privilege('authenticated', '${RFN}'::regprocedure, 'execute')::int::text`), '1100', 'receipt: both writer roles (frankendom_origins and frankendom_verifier, the writer\'s real login) and no one else (not anon, not authenticated)');
  const r12 = await receipt(A, tok(12));
  eq([r12.kind, r12.instance, typeof r12.killedAt, r12.cp, r12.bronze, r12.loot], ['paid', psql(`select instance from public.origins_spawn_engages where token = '${tok(12)}'`), 'string', 30, 7, 1], 'receipt: a paid kill reads back from the stored ledger row (cp 30, bronze 7, one item), not recomputed');
  const r1 = await receipt(A, tok(1));
  eq([r1.kind, r1.cp, r1.bronze, r1.loot], ['paid', 0, 0, 0], 'receipt: a paid kill whose batch booked nothing reads back as paid with zeros');
  eq(await receipt(B, tok(1)), null, 'receipt: another account\'s token is unknown, nothing leaks');
  eq(await receipt(A, tok(404)), null, 'receipt: a token that never existed is unknown');
  eq(await receipt(B, tok(20)), { kind: 'expired' }, 'receipt: a token closed dead (lost the kill) is expired');
  eq(await receipt(B, tok(22)), { kind: 'expired' }, 'receipt: an open token past its expiry is expired');
  eq(await receipt(A, tok(1)).then(r => JSON.stringify(Object.keys(r).sort())), JSON.stringify(['bronze', 'cp', 'instance', 'killedAt', 'kind', 'loot']), 'receipt: only the receipt fields');
  eq(await val(V, `select coalesce(public.origins_spawn_receipt('${A}', '${tok(1)}'), 'null'::jsonb)::text;`).then(r => r.kind), 'paid', 'receipt: the writer\'s real login role (frankendom_verifier) can call it and reads the same receipt');
  eq(await code('anon', `select public.origins_spawn_receipt('${A}', '${tok(1)}');`), '42501', 'receipt: anon cannot call it');
  eq([used(tok(1)), events(tok(1)), ledger(tok(1))], ['killed', '1', 'unchecked/0/0/0'], 'receipt: reading it twice changes and pays nothing');
  psql(readFileSync(join(dir, '..', 'down', RECEIPT.replace('.sql', '_down.sql')), 'utf8'));
  eq(psql(`select count(*) from pg_proc where proname = 'origins_spawn_receipt'`), '0', 'receipt down: the function is gone');

  // ---- 0015 the beta wipe: exactly the ledger's rewards, everything else byte-identical ---------------------------------------------------------------
  const keep = `{"op":"mint","item":{"id":"it-keep-1","item":"item:ash-pelt","quantity":2,"tier":0,"upgrade_level":0,"loc":{"kind":"pack","owner":"${pcA}","index":1},"bound_to":null,"mint_key":"loot:keep0001:0","provenance":{"mintKey":"loot:keep0001:0"},"history":[],"single_copy":false}}`;
  psql(`select public.origins_apply('[${keep}]'::jsonb, array['${A}'::uuid]);`);   // a NON-beta item of the same account: must survive
  psql(`set role frankendom_origins; select public.origins_snapshot('${B}', 0, 7000);`);
  const others = () => psql(`select md5(coalesce(string_agg(row_to_json(i)::text, '|' order by i.id), '')) from public.origins_items i where i.id <> 'it-beta-1'`) + '/' +
    psql(`select md5(row_to_json(c)::text) from public.origins_career c where account = '${B}'`) + '/' + psql(`select count(*) from public.origins_events`);
  const careerA = () => psql(`select world_credit || '/' || seed_credit || '/' || version from public.origins_career where account = '${A}'`);
  const pre = { others: others(), career: careerA(), bronze: psql(`select bronze from public.origins_metal where account = '${A}'`) };
  eq(await code(V, `select public.origins_beta_wipe();`), '42501', 'wipe: the verifier role cannot run it');
  eq(await code(O, `select public.origins_beta_wipe();`), '42501', 'wipe: the origins role cannot run it');
  const w1 = JSON.parse(psql(`select public.origins_beta_wipe()::text`));
  eq([w1.items_burned, w1.items_skipped, w1.bronze_reversed, w1.cp_reversed, w1.rows], [1, 0, 7, 30, 2], 'wipe: one item, 7 bronze, 30 CP, both ledger rows of A');
  eq(psql(`select retire_reason from public.origins_items where id = 'it-beta-1'`), 'burn', 'wipe: the beta item is retired as a burn');
  eq(psql(`select count(*) from public.origins_item_ledger where item_id = 'it-beta-1' and reason = 'burn'`), '1', 'wipe: the item ledger books the burn');
  eq(psql(`select bronze from public.origins_metal where account = '${A}'`), String(Number(pre.bronze) - 7), 'wipe: the beta bronze is spent back');
  const [wc, seed, ver] = pre.career.split('/').map(Number);
  eq(careerA(), `${wc - 30}/${seed}/${ver + 1}`, 'wipe: CP reversed, the seed untouched, version + 1 (a writer holding the old version goes stale)');
  eq(others(), pre.others, 'wipe: every other item, the other account\'s career and every event are byte-identical');
  eq(psql(`select count(*) from public.origins_beta_ledger where wiped_at is null`), '0', 'wipe: every ledger row is marked');
  eq(JSON.parse(psql(`select public.origins_beta_wipe()::text`)).rows, 0, 'wipe: a second run reverses nothing');
  psql(readFileSync(join(dir, '..', 'down', '202610080015_origins_beta_wipe_down.sql'), 'utf8'));
  eq(psql(`select (to_regprocedure('public.origins_beta_wipe()') is null)::text`), 'true', 'wipe down: the function is gone');
  psql(readFileSync(join(dir, '202610080015_origins_beta_wipe.sql'), 'utf8'));

  // ---- many-on-one (Proof 3): one account, three creatures at once, each kill server-verified on its own token and its own time floor --------------------
  const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  psql(`insert into auth.users values ('${C}'); insert into public.origins_access(account) values ('${C}');`);
  const pcC = mk(C, 'Cara'), pack = [31, 32, 33].map(tok), packAt = n => `wolves-${n + 11}`;
  const opened = [];
  for (const [i, t] of pack.entries()) opened.push(await val(V, ENGAGE(C, pcC, t, packAt(i))));
  eq(opened.map(e => [e.token, e.instance, e.generation]), pack.map((t, i) => [t, packAt(i), 0]), 'pack: three engages open at once, three distinct tokens');
  eq(psql(`select count(*) from public.origins_spawn_engages where account = '${C}' and used_at is null`), '3', 'pack: all three are open together');
  await val(V, ENGAGE(C, pcC, tok(34), 'wolves-14'));
  eq(await val(V, ENGAGE(C, pcC, tok(35), 'wolves-15')), { refused: 'too-many' }, 'pack: a 5th engage while four are open is refused');
  backdate(pack[0], 30);
  eq(await val(V, KILL(C, pack[0], 20_000, 75, EV(pack[0], C, pcC))).then(k => k.result), 'killed', 'pack: the first kill is accepted on its own token');
  for (const t of pack.slice(1)) eq(await val(V, KILL(C, t, 20_000, 75, EV(t, C, pcC))), { refused: 'too-fast' }, 'pack: each token keeps its OWN time floor (issued just now: too fast)');
  eq(pack.slice(1).map(used), ['open', 'open'], 'pack: ... and a too-fast report leaves its token open');
  for (const t of pack.slice(1)) backdate(t, 30);
  for (const t of pack.slice(1)) eq(await val(V, KILL(C, t, 20_000, 75, EV(t, C, pcC))).then(k => k.result), 'killed', 'pack: the second and third kills are accepted independently');
  eq([pack.map(used), pack.map(events), pack.map(ledger)], [['killed', 'killed', 'killed'], ['1', '1', '1'], ['unchecked/0/0/0', 'unchecked/0/0/0', 'unchecked/0/0/0']], 'pack: three tokens consumed, three events, three ledger rows');
  eq(psql(`select string_agg(instance || ':' || alive, ',' order by instance) from public.origins_spawns where instance in ('wolves-11', 'wolves-12', 'wolves-13')`), 'wolves-11:false,wolves-12:false,wolves-13:false', 'pack: all three spawns dead');
  eq((await val(V, ENGAGE(C, pcC, tok(36), 'wolves-15'))).token, tok(36), 'pack: the kills free their slots (one open left, a new engage is issued)');

  // ---- 202610090016 spawn zones: Zone N >= 2 ids are z<N>:..., so a Zone 2 spawn never shares a Zone 1 row of the same name --------------------------------------
  eq((await val(V, ENGAGE(C, pcC, tok(37), 'z2:wolves-11'))).generation, 0, 'zones: z2:wolves-11 is alive while Zone 1\'s wolves-11 is dead (its own row)');
  eq(psql(`select string_agg(instance || '=' || zone, ',' order by instance) from public.origins_spawns where instance in ('wolves-11', 'z2:wolves-11')`), 'wolves-11=1,z2:wolves-11=2', 'zones: the zone is read from the id; Zone 1 ids read 1');
  eq(psql(`select count(*) from public.origins_spawns where zone is null`), '0', 'zones: every existing row has a zone');

  // ---- 202610090017: the zone has no ceiling and no leading zero; a key that does not match stays Zone 1 in the table (the writer refuses such a key before it is stored) ----------------------
  eq(psql(`begin; insert into public.origins_spawns(instance, kind) values ('z1000:wolves-1', 'character:ash-wolf'), ('z700:wolves-1', 'character:ash-wolf'), ('z123456:wolves-1', 'character:ash-wolf'), ('z01:wolves-1', 'character:ash-wolf'), ('z0:wolves-1', 'character:ash-wolf');
    select string_agg(instance || '=' || zone, ',' order by instance) from public.origins_spawns where instance in ('z1000:wolves-1', 'z700:wolves-1', 'z123456:wolves-1', 'z01:wolves-1', 'z0:wolves-1'); rollback;`.replace('order by instance', 'order by instance collate "C"')),
    'z01:wolves-1=1,z0:wolves-1=1,z1000:wolves-1=1000,z123456:wolves-1=123456,z700:wolves-1=700', 'zones: 700, 1000 and 123456 read as their own zone; z01 and z0 do not parse and stay 1 (the writer refuses them)');
  eq(psql(`select count(*) from public.origins_spawns where instance like 'z1000:%'`), '0', 'zones: the probe rows were rolled back');
  const ZONE17 = '202610090017_origins_spawn_zone_unbounded.sql', probe = `begin; insert into public.origins_spawns(instance, kind) values ('z1000:wolves-1', 'character:ash-wolf'), ('z2:wolves-1', 'character:ash-wolf'); select string_agg(instance || '=' || zone, ',' order by instance collate "C") from public.origins_spawns where instance in ('z1000:wolves-1', 'z2:wolves-1'); rollback;`;
  psql(readFileSync(join(dir, '..', 'down', ZONE17.replace('.sql', '_down.sql')), 'utf8'));
  eq(psql(probe), 'z1000:wolves-1=1,z2:wolves-1=2', '0017 down: back to 1 to 3 digits (z1000 reads as 1 again), Zone 2 unchanged');
  eq(psql(`select count(*) from public.origins_spawns where zone is null`), '0', '0017 down: every existing row still has a zone');
  psql(readFileSync(join(dir, ZONE17), 'utf8'));
  eq(psql(probe), 'z1000:wolves-1=1000,z2:wolves-1=2', '0017 up again after down');

  // ---- 20261019170000 per-layer spawns: every layer keeps its own clocks; a kill reads the TOKEN's layer; one paid kill per account per spawn id per respawn window across layers; the janitor ------------------------
  const LAYERS = '20261019170000_origins_spawn_layers.sql';
  const [D, E] = ['dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'];
  let pcD, pcE;   // set inside the layers section, read again by the rollback checks below it
  if (readdirSync(dir).includes(LAYERS)) {
    psql(`insert into auth.users values ('${D}'), ('${E}'); insert into public.origins_access(account) values ('${D}'), ('${E}');`);
    [pcD, pcE] = [mk(D, 'Dara'), mk(E, 'Edda')];
    const ENGAGE_L = (layer, acct, pc, t, inst) => `select public.origins_spawn_engage_layer(${layer}, '${acct}', '${pc}', '${t}', '${inst}', 'character:ash-wolf')::text;`;
    const STATE_L = (layer, inst) => `select public.origins_spawn_state_layer(${layer}, array['${inst}'])::text;`;
    const alive = async (layer, inst) => (await val(V, STATE_L(layer, inst))).spawns.map(s => [s.alive, s.generation]);
    const FNS_L = ['origins_spawn_state_layer(int,text[])', 'origins_spawn_engage_layer(int,uuid,text,text,text,text)', 'origins_spawn_check_layer(uuid,text,int,int,int)', 'origins_spawn_damage_read_layer(int,text,int)', 'origins_spawn_layers_sweep(int[])'];
    for (const fn of FNS_L) eq(psql(`select has_function_privilege('${V}', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('${O}', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('anon', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('authenticated', '${fn}'::regprocedure, 'execute')::int::text`), '1100', `layers grants: ${fn} is the two writer roles only`);
    eq(psql(`select count(*) from public.origins_spawns where layer <> 1`), '0', 'layers: every row that existed before is layer 1');
    const [t60, t61, t62, t64, t65] = [60, 61, 62, 64, 65].map(tok);
    eq((await val(V, ENGAGE_L(1, D, pcD, t60, 'lay-1'))).layer, 1, 'layers: engage in layer 1');
    eq((await val(V, ENGAGE_L(2, E, pcE, t61, 'lay-1'))).layer, 2, 'layers: the SAME spawn id in layer 2 is its own row');
    eq(psql(`select string_agg(layer::text, ',' order by layer) from public.origins_spawns where instance = 'lay-1'`), '1,2', 'layers: two rows for one id, one per layer');
    eq(await val(V, KILL(D, t60, 0, 100, EV(t60, D, pcD))).then(k => k.result), 'killed', 'layers: a kill in layer 1');
    eq([await alive(1, 'lay-1'), await alive(2, 'lay-1')], [[[false, 0]], [[true, 0]]], 'layers: layer 1\'s clock runs and layer 2\'s creature is still alive');
    eq(await val(V, `select public.origins_spawn_state(array['lay-1'])::text;`).then(s => s.spawns.map(x => x.alive)), [false], 'layers: the layer-less state is layer 1');
    eq((await val(V, ENGAGE_L(2, D, pcD, t62, 'lay-1'))).layer, 2, 'layers: D engages the same creature in layer 2 (it is alive there)');
    eq(await val(V, KILL(D, t62, 0, 100, EV(t62, D, pcD))), { refused: 'cooldown' }, 'layers: ONE PAID KILL PER ACCOUNT PER SPAWN ID PER RESPAWN WINDOW ACROSS LAYERS: D killed lay-1 in layer 1 a moment ago');
    eq([used(t62), events(t62)], ['open', '0'], 'layers: the cooldown refusal writes nothing and leaves the token open');
    eq(await val(V, `select public.origins_spawn_check_layer('${D}', '${t62}', 0, 120, 100)::text;`), { refused: 'cooldown' }, 'layers: the read-only check says the same, before any replay');
    psql(`update public.origins_spawn_engages set used_at = used_at - interval '200 seconds' where token = '${t60}'`);
    eq(await val(V, `select public.origins_spawn_check_layer('${D}', '${t62}', 0, 120, 100)::text;`).then(c => [c.ok, c.mode, c.layer]), [true, 'first', 2], 'layers: past the window the check passes and names the token\'s layer');
    eq(await val(V, KILL(D, t62, 0, 100, EV(t62, D, pcD))).then(k => k.result), 'killed', 'layers: past the respawn window D may kill it in layer 2');
    eq(await val(V, KILL(E, t61, 0, 100, EV(t61, E, pcE))).then(k => k.refused), 'dead', 'layers: E\'s token in layer 2 finds the creature dead there (D killed it first IN layer 2)');
    eq((await val(V, ENGAGE_L(1, E, pcE, t64, 'lay-3'))).token, t64, 'layers: E engages lay-3 in layer 1');
    eq((await val(V, ENGAGE_L(2, E, pcE, t65, 'lay-3'))).layer, 2, 'layers: ... then in layer 2');
    eq([used(t64), used(t65)], ['dead', 'open'], 'layers: moving layers closes the old layer\'s token (no token crosses copies)');
    eq(await val(V, `select coalesce(public.origins_spawn_engage_get('${E}', '${t65}'), 'null'::jsonb)::text;`).then(g => g.layer), 2, 'layers: engage_get carries the token\'s layer');
    eq(await val(V, KILL(E, t65, 0, 100, EV(t65, E, pcE))).then(k => k.result), 'killed', 'layers: the kill is on the TOKEN\'s layer');
    eq(psql(`select string_agg(layer || ':' || alive, ',' order by layer) from public.origins_spawns where instance = 'lay-3'`), '1:true,2:false', 'layers: layer 1\'s lay-3 is untouched by a kill in layer 2');
    eq((await val(V, ENGAGE(E, pcE, tok(66), 'lay-4'))).instance, 'lay-4', 'layers: the old engage name still works');
    eq(psql(`select layer from public.origins_spawns where instance = 'lay-4'`), '1', 'layers: ... on layer 1');
    eq(await code(V, ENGAGE_L(0, E, pcE, tok(67), 'lay-5')), 'O0002', 'layers: a layer is a positive number');
    eq(await val(V, ENGAGE_L(3, E, pcE, tok(68), 'lay-6')).then(e => e.layer), 3, 'layers: layer 3 opens on its first engage');
    // the janitor: delete every layer not live; a null list is refused; no writer can read or delete a row any other way
    eq(await code('anon', `select public.origins_spawn_layers_sweep(array[1]);`), '42501', 'sweep: anon cannot call it');
    eq(await code(V, `select public.origins_spawn_layers_sweep(null);`), 'O0002', 'sweep: a null list (presence did not answer) is refused, never read as "no layer is live"');
    const before2 = psql(`select count(*) from public.origins_spawns where layer in (2, 3)`);
    eq(await val(V, `select public.origins_spawn_layers_sweep(array[1])::text;`), Number(before2), 'sweep: every row of layers presence no longer holds is deleted');
    eq(psql(`select count(*) from public.origins_spawns where layer <> 1`), '0', 'sweep: layer 1 survives');
    eq(psql(`select count(*) from public.origins_spawn_engages where layer <> 1`) > '0', true, 'sweep: engages are never touched (receipts stay readable)');
    eq(await val(V, `select public.origins_spawn_layers_sweep(array[1])::text;`), 0, 'sweep: a second sweep deletes nothing');
    await val(V, ENGAGE_L(2, E, pcE, tok(69), 'lay-7'));   // a layer-2 row and an OPEN layer-2 token left for the rollback
    // the Auditor's blocker (#3315): a kill whose spawn row is gone (the janitor swept a closed layer) is REFUSED, never paid with a NULL spawn (v1 and v2 both)
    const [t71, t72, t73] = [71, 72, 73].map(tok), KILL_V2 = (acct, t, batch) => `select public.origins_spawn_kill_v2('${acct}', '${t}', 0, 100, '${batch}'::jsonb, '{"reach":"unchecked"}'::jsonb, 5, 120)::text;`;
    await val(V, ENGAGE_L(3, E, pcE, t71, 'lay-10')); await val(V, ENGAGE_L(3, D, pcD, t72, 'lay-11'));   // two accounts: max_open is 4 per account
    eq(await val(V, `select public.origins_spawn_layers_sweep(array[1, 2])::text;`), 2, 'blocker: the sweep deletes the two layer-3 spawn rows (their tokens stay open)');
    const ledgerBefore = psql(`select count(*) from public.origins_beta_ledger`), eventsNow = psql(`select count(*) from public.origins_events`);
    eq(await val(V, KILL(E, t71, 0, 100, EV(t71, E, pcE))).then(k => k.refused), 'dead', 'blocker: the v1 kill of a token whose spawn row is gone is refused dead');
    eq(await val(V, KILL_V2(D, t72, EV(t72, D, pcD))).then(k => k.refused), 'dead', 'blocker: the v2 kill is refused dead too');
    eq([psql(`select count(*) from public.origins_beta_ledger`), psql(`select count(*) from public.origins_events`), used(t71), used(t72)], [ledgerBefore, eventsNow, 'dead', 'dead'], 'blocker: nothing was paid or written, and both tokens are closed');
    // a layer-2 damage row for the rollback's archive: a layer-2 engage killed through the share function
    await val(V, ENGAGE_L(2, D, pcD, t73, 'lay-9'));
    eq(await val(V, KILL_V2(D, t73, EV(t73, D, pcD))).then(k => k.result), 'killed', 'layers: a kill through the share function writes a layer-2 damage row');
    eq(psql(`select count(*) from public.origins_spawn_damage where layer = 2`), '1', 'layers: ... one layer-2 damage row');
  }

  // ---- down ----------------------------------------------------------------------------------------------------------------------------------------
  const eventsBefore = psql(`select count(*) from public.origins_events`);
  const LAYERS_DOWN = '20261019170000_origins_spawn_layers_down.sql';   // rollbacks run newest first: the layers restore the pre-layer bodies (damage-share's included), so they go before the damage-share down
  if (readdirSync(join(dir, '..', 'down')).includes(LAYERS_DOWN)) {
    psql(readFileSync(join(dir, '..', 'down', LAYERS_DOWN), 'utf8'));
    eq(psql(`select count(*) from information_schema.columns where table_name in ('origins_spawns', 'origins_spawn_engages', 'origins_spawn_damage') and column_name = 'layer'`), '0', 'layers down: the layer columns are gone');
    eq(psql(`select count(*) from public.origins_spawns where instance in ('lay-7', 'lay-9')`), '0', 'layers down: the rows of layers above 1 are deleted');
    eq([psql(`select count(*) from public.origins_spawn_layers_rollback_archive where kind = 'damage'`), psql(`select count(*) from public.origins_spawn_layers_rollback_archive where kind = 'spawn'`) > '0', psql(`select count(*) from public.origins_spawn_layers_rollback_archive where kind = 'engage' and data ->> 'token' = '${tok(69)}' and data ->> 'layer' = '2'`)], ['1', true, '1'], 'layers down: the damage row, the spawn rows and the engage tokens with their layers are ARCHIVED before the deletes');
    eq(used(tok(69)), 'dead', 'layers down: the OPEN layer-2 token is closed, so a pre-layer kill cannot pay a spawn row that is gone');
    eq(await code(V, KILL(E, tok(69), 0, 100, EV(tok(69), E, pcE))), 'O0009', 'layers down: ... a kill on it is the plain used-token error (O0009), never a paid kill');
    eq(psql(`select convalidated::text from pg_constraint where conname = 'origins_spawn_engages_instance_fkey'`), 'false', 'layers down: engages of layers above 1 name instances that no longer have a row, so the foreign key stays NOT VALID (the PR carries the validate command)');
    eq(psql(`select has_table_privilege('${V}', 'public.origins_spawn_layers_rollback_archive', 'select')::text`), 'false', 'layers down: no writer role can read the archive');
    eq(psql(`select count(*) from pg_proc where proname like 'origins\\_spawn\\_%\\_layer%'`), '0', 'layers down: the layer functions are gone');
    eq(await val(V, ENGAGE(B, pcB, tok(70), 'lay-8')).then(e => e.generation), 0, 'layers down: the old engage works on the single-column key');
  }
  const LATER_DOWN = '20261019113226_origins_damage_share_down.sql';   // rollbacks run newest first: the damage-share objects (origins_spawn_check / _damage_read / _kill_v2) go before the spawn tables they sit beside
  if (readdirSync(join(dir, '..', 'down')).includes(LATER_DOWN)) psql(readFileSync(join(dir, '..', 'down', LATER_DOWN), 'utf8'));
  psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  eq(psql(`select count(*) from pg_proc where proname like 'origins\\_spawn\\_%'`), '0', 'down: the functions are gone');
  eq(psql(`select count(*) from pg_class where relname in ('origins_world_config', 'origins_spawns', 'origins_spawn_engages', 'origins_beta_ledger')`), '0', 'down: the tables are gone');
  eq(psql(`select count(*) from public.origins_events`), eventsBefore, 'down: no event touched');
  psql(readFileSync(join(dir, UP), 'utf8'));
  eq(psql(`select count(*) from pg_proc where proname like 'origins\\_spawn\\_%'`), '6', 'up again after down');
  console.log(`origins-spawns-check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
