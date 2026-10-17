// Rehearsal of ops/prelaunch-reset.sql (launch gate R1) on a disposable PostgreSQL cluster with every repo migration applied: progress is seeded through the real functions
// (characters, career snapshot, an item, bronze, events) next to the KEEP data (the Pit's profiles and claims, the switches, the access list); then the DRY run changes nothing, a RESET
// without the phrase or with a wrong one changes nothing, the real RESET leaves every RESET table at 0 and every KEEP table exactly as it was, a second reset is a clean no-op, the
// immutable-ledger triggers are still installed afterwards, and a new origins_ table nobody classified makes the script refuse (the drift guard). Socket-only: no DATABASE_URL, no
// hosted project is reachable. Needs PG_BIN and a non-root user (as `postgres` on the VPS).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { compare, measure, parseManifest, restoreInto, scratchCluster } from './prelaunch-restore-test.mjs';

const dir = process.env.ORIGINS_MIGRATIONS ?? 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-r1-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const base = ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'];
const psql = sql => run('psql', base, sql).trim();
const scriptAs = (user, ...vars) => run('psql', [...base, ...(user ? ['-U', user] : []), ...vars.flatMap(v => ['-v', v]), '-f', 'ops/prelaunch-reset.sql']);
const script = (...vars) => scriptAs(null, ...vars);
const PHRASE = 'R1-WIPE-ORIGINS-TEST-PROGRESS';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let checks = 0;
const fail = message => { throw Error(message); };
const eq = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const refused = (what, needle, fn) => { checks++; try { fn(); } catch (e) { const text = `${e.stderr ?? ''}${e.message}`; if (text.includes(needle)) return; fail(`${what}: refused for the wrong reason (${text.slice(0, 300)})`); } fail(`${what}: was not refused`); };
const count = t => Number(psql(`select count(*) from public.${t};`));
const origins = () => psql(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and relname like 'origins\\_%' order by 1;`).split('\n');
const snapshot = tables => Object.fromEntries(tables.map(t => [t, count(t)]));
const triggers = () => psql(`select tgrelid::regclass || ':' || tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text like 'origins\\_%' order by 1;`);

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
    insert into auth.users values ('${A}'),('${B}');`);
  for (const n of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) psql(readFileSync(join(dir, n), 'utf8'));

  // ---- seed progress through the real functions, and KEEP data beside it ----------------------------------------------------------
  psql(`insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) values ('${A}','Aldren',4,'{"owned":[],"equipped":{}}'),('${B}','Bran',2,'{"owned":[],"equipped":{}}');
    update public.origins_config set value = 'true'::jsonb where key in ('origins_enabled','origins_open_to_all');
    insert into public.origins_access(account) values ('${A}'),('${B}') on conflict do nothing;`);
  const pcA = psql(`select public.origins_create_character('${A}', 'Aldren');`), pcB = psql(`select public.origins_create_character('${B}', 'Bran');`);
  psql(`select public.origins_snapshot('${A}', 4, 5000); select public.origins_snapshot('${B}', 2, 800);`);
  const mint = (account, id, pc, key, index = 0) => psql(`select public.origins_commit('${account}', $j$[{"op":"mint","item":{"id":"${id}","item":"iron-ore","quantity":10,"mint_key":"${key}","loc":{"kind":"pack","owner":"${pc}","index":${index}},"provenance":{"kind":"loot","mintKey":"${key}","at":"2026-10-06T00:00:00Z"}}}]$j$::jsonb)::text;`);
  mint(A, 'it:a1', pcA, 'mk:a1'); mint(B, 'it:b1', pcB, 'mk:b1');
  // A bronze award is a write to origins_metal_ledger (identity id) with its own event: the same shape the verified-kill payout writes.
  const bronze = (account, key, delta) => psql(`select public.origins_commit('${account}', $j$[{"op":"event","event_id":"${key}","kind":"metal","account":"${account}","payload":{}},{"op":"metal","account":"${account}","delta_bronze":${delta},"reason":"award","event_id":"${key}"}]$j$::jsonb)::text;`);   // a first award: no metal row yet, so no expected_version
  bronze(A, 'r1:bz-a', 40);
  psql(`insert into public.origins_character_location(character, x, z, updated_at) values ('${pcA}', 100, 200, now()) on conflict do nothing;`);
  const all = origins();
  const RESET = ['origins_characters','origins_active_character','origins_career','origins_character_build','origins_character_location','origins_character_renown','origins_items','origins_item_ledger','origins_metal','origins_metal_ledger','origins_events','origins_encounters','origins_encounter_runs','origins_creature_claims','origins_quest_state','origins_quest_journal','origins_talk','origins_trades','origins_trade_audit','origins_grimoire','origins_skill_practice','origins_skill_xp','origins_beta_ledger','origins_ground_takes','origins_spawn_engages'];
  const KEEP = ['origins_access','origins_config','origins_world_config','origins_switches','origins_live_events','origins_spawns'];
  eq([...RESET, ...KEEP].sort(), all, 'the rehearsal knows every origins_ table (and the script lists the same)');
  const seeded = snapshot(RESET);
  eq([seeded.origins_characters, seeded.origins_career, seeded.origins_items > 0, seeded.origins_events > 0, seeded.origins_item_ledger > 0], [2, 2, true, true, true], 'progress is seeded in the tables the reset must empty');
  const other = ['fighter_profiles', 'loot_claims', 'awards'], keepBefore = { ...snapshot(KEEP), ...snapshot(other) };
  const trgBefore = triggers();

  // ---- the backup, and the TESTED restore into a separate scratch cluster (the gate's receipt) ----------------------------------------
  const outDir = join(root, 'out'), who = execFileSync('id', ['-un'], { encoding: 'utf8' }).trim();
  writeFileSync(join(root, 'backup.env'), `DATABASE_URL=postgresql:///postgres?host=${root}&user=${who}\n`);
  const bk = execFileSync('bash', ['ops/prelaunch-backup.sh'], { encoding: 'utf8', env: { ...env, BACKUP_ENV: join(root, 'backup.env'), OUT_DIR: outDir, PG_DUMP: pg('pg_dump'), PG_RESTORE: pg('pg_restore'), PSQL: pg('psql') } });
  const made = readdirSync(outDir), backupDir = join(outDir, made[0]), inside = readdirSync(backupDir);
  eq([made.length, /^r1-\d{8}T\d{6}Z$/.test(made[0])], [1, true], 'the backup wrote one r1-<stamp> directory');
  eq(inside.length, 26, 'the backup holds a CSV per RESET table and the manifest');
  eq([inside.every(f => (statSync(join(backupDir, f)).mode & 0o777) === 0o600), statSync(backupDir).mode & 0o777, statSync(outDir).mode & 0o777], [true, 0o700, 0o700], 'the backup files are 0600 in 0700 directories');
  const manifest = parseManifest(join(backupDir, 'manifest.tsv'));
  eq(manifest.map(m => m.table).sort(), [...RESET].sort(), 'the manifest lists exactly the RESET tables');
  // The reset takes the manifest's counts (-v expect=table=n,...) exactly as the runbook builds them with awk, so the backup is proven to be the backup of these rows.
  const expect = execFileSync('awk', ['-F', '\t', '{printf "%s%s=%s", s, $1, $2; s=","}', join(backupDir, 'manifest.tsv')], { encoding: 'utf8' });
  const EXPECT = `expect=${expect}`;
  eq(manifest.find(m => m.table === 'origins_metal_ledger').n > 0, true, 'the backup holds bronze ledger rows (the sequence drill below needs them)');
  eq(bk.includes('postgresql://'), false, 'the backup prints no connection string');
  eq(manifest.find(m => m.table === 'origins_characters').n, 2, 'the manifest counts the seeded rows');
  const scratch = scratchCluster();
  try {
    restoreInto(scratch.socket, backupDir);
    eq(compare(manifest, measure(scratch.socket, RESET)), [], 'restore into a scratch cluster: every table equals the manifest (counts and content hashes)');
  } finally { scratch.stop(); }

  // ---- DRY RUN: counts only, nothing changes, the report names every table -------------------------------------------------------
  const dry = script();
  eq(dry.includes('R1: DRY RUN') && dry.includes('dry run finished, nothing changed'), true, 'the dry run says so');
  eq(RESET.every(t => dry.includes(t)) && KEEP.every(t => dry.includes(t)), true, 'the dry run reports every table');
  eq(snapshot(RESET), seeded, 'the dry run changed no RESET table');
  // ---- a reset without the phrase, with a wrong one, or with the phrase but no commit: still a dry run --------------------------
  for (const [what, vars] of [['commit without a phrase', ['commit=1']], ['a wrong phrase', ['commit=1', 'confirm=yes']], ['the phrase without commit', [`confirm=${PHRASE}`]],
    ['commit=0 with the phrase and the counts', ['commit=0', `confirm=${PHRASE}`, EXPECT]]]) {
    const out = script(...vars);
    eq(out.includes('R1: DRY RUN') && !out.includes('COMMITTED'), true, `${what}: stays a dry run`);
    eq(snapshot(RESET), seeded, `${what}: changed nothing`);
  }
  // ---- the reset itself refuses: no counts, counts that are not the backup's, a role that is not the owner -------------------------
  refused('a reset with no -v expect', 'needs -v expect', () => script('commit=1', `confirm=${PHRASE}`));
  refused('a reset whose counts are not the backup\'s', 'do not hold the rows the backup holds', () => script('commit=1', `confirm=${PHRASE}`, EXPECT.replace('origins_characters=2', 'origins_characters=3')));
  refused('a reset whose counts omit a table', 'do not hold the rows the backup holds', () => script('commit=1', `confirm=${PHRASE}`, `expect=${expect.split(',').slice(1).join(',')}`));
  psql(`create role r1_nobody login; grant all on all tables in schema public to r1_nobody; grant usage on schema public to r1_nobody;`);
  refused('a reset by a role that does not own the tables', 'run it as the owner', () => scriptAs('r1_nobody', 'commit=1', `confirm=${PHRASE}`, EXPECT));
  eq(snapshot(RESET), seeded, 'every refused reset changed nothing');
  // ---- the drift guard: a new origins_ table nobody classified refuses, and nothing changes -----------------------------------
  psql(`create table public.origins_zz_new (id int);`);
  refused('an unclassified origins_ table', 'neither list', () => script('commit=1', `confirm=${PHRASE}`, EXPECT));
  refused('an unclassified origins_ table, dry run too', 'neither list', () => script());
  eq(snapshot(RESET), seeded, 'the refused run changed nothing');
  psql(`drop table public.origins_zz_new;`);
  // ---- the real reset ----------------------------------------------------------------------------------------------------------------
  const out = script('commit=1', `confirm=${PHRASE}`, EXPECT);
  eq(out.includes('R1: RESET MODE') && out.includes('R1: COMMITTED'), true, 'the reset ran and committed');
  eq(Object.values(snapshot(RESET)).every(n => n === 0), true, 'every RESET table is at 0');
  eq({ ...snapshot(KEEP), ...snapshot(other) }, keepBefore, 'every KEEP table (and the Pit: profiles, claims, awards) has exactly its rows');
  eq(psql(`select victory_marks from public.fighter_profiles where user_id = '${A}';`), '4', 'the Pit profile is untouched');
  eq(triggers(), trgBefore, 'no trigger was disabled, dropped or added (the append-only ledgers stay immutable)');
  refused('the append-only ledger still refuses a delete', 'append', () => psql(`insert into public.origins_events(event_id, kind, account, payload) values ('r1:probe','career-snapshot','${A}','{}'); delete from public.origins_events where event_id = 'r1:probe';`));
  psql(`truncate public.origins_events;`);
  // ---- the recovery drill: the backup restores INTO the emptied database, row for row, through ops/prelaunch-restore.sh (the real restore path: a service file, one transaction) -----
  const restoreEnv = { ...env, BACKUP_ENV: join(root, 'backup.env'), PSQL: pg('psql'), NODE: process.execPath };
  const probe = execFileSync('bash', ['ops/prelaunch-restore.sh', 'probe'], { encoding: 'utf8', env: restoreEnv });
  eq(probe.includes('probe ok') && !probe.includes('postgresql://'), true, 'the probe: the role may set session_replication_role = replica, in a transaction rolled back');
  eq(psql(`show session_replication_role;`), 'origin', 'the probe changed nothing');
  const restored = execFileSync('bash', ['ops/prelaunch-restore.sh', 'restore', backupDir], { encoding: 'utf8', env: restoreEnv });
  eq(restored.includes('restored:') && !restored.includes('postgresql://'), true, 'the restore script ran and prints no connection string');
  eq(compare(manifest, measure(root, RESET)), [], 'restore into the reset database: every table equals the manifest again');
  eq(count('origins_characters'), 2, 'the characters are back');
  refused('a second restore into the now-full database', 'not empty', () => execFileSync('bash', ['ops/prelaunch-restore.sh', 'restore', backupDir], { encoding: 'utf8', env: restoreEnv, stdio: 'pipe' }));
  eq(compare(manifest, measure(root, RESET)), [], 'the refused restore left the tables as they were');
  // The identity sequences were advanced to max(id) (COPY does not touch them): every serial/identity column of every restored table has a sequence at or past its highest id ...
  const idents = psql(`select c.relname || '.' || a.attname || '.' || pg_get_serial_sequence('public.' || c.relname, a.attname) from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where c.relnamespace = 'public'::regnamespace and c.relname = any (string_to_array('${RESET.join(',')}', ',')) and pg_get_serial_sequence('public.' || c.relname, a.attname) is not null order by 1;`).split('\n').filter(Boolean).map(l => l.split('.'));
  eq(idents.map(i => i[0]).sort().filter(t => ['origins_item_ledger', 'origins_trade_audit', 'origins_metal_ledger'].includes(t)), ['origins_item_ledger', 'origins_metal_ledger', 'origins_trade_audit'], 'the three identity ledgers are found');
  const behind = idents.filter(([t, c, ...seq]) => { const s = seq.join('.'); const max = psql(`select coalesce(max(${c}), 0) from public.${t};`); const [last, called] = psql(`select last_value, is_called from ${s};`).split('|'); return called === 't' ? Number(last) < Number(max) : Number(max) > 0; });
  eq(behind.map(b => b[0]), [], 'no identity sequence is behind the ids restored into its table');
  // ... and a real write to each ledger succeeds right after the restore, before the second reset (it would collide with a restored id otherwise).
  mint(A, 'it:a2', pcA, 'mk:a2', 1);
  bronze(B, 'r1:bz-b', 25);
  eq(Number(psql(`select count(*) from public.origins_item_ledger;`)) > Number(manifest.find(m => m.table === 'origins_item_ledger').n), true, 'a mint right after the restore writes the item ledger');
  eq(Number(psql(`select count(*) from public.origins_metal_ledger;`)) > Number(manifest.find(m => m.table === 'origins_metal_ledger').n), true, 'a bronze award right after the restore writes the metal ledger');
  // ---- a second reset is a clean no-op, and the game works again from scratch ---------------------------------------------------
  const after = Object.fromEntries(RESET.map(t => [t, count(t)]));
  const again = script('commit=1', `confirm=${PHRASE}`, `expect=${RESET.map(t => `${t}=${after[t]}`).join(',')}`);
  eq(again.includes('R1: COMMITTED'), true, 'a second reset commits cleanly');
  const pcA2 = psql(`select public.origins_create_character('${A}', 'Aldren');`);
  eq(/^pc:[0-9a-f]{32}$/.test(pcA2), true, 'an account can create its character again after the reset');
  psql(`select public.origins_snapshot('${A}', 4, 5000);`);
  eq(psql(`select seed_credit from public.origins_career where account = '${A}';`), '5000', 'the first open re-seeds the career from the Pit marks (by design)');
  console.log(`prelaunch-reset-check: ${checks} checks passed`);
} catch (e) {
  console.error(`prelaunch-reset-check FAIL: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* the cluster is disposable */ }
  rmSync(root, { recursive: true, force: true });
}
