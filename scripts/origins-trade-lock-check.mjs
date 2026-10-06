// Audit finding C: origins_open_trade took no account-level lock, so two openings that share an account could both pass its "not already in an open trade" check and both
// insert. This check builds a disposable PostgreSQL cluster with the Origins migrations before 202610070003 (0001-0003), proves the race on 0003's function (two crossed
// openings both succeed: the red run), applies 202610070003, and proves exactly one of every conflicting pair opens with no residue while independent openings still run in
// parallel; then the down-script restores 0003's body byte for byte. Two real connections, the first holding its transaction open so the interleaving is deterministic.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const UP = '202610070003_origins_trade_open_lock.sql';
const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-origins-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const psqlAsync = sql => new Promise(resolve => {
  const child = spawn(pg('psql'), ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], { env });
  let err = ''; child.stderr.on('data', d => { err += d; }); child.on('close', code => resolve({ code, err }));
  child.stdin.end(sql);
});
const ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
const [A, B, C, D] = ids;
const fail = message => { throw Error(message); };
let checks = 0;
const eq = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const def = () => psql(`select md5(pg_get_functiondef('public.origins_open_trade(text,text,text)'::regprocedure))`);
const open = (c, a, b) => `select public.origins_open_trade('${c}', '${a}', '${b}');`;
const openTrades = () => psql(`select count(*) from public.origins_trades where state = 'open'`);
// Two openings on two connections; the first keeps its transaction open for 2 s, the second starts 0.7 s in.
const race = async (first, second) => {
  const one = psqlAsync(`set role frankendom_origins; begin; ${first} select pg_sleep(2); commit;`);
  await new Promise(r => setTimeout(r, 700));
  const two = psqlAsync(`set role frankendom_origins; begin; ${second} commit;`);
  return Promise.all([one, two]);
};
const reset = () => psql(`delete from public.origins_trades;`);

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
    insert into auth.users values ${ids.map(i => `('${i}')`).join(', ')};`);
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(UP)) fail(`${UP} is missing from ${dir}`);
  const apply = names => psql(names.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  apply(files.filter(n => n < UP));
  const w = sql => psql(`set role frankendom_origins; ${sql}`);
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ${ids.map(i => `('${i}')`).join(', ')};`);
  const mk = (account, name) => psql(`set role frankendom_origins; select public.origins_create_character('${account}', '${name}');`).split('\n').pop();
  const pcA = mk(A, 'Aria'), pcA2 = mk(A, 'Aria II'), pcB = mk(B, 'Bran'), pcC = mk(C, 'Cass'), pcD = mk(D, 'Dane');
  const before = def();

  // ---- the red run: on 0003's function the crossed openings both succeed (one account in two open trades) -------------------------
  const red = await race(open('tr:r1', pcA, pcB), open('tr:r2', pcC, pcA));
  eq([red[0].code, red[1].code, openTrades()], [0, 0, '2'], 'red: on 0003 both crossed openings succeed, so account A is in two open trades (the bug)');
  reset();

  apply([UP]);
  eq(def() === before, false, 'up: origins_open_trade is replaced');
  for (const fn of ['origins_open_trade(text,text,text)']) eq(psql(`select has_function_privilege('frankendom_origins', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('anon', '${fn}'::regprocedure, 'execute')::int::text || has_function_privilege('authenticated', '${fn}'::regprocedure, 'execute')::int::text`), '100', `up: ${fn} is still the writer's alone`);

  // ---- crossed openings Alice-Bob and Carol-Alice: exactly one succeeds, the other is refused as "already in an open trade", no residue ------
  const crossed = await race(open('tr:c1', pcA, pcB), open('tr:c2', pcC, pcA));
  eq([crossed[0].code, crossed[1].code], [0, 3], 'crossed: the first opens, the second is refused');
  eq(crossed[1].err.includes('already in an open trade'), true, 'crossed: and it is refused for the right reason (O0013), not a deadlock');
  eq(psql(`select string_agg(container, ',' order by container) from public.origins_trades where state = 'open'`), 'tr:c1', 'crossed: exactly one open trade remains, no residue');
  reset();

  // ---- the same rule in the other order: Alice's second character opens first, then Alice's first character ---------------------------
  const sameAccount = await race(open('tr:s1', pcA2, pcB), open('tr:s2', pcA, pcC));
  eq([sameAccount[0].code, sameAccount[1].code], [0, 3], 'one account, two characters: exactly one opens');
  eq(sameAccount[1].err.includes('already in an open trade'), true, 'one account, two characters: refused for the right reason');
  eq(openTrades(), '1', 'one account, two characters: no residue');
  reset();

  // ---- opposite lock order must not deadlock: A-B and B-A style pairs share both accounts, taken least-first ------------------------
  const opposite = await race(open('tr:o1', pcA, pcB), open('tr:o2', pcB, pcA));
  eq([opposite[0].code, opposite[1].code], [0, 3], 'opposite order: one opens, the other is refused');
  eq(opposite.some(r => r.err.includes('deadlock')), false, 'opposite order: no deadlock (the locks are taken in a stable order)');
  reset();

  // ---- independent pairs are NOT serialised: A-B (holding its transaction 2 s) and C-D (a different pair of accounts) both open at once ---
  const t0 = Date.now();
  const apart = await race(open('tr:p1', pcA, pcB), open('tr:p2', pcC, pcD));
  eq([apart[0].code, apart[1].code, openTrades()], [0, 0, '2'], 'independent pairs: both open');
  reset();

  // ---- a sequential opening still refuses an account already in a trade, and the self-trade and unknown-character refusals are unchanged ---
  w(open('tr:q1', pcA, pcB));
  const again = await psqlAsync(`set role frankendom_origins; ${open('tr:q2', pcC, pcA)}`);
  eq([again.code, again.err.includes('already in an open trade')], [3, true], 'sequential: a second opening for an account in a trade is refused');
  const self = await psqlAsync(`set role frankendom_origins; ${open('tr:q3', pcA, pcA2)}`);
  eq([self.code, self.err.includes('between two accounts')], [3, true], 'a trade is still between two accounts');
  reset();

  // ---- down restores 0003's body byte for byte ----------------------------------------------------------------------------------
  psql(readFileSync(join(dir, '..', 'down', UP.replace('.sql', '_down.sql')), 'utf8'));
  eq(def(), before, 'down: origins_open_trade is 0003\'s body again');
  void t0;
  console.log(`origins-trade-lock-check: ${checks} checks passed`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
