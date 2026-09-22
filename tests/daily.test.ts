import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LADDER } from '../src/ladder.ts';
import { createRecorder, decodeRecord } from '../src/record.ts';
import { dailyBoard, dailyOpponent, dailyParam, dailyShareText, fetchDaily, fetchDailySummary, loadDaily, postDaily, saveDaily, type DailyRow, type DailySummary } from '../src/daily.ts';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
const answer = (status: number, body: unknown, calls: { url: string; init?: RequestInit }[] = []) => (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init }); return { ok: status < 300, status, json: async () => body } as Response; }) as typeof fetch;
const row = (over: Partial<DailyRow>): DailyRow => ({ day: '2026-09-22', number: 0, opponent: 'veteran', weapon: 'longsword', outcome: 'died', ticks: 1200, location: 'torso', taken: 3, verified: true, display_name: 'A', ...over });

test('daily: the day rotates the live ladder by its number, forwards and backwards, and the flag is read only as ?daily=1', () => {
  const n = LADDER.length;
  assert.equal(dailyOpponent({ day: 'd', number: 0, seed: 1 }, LADDER).id, LADDER[0].id);
  assert.equal(dailyOpponent({ day: 'd', number: n + 2, seed: 1 }, LADDER).id, LADDER[2].id);
  assert.equal(dailyOpponent({ day: 'd', number: -1, seed: 1 }, LADDER).id, LADDER[n - 1].id, 'a day before the epoch still names a rung');
  assert.equal(dailyParam('?daily=1'), true); assert.equal(dailyParam('?opponent=goblin&daily=1'), true);
  assert.equal(dailyParam('?daily=12'), false); assert.equal(dailyParam('?daily=1x'), false); assert.equal(dailyParam(''), false);
});

test('daily: the device remembers today only — a spent attempt, a posted result — and forgets it on another day or unreadable storage', () => {
  const storage = memory();
  assert.deepEqual(loadDaily(storage, '2026-09-22'), { day: '2026-09-22', started: false, submitted: false });
  saveDaily(storage, { day: '2026-09-22', started: true, submitted: false });
  assert.deepEqual(loadDaily(storage, '2026-09-22'), { day: '2026-09-22', started: true, submitted: false }, 'the attempt is spent the moment the fight starts');
  saveDaily(storage, { day: '2026-09-22', started: true, submitted: true, outcome: 'died', ticks: 1500 });
  assert.deepEqual(loadDaily(storage, '2026-09-22'), { day: '2026-09-22', started: true, submitted: true, outcome: 'died', ticks: 1500 });
  assert.deepEqual(loadDaily(storage, '2026-09-23'), { day: '2026-09-23', started: false, submitted: false }, 'tomorrow is a fresh day');
  storage.setItem('frankendom.daily.v1', '{broken'); assert.deepEqual(loadDaily(storage, '2026-09-22'), { day: '2026-09-22', started: false, submitted: false });
  const blocked = { getItem: () => { throw Error('no'); }, setItem: () => { throw Error('no'); } };
  assert.deepEqual(loadDaily(blocked, '2026-09-22'), { day: '2026-09-22', started: false, submitted: false }); assert.equal(saveDaily(blocked, { day: 'x', started: true, submitted: false }), false);
});

test('daily: today\'s fight is asked from the server with the public key and read only when whole; the signed hash becomes the warden\'s unsigned seed', async () => {
  const api = { url: 'https://x.supabase.co', key: 'pk' }, calls: { url: string; init?: RequestInit }[] = [];
  const fight = await fetchDaily(api, answer(200, [{ day: '2026-09-22', number: 0, seed: -5 }], calls));
  assert.deepEqual(fight, { day: '2026-09-22', number: 0, seed: 4294967291 });
  assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/rpc/daily_fight'); assert.equal(calls[0].init?.method, 'POST'); assert.equal((calls[0].init?.headers as Record<string, string>).apikey, 'pk');
  assert.deepEqual(await fetchDaily(api, answer(200, { day: '2026-09-23', number: 1, seed: 7 })), { day: '2026-09-23', number: 1, seed: 7 }, 'a single-object answer reads too');
  await assert.rejects(fetchDaily(api, answer(200, [{ day: '2026-09-22', number: 0, seed: null }])), /no daily warden today/, 'no secret → no seed → no daily');
  await assert.rejects(fetchDaily(api, answer(200, [{ day: 'tomorrow', number: 0, seed: 1 }])), /no daily warden today/);
  await assert.rejects(fetchDaily(api, answer(500, null)), /answered 500/);
  // The board is one RPC over every row of the day — the client sends the day and never pages or ranks rows itself (a page of 200
  // hid the 201st poster; ranking locally let a pending row lead). A headline that isn't a whole row reads as empty, not as a crash.
  const summary = await fetchDailySummary(api, '2026-09-22', answer(200, { day: '2026-09-22', fastest_kill: row({ outcome: 'killed', ticks: 800 }), cleanest_kill: { junk: true }, longest_survived: null, fastest_death: row({}), where: { head: 2, legs: 'x' }, pending: 3 }, calls));
  assert.equal(calls[1].url, 'https://x.supabase.co/rest/v1/rpc/daily_board_summary'); assert.equal(calls[1].init?.method, 'POST'); assert.equal(calls[1].init?.body, JSON.stringify({ on_day: '2026-09-22' }));
  assert.equal(summary.fastest_kill?.ticks, 800); assert.equal(summary.cleanest_kill, null, 'a malformed headline reads as empty'); assert.equal(summary.longest_survived, null); assert.equal(summary.fastest_death?.outcome, 'died');
  assert.deepEqual(summary.where, { head: 2 }, 'only whole counts are kept'); assert.equal(summary.pending, 3);
  assert.deepEqual(await fetchDailySummary(api, '2026-09-22', answer(200, [{ fastest_kill: null }])), { fastest_kill: null, cleanest_kill: null, longest_survived: null, fastest_death: null, where: {}, pending: 0 }, 'an array-wrapped or sparse answer reads too');
  await assert.rejects(fetchDailySummary(api, 'not-a-day', answer(200, {})), /not a day/);
  await assert.rejects(fetchDailySummary(api, '2026-09-22', answer(200, null)), /no daily board/);
  await assert.rejects(fetchDailySummary(api, '2026-09-22', answer(503, null)), /answered 503/);
});

test('daily: the one post carries the record and the board facts; a second post the same day is refused by the primary key', async () => {
  const rec = createRecorder({ weapon: 'longsword', build: 'dev', opponent: 'veteran', profile: 'normal', seed: 9 });
  for (let i = 0; i < 30; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
  const record = rec.finish('died'), inserts: Record<string, unknown>[] = [], answers: ({ code?: string; message?: string } | null)[] = [null, { code: '23505' }];
  const db = { from: (table: string) => ({ insert: async (r: Record<string, unknown>) => { assert.equal(table, 'daily_results'); inserts.push(r); return { error: answers.shift() ?? null }; } }) } as unknown as SupabaseClient;
  await postDaily(db, 'user-1', { day: '2026-09-22', number: 0, seed: 9 }, record, 'torso', 4);
  assert.deepEqual(Object.keys(inserts[0]).sort(), ['day', 'location', 'number', 'opponent', 'outcome', 'record', 'taken', 'ticks', 'user_id', 'weapon']);
  assert.equal(inserts[0].outcome, 'died'); assert.equal(inserts[0].ticks, 30); assert.equal(inserts[0].taken, 4); assert.equal(inserts[0].location, 'torso'); assert.equal(inserts[0].day, '2026-09-22');
  assert.deepEqual(await decodeRecord(inserts[0].record as string), record);
  await assert.rejects(postDaily(db, 'user-1', { day: '2026-09-22', number: 0, seed: 9 }, record, null, 0), /already posted/);
});

test('daily: the board\'s five lines are the server\'s headlines as given (the ranking is the server\'s), the biggest location count is named, empty lines say nothing; the share text is the day, the squares and the result', () => {
  const s: DailySummary = { fastest_kill: row({ outcome: 'killed', ticks: 900, taken: 2, display_name: 'A' }), cleanest_kill: row({ outcome: 'killed', ticks: 900, taken: 5, display_name: 'B', verified: false }), longest_survived: row({ outcome: 'died', ticks: 3000, display_name: 'C' }), fastest_death: row({ outcome: 'died', ticks: 600, display_name: 'D' }), where: { head: 2, legs: 1 }, pending: 1 };
  const board = dailyBoard(s);
  assert.deepEqual(board.map(b => [b.title, b.row?.display_name ?? null]), [['Fastest kill', 'A'], ['Cleanest kill', 'B'], ['Longest survived', 'C'], ['Fastest death', 'D'], ['Where he killed people: head (2)', null]]);
  assert.equal(board[1].row?.verified, false, 'a pending row the server let lead is passed through as pending, for the client to grey');
  assert.deepEqual(dailyBoard({ fastest_kill: null, cleanest_kill: null, longest_survived: null, fastest_death: null, where: {}, pending: 0 }).map(b => [b.title, b.row]), [['Fastest kill', null], ['Cleanest kill', null], ['Longest survived', null], ['Fastest death', null], ['Where he killed people', null]]);
  assert.equal(dailyShareText({ day: '2026-09-22', number: 3, seed: 1 }, 'the Veteran', 'died', 1500, 'https://frankendom.com/?opponent=veteran&r=Ab3_-9xZ'), 'Frankendom Daily #3 · the Veteran\n🟩🟩🟥 fell at 25.0 s\nhttps://frankendom.com/?opponent=veteran&r=Ab3_-9xZ');
  assert.equal(dailyShareText({ day: 'd', number: 0, seed: 1 }, 'the Goblin', 'killed', 300, null), 'Frankendom Daily #0 · the Goblin\n🟨 killed him in 5.0 s');
  assert.equal(dailyShareText({ day: 'd', number: 0, seed: 1 }, 'the Goblin', 'abandoned', 0, null), 'Frankendom Daily #0 · the Goblin\n⬛ walked away');
});
