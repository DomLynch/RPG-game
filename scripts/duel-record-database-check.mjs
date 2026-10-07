// The duel-record storage (migration 202610070002) on real PostgreSQL, in a disposable socket-only cluster (no DATABASE_URL, no SUPABASE_*, no service key is read).
// Every migration is applied in order, then: the OLD three-argument report_duel still works unchanged; a new report_duel_record stores record + side for the
// page's own report; an oversize or malformed record, a bad side, an anonymous caller and a page with no report row are refused/answered false; clients read and
// write nothing directly and see no one else's record; the verifier role reads; the record goes with its report row; the down-script restores the baseline.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = mkdtempSync(join(tmpdir(), 'frankendom-duelrecord-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 120_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const as = (role, user, sql) => psql(`select set_config('request.jwt.claim.sub','${user ?? ''}',false); set role ${role};\n${sql}\nreset role;`)
  .split('\n').filter(line => line !== '' && !/^[0-9a-f-]{36}$/.test(line)).join('\n');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333';
const HASH = '0123456789abcdef';
let checks = 0;
const fail = message => { throw Error(message); };
const eq = (got, want, what) => { checks++; if (got !== want) fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
// a statement that must raise `code` (the whole DO block is rolled back when it does not)
const refused = (what, role, user, sql, code) => { checks++; if (as(role, user, `do $$begin begin ${sql}; raise exception 'NOT REFUSED' using errcode = 'P0001'; exception when ${code} then null; end; end$$;`) !== '') fail(`${what}: not refused with ${code}`); };
const record = (extra = {}) => JSON.stringify({ v: 26, build: 'x', delay: 4, kits: [{ weapon: 'longsword', skill: null }, { weapon: 'longsword', skill: null }], ticks: 600, intents: ['a', 'b'], ...extra });
const q = s => s.replace(/'/g, "''");
const store = (user, room, side, rec) => as('authenticated', user, `select public.report_duel_record('${room}', ${side}, '${q(rec)}'::jsonb);`);
const baseline = () => psql(`select (select count(*) from pg_class where relname = 'duel_records') || '|' || (select count(*) from pg_proc where proname = 'report_duel_record') || '|' || (select count(*) from pg_proc where proname = 'report_duel')`);
let started = false;
try {
  run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o', `-k ${root} -c listen_addresses=''`, '-w', 'start']); started = true;
  psql(`create extension if not exists pgcrypto;
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    insert into auth.users values ('${A}'),('${B}'),('${C}');`);
  const migrations = readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort();
  const UP = '202610070002_duel_record.sql';
  psql(migrations.filter(n => n !== UP).map(n => readFileSync(join('supabase/migrations', n), 'utf8')).join('\n'));
  const before = baseline();
  psql(readFileSync(join('supabase/migrations', UP), 'utf8'));

  // two registered rooms: room00001 (A vs B, both report), room00002 (A and B registered, only A reports), room00003 (C alone, no report)
  for (const [room, user] of [['room00001', A], ['room00001', B], ['room00002', A], ['room00002', B], ['room00003', C]]) as('authenticated', user, `select public.report_duel_start('${room}', 'N', 1, '{}'::jsonb);`);

  // (1) the OLD call is untouched: it still reports and pairs a duel exactly as before
  eq(as('authenticated', A, `select public.report_duel('room00001', 'win', '${HASH}');`), 'f', 'old 3-arg report_duel (first report) still works');
  eq(as('authenticated', B, `select public.report_duel('room00001', 'loss', '${HASH}');`), 't', 'old 3-arg report_duel pairs the duel as before');
  eq(as('authenticated', A, `select public.report_duel('room00002', 'win', '${HASH}');`), 'f', 'old 3-arg report_duel, second room');
  eq(psql(`select count(*) from public.duel_records`), '0', 'the old call writes no record');

  // (2) the new call stores record + side for the page's OWN report; a repeat changes nothing (first write wins)
  eq(store(A, 'room00001', 0, record()), 't', 'a page stores its record');
  eq(psql(`select side || '|' || (record ->> 'ticks') from public.duel_records where room = 'room00001' and user_id = '${A}'`), '0|600', 'record and side are stored');
  eq(store(A, 'room00001', 1, record({ ticks: 999 })), 't', 'a repeat answers true');
  eq(psql(`select side || '|' || (record ->> 'ticks') from public.duel_records where room = 'room00001' and user_id = '${A}'`), '0|600', 'a repeat changes nothing');
  eq(store(B, 'room00001', 1, record()), 't', 'the other page stores its own');
  eq(psql(`select count(*) from public.duel_records where room = 'room00001'`), '2', 'one row per page');

  // (3) refusals: oversize, not an object, a bad side, anonymous; and a page with no report row gets false
  const big = record({ pad: 'x'.repeat(262144) });
  refused('an oversize record', 'authenticated', B, `perform public.report_duel_record('room00002', 1, '${q(big)}'::jsonb)`, 'check_violation');
  refused('a record that is not an object', 'authenticated', B, `perform public.report_duel_record('room00002', 1, '[1,2]'::jsonb)`, 'check_violation');
  refused('a side other than 0 or 1', 'authenticated', B, `perform public.report_duel_record('room00002', 2, '${q(record())}'::jsonb)`, 'check_violation');
  refused('an anonymous caller', 'anon', null, `perform public.report_duel_record('room00002', 1, '${q(record())}'::jsonb)`, 'insufficient_privilege');
  eq(store(B, 'room00002', 1, record()), 'f', 'a page that has not reported the room stores nothing (B has no report in room00002)');
  eq(store(C, 'room00003', 0, record()), 'f', 'a page registered but with no report row stores nothing');
  eq(psql(`select count(*) from public.duel_records where room in ('room00002','room00003')`), '0', 'the refused calls left no row');

  // (4) the table is nobody's to touch directly; a page cannot read another page's record
  for (const user of [A, B]) {
    refused('a client reading the table', 'authenticated', user, `perform * from public.duel_records`, 'insufficient_privilege');
    refused('a client writing the table', 'authenticated', user, `insert into public.duel_records(room, user_id, side, record) values ('room00002', '${user}', 0, '{}')`, 'insufficient_privilege');
    refused('a client updating the table', 'authenticated', user, `update public.duel_records set side = 1`, 'insufficient_privilege');
    refused('a client deleting from the table', 'authenticated', user, `delete from public.duel_records`, 'insufficient_privilege');
  }
  refused('anon reading the table', 'anon', null, `perform * from public.duel_records`, 'insufficient_privilege');
  refused('anon writing the table', 'anon', null, `insert into public.duel_records(room, user_id, side, record) values ('room00002', '${A}', 0, '{}')`, 'insufficient_privilege');
  eq(as('frankendom_verifier', null, `select count(*) from public.duel_records;`), '2', 'the verifier role reads the records');
  refused('the verifier writing the table', 'frankendom_verifier', null, `insert into public.duel_records(room, user_id, side, record) values ('room00002', '${A}', 0, '{}')`, 'insufficient_privilege');

  // (5) the record goes with its report row (the FK cascades), so a revoked claim or the retention takes the record too
  psql(`delete from public.duel_reports where room = 'room00001' and user_id = '${B}'`);
  eq(psql(`select count(*) from public.duel_records where room = 'room00001'`), '1', "deleting a report row deletes that page's record only");
  checks++; if (psql(`do $$begin begin insert into public.duel_records(room, user_id, side, record) values ('room00002', '${B}', 0, '{}'); raise exception 'NOT REFUSED' using errcode = 'P0001'; exception when foreign_key_violation then null; end; end$$;`) !== '') fail('a record with no report row, at the table level: not refused by the FK');

  // (6) the down-script restores the baseline, and the up-script applies again after it
  psql(readFileSync(join('supabase/down', '202610070002_duel_record_down.sql'), 'utf8'));
  eq(baseline(), before, 'the down-script returns the schema to the pre-migration baseline');
  eq(as('authenticated', A, `select public.report_duel('room00002', 'win', '${HASH}');`), 'f', 'the old call works after the down-script too');
  console.log(`Duel record database PASS: ${checks} checks. The old report_duel is untouched; a page stores its own record and side once; oversize, non-object, bad side and anonymous are refused; the table is closed to clients and anon, open to the verifier read; the record goes with its report; the down-script restores the baseline.`);
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* the cluster is already gone */ }
  rmSync(root, { recursive: true, force: true });
}
