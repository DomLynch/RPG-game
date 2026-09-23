// Server-authoritative awards (migration 202609230001) and the loot-claim sweep (scripts/verify-loot.mjs) on real PostgreSQL, in the same
// disposable socket-only cluster as account-database-check.mjs: no DATABASE_URL, no SUPABASE_* and no service-role key is read, so it
// cannot reach a hosted project.
//
// The seed is written at APPLY time from fighter_profiles, so the migrations are applied in two halves: everything before 202609230001,
// then the fixture profiles, then 202609230001 and anything after it. Claims are settled by the REAL sweep, connected as the verifier
// role, over records that replay headless: a scripted fight the player wins against the Goblin (easy, seed 1), and one he loses.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { idleIntent } from '../src/duel.ts';
import { levelOf, tierAt } from '../src/grades.ts';
import { OPPONENTS } from '../src/moves.ts';
import { createRecorder, encodeRecord } from '../src/record.ts';
import { psqlAdapter, verifyClaims } from './verify-loot.mjs';

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
const O = '44444444-4444-4444-8444-444444444444';   // seeded at the same boundary as S: the sweep-order check
const R = '55555555-5555-4555-8555-555555555555';   // seeded at the same boundary: the recheck check
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
    insert into auth.users values ('${S}'),('${Z}'),('${G}'),('${O}'),('${R}');`);
  const files = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (!files.includes(D3)) throw Error(`${D3} is missing from ${dir}`);
  const apply = names => psql(names.map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  apply(files.filter(n => n < D3));
  psql(`insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) values
    ('${S}', 'Seeded', ${SEED_MARKS}, '{"owned":${JSON.stringify(SEED_OWNED)},"equipped":{}}'),
    ('${Z}', 'Zero', 0, '{"owned":[],"equipped":{}}'),
    ('${O}', 'Ordered', ${SEED_MARKS}, '{"owned":[],"equipped":{}}'),
    ('${R}', 'Rechecked', ${SEED_MARKS}, '{"owned":[],"equipped":{}}');`);
  apply(files.filter(n => n >= D3));
  psql(`insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) values ('${G}', 'Convert', 50, '{"owned":["veteran.Body"],"equipped":{}}');`);   // the guest's device cache, carried over on sign-up

  const fail = message => { throw Error(message); };
  // Fights that replay: the Goblin at easy on seed 1 falls to a walk-in with an attack every 45 ticks (920 ticks); the Veteran kills a
  // fighter who walks in guard down. `build` only changes the bytes, so each claim carries a distinct record of the same fight.
  const fight = async (opponent, profile, seed, intent, build, claimed) => {
    const rec = createRecorder({ build, opponent, weapon: 'longsword', profile, seed });
    let practice = initialPractice(seed, OPPONENTS[opponent]);
    for (let t = 0; t < 20000 && !practice.finish; t++) practice = stepPractice(practice, rec.push(intent(t)), OPPONENTS[opponent].profiles[profile]);
    return encodeRecord(rec.finish(claimed ?? (practice.finish.victim === 1 ? 'killed' : 'died')));   // `claimed`: a record that lies
  };
  const ACTS = ['light', 'heavy', 'thrust'];
  const win = build => fight('goblin', 'easy', 1, t => ({ move: { x: 0, z: t % 120 < 60 ? 0.8 : 0, yaw: 0, run: false }, action: t % 45 === 0 ? ACTS[(t / 45) % 3] : null, guard: false, lock: true }), build);
  const loss = (build, claimed) => fight('veteran', 'normal', 20260922, () => ({ ...idleIntent(), move: { x: 0, z: 0.8, yaw: 0, run: false } }), build, claimed);
  const verifier = psqlAdapter(`postgresql://frankendom_verifier@/postgres?host=${root}`, (command, args, options) => spawnSync(pg(command), args, { ...options, env: { ...options.env, LC_ALL: env.LC_ALL }, timeout: 60_000 }));
  const sweep = (options, db = verifier) => verifyClaims(db, options);
  const standingBefore = (user, claim) => { const [marks, owned] = as('frankendom_verifier', null, `select marks || '|' || owned::text from public.standing_of('${user}', ${claim});`).split('|'); return { marks: Number(marks), owned: JSON.parse(owned) }; };
  const mine = user => { const [marks, owned] = as('authenticated', user, 'select marks || \'|\' || owned::text from public.my_standing();').split('|'); return { marks: Number(marks), owned: JSON.parse(owned) }; };
  const claim = (user, record, opponent = 'goblin', piece = null) =>
    Number(as('authenticated', user, `insert into public.loot_claims(opponent, piece, record) values ('${opponent}', ${piece ? `'${piece}'` : 'null'}, '${record}') returning id;`));
  const settled = id => { const [verified, checked, note, piece, tier] = psql(`select c.verified || '|' || (c.checked_at is not null) || '|' || coalesce(c.note, '') || '|' || coalesce(a.piece, '') || '|' || coalesce(a.tier::text, '') from public.loot_claims c left join public.awards a on a.claim_id = c.id where c.id = ${id};`).split('|'); return { verified: verified === 'true', checked: checked === 'true', note, award: piece ? { piece, tier: Number(tier) } : null }; };
  const refused = (role, user, sql, code) => {   // the statement must fail with this SQLSTATE class
    const out = as(role, user, `do $$begin begin ${sql}; raise exception 'NOT REFUSED' using errcode = 'P0001'; exception when ${code} then null; end; end$$;`);
    return out === '';
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // (1) seed: the fixture profiles, exactly those, exactly once; nothing a client or the verifier holds can write it again.
  const seeds = psql('select user_id || \'|\' || marks || \'|\' || owned::text from public.account_seed order by user_id;').split('\n');
  if (!same(seeds, [`${S}|${SEED_MARKS}|${JSON.stringify(SEED_OWNED)}`, `${Z}|0|[]`, `${O}|${SEED_MARKS}|[]`, `${R}|${SEED_MARKS}|[]`])) fail(`seed rows are not the fixture profiles: ${JSON.stringify(seeds)}`);
  if (!refused('authenticated', G, `insert into public.account_seed(user_id, marks, owned) values ('${G}', 99, '[]')`, 'insufficient_privilege')) fail('a client can write account_seed');
  if (!refused('authenticated', S, `update public.account_seed set marks = 99`, 'insufficient_privilege')) fail('a client can update account_seed');
  if (!refused('authenticated', S, `perform * from public.account_seed`, 'insufficient_privilege')) fail('a client can read account_seed');
  if (!refused('frankendom_verifier', null, `insert into public.account_seed(user_id, marks, owned) values ('${G}', 99, '[]')`, 'insufficient_privilege')) fail('the verifier can write account_seed');
  if (psql(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc ~* 'insert\\s+into\\s+public\\.account_seed';`) !== '0') fail('a function can re-run the seed');
  if (!same(mine(S), { marks: SEED_MARKS, owned: SEED_OWNED })) fail(`seeded standing is not the seed: ${JSON.stringify(mine(S))}`);

  // (2) verified win: server marks = seed + 1, and the award is the claimed piece at the server tier BEFORE the win.
  const TAKE = 'goblin.Body';
  const first = claim(S, await win('s1'), 'goblin', TAKE);
  if (!same(mine(S), { marks: SEED_MARKS, owned: SEED_OWNED })) fail('an unverified claim moved the standing');
  await sweep();
  if (!same(settled(first), { verified: true, checked: true, note: '', award: { piece: TAKE, tier: levelOf(tierAt(SEED_MARKS)) } })) fail(`the first win did not settle as the claimed piece at the server tier: ${JSON.stringify(settled(first))}`);
  if (!same(mine(S), { marks: SEED_MARKS + 1, owned: [TAKE, ...SEED_OWNED].sort() })) fail(`standing after a verified win: ${JSON.stringify(mine(S))}`);
  if (as('authenticated', S, `select piece || '|' || tier from public.awards;`) !== `${TAKE}|${levelOf(tierAt(SEED_MARKS))}`) fail('the owner cannot read his award');

  // (3) guest convert: no seed row, marks 0 whatever the device cache says, then 1 after the first verified win.
  if (psql(`select count(*) from public.account_seed where user_id = '${G}';`) !== '0') fail('a post-migration account has a seed row');
  if (!same(mine(G), { marks: 0, owned: [] })) fail(`a converted guest's cache became standing: ${JSON.stringify(mine(G))}`);
  claim(G, await win('g1'));
  await sweep();
  if (mine(G).marks !== 1) fail(`converted guest after one verified win: ${JSON.stringify(mine(G))}`);

  // (4) forged cache: 100000 marks and an Origin piece written into the profile change nothing on the server.
  const beforeForge = mine(S);
  as('authenticated', S, `update public.fighter_profiles set victory_marks = 100000, loot = '{"owned":["goblin.Knife","executioner.Scythe"],"equipped":{}}' where user_id = auth.uid();`);
  if (psql(`select victory_marks from public.fighter_profiles where user_id = '${S}';`) !== '100000') fail('the forge did not land in the cache');
  if (!same(mine(S), beforeForge)) fail(`a forged cache moved the server standing: ${JSON.stringify(mine(S))}`);
  const forged = claim(S, await win('s2'), 'goblin', 'goblin.Knife');   // the forged cache "owns" it: the server does not
  await sweep();
  if (!same(settled(forged).award, { piece: 'goblin.Knife', tier: levelOf(tierAt(SEED_MARKS + 1)) })) fail(`the verifier read the forged cache: ${JSON.stringify(settled(forged))}`);

  // [B4] the sweep proves the WIN from the record: the claimed opponent, a player kill, a replay that ends there. Each refusal is settled
  // with its reason, never skipped. [B2] a proven win is a mark even when its piece is refused.
  const marksZ = mine(Z).marks;
  const mismatch = claim(Z, await win('z-wrong-opponent'), 'veteran');
  const lost = claim(Z, await loss('z-loss'), 'veteran');
  const offKit = claim(Z, await win('z-off-kit'), 'goblin', 'veteran.Helmet');
  const lie = claim(Z, await loss('z-lie', 'killed'), 'veteran');   // a lost fight whose bytes say 'killed': only the replay catches it
  await sweep();
  if (settled(mismatch).verified || !/record is against goblin/.test(settled(mismatch).note)) fail(`a record against another opponent verified: ${JSON.stringify(settled(mismatch))}`);
  if (settled(lost).verified || !/not a win/.test(settled(lost).note)) fail(`a lost fight verified: ${JSON.stringify(settled(lost))}`);
  if (settled(lie).verified || !/replay ends in "died"/.test(settled(lie).note)) fail(`a record that lies about its outcome verified: ${JSON.stringify(settled(lie))}`);
  const kept = settled(offKit);
  if (!kept.verified || kept.award || !/not in goblin's kit/.test(kept.note)) fail(`an off-kit take should keep the mark and carry the reason: ${JSON.stringify(kept)}`);
  if (mine(Z).marks !== marksZ + 1) fail(`only the proven win is a mark: ${mine(Z).marks} vs ${marksZ + 1}`);
  // Liveness (Backend): a record that cannot be read is refused with a note and never blocks the account's next win.
  const junk = claim(G, 'AAAA');
  const after = claim(G, await win('g2'));
  await sweep();
  if (settled(junk).verified || !settled(junk).checked || !/unreadable record/.test(settled(junk).note)) fail(`an unreadable record was not settled as a refusal: ${JSON.stringify(settled(junk))}`);
  if (!settled(after).verified) fail('a win behind an unreadable record did not verify');

  // [B3] order: a claim waits while an earlier claim from its account is unchecked, and its standing counts only EARLIER claims. A sweep
  // that meets them in reverse (a recheck, a page boundary) gives the same tiers as one that meets them in order.
  const early = claim(O, await win('o1'), 'goblin', 'goblin.Arms');
  const late = claim(O, await win('o2'), 'goblin', 'goblin.Gloves');
  const reversed = { ...verifier, pending: async (limit, recheck) => (await verifier.pending(limit, recheck)).reverse() };
  const r1 = await sweep({}, reversed);
  if (r1.waiting !== 1 || settled(late).checked) fail(`the later claim did not wait for the earlier one: ${JSON.stringify(r1)}`);
  await sweep({}, reversed);
  if (!same([settled(early).award, settled(late).award], [{ piece: 'goblin.Arms', tier: levelOf(tierAt(SEED_MARKS)) }, { piece: 'goblin.Gloves', tier: levelOf(tierAt(SEED_MARKS + 1)) }])) fail(`reverse-order sweeps gave different tiers: ${JSON.stringify([settled(early), settled(late)])}`);
  if (standingBefore(O, early).marks !== SEED_MARKS || standingBefore(O, late).marks !== SEED_MARKS + 1) fail('standing_of counts claims later than the bound');
  // A recheck (`--recheck` after a rules change) can verify an earlier claim AFTER a later one: its tier still counts only earlier claims.
  const was = claim(R, await win('r1'), 'goblin', 'goblin.Arms');
  const then = claim(R, await win('r2'), 'goblin', 'goblin.Gloves');
  as('frankendom_verifier', null, `update public.loot_claims set checked_at = now(), note = 'refused under older rules' where id = ${was};`);   // the old build refused it
  await sweep();
  await sweep({ recheck: true });
  if (!same([settled(then).award, settled(was).award], [{ piece: 'goblin.Gloves', tier: levelOf(tierAt(SEED_MARKS)) }, { piece: 'goblin.Arms', tier: levelOf(tierAt(SEED_MARKS)) }])) fail(`a rechecked earlier claim counted a later one: ${JSON.stringify([settled(was), settled(then)])}`);

  // Backend's DB checks.
  const other = claim(Z, 'zeroWin1');   // stays unverified: nothing sweeps after this point
  if (!refused('authenticated', S, `insert into public.awards(claim_id, piece, tier) values (${first}, 'goblin.Arms', 1)`, 'insufficient_privilege')) fail('a client can write awards');
  if (!refused('authenticated', Z, `update public.loot_claims set verified = true where id = ${other}`, 'insufficient_privilege')) fail('a client can flip verified');
  if (!refused('authenticated', Z, `update public.loot_claims set note = 'x' where id = ${other}`, 'insufficient_privilege')) fail('a client can write a note');
  if (!refused('authenticated', Z, `perform note from public.loot_claims where id = ${other}`, 'insufficient_privilege')) fail('a client can read the verifier\'s note');
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record, verified) values ('veteran', 'x1', true)`, 'insufficient_privilege')) fail('a client can post a verified claim');
  if (!refused('authenticated', Z, `insert into public.loot_claims(user_id, opponent, record) values ('${S}', 'veteran', 'x2')`, 'insufficient_privilege')) fail('a client can claim for another account');
  if (!refused('authenticated', Z, `delete from public.loot_claims`, 'insufficient_privilege')) fail('a client can delete claims');
  if (!refused('frankendom_verifier', null, `insert into public.awards(claim_id, piece, tier) values (999999, 'veteran.Body', 1)`, 'foreign_key_violation or check_violation')) fail('the verifier can award a nonexistent claim');
  if (!refused('frankendom_verifier', null, `insert into public.awards(claim_id, piece, tier) values (${first}, 'veteran.Body', 1)`, 'unique_violation')) fail('the verifier can award twice');
  if (!refused('frankendom_verifier', null, `insert into public.awards(claim_id, piece, tier) values (${other}, 'veteran.Body', 1)`, 'check_violation')) fail('the verifier can award an unverified claim');
  if (!refused('frankendom_verifier', null, `update public.loot_claims set verified = false where id = ${first}`, 'check_violation')) fail('a verified claim can be unverified');
  if (!refused('frankendom_verifier', null, `update public.loot_claims set user_id = '${Z}' where id = ${first}`, 'insufficient_privilege')) fail('the verifier can move a claim to another account');
  if (as('authenticated', Z, `select count(*) from public.awards a join public.loot_claims c on c.id = a.claim_id where c.user_id <> auth.uid();`) !== '0' || as('authenticated', Z, `select count(*) from public.loot_claims where id = ${first};`) !== '0') fail('an account sees another\'s claims or awards');
  if (!refused('anon', null, 'perform * from public.awards', 'insufficient_privilege') || !refused('anon', null, 'perform * from public.loot_claims', 'insufficient_privilege')) fail('anon can read claims or awards');
  if (!refused('anon', null, `insert into public.loot_claims(opponent, record) values ('veteran', 'anon1')`, 'insufficient_privilege')) fail('anon can post a claim');
  if (!refused('anon', null, 'perform * from public.my_standing()', 'insufficient_privilege')) fail('anon can call my_standing');
  if (!refused('authenticated', Z, `perform * from public.standing_of('${S}', null)`, 'insufficient_privilege')) fail('a client can read another account\'s standing');
  if (psql(`select count(*) from pg_proc where proname = 'standing_of';`) !== '1') fail('standing_of has more than one signature');
  if (!refused('authenticated', Z, `perform public.award_needs_verified_claim()`, 'feature_not_supported')) fail('a trigger function is callable');
  const firstRecord = psql(`select record from public.loot_claims where id = ${first};`);
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record) values ('goblin', '${firstRecord}')`, 'unique_violation')) fail('a duplicate record hash was accepted from another account');
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record) values ('veteran', repeat('a', 16385))`, 'check_violation')) fail('an oversized record was accepted');
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record) values ('veteran', 'not base64!')`, 'check_violation')) fail('a record outside base64url was accepted');
  // [B1] one statement, many rows: PostgREST takes a JSON array as a bulk insert. The cap is per row, so the whole statement is refused.
  const zClaims = Number(psql(`select count(*) from public.loot_claims where user_id = '${Z}';`));
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record) select 'veteran', 'bulk' || i from generate_series(1, 500) i`, 'insufficient_privilege')) fail('a 500-row insert passed the hourly cap');
  if (Number(psql(`select count(*) from public.loot_claims where user_id = '${Z}';`)) !== zClaims) fail('a refused bulk insert left rows behind');
  as('authenticated', Z, `do $$begin for i in 1..${60 - zClaims} loop insert into public.loot_claims(opponent, record) values ('veteran', 'rate' || i); end loop; end$$;`);   // 60 this hour
  if (!refused('authenticated', Z, `insert into public.loot_claims(opponent, record) values ('veteran', 'rate61')`, 'insufficient_privilege')) fail('a 61st claim within the hour was accepted');
  console.log('Awards database PASS: seed written once at apply from the fixture profiles and unwritable after; the real sweep settles replayed records: verified win = seed + 1 with the claimed piece at the server tier; wrong opponent, lost fight and unreadable record refused with a note, never blocking; off-kit take keeps the mark; reverse-order sweeps give the same tiers; converted guest starts at 0; forged cache ignored; client cannot write awards or flip verified; verifier cannot award a missing, unverified or already-awarded claim; owner-only reads, anon none; global record-hash uniqueness; size cap and the hourly cap, bulk insert included. No hosted database changed.');
} finally {
  if (started) run('pg_ctl', ['-D', join(root, 'data'), '-m', 'fast', '-w', 'stop']);
  rmSync(root, { recursive: true, force: true });
}
