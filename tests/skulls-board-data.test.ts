// The kills board's and rankings board's DATA (src/pit/skulls.ts), kept when the walkable Pit room and its renderers were removed: the pit_record and
// daily_board_summary mappings, the loot fallback, the fetches that never throw, the live feed's races, the demo sets. These tests were
// tests/pit-board.test.ts and tests/pit-champions.test.ts; the room-drawing halves of those files went with the room.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFeed, blankRecord, demoKills, demoRecord, fetchKills, fetchRecord, killsFromLoot, localRecord, lootKills, recordFromRows, splitOf, NO_CHAMPIONS, boardName, championLine, championsFromSummary, demoChampions, fetchChampions, type SkullDb } from '../src/pit/skulls.ts';
import type { Loot } from '../src/loot.ts';

const loot = (extra: object): Loot => ({ owned: [], equipped: {}, ...extra }) as Loot;
const prov = (opponent: string, tier?: number, day = '2026-10-01') => ({ opponent, attempt: 1, healthLeft: 1, recordId: null, day, ...(tier ? { tier } : {}) });
const db = (reply: () => PromiseLike<{ data: unknown; error: unknown }>): SkullDb => ({ rpc: reply });
const full = {
  day: '2026-10-04',
  fastest_kill: { display_name: 'Wanderer', ticks: 852, verified: true, outcome: 'killed' },
  cleanest_kill: { display_name: 'Ivy', taken: 1, verified: true },
  longest_survived: { display_name: 'Marcus', ticks: 4310, verified: false },
  fastest_death: { display_name: 'Dunmore', ticks: 410, verified: true },
  where: { gate: 3, pit: 3, wall: 1 }, pending: 4,
};

test('recordFromRows: one row, or an array of one; the split of the kills handed in; bad shapes are null', () => {
  const r = recordFromRows([{ wins: 12, losses: 3, draws: 1, streak: 4, highest_rank: 7 }], demoKills());
  assert.deepEqual(r, { kills: 12, wins: 12, losses: 3, streak: 4, highestRank: 7, computerKills: 8, duelKills: 4 });
  assert.deepEqual(recordFromRows({ wins: 0, losses: 0, streak: 0, highest_rank: null })!.highestRank, null);
  assert.equal(recordFromRows({ wins: 0, losses: 0, streak: 0, highest_rank: null })!.streak, 0);
  assert.equal(recordFromRows({ wins: 2, losses: 1, streak: -1, highest_rank: 99 })!.highestRank, null);
  for (const bad of [undefined, null, 'x', 5, [], [null], [{ wins: 'x', losses: 1 }], [{ wins: 1 }]]) assert.equal(recordFromRows(bad), null);
});

test('localRecord: kills = takes, refusals and uncovered defeats; wins = the marks passed in; the rest unknown; highest rank from the tiers', () => {
  const l = loot({ taken: { 'dwarf.Axe': prov('dwarf', 4) }, declined: [prov('witch', 9), prov('pitborn')], defeats: ['dwarf-4', 'knight-2'] });
  assert.deepEqual(localRecord(l, 121), { kills: 4, wins: 121, losses: null, streak: null, highestRank: 9, computerKills: 4, duelKills: 0 });
  assert.deepEqual(localRecord(undefined, null), { ...blankRecord(), kills: 0, computerKills: 0, duelKills: 0 });
  assert.equal(localRecord(l, -5).wins, null);
  assert.equal(localRecord(loot({ declined: [prov('goblin')] }), 3).highestRank, null);
  const many = loot({ declined: Array.from({ length: 33 }, () => prov('witch', 2)) });
  assert.equal(localRecord(many, 40).kills, 33, 'the count is not capped at the 30 niches');
  assert.equal(localRecord(many, 40).computerKills, 30, 'the split is of the latest 30');
});

test('fetchRecord never throws: no db, error, throw, rejection, bad row, an empty record while the fallback has kills: local; else the rpc row', async () => {
  const local = localRecord(loot({ declined: [prov('witch', 2)] }), 5);
  assert.equal(await fetchRecord(null, local), local); assert.equal(await fetchRecord(undefined, local), local);
  assert.equal(await fetchRecord(db(async () => ({ data: [], error: { message: 'denied' } })), local), local);
  assert.equal(await fetchRecord(db(() => { throw new Error('boom'); }), local), local);
  assert.equal(await fetchRecord(db(() => Promise.reject(new Error('offline'))), local), local);
  assert.equal(await fetchRecord(db(async () => ({ data: [], error: null })), local), local);
  assert.equal(await fetchRecord(db(async () => ({ data: [{ wins: 'x' }], error: null })), local), local);
  assert.equal(await fetchRecord(db(async () => ({ data: [{ wins: 0, losses: 0, draws: 0, streak: 0, highest_rank: null }], error: null })), local), local);
  const row = [{ wins: 9, losses: 2, draws: 0, streak: 3, highest_rank: 5 }];
  assert.deepEqual(await fetchRecord(db(async () => ({ data: row, error: null })), local, demoKills()), { kills: 9, wins: 9, losses: 2, streak: 3, highestRank: 5, computerKills: 8, duelKills: 4 });
  assert.equal((await fetchRecord(db(async () => ({ data: [{ wins: 0, losses: 0, streak: 0, highest_rank: null }], error: null })), blankRecord())).wins, 0, 'a new fighter with no fallback: the real zeros');
});

test('demoRecord is deterministic and consistent with demoKills', () => {
  assert.deepEqual(demoRecord(), demoRecord());
  const r = demoRecord();
  assert.deepEqual([r.computerKills, r.duelKills], [8, 4]);
  assert.deepEqual(splitOf(demoKills()), { computerKills: 8, duelKills: 4 });
  assert.ok(r.kills! > 30 && r.wins! >= 30 && r.highestRank! >= 1 && r.highestRank! <= 10);
});

test('fetchRecord: Kills = server wins + loot kills no server row covers (29+1 = 30, same legend = 29, rematch x3 = 3)', async () => {
  const taken = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [`k${i}`, { opponent: `o${i}`, attempt: 1, healthLeft: 1, recordId: null, day: '2026-09-01', tier: 1 }]));
  const l = loot({ taken }), one = loot({ declined: [prov('witch', 2)] });
  const row = (n: number) => db(async () => ({ data: [{ wins: n, losses: 0, streak: n, highest_rank: 1 }], error: null }));
  const rows = (...keys: string[]) => keys.map((k) => ({ kind: 'ai', opponent_key: k, opponent_name: 'X', opponent_level: 1, opponent_gear: {}, created_at: '2026-10-05T00:00:00Z' }));
  const run = async (loo: Loot, wins: number, keys: string[]) => {
    const seen = new Set<string>(), merged = await fetchKills({ rpc: async () => ({ data: rows(...keys), error: null }) }, killsFromLoot(loo), seen);
    return { skulls: merged.length, kills: (await fetchRecord(row(wins), localRecord(loo, 29), merged, lootKills(loo), seen)).kills };
  };
  assert.deepEqual(await run(l, 1, ['new-1']), { skulls: 30, kills: 30 });
  assert.deepEqual(await run(l, 1, ['o3-1']), { skulls: 29, kills: 29 });
  assert.deepEqual(await run(one, 3, ['witch-2', 'witch-2', 'witch-2']), { skulls: 3, kills: 3 }, 'a rematch: three server wins over one loot legend');
});

test('createFeed: pit_record answering before pit_recent_kills still waits for the kills (10 wins over 10 loot legends is Kills 10, not 20)', async () => {
  const taken = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, { opponent: `o${i}`, attempt: 1, healthLeft: 1, recordId: null, day: '2026-09-01', tier: 1 }]));
  let release: () => void = () => undefined;
  const slow = new Promise<void>((r) => { release = r; });
  const rows = Array.from({ length: 10 }, (_, i) => ({ kind: 'ai', opponent_key: `o${i}-1`, opponent_name: 'X', opponent_level: 1, opponent_gear: {}, created_at: '2026-10-05T00:00:00Z' }));
  let user: string | null = 'u1';
  const feed = createFeed({
    db: () => ({ rpc: async (name: string) => (name === 'pit_record' ? { data: [{ wins: 10, losses: 0, streak: 1, highest_rank: 1 }], error: null } : (await slow, { data: rows, error: null })) }),
    userId: () => user, loot: () => loot({ taken }), marks: () => 10,
  });
  const kills = feed.kills(), record = feed.record();   // the room fires both; the record's RPC would answer first
  release();
  assert.equal((await record).kills, 10); assert.equal((await kills).length, 10);
  user = null;
  assert.equal(feed.recordNow().wins, 10, 'sign-out: the fallback record, not the last fighter\'s');
  assert.equal(feed.recordNow().losses, null);
});

test('createFeed races: a slow kills refetch does not empty the live key set (N3); a record that lands after a user change is dropped (N4)', async () => {
  const taken = Object.fromEntries(Array.from({ length: 3 }, (_, i) => [`k${i}`, { opponent: `o${i}`, attempt: 1, healthLeft: 1, recordId: null, day: '2026-09-01', tier: 1 }]));
  const rows = Array.from({ length: 3 }, (_, i) => ({ kind: 'ai', opponent_key: `o${i}-1`, opponent_name: 'X', opponent_level: 1, opponent_gear: {}, created_at: '2026-10-05T00:00:00Z' }));
  let hold: Promise<void> | null = null, recordHold: Promise<void> | null = null, user: string | null = 'u1';
  const feed = createFeed({
    db: () => ({ rpc: async (name: string) => (name === 'pit_record' ? (await recordHold, { data: [{ wins: 3, losses: 0, streak: 1, highest_rank: 1 }], error: null }) : (await hold, { data: rows, error: null })) }),
    userId: () => user, loot: () => loot({ taken }), marks: () => 3,
  });
  await feed.kills();
  let release: () => void = () => undefined;
  hold = new Promise<void>((r) => { release = r; });
  let go: () => void = () => undefined;
  recordHold = new Promise<void>((r) => { go = r; });
  const inFlightRecord = feed.record();               // fired, its pit_record RPC pending
  const refetch = feed.kills();                       // a slow refetch starts: it must not empty the key set the pending record is about to read
  go();
  assert.equal((await inFlightRecord).kills, 3, 'wins 3 over 3 loot legends, the old keys intact: 3, not 6');
  release(); await refetch; recordHold = null;
  recordHold = new Promise<void>((r) => { go = r; });
  const late = feed.record();
  user = 'u2'; go();
  assert.equal((await late).losses, null, 'u1\'s record lands after the switch to u2: the fallback, not theirs');
  assert.equal(feed.recordNow().losses, null, 'and it is not cached');
});

test('createFeed: a refetch that answers with zero rows clears the old keys (a failed one keeps them)', async () => {
  const taken = { k0: { opponent: 'o0', attempt: 1, healthLeft: 1, recordId: null, day: '2026-09-01', tier: 1 } };
  const row = { kind: 'ai', opponent_key: 'o0-1', opponent_name: 'X', opponent_level: 1, opponent_gear: {}, created_at: '2026-10-05T00:00:00Z' };
  let kills: { data: unknown; error: unknown } = { data: [row, row], error: null };
  const feed = createFeed({
    db: () => ({ rpc: async (name: string) => (name === 'pit_record' ? { data: [{ wins: 2, losses: 0, streak: 1, highest_rank: 1 }], error: null } : kills) }),
    userId: () => 'u1', loot: () => loot({ taken }), marks: () => 2,
  });
  await feed.kills();
  assert.equal((await feed.record()).kills, 2, 'two server wins over the one loot legend');
  kills = { data: [], error: { message: 'offline' } };
  await feed.kills();
  assert.equal((await feed.record()).kills, 2, 'a failed refetch keeps the keys');
  kills = { data: [], error: null };
  await feed.kills();
  assert.equal((await feed.record()).kills, 3, 'an answered empty refetch clears them: 2 wins + the loot legend no server row covers');
});

test('five lines in the summary\'s order: feat, name, value; seconds to one decimal, hits, the deadliest spot', () => {
  const lines = championsFromSummary(full);
  assert.deepEqual(lines.map((c) => c.key), ['fastestKill', 'cleanestKill', 'longestSurvived', 'fastestDeath', 'where']);
  assert.deepEqual(lines.map(championLine), ['Fastest kill  Wanderer  14.2 s', 'Cleanest kill  Ivy  1 hit', 'Longest survived  Marcus*  71.8 s', 'Fastest death  Dunmore  6.8 s', 'Deadliest spot  gate  3 deaths']);
  assert.equal(lines[2]!.verified, false, 'an unverified row is starred');
});
test('no location split: the unverified count is the fifth line; neither: four lines at most', () => {
  const noWhere = championsFromSummary({ ...full, where: null });
  assert.equal(championLine(noWhere[4]!), 'Pending  4 unverified today');
  assert.equal(championsFromSummary({ ...full, where: {}, pending: 0 }).length, 4);
});
test('an empty or malformed day gives no lines, and never throws', () => {
  const empty = { day: '2026-10-04', fastest_kill: null, cleanest_kill: null, longest_survived: null, fastest_death: null, where: null, pending: 0 };
  for (const v of [empty, null, undefined, 7, 'x', [], {}, { fastest_kill: 'no' }, { fastest_kill: { ticks: 'fast' } }, { fastest_kill: { ticks: -5 } }, { where: { a: 'x' } }, { where: [1] }, { pending: 'many' }]) assert.deepEqual(championsFromSummary(v), []);
  assert.equal(NO_CHAMPIONS, 'No champions yet today.');
});
test('the rpc may hand the object bare, in an array of one, or as JSON text', () => {
  const want = championsFromSummary(full);
  assert.deepEqual(championsFromSummary([full]), want);
  assert.deepEqual(championsFromSummary(JSON.stringify(full)), want);
  assert.deepEqual(championsFromSummary('{not json'), []);
});
test('names: control characters out, 16 characters, a fallback when nothing is left', () => {
  assert.equal(boardName('A\u0000B\u202e\nC'), 'A B C', 'a bidi override cannot flip the board');
  assert.equal(boardName('A\u0007B\tC'), 'A B C');
  assert.equal(boardName('abcdefghijklmnopqrstuvwxyz'), 'abcdefghijklmnop');
  assert.equal(boardName('   '), 'Fighter');
  assert.equal(boardName(42), 'Fighter');
  assert.equal(championsFromSummary({ fastest_kill: { ticks: 60, verified: true } })[0]!.name, 'Fighter');
  assert.equal(championsFromSummary({ fastest_kill: { display_name: 'abcdefghijklmnopqrstuvwxyz', ticks: 60, verified: false } })[0]!.name, 'abcdefghijklmnop*');
});
test('fetchChampions: a guest, an rpc error and a throw all leave an empty board; the right rpc is called', async () => {
  assert.deepEqual(await fetchChampions(undefined), []);
  assert.deepEqual(await fetchChampions(null), []);
  const calls: string[] = [];
  const ok: SkullDb = { rpc: (name) => { calls.push(name); return Promise.resolve({ data: full, error: null }); } };
  assert.equal((await fetchChampions(ok)).length, 5);
  assert.deepEqual(calls, ['daily_board_summary']);
  assert.deepEqual(await fetchChampions({ rpc: () => Promise.resolve({ data: full, error: { message: 'no' } }) }), []);
  assert.deepEqual(await fetchChampions({ rpc: () => { throw new Error('offline'); } }), []);
  assert.deepEqual(await fetchChampions({ rpc: () => Promise.reject(new Error('offline')) }), []);
});
test('the demo day: five lines, one starred', () => {
  const lines = demoChampions();
  assert.equal(lines.length, 5);
  assert.equal(lines.filter((c) => c.name.endsWith('*')).length, 1);
  assert.deepEqual(demoChampions(), demoChampions());
});
