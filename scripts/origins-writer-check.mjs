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
import { handlers, storyOps } from '../origins/server/handlers.ts';
import { readStoryContent } from '../origins/server/content.ts';
import { storyBundle } from '../origins/server/fixtures.ts';
import { creditFromMarks } from '../origins/progression/model.ts';


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

  writeFileSync(join(root, 'content.json'), JSON.stringify(storyBundle()));
  server = createWriter({ db: psqlDb(`postgresql://frankendom_origins@/postgres?host=${root}`, pg('psql')), verify: async t => TOKENS[t] ?? null,
    handlers: { ...handlers, ...storyOps(readStoryContent(join(root, 'content.json'))) } });
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
  console.log(`origins-writer-check: ${checks} checks passed`);
} finally {
  server?.close();
  if (started) try { run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', 'stop']); } catch { /* already down */ }
  rmSync(root, { recursive: true, force: true });
}
