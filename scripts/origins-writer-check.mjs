// The Origins writer service (origins/server) end to end: real HTTP -> real handlers -> psql as the frankendom_origins role -> the real migration, in the
// same disposable socket-only cluster as origins-database-check.mjs. Only Supabase Auth is faked (a token table). No DATABASE_URL or SUPABASE_* is read.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { psqlDb } from '../origins/server/db.ts';
import { createWriter } from '../origins/server/server.ts';
import { storyOps, withContent } from '../origins/server/handlers.ts';
import { readStoryContent } from '../origins/server/content.ts';
import { storyBundle } from '../origins/server/fixtures.ts';
import { parseItemDefinition } from '../origins/contracts/items.ts';
import * as F from '../origins/contracts/fixtures.ts';
import { creditFromMarks, cumulative } from '../origins/progression/model.ts';
import { smithContent } from '../origins/server/upgrade.ts';
import { fetchOpen, isOffline, saveLine } from '../origins/preview/save.ts';
import { careerLine } from '../origins/pit/pit.ts';


const dir = 'supabase/migrations';
const root = mkdtempSync(join(tmpdir(), 'frankendom-origins-writer-'));
const pg = process.env.PG_BIN ? name => join(process.env.PG_BIN, name) : name => name;
const env = { ...process.env, LC_ALL: process.env.LC_ALL || process.env.LANG || 'C' };
const run = (command, args, input) => execFileSync(pg(command), args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env, timeout: 300_000 });
const psql = sql => run('psql', ['-h', root, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t'], sql).trim();
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TOKENS = { ta: A, tb: B, tc: C, td: D };
// The story ops run on the writer's example bundle (the Concord Commission, Orla, an errand), read from a file the way the writer reads it at start.
const CQ = 'quest:concord-commission', NPC = 'character:smith-orla';
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
    insert into auth.users values ('${A}'),('${B}'),('${C}'),('${D}');`);
  psql(readdirSync(dir).filter(n => n.endsWith('.sql')).sort().map(n => readFileSync(join(dir, n), 'utf8')).join('\n'));
  psql(`insert into public.fighter_profiles(user_id, display_name, victory_marks, loot) values ('${A}','Aldren',4,'{"owned":[],"equipped":{}}'),('${B}','Bran',0,'{"owned":[],"equipped":{}}'),('${D}','Dara',10,'{"owned":[],"equipped":{}}');`);

  // Example content (the contracts' fixtures): exchange ore and the story-critical Record of Names. The writer is built with its content; no body names a definition.
  // The smith: the fixtures' forge, materials only (level 1 costs 5 grave iron and 0 coin; level 2 still prices coin, so it is a 501).
  const defs = new Map([F.exchangeOreDef(), F.recordDef(), F.helmetDef(), F.graveIronDef(),
    { ...F.helmetDef(), id: 'item:loot.veteran.Body', slot: 'Body', name: "The Centurion's cuirass", appearance: { asset: 'loot.glb/veteran.Body' } },
    { ...F.helmetDef(), id: 'item:loot.veteran.Greaves', slot: 'Greaves', name: "The Centurion's greaves", appearance: { asset: 'loot.glb/veteran.Greaves' } }].map(raw => { const d = parseItemDefinition(raw); if (!d.ok) throw Error(JSON.stringify(d.issues)); return [d.value.id, d.value]; }));
  writeFileSync(join(root, 'content.json'), JSON.stringify(storyBundle()));
  server = createWriter({ db: psqlDb(`postgresql://frankendom_origins@/postgres?host=${root}`, pg('psql')), verify: async t => TOKENS[t] ?? null, handlers: { ...withContent({
    lookup: id => defs.get(id),
    smith: smithContent(F.blacksmith(), { ...F.forgeCosts(), rows: [{ level: 1, rarity: 'common', coin: 0, materials: [{ item: 'item:grave-iron', quantity: 5 }] }, { level: 2, rarity: 'common', coin: 250, materials: [] }] }),
  }), ...storyOps(readStoryContent(join(root, 'content.json'))) } });
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
  psql(`update public.origins_config set value = 'true'::jsonb where key = 'origins_enabled'; insert into public.origins_access(account) values ('${A}'),('${B}'),('${D}');`);
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
  const racedBurn = await Promise.all([call('consume', 'ta', handIn({ op: 'quest:ore-handin:0005', qty: 2 })), call('consume', 'ta', handIn({ op: 'quest:ore-handin:0005', qty: 2 }))]);
  eq([racedBurn.map(r => r.status), racedBurn.map(r => r.json.result?.replayed).sort()], [[200, 200], [false, true]], 'consume race: one burn, one replay');
  eq([live(), burns(), conserved()], ['inst:ore-b:6:v3,inst:ore-c:20:v1,inst:record-1:1:v1', '3/7', '0'], 'consume race: burned once, conserved');
  const story = await call('consume', 'ta', handIn({ op: 'quest:stolen-name:ruin:handin', itemId: 'item:stolen-name-record', qty: 1, consumesStoryItem: 'item:stolen-name-record' }));
  eq([story.status, live(), conserved()], [200, 'inst:ore-b:6:v3,inst:ore-c:20:v1', '0'], 'consume: the step that names the story piece burns it');
  eq(psql(`select count(*) from public.origins_events where kind = 'burn' and account = '${A}'`), '3', 'one burn event per op id');

  // apply_upgrade (the smith, materials only): a Recruit helmet one level up for 5 grave iron, retried, conflicted, raced; conservation at every commit
  psql(`update public.origins_career set world_credit = ${cumulative(11)}, version = version + 1 where account = '${A}';`);   // rank for a Legionary piece
  psql(`select public.origins_commit('${A}', $j$${JSON.stringify([
    mint('inst:helm-wc', 'item:loot.veteran.Helmet', 1, 'pack', 3, 'claim:9001', { kind: 'arena-award', claimId: 9001, lootId: 'veteran.Helmet', fromLegend: 'veteran-1', atRank: 'Recruit' }, { tier: 'Recruit' }),
    mint('inst:iron-a', 'item:grave-iron', 3, 'pack', 4, 'loot:wc:ia', loot), mint('inst:iron-b', 'item:grave-iron', 10, 'pack', 5, 'loot:wc:ib', loot),
    mint('inst:iron-c', 'item:grave-iron', 20, 'bank', 1, 'loot:wc:ic', loot), mint('inst:iron-d', 'item:grave-iron', 6, 'pack', 6, 'loot:wc:id', loot),
  ])}$j$::jsonb);`);
  const helmRow = () => psql(`select upgrade_level || ':v' || version || ':' || jsonb_array_length(history) || ':' || coalesce(history -> -1 ->> 'kind', '-') || ':' || coalesce(history -> -1 ->> 'receipt', '-') from public.origins_items where id = 'inst:helm-wc'`);
  const irons = () => psql(`select coalesce(string_agg(id || ':' || quantity || ':v' || version, ',' order by id), '') from public.origins_items where item = 'item:grave-iron' and retired_at is null`);
  const upgrades = () => psql(`select count(*) from public.origins_events where kind = 'upgrade' and account = '${A}'`);
  const smithAsk = over => ({ character: pc, op: 'smith:helm-wc:l1', instance: 'inst:helm-wc', toLevel: 1, materials: ['inst:iron-a', 'inst:iron-b'], ...over });
  const burned0 = burns();
  const u1 = await call('apply_upgrade', 'ta', smithAsk({ coin: 999, fromLevel: 8 }));
  eq([u1.status, u1.json.result?.replayed, u1.json.result?.receipt.coin, u1.json.result?.receipt.fromLevel, u1.json.result?.receipt.materials.map(m => [m.instance, m.quantity])],
    [200, false, 0, 0, [['inst:iron-a', 3], ['inst:iron-b', 2]]], 'upgrade: level 0 -> 1 for 5 iron and 0 coin, whatever the body says');
  eq(helmRow(), '1:v2:1:upgrade:smith:helm-wc:l1', 'upgrade: the piece is level 1, one version on, its history grew by the upgrade entry');
  eq(irons(), 'inst:iron-b:8:v2,inst:iron-c:20:v1,inst:iron-d:6:v1', 'upgrade: iron a spent (retired), b down to 8, the bank and d untouched');
  eq([upgrades(), burns(), conserved()], ['1', `${Number(burned0.split('/')[0]) + 2}/${Number(burned0.split('/')[1]) + 5}`, '0'], 'upgrade: one event, two ledger burns of 5 units, every root conserved at commit');
  const u2 = await call('apply_upgrade', 'ta', smithAsk());
  eq([u2.status, u2.json.result?.replayed, JSON.stringify(u2.json.result?.receipt) === JSON.stringify(u1.json.result?.receipt)], [200, true, true], 'upgrade retry: the original receipt, byte for byte');
  eq([helmRow(), irons(), upgrades(), conserved()], ['1:v2:1:upgrade:smith:helm-wc:l1', 'inst:iron-b:8:v2,inst:iron-c:20:v1,inst:iron-d:6:v1', '1', '0'], 'upgrade retry: nothing changed');
  const u3 = await call('apply_upgrade', 'ta', smithAsk({ toLevel: 2 }));
  eq([u3.status, u3.json.code], [409, 'op-conflict'], 'upgrade: the op id with a different request is a conflict');
  const u4 = await call('apply_upgrade', 'ta', smithAsk({ op: 'smith:helm-wc:l2', toLevel: 2, materials: [], coin: 999, balance: 999 }));
  eq([u4.status, u4.json.code, /metals ledger/.test(u4.json.error)], [501, 'not-implemented', true], 'upgrade: a cost row that charges coin is a 501, whatever balance the body claims');
  eq((await call('apply_upgrade', 'tb', smithAsk({ op: 'smith:helm-wc:b', account: A }))).status, 400, 'upgrade: B cannot name A\'s character or piece');
  eq([helmRow(), irons(), upgrades(), conserved()], ['1:v2:1:upgrade:smith:helm-wc:l1', 'inst:iron-b:8:v2,inst:iron-c:20:v1,inst:iron-d:6:v1', '1', '0'], 'upgrade: refusals changed nothing');
  // a second piece (one of each: the cuirass, not another helmet), bank iron: refused away from the Exchange, taken at it; two identical requests at once upgrade once
  psql(`select public.origins_commit('${A}', $j$${JSON.stringify([
    mint('inst:body-wc', 'item:loot.veteran.Body', 1, 'pack', 7, 'claim:9002', { kind: 'arena-award', claimId: 9002, lootId: 'veteran.Body', fromLegend: 'veteran-1', atRank: 'Recruit' }, { tier: 'Recruit' }),
  ])}$j$::jsonb);`);
  const secondPiece = over => smithAsk({ op: 'smith:body-wc:l1', instance: 'inst:body-wc', materials: ['inst:iron-c'], ...over });
  const away = await call('apply_upgrade', 'ta', secondPiece());
  eq([away.status, /Concord Exchange/.test(away.json.error)], [400, true], 'upgrade: bank iron is refused away from the Exchange');
  const smithRace = await Promise.all([call('apply_upgrade', 'ta', secondPiece({ place: 'exchange' })), call('apply_upgrade', 'ta', secondPiece({ place: 'exchange' }))]);
  eq([smithRace.map(r => r.status), smithRace.map(r => r.json.result?.replayed).sort()], [[200, 200], [false, true]], 'upgrade race: one upgrade, one replay');
  eq([psql(`select upgrade_level || ':v' || version || ':' || jsonb_array_length(history) from public.origins_items where id = 'inst:body-wc'`), irons(), upgrades(), conserved()],
    ['1:v2:1', 'inst:iron-b:8:v2,inst:iron-c:15:v2,inst:iron-d:6:v1', '2', '0'], 'upgrade race: upgraded and burned once, at the Exchange, conserved');
  // a third piece kept in the BANK, paid from pack iron: refused away from the Exchange (the piece itself, not its materials), upgraded in place at it
  psql(`select public.origins_commit('${A}', $j$${JSON.stringify([
    mint('inst:greaves-wc', 'item:loot.veteran.Greaves', 1, 'bank', 2, 'claim:9003', { kind: 'arena-award', claimId: 9003, lootId: 'veteran.Greaves', fromLegend: 'veteran-1', atRank: 'Recruit' }, { tier: 'Recruit' }),
  ])}$j$::jsonb);`);
  const greavesRow = () => psql(`select loc_kind || ':' || upgrade_level || ':v' || version || ':' || jsonb_array_length(history) from public.origins_items where id = 'inst:greaves-wc'`);
  const bankedPiece = over => smithAsk({ op: 'smith:greaves-wc:l1', instance: 'inst:greaves-wc', materials: ['inst:iron-d'], ...over });
  const bankedAway = await call('apply_upgrade', 'ta', bankedPiece());
  eq([bankedAway.status, /bank, which opens only at the Concord Exchange/.test(bankedAway.json.error)], [400, true], 'upgrade: a banked piece is refused away from the Exchange');
  eq([greavesRow(), irons(), upgrades(), conserved()], ['bank:0:v1:0', 'inst:iron-b:8:v2,inst:iron-c:15:v2,inst:iron-d:6:v1', '2', '0'], 'upgrade: the banked refusal changed nothing');
  const bankedAt = await call('apply_upgrade', 'ta', bankedPiece({ place: 'exchange' }));
  eq([bankedAt.status, bankedAt.json.result?.replayed, bankedAt.json.result?.receipt.materials.map(m => [m.instance, m.quantity])], [200, false, [['inst:iron-d', 5]]], 'upgrade: a banked piece is upgraded at the Exchange');
  eq([greavesRow(), irons(), upgrades(), conserved()], ['bank:1:v2:1', 'inst:iron-b:8:v2,inst:iron-c:15:v2,inst:iron-d:1:v2', '3', '0'], 'upgrade: the banked piece stays in the bank at level 1, pack iron burned, conserved');


  // Story ops (quest_advance, talk_pick): Dara (10 marks: level 11, past the outer gate) talks to Orla, takes the Concord Commission and moves it on.
  const seedD = creditFromMarks(10);
  eq((await call('open', 'td')).json.result.career.seed_credit, seedD, 'Dara: open');
  const dara = (await call('create_character', 'td', { name: 'Dara' })).json.result.id;
  const q = sql => psql(sql.replaceAll('$PC', dara));
  const credit = () => psql(`select world_credit || '|' || public.origins_total_credit('${D}') from public.origins_career where account = '${D}'`).split('|').map(Number);
  const hello = await call('talk_pick', 'td', { character: dara, npc: NPC, line: 'greet-first' });
  eq([hello.status, hello.json.result.cp], [200, 0], 'talk_pick greet-first');
  eq(q(`select array_to_string(told, ',') || '|' || flags::text from public.origins_talk where character = '$PC'`), `${NPC} greet-first|{"met-orla": true}`, 'the talk row records the once-line and its flag');
  eq(q(`select count(*) from public.origins_events where event_id = 'talk:$PC:${NPC}:greet-first' and kind = 'talk'`), '1', 'the once-line talk event');
  eq((await call('talk_pick', 'td', { character: dara, npc: NPC, line: 'greet-first' })).status, 400, 'a once-line is said once');
  eq((await call('talk_pick', 'tb', { character: dara, npc: NPC, line: 'farewell' })).status, 400, 'another account\'s character cannot talk');
  const offer = await call('talk_pick', 'td', { character: dara, npc: NPC, line: 'offer' });
  const stepCp = offer.json.result.cp;
  eq([offer.status, stepCp > 0], [200, true], 'talk_pick offer: the quest starts and its story step pays');
  eq(q(`select stage || '|' || status || '|' || array_to_string(rewarded, ',') || '|' || version from public.origins_quest_state where character = '$PC' and quest = '${CQ}'`), 'smith|active|smith|1', 'the quest row, inserted by the talk batch');
  eq(q(`select count(*) from public.origins_quest_journal where character = '$PC'`), '1', 'one journal line');
  eq(q(`select string_agg(kind, ',' order by kind) from public.origins_events where event_id in ('quest:$PC:${CQ}:smith', 'story:$PC:${CQ}:smith')`), 'quest-stage,story-step', 'the stage and story events');
  eq(credit(), [stepCp, seedD + stepCp], 'world credit booked by the same batch');
  const replay = await call('quest_advance', 'td', { character: dara, quest: CQ, stage: 'smith' });
  eq([replay.status, replay.json.result.replay, replay.json.result.cp, credit()[0]], [200, true, 0, stepCp], 'quest_advance to the stage it is at: a replay, nothing paid');
  // three racing advances to the next stage: exactly one pays, the others are a 409 or a replay
  const raced = await Promise.all([1, 2, 3].map(() => call('quest_advance', 'td', { character: dara, quest: CQ, stage: 'fetch', account: A, cp: 1e9 })));
  const paid = raced.filter(r => r.status === 200 && !r.json.result.replay);
  eq([paid.length, raced.filter(r => r !== paid[0]).every(r => r.status === 409 || r.json.result?.replay === true)], [1, true], `racing advances: one pays (${raced.map(r => r.status)})`);
  const fetchCp = paid[0].json.result.cp;
  eq([fetchCp > 0, credit()[0]], [true, stepCp + fetchCp], 'paid once across the race; the body\'s cp is ignored');
  eq(q(`select count(*) from public.origins_events where event_id like 'story:$PC:%'`), '2', 'one story event per stage');
  eq(q(`select string_agg(seq || ':' || stage, ',' order by seq) || '|' || (select version from public.origins_quest_state where character = '$PC') from public.origins_quest_journal where character = '$PC'`), '0:smith,1:fetch|2', 'journal appended in order, row at version 2');
  const again = await call('quest_advance', 'td', { character: dara, quest: CQ, stage: 'fetch' });
  eq([again.status, again.json.result.cp, credit()[0]], [200, 0, stepCp + fetchCp], 'a retry pays nothing');
  eq((await call('quest_advance', 'td', { character: dara, quest: CQ, stage: 'forge', choice: 'smith' })).status, 400, 'no ore in Dara\'s pack: refused');
  eq((await call('quest_advance', 'ta', { character: dara, quest: CQ, stage: 'forge' })).status, 400, 'another account\'s character');
  // a second character of the same account takes the same quest: its stage event is its own, the story step is paid once per account
  const dara2 = (await call('create_character', 'td', { name: 'Dara Two' })).json.result.id;
  const second = await call('quest_advance', 'td', { character: dara2, quest: CQ, stage: 'smith' });
  eq([second.status, second.json.result.cp, credit()[0]], [200, 0, stepCp + fetchCp], 'the same story step on a second character pays 0');
  eq(psql(`select payload->>'reason' from public.origins_events where event_id = 'story:${dara2}:${CQ}:smith'`), 'already-done', 'its story event says why');
  // A stage that rewards faction standing (or loot) is refused whole: nothing written, the stage stays unrewarded; the other branch finishes.
  const EQ = 'quest:orla-errand';
  eq((await call('quest_advance', 'td', { character: dara, quest: EQ, stage: 'asked' })).status, 200, 'errand taken');
  const errandRow = () => q(`select stage || '|' || array_to_string(rewarded, ',') || '|' || version || '|' || (select count(*) from public.origins_events where event_id like 'quest:$PC:${EQ}:%') || '|' || (select world_credit from public.origins_career where account = '${D}') from public.origins_quest_state where character = '$PC' and quest = '${EQ}'`);
  const beforeFavour = errandRow();
  const favour = await call('quest_advance', 'td', { character: dara, quest: EQ, stage: 'favour', choice: 'favour' });
  eq([favour.status, /faction standing/.test(favour.json.error)], [501, true], 'a standing-reward stage is refused with 501');
  eq(errandRow(), beforeFavour, 'nothing written: still at asked, favour not rewarded, no event, no credit');
  const finished = await call('quest_advance', 'td', { character: dara, quest: EQ, stage: 'done', choice: 'thanks' });
  eq([finished.status, finished.json.result.status, finished.json.result.cp > fetchCp], [200, 'finished', true], 'the other branch finishes and pays the chapter');
  // a writer started without content answers 503 for both ops and writes nothing
  const bare = createWriter({ db: psqlDb(`postgresql://frankendom_origins@/postgres?host=${root}`, pg('psql')), verify: async t => TOKENS[t] ?? null });
  await new Promise(r => bare.listen(0, '127.0.0.1', r));
  try {
    const events = psql(`select count(*) from public.origins_events`);
    for (const [op, body] of [['quest_advance', { character: dara, quest: EQ, stage: 'asked' }], ['talk_pick', { character: dara, npc: NPC, line: 'farewell' }]]) {
      const res = await globalThis.fetch(`http://127.0.0.1:${bare.address().port}/origins/${op}`, { method: 'POST', headers: { authorization: 'Bearer td' }, body: JSON.stringify(body) });
      eq(res.status, 503, `no content: ${op} is not ready`);
    }
    eq(psql(`select count(*) from public.origins_events`), events, 'no content: nothing written');
  } finally { bare.close(); }
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
  // retiring a pack row (a whole-stack burn nulls loc_kind) is not an escrow move: 0003's guard compared with '=' and refused it
  const pcId = made.json.result.id, key = 'loot:wc:guard';
  psql(`select public.origins_commit('${A}', $j$${JSON.stringify([{ op: 'mint', item: { id: 'inst:guard-ore', item: 'item:exchange-ore', quantity: 2, mint_key: key,
    loc: { kind: 'pack', owner: pcId, index: 9 }, provenance: { mintKey: key, at: '2026-10-07T00:00:00Z', wonBy: pcId, kind: 'loot', table: 'loottable:ghoul', encounter: 'encounter:ruin-vigil' } } }])}$j$::jsonb);`);
  psql(`select public.origins_commit('${A}', $j$[{"op":"burn","id":"inst:guard-ore","count":2,"expected_version":1}]$j$::jsonb);`);
  eq(psql(`select retire_reason || ':' || coalesce(loc_kind, 'null') from public.origins_items where id = 'inst:guard-ore'`), 'burn:null', 'escrow guard: a whole-stack burn of a pack row retires it');
  console.log(`origins-writer-check: ${checks} checks passed`);
} finally {
  server?.close();
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
