import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { OPPONENTS } from '../src/moves.ts';
import { idleIntent } from '../src/duel.ts';
import { createRecorder, encodeRecord, type FightRecord } from '../src/record.ts';
import { psqlAdapter, restAdapter, verifyPending } from '../scripts/verify-daily.mjs';

const SEED = 20260922, DAY = '2026-09-22';

// A real daily fight: the Veteran at normal on the day's seed, the fighter walking in with his guard down until the warden kills him.
async function dailyRecord(): Promise<{ record: FightRecord; text: string }> {
  const rec = createRecorder({ weapon: 'longsword', build: 'test', opponent: 'veteran', profile: 'normal', seed: SEED });
  let practice = initialPractice(SEED, OPPONENTS.veteran);
  const walkIn = { ...idleIntent(), move: { x: 0, z: 0.8, yaw: 0, run: false } };
  for (let t = 0; t < 20000 && !practice.finish; t++) practice = stepPractice(practice, rec.push(walkIn), OPPONENTS.veteran.profiles.normal);
  assert.ok(practice.finish, 'the warden finishes a fighter who walks in guard down');
  const record = rec.finish(practice.finish.victim === 1 ? 'killed' : 'died');
  return { record, text: await encodeRecord(record) };
}

type Row = { day: string; user_id: string; opponent: string; weapon: string; outcome: string; ticks: number; record: string };

// Supabase REST as the sweep sees it: one page of unverified rows, daily_fight() per day, PATCH per verified row.
function fakeSupabase(rows: Row[], seed = SEED, recheckWanted = false) {
  const patched: string[] = [], calls: string[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    calls.push(`${method} ${url.replace(/\?.*$/, '')}`);
    assert.equal((init?.headers as Record<string, string>).apikey, 'service-key', 'every call carries the service key');
    if (url.includes('/rpc/daily_fight')) {
      assert.equal(JSON.parse(String(init?.body)).on_day, DAY);
      return Response.json([{ day: DAY, number: 0, seed: seed | 0 }]);   // the database hands out the signed 32-bit hash
    }
    if (method === 'PATCH') { patched.push(`${url.replace(/^.*user_id=eq\./, '')} ${Object.keys(JSON.parse(String(init?.body))).join(',')}`); return new Response(null, { status: 204 }); }
    assert.match(url, /verified=eq\.false/, 'only unverified rows are read');
    assert.equal(/checked_at=is\.null/.test(url), !recheckWanted, 'a plain sweep skips rows already checked; --recheck takes them all');
    return Response.json(rows);
  }) as unknown as typeof fetch;
  return { fetchFn, patched, calls };
}

test('a genuine daily record is replayed and marked verified; the seed is fetched once per day', async () => {
  const { record, text } = await dailyRecord();
  const row: Row = { day: DAY, user_id: 'u1', opponent: 'veteran', weapon: 'longsword', outcome: record.outcome, ticks: record.ticks, record: text };
  const db = fakeSupabase([row, { ...row, user_id: 'u2' }]);
  const receipt = await verifyPending(restAdapter({ url: 'https://x.supabase.co/', key: 'service-key' }, db.fetchFn));
  assert.deepEqual({ checked: receipt.checked, verified: receipt.verified, refused: receipt.refused }, { checked: 2, verified: 2, refused: [] });
  assert.deepEqual(db.patched, ['u1 verified,checked_at', 'u2 verified,checked_at']);
  assert.equal(db.calls.filter(c => c.includes('daily_fight')).length, 1, 'the seed is cached per day');
});

test('a row that lies about its outcome, seed, opponent or record stays unverified with a reason; --dry writes nothing', async () => {
  const { record, text } = await dailyRecord();
  const good: Row = { day: DAY, user_id: 'ok', opponent: 'veteran', weapon: 'longsword', outcome: record.outcome, ticks: record.ticks, record: text };
  const rows: Row[] = [
    { ...good, user_id: 'outcome', outcome: record.outcome === 'died' ? 'killed' : 'died' },
    { ...good, user_id: 'opponent', opponent: 'goblin' },
    { ...good, user_id: 'ticks', ticks: record.ticks + 1 },
    { ...good, user_id: 'garbage', record: 'AAAA' },
    { ...good, user_id: 'forged', record: await encodeRecord({ ...record, intents: record.intents.map(() => idleIntent()) }) },   // right meta, a fight that never happened
    good,
  ];
  const db = fakeSupabase(rows);
  const receipt = await verifyPending(restAdapter({ url: 'https://x.supabase.co', key: 'service-key' }, db.fetchFn));
  assert.equal(receipt.verified, 1);
  assert.deepEqual(receipt.refused.map(r => r.user_id), ['outcome', 'opponent', 'ticks', 'garbage', 'forged']);
  assert.match(receipt.refused[0]!.reason, /outcome/);
  assert.match(receipt.refused[3]!.reason, /undecodable/);
  assert.match(receipt.refused[4]!.reason, /does not reach its finish/);
  assert.deepEqual(db.patched, ['outcome checked_at', 'opponent checked_at', 'ticks checked_at', 'garbage checked_at', 'forged checked_at', 'ok verified,checked_at'], 'refused rows are stamped checked_at so the next sweep moves past them');

  const wrongDay = fakeSupabase([good], SEED + 1);   // the day's seed is not the record's: a fight from another day or a forged seed
  const stale = await verifyPending(restAdapter({ url: 'https://x.supabase.co', key: 'service-key' }, wrongDay.fetchFn));
  assert.equal(stale.verified, 0);
  assert.match(stale.refused[0]!.reason, /warden seed/);

  const dry = fakeSupabase([good], SEED, true);
  const dryReceipt = await verifyPending(restAdapter({ url: 'https://x.supabase.co', key: 'service-key' }, dry.fetchFn), { dry: true, recheck: true });
  assert.equal(dryReceipt.verified, 1);
  assert.equal(dry.patched.length, 0, '--dry replays but never writes');
});

test('the psql adapter issues the three statements as the verifier role and refuses malformed keys', async () => {
  const { record, text } = await dailyRecord();
  const statements: string[] = [];
  const run = ((_cmd: string, args: string[]) => {
    const statement = args[args.length - 1]!, url = args[0];
    statements.push(statement);
    assert.equal(url, 'postgres://verifier@db/postgres');
    if (statement.startsWith('select coalesce(json_agg')) return { status: 0, stdout: JSON.stringify([{ day: DAY, user_id: '11111111-2222-3333-4444-555555555555', opponent: 'veteran', weapon: 'longsword', outcome: record.outcome, ticks: record.ticks, record: text }]), stderr: '' };
    if (statement.startsWith('select seed from public.daily_fight')) return { status: 0, stdout: `${SEED | 0}\n`, stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  }) as unknown as typeof import('node:child_process').spawnSync;
  const receipt = await verifyPending(psqlAdapter('postgres://verifier@db/postgres', run));
  assert.deepEqual({ verified: receipt.verified, refused: receipt.refused }, { verified: 1, refused: [] });
  assert.match(statements[1]!, /daily_fight\(date '2026-09-22'\)/);
  assert.match(statements[0]!, /where not verified and checked_at is null order by created_at asc limit 200/);
  assert.match(statements[2]!, /^update public\.daily_results set verified = true, checked_at = now\(\) where day = date '2026-09-22' and user_id = '11111111-2222-3333-4444-555555555555'$/);
  await psqlAdapter('postgres://verifier@db/postgres', run).refuse(DAY, '11111111-2222-3333-4444-555555555555');
  assert.match(statements[3]!, /^update public\.daily_results set checked_at = now\(\) where day = date '2026-09-22'/);
  await assert.rejects(psqlAdapter('postgres://verifier@db/postgres', run).verify("2026-09-22'; drop table x; --", 'u'), /malformed day/);
});
