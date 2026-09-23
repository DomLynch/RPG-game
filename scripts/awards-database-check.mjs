// Server-authoritative awards (migration 202609230001) on real PostgreSQL, in the same disposable socket-only cluster as
// account-database-check.mjs: no DATABASE_URL, no SUPABASE_* and no service-role key is read, so it cannot reach a hosted project.
//
// The seed is written at APPLY time from fighter_profiles, so the migrations are applied in two halves: everything before 202609230001,
// then the fixture profiles, then 202609230001 and anything after it. The verifier's step is the real one in miniature: read
// standing_of as the verifier role, run src/awards.ts awardFor in node, write what it says as the verifier role.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { awardFor } from '../src/awards.ts';
import { levelOf, tierAt } from '../src/grades.ts';

const D3 = '202609230001_server_awards.sql';
const dir = process.env.AWARDS_MIGRATIONS ?? 'supabase/migrations';   // a mutation probe points this at a mutated copy
const root = mkdtempSync(join(tmpdir(), 'frankendom-awards-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };   // see account-database-check.mjs
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 120_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const as = (role, user, sql) => psql(`select set_config('request.jwt.claim.sub','${user ?? ''}',false); set role ${role};\n${sql}\nreset role;`)
  .split('\n').filter(line => line !== '' && !/^[0-9a-f-]{36}$/.test(line)).join('\n');   // drop set_config's echo

const S = '11111111-1111-4111-8111-111111111111';   // seeded: a fighter with progress before the migration
const Z = '22222222-2222-4222-8222-222222222222';   // seeded with nothing: a profile at zero
const G = '33333333-3333-4333-8333-333333333333';   // a guest who signs up after the migration
const SEED_MARKS = 14, SEED_OWNED = ['veteran.Helmet'];   // 14 is Recruit V and 15 is Legionary I: a tier read one win late gives a different level
let started = false;
try {
  run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o', `-k ${root} -c listen_addresses=''`, '-w', 'start']); started = true;
  // Hosted Supabase's default privileges on public (all on tables, functions and sequences to the client roles): a migration that forgets
  // a revoke-all must fail here, not only on the hosted project.
  psql(`create extension if not exists pgcrypto;
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated;
    insert into auth.users values ('${S}'),('${Z}'),('${G}');`);
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(D3)) throw Error(`${D3} is missing from ${dir}`);
  const apply = names => psql(names.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  apply(files.filter(n => n < D3));
  psql(`insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) values
    ('${S}', 'Seeded', ${SEED_MARKS}, '{"owned":${JSON.stringify(SEED_OWNED)},"equipped":{}}'),
    ('${Z}', 'Zero', 0, '{"owned":[],"equipped":{}}');`);
  apply(files.filter(n => n >= D3));
  psql(`insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) values ('${G}', 'Convert', 50, '{"owned":["veteran.Body"],"equipped":{}}');`);   // the guest's device cache, carried over on sign-up

  const fail = message => { throw Error(message); };
  const standing = user => { const [marks, owned] = as('frankendom_verifier', null, `select marks || '|' || owned::text from public.standing_of('${user}');`).split('|'); return { marks: Number(marks), owned: JSON.parse(owned) }; };
  const mine = user => { const [marks, owned] = as('authenticated', user, 'select marks || \'|\' || owned::text from public.my_standing();').split('|'); return { marks: Number(marks), owned: JSON.parse(owned) }; };
  const claim = (user, record, opponent = 'veteran', piece = null) =>
    Number(as('authenticated', user, `insert into public.loot_claims(opponent, piece, record) values ('${opponent}', ${piece ? `'${piece}'` : 'null'}, '${record}') returning id;`));
  // The verifier's step: standing BEFORE the win, the award rule in node, then the flip and the award as the verifier role.
  const verify = (user, id) => {
    const before = standing(user);
    const [opponent, piece] = as('frankendom_verifier', null, `select opponent || '|' || coalesce(piece, '') from public.loot_claims where id = ${id};`).split('|');
    const award = awardFor({ opponent, piece: piece || null }, before);
    if (typeof award === 'string') fail(`verifier refused claim ${id}: ${award}`);
    as('frankendom_verifier', null, `update public.loot_claims set verified = true, checked_at = now() where id = ${id};
      ${award ? `insert into public.awards(claim_id, piece, tier) values (${id}, '${award.piece}', ${award.tier});` : ''}`);
    return { before, award };
  };
  const refused = (role, user, sql, code) => {   // the statement must fail with this SQLSTATE class
    const out = as(role, user, `do $$begin begin ${sql}; raise exception 'NOT REFUSED' using errcode = 'P0001'; exception when ${code} then null; end; end$$;`);
    return out === '';
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // (1) seed: the fixture profiles, exactly those, exactly once; nothing a client or the verifier holds can write it again.
  const seeds = psql('select user_id || \'|\' || marks || \'|\' || owned::text from public.account_seed order by user_id;').split('\n');
  if (!same(seeds, [`${S}|${SEED_MARKS}|${JSON.stringify(SEED_OWNED)}`, `${Z}|0|[]`])) fail(`seed rows are not the two fixture profiles: ${JSON.stringify(seeds)}`);
  if (!refused('authenticated', G, `insert into public.account_seed(user_id, marks, owned) values ('${G}', 99, '[]')`, 'insufficient_privilege')) fail('a client can write account_seed');
  if (!refused('authenticated', S, `update public.account_seed set marks = 99`, 'insufficient_privilege')) fail('a client can update account_seed');
  if (!refused('authenticated', S, `perform * from public.account_seed`, 'insufficient_privilege')) fail('a client can read account_seed');
  if (!refused('frankendom_verifier', null, `insert into public.account_seed(user_id, marks, owned) values ('${G}', 99, '[]')`, 'insufficient_privilege')) fail('the verifier can write account_seed');
  if (psql(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc ~* 'insert\\s+into\\s+public\\.account_seed';`) !== '0') fail('a function can re-run the seed');
  if (!same(mine(S), { marks: SEED_MARKS, owned: SEED_OWNED })) fail(`seeded standing is not the seed: ${JSON.stringify(mine(S))}`);

  // (2) verified win: server marks = seed + 1, and the award is the claimed piece at the server tier BEFORE the win.
  const TAKE = 'veteran.Greaves';
  const win = claim(S, 'seededWin1', 'veteran', TAKE);
  if (!same(mine(S), { marks: SEED_MARKS, owned: SEED_OWNED })) fail('an unverified claim moved the standing');
  const { before, award } = verify(S, win);
  if (before.marks !== SEED_MARKS || !same(award, { piece: TAKE, tier: levelOf(tierAt(SEED_MARKS)) })) fail(`award is not the claimed piece at the server tier: ${JSON.stringify(award)}`);
  if (!same(mine(S), { marks: SEED_MARKS + 1, owned: [...SEED_OWNED, TAKE].sort() })) fail(`standing after a verified win: ${JSON.stringify(mine(S))}`);
  if (as('authenticated', S, `select piece || '|' || tier from public.awards;`) !== `${TAKE}|${award.tier}`) fail('the owner cannot read his award');

  // (3) guest convert: no seed row, marks 0 whatever the device cache says, then 1 after the first verified win.
  if (psql(`select count(*) from public.account_seed where user_id = '${G}';`) !== '0') fail('a post-migration account has a seed row');
  if (!same(mine(G), { marks: 0, owned: [] })) fail(`a converted guest's cache became standing: ${JSON.stringify(mine(G))}`);
  verify(G, claim(G, 'guestWin1'));
  if (mine(G).marks !== 1) fail(`converted guest after one verified win: ${JSON.stringify(mine(G))}`);

  // (4) forged cache: 100000 marks and an Origin piece written into the profile change nothing on the server.
  const beforeForge = mine(S);
  as('authenticated', S, `update public.fighter_profiles set victory_marks = 100000, loot = '{"owned":["veteran.Trident","executioner.Scythe"],"equipped":{}}' where user_id = auth.uid();`);
  if (psql(`select victory_marks from public.fighter_profiles where user_id = '${S}';`) !== '100000') fail('the forge did not land in the cache');
  if (!same(mine(S), beforeForge)) fail(`a forged cache moved the server standing: ${JSON.stringify(mine(S))}`);
  const next = verify(S, claim(S, 'seededWin2', 'veteran', 'veteran.Trident'));   // the forged cache "owns" it: the server does not
  if (next.before.marks !== SEED_MARKS + 1 || !same(next.award, { piece: 'veteran.Trident', tier: levelOf(tierAt(SEED_MARKS + 1)) })) fail(`the verifier read the forged cache: ${JSON.stringify(next)}`);

  // Backend's DB checks.
  const other = claim(Z, 'zeroWin1');
  if (!refused('authenticated', S, `insert into public.awards(claim_id, piece, tier) values (${win}, 'veteran.Body', 1)`, 'insufficient_privilege')) fail('a client can write awards');
  if (!refused('authenticated', Z, `update public.loot_claims set verified = true where id = ${other}`, 'insufficient_privilege')) fail('a client can flip verified');
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record, verified) values ('veteran', 'x1', true)`, 'insufficient_privilege')) fail('a client can post a verified claim');
  if (!refused('authenticated', Z, `insert into public.loot_claims(user_id, opponent, record) values ('${S}', 'veteran', 'x2')`, 'insufficient_privilege')) fail('a client can claim for another account');
  if (!refused('authenticated', Z, `delete from public.loot_claims`, 'insufficient_privilege')) fail('a client can delete claims');
  if (!refused('frankendom_verifier', null, `insert into public.awards(claim_id, piece, tier) values (999999, 'veteran.Body', 1)`, 'foreign_key_violation or check_violation')) fail('the verifier can award a nonexistent claim');
  if (!refused('frankendom_verifier', null, `insert into public.awards(claim_id, piece, tier) values (${win}, 'veteran.Body', 1)`, 'unique_violation')) fail('the verifier can award twice');
  if (!refused('frankendom_verifier', null, `insert into public.awards(claim_id, piece, tier) values (${other}, 'veteran.Body', 1)`, 'check_violation')) fail('the verifier can award an unverified claim');
  if (!refused('frankendom_verifier', null, `update public.loot_claims set verified = false where id = ${win}`, 'check_violation')) fail('a verified claim can be unverified');
  if (!refused('frankendom_verifier', null, `update public.loot_claims set user_id = '${Z}' where id = ${win}`, 'insufficient_privilege')) fail('the verifier can move a claim to another account');
  if (as('authenticated', Z, 'select count(*) from public.awards;') !== '0' || as('authenticated', Z, `select count(*) from public.loot_claims where id = ${win};`) !== '0') fail('an account sees another\'s claims or awards');
  if (!refused('anon', null, 'perform * from public.awards', 'insufficient_privilege') || !refused('anon', null, 'perform * from public.loot_claims', 'insufficient_privilege')) fail('anon can read claims or awards');
  if (!refused('anon', null, `insert into public.loot_claims(opponent, record) values ('veteran', 'anon1')`, 'insufficient_privilege')) fail('anon can post a claim');
  if (!refused('anon', null, 'perform * from public.my_standing()', 'insufficient_privilege')) fail('anon can call my_standing');
  if (!refused('authenticated', Z, `perform * from public.standing_of('${S}')`, 'insufficient_privilege')) fail('a client can read another account\'s standing');
  if (!refused('authenticated', Z, `perform public.award_needs_verified_claim()`, 'feature_not_supported')) fail('a trigger function is callable');
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record) values ('veteran', 'seededWin1')`, 'unique_violation')) fail('a duplicate record hash was accepted from another account');
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record) values ('veteran', repeat('a', 16385))`, 'check_violation')) fail('an oversized record was accepted');
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record) values ('veteran', 'not base64!')`, 'check_violation')) fail('a record outside base64url was accepted');
  // [B1] one statement, many rows: PostgREST takes a JSON array as a bulk insert. The cap is per row, so the whole statement is refused.
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record) select 'veteran', 'bulk' || i from generate_series(1, 500) i`, 'insufficient_privilege')) fail('a 500-row insert passed the hourly cap');
  if (psql(`select count(*) from public.loot_claims where user_id = '${Z}';`) !== '1') fail('a refused bulk insert left rows behind');
  as('authenticated', Z, `do $$begin for i in 1..59 loop insert into public.loot_claims(opponent, record) values ('veteran', 'rate' || i); end loop; end$$;`);   // 60 this hour with zeroWin1
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record) values ('veteran', 'rate61')`, 'insufficient_privilege')) fail('a 61st claim within the hour was accepted');
  console.log('Awards database PASS: seed written once at apply from the fixture profiles and unwritable after; verified win = seed + 1 with the claimed piece at the server tier; converted guest starts at 0; forged cache ignored; client cannot write awards or flip verified; verifier cannot award a missing, unverified or already-awarded claim; owner-only reads, anon none; global record-hash uniqueness; size cap and the hourly cap, bulk insert included. No hosted database changed.');
} finally {
  if (started) run('pg_ctl', ['-D', join(root, 'data'), '-m', 'fast', '-w', 'stop']);
  rmSync(root, { recursive: true, force: true });
}
