// The Origins writer service (origins/server) end to end: real HTTP -> real handlers -> psql as the frankendom_origins role -> the real migration, in the
// same disposable socket-only cluster as origins-database-check.mjs. Only Supabase Auth is faked (a token table). No DATABASE_URL or SUPABASE_* is read.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { psqlDb } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';
import { withContent } from '../origins/server/handlers.ts';
import { parseItemDefinition } from '../origins/contracts/items.ts';
import * as F from '../origins/contracts/fixtures.ts';
import { creditFromMarks } from '../origins/progression/model.ts';
import { fetchOpen, isOffline, saveLine } from '../origins/preview/save.ts';
import { careerLine } from '../origins/pit/pit.ts';

const dir = 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-origins-writer-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TOKENS = { ta: A, tb: B, tc: C };
let checks = 0, started = false, server;
const eq = (got, want, what) => { checks++; if (JSON.stringify(got) !== JSON.stringify(want)) throw Error(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };

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
    insert into auth.users values ('${A}'),('${B}'),('${C}');`);
  psql(readdirSync(dir).filter(n => n.endsWith('.sql')).sort().map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  psql(`insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) values ('${A}','Aldren',4,'{"owned":[],"equipped":{}}'),('${B}','Bran',0,'{"owned":[],"equipped":{}}');`);

  // Example content (the contracts' fixtures): exchange ore and the story-critical Record of Names. The writer is built with its content; no body names a definition.
  const defs = new Map([F.exchangeOreDef(), F.recordDef()].map(raw => { const d = parseItemDefinition(raw); if (!d.ok) throw Error(JSON.stringify(d.issues)); return [d.value.id, d.value]; }));
  server = createWriter({ db: psqlDb(`postgresql://frankendom_origins@/postgres?host=${root}`, pg('psql')), verify: async t => TOKENS[t] ?? null, handlers: withContent({ lookup: id => defs.get(id) }) });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/origins/`;
  const call = async (op, token, body, method = 'POST') => {
    const res = await globalThis.fetch(base + op, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined });
    return { status: res.status, json: await res.json() };
  };

  eq((await call('open', null)).status, 401, 'no token');
  eq((await call('open', 'nobody')).status, 401, 'a token Auth does not vouch for');
  eq((await call('nope', 'ta')).status, 404, 'unknown op');
  eq((await call('open', 'ta', {}, 'GET')).status, 404, 'GET is not an op');
  eq((await call('open', 'ta')).status, 403, 'flag off: refused by the database');
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ('${A}'),('${B}');`);
  eq((await call('open', 'tc')).status, 403, 'on, but not on the allowlist');

  // open snapshots the Pit credit once, from the marks the database holds
  const seed = creditFromMarks(4);
  const o1 = await call('open', 'ta');
  eq([o1.status, o1.json.result.marks, o1.json.result.career.seed_credit, o1.json.result.career.total_credit], [200, 4, seed, seed], 'open: the snapshot');
  psql(`update public.fighter_profiles set victory_marks = 40 where user_id = '${A}';`);
  eq((await call('open', 'ta')).json.result.career.seed_credit, seed, 'a later open never re-snapshots');
  psql(`update public.fighter_profiles set victory_marks = 4 where user_id = '${A}';`);

  // characters
  const made = await call('create_character', 'ta', { name: 'Aldren' });
  eq([made.status, /^pc:[0-9a-f]{32}$/.test(made.json.result.id)], [200, true], 'create_character');
  eq((await call('create_character', 'ta', { name: 'Aldren' })).status, 409, 'a second Aldren');
  for (const name of ['', ' x', 'x'.repeat(33), 'a\nb', 7, undefined]) eq((await call('create_character', 'ta', { name })).status, 400, `bad name ${JSON.stringify(name)}`);
  eq((await call('open', 'ta')).json.result.characters.map(c => c.name), ['Aldren'], 'the character is in the snapshot');
  eq((await call('create_character', 'tb', { name: 'Aldren' })).status, 200, 'names are per account');

  // Pit import: a win verified after the snapshot pays the legend row once, at the derived level, however many opens race
  const claim = n => psql(`insert into public.loot_claims(user_id, opponent, record, verified, checked_at, fight_hash) values ('${A}', 'knight', 'wrec${n}', true, now() + interval '1 minute', '${n.toString(16).padStart(64, '0')}') returning id;`).split('\n')[0];
  const c1 = claim(1);
  const opens = await Promise.all([call('open', 'ta'), call('open', 'ta'), call('open', 'ta')]);
  eq(opens.map(o => o.status), [200, 200, 200], 'racing opens all answer');
  const total1 = (await call('open', 'ta')).json.result.career.total_credit;
  const [rows, cp] = psql(`select count(*) || '|' || coalesce(sum((payload->>'cp')::bigint), 0) from public.origins_events where account = '${A}' and kind = 'pit'`).split('|');
  eq(rows, '1', 'one pit event however many opens raced');
  eq([total1, total1 > seed], [seed + Number(cp), true], 'total = seed + the pit event, and the win paid something');
  eq((await call('open', 'ta')).json.result.career.beaten.length, 1, 'the legend is recorded as beaten');
  // the same opponent again at the same level pays nothing, but still leaves pending
  const c2 = claim(2);
  const after = (await call('open', 'ta')).json.result.career.total_credit;
  eq([after, psql(`select count(*) from public.origins_events where event_id in ('pit:${c1}', 'pit:${c2}')`)], [total1, '2'], 'a repeat win: cp 0, event written');
  eq(psql(`select count(*) from public.origins_pit_pending('${A}')`), '0', 'nothing left pending');
  // a client cannot name another account: the body is ignored, the token decides
  eq((await call('open', 'tb', { account: A })).json.result.career.seed_credit, creditFromMarks(0), 'the account comes from the token alone');

  // consume (a quest hand-in): ore minted into Aldren's pack and bank, burned through the writer, retried, conflicted, raced; conservation at every commit
  const pc = made.json.result.id;
  const mint = (id, item, quantity, kind, index, key, provenance, extra = {}) => ({ op: 'mint', item: { id, item, quantity, mint_key: key, loc: { kind, owner: pc, index }, ...extra, provenance: { mintKey: key, at: '2026-10-06T12:00:00Z', wonBy: pc, ...provenance } } });
  const loot = { kind: 'loot', table: 'loottable:ghoul', encounter: 'encounter:ruin-vigil' };
  psql(`select public.origins_commit('${A}', $j$${JSON.stringify([
    mint('inst:ore-a', 'item:exchange-ore', 3, 'pack', 0, 'loot:wc:a', loot), mint('inst:ore-b', 'item:exchange-ore', 10, 'pack', 1, 'loot:wc:b', loot),
    mint('inst:ore-c', 'item:exchange-ore', 20, 'bank', 0, 'loot:wc:c', loot),
    mint('inst:record-1', 'item:stolen-name-record', 1, 'pack', 2, 'quest:stolen-name:ruin:wc', { kind: 'quest-reward', quest: 'quest:stolen-name', stage: 'ruin' }, { bound_to: pc }),
  ])}$j$::jsonb);`);
  const live = () => psql(`select coalesce(string_agg(id || ':' || quantity || ':v' || version, ',' order by id), '') from public.origins_items where holder_account = '${A}' and retired_at is null`);
  const conserved = () => psql(`select count(*) from (select r.root from (select mint_root as root from public.origins_item_ledger group by mint_root) r
    where (select coalesce(sum(quantity), 0) from public.origins_items i where i.mint_root = r.root and i.retired_at is null) <> (select sum(delta) from public.origins_item_ledger l where l.mint_root = r.root)) bad`);
  const burns = () => psql(`select count(*) || '/' || coalesce(-sum(delta), 0) from public.origins_item_ledger where reason = 'burn'`);
  const handIn = over => ({ character: pc, op: 'quest:ore-handin:0001', reason: 'quest-handin', qty: 5, itemId: 'item:exchange-ore', ...over });
  const k1 = await call('consume', 'ta', handIn());
  eq([k1.status, k1.json.result?.replayed, k1.json.result?.burn.lines.map(l => [l.instance, l.quantity])], [200, false, [['inst:ore-a', 3], ['inst:ore-b', 2]]], 'consume: 5 ore, lowest slot first');
  eq(live(), 'inst:ore-b:8:v2,inst:ore-c:20:v1,inst:record-1:1:v1', 'consume: a emptied (retired), b down to 8, the bank untouched');
  eq([burns(), conserved()], ['2/5', '0'], 'consume: two ledger burns of 5 units, every root conserved');
  const k2 = await call('consume', 'ta', handIn());
  eq([k2.status, k2.json.result?.replayed, JSON.stringify(k2.json.result?.burn) === JSON.stringify(k1.json.result.burn)], [200, true, true], 'consume retry: the original receipt');
  eq([live(), burns()], ['inst:ore-b:8:v2,inst:ore-c:20:v1,inst:record-1:1:v1', '2/5'], 'consume retry: nothing changed');
  const k3 = await call('consume', 'ta', handIn({ qty: 4 }));
  eq([k3.status, k3.json.code], [409, 'op-conflict'], 'consume: the op id with a different request is a conflict');
  eq((await call('consume', 'ta', handIn({ op: 'quest:ore-handin:0002', qty: 9 }))).status, 400, 'consume: 8 in the pack; the bank does not count');
  eq((await call('consume', 'ta', handIn({ op: 'quest:ore-handin:0003', itemId: 'item:stolen-name-record', qty: 1 }))).status, 400, 'consume: a story piece not named by the step');
  eq((await call('consume', 'tb', handIn({ op: 'quest:ore-handin:0004', account: A }))).status, 400, 'consume: B cannot name A\'s character, whatever the body says');
  eq([live(), burns()], ['inst:ore-b:8:v2,inst:ore-c:20:v1,inst:record-1:1:v1', '2/5'], 'consume: refusals changed nothing');
  // two identical requests at once: one commits, the other loses on the event key (O0001) and answers from the stored receipt
  const raced = await Promise.all([call('consume', 'ta', handIn({ op: 'quest:ore-handin:0005', qty: 2 })), call('consume', 'ta', handIn({ op: 'quest:ore-handin:0005', qty: 2 }))]);
  eq([raced.map(r => r.status), raced.map(r => r.json.result?.replayed).sort()], [[200, 200], [false, true]], 'consume race: one burn, one replay');
  eq([live(), burns(), conserved()], ['inst:ore-b:6:v3,inst:ore-c:20:v1,inst:record-1:1:v1', '3/7', '0'], 'consume race: burned once, conserved');
  const story = await call('consume', 'ta', handIn({ op: 'quest:stolen-name:ruin:handin', itemId: 'item:stolen-name-record', qty: 1, consumesStoryItem: 'item:stolen-name-record' }));
  eq([story.status, live(), conserved()], [200, 'inst:ore-b:6:v3,inst:ore-c:20:v1', '0'], 'consume: the step that names the story piece burns it');
  eq(psql(`select count(*) from public.origins_events where kind = 'burn' and account = '${A}'`), '3', 'one burn event per op id');

  // The greybox preview's read (origins/preview/save.ts fetchOpen) against this real writer: the mapped career is the writer's derived total,
  // the read writes nothing, and every refusal comes back offline instead of throwing.
  const writer = base.slice(0, -1), events = () => psql(`select count(*) from public.origins_events where account = '${A}'`);
  const before = events(), viaPreview = await fetchOpen('ta', { base: writer }), direct = (await call('open', 'ta')).json.result.career;
  eq([viaPreview.career?.credit, careerLine(viaPreview.career).credit, viaPreview.career?.beaten, viaPreview.characters.map(c => c.name)],
    [Number(direct.total_credit), Number(direct.total_credit), direct.beaten, ['Aldren']], 'preview: the mapped career is the derived total');
  eq(events(), before, 'preview: open wrote nothing');
  eq(await fetchOpen('nobody', { base: writer }), { offline: 'http-401' }, 'preview: a token Auth refuses -> offline');
  eq(await fetchOpen('tc', { base: writer }), { offline: 'http-403' }, 'preview: not on the allowlist -> offline');
  eq(await fetchOpen('ta', { base: writer.replace(/origins$/, 'nope') }), { offline: 'http-404' }, 'preview: no route -> offline');
  eq(await fetchOpen(null, { base: writer }), { offline: 'no-session' }, 'preview: no session -> no call');
  // prod today: the flag is off. An allowlisted account then gets 403 too, and the preview shows the offline line.
  psql(`update public.origins_config set value = 'false'::jsonb where key = 'origins_enabled';`);
  eq(psql(`select count(*) from public.origins_access where account = '${A}'`), '1', 'A is still on the allowlist');
  const flagOff = await fetchOpen('ta', { base: writer });
  eq([flagOff, saveLine(flagOff)], [{ offline: 'http-403' }, 'Offline preview: progress is not saved'], 'preview: flag off + access row -> 403 -> the offline line');
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled';`);
  eq(isOffline(await fetchOpen('ta', { base: writer })), false, 'preview: flag back on -> the saved career again');
  console.log(`origins-writer-check: ${checks} checks passed`);
} finally {
  server?.close();
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
