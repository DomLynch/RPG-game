// The record board's pure parts (src/pit/skulls.ts record data, src/pit/board.ts layout): the rpc mapping, the loot fallback, fetchRecord that never throws,
// the demo record, the tally layout and the board's build with no canvas available.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { contrast, luminance } from '../src/pit/contrast.ts';
import { BOARD, SLAB, buildBoard, paintRecord, recordLines, recordTexture, tallyGroups } from '../src/pit/board.ts';
import { createFeed, blankRecord, demoKills, demoRecord, fetchKills, fetchRecord, killsFromLoot, localRecord, lootKills, recordFromRows, splitOf, type SkullDb } from '../src/pit/skulls.ts';
import type { Loot } from '../src/loot.ts';

const loot = (extra: object): Loot => ({ owned: [], equipped: {}, ...extra }) as Loot;
const prov = (opponent: string, tier?: number, day = '2026-10-01') => ({ opponent, attempt: 1, healthLeft: 1, recordId: null, day, ...(tier ? { tier } : {}) });
const db = (reply: () => PromiseLike<{ data: unknown; error: unknown }>): SkullDb => ({ rpc: reply });

test('tallyGroups: groups of five, a remainder, capped at 30 marks with the rest counted', () => {
  assert.deepEqual(tallyGroups(0), { fives: 0, rest: 0, more: 0 });
  assert.deepEqual(tallyGroups(null), { fives: 0, rest: 0, more: 0 });
  assert.deepEqual(tallyGroups(4), { fives: 0, rest: 4, more: 0 });
  assert.deepEqual(tallyGroups(13), { fives: 2, rest: 3, more: 0 });
  assert.deepEqual(tallyGroups(30), { fives: 6, rest: 0, more: 0 });
  assert.deepEqual(tallyGroups(73), { fives: 6, rest: 0, more: 43 });
  assert.deepEqual(tallyGroups(-3), { fives: 0, rest: 0, more: 0 });
});

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

test('recordLines: the numbers as lines, an em dash for unknowns', () => {
  assert.deepEqual(recordLines(blankRecord()), ['Kills: —', 'Wins: — · Losses: —', 'Win streak: —', 'Highest rank beaten: —']);
  assert.deepEqual(recordLines(demoRecord())[1], 'Wins: 73 · Losses: 19');
});

test('buildBoard: a slab flush to the wall 0.04 m proud with the pick target `board`; with no canvas it stays plain stone and never throws; dispose is once', () => {
  const group = new THREE.Group(), b = buildBoard(group, -3.75);
  const slab = group.getObjectByName('record-board') as THREE.Mesh;
  assert.ok(slab);
  const box = new THREE.Box3().setFromObject(slab);
  assert.ok(Math.abs(box.min.z - -3.75) < 1e-6 && Math.abs(box.max.z - (-3.75 + BOARD.d)) < 1e-6, `flush to the wall: ${box.min.z}..${box.max.z}`);
  assert.ok(Math.abs(box.max.x - BOARD.x1) < 1e-6 && Math.abs(box.min.x - BOARD.x0) < 1e-6 && Math.abs(box.max.y - BOARD.y1) < 1e-6 && Math.abs(box.min.y - BOARD.y0) < 1e-6);
  assert.deepEqual(b.targets.map((t) => t.id), ['board']);
  assert.ok(b.targets[0]!.box.clone().expandByScalar(1e-4).containsBox(box), 'the pick volume covers the slab');
  const face = slab.material as THREE.MeshStandardMaterial;
  assert.equal(face.roughness, 1); assert.equal(face.emissiveIntensity > 0 && face.emissive.getHex() !== 0, false, 'lit by the torch, not emissive');
  b.restock(undefined); b.restock(demoRecord());
  b.dispose(); b.dispose(); b.restock(demoRecord());
  assert.equal(group.children.length, 0);
});

test('the slab is painted when a canvas exists: chiselled glyphs drawn three times each, deterministic, tally strokes jittered by a seed', () => {
  const calls: string[] = [];
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (s: string) => ({ width: s.length * 10 }) : typeof k === 'string' && /^(fill|stroke|move|line|begin)/.test(k) ? (...a: unknown[]) => { calls.push(`${k}:${a.join(',')}`); } : undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
  paintRecord(ctx, demoRecord()); const first = [...calls]; calls.length = 0;
  paintRecord(ctx, demoRecord());
  assert.deepEqual(calls, first, 'the same record paints the same stone');
  assert.ok(first.filter((c) => c.startsWith('fillText:')).length >= 3 * 'THE RECORD'.length, 'each glyph is cut three times');
  assert.ok(first.filter((c) => c.startsWith('stroke:')).length >= 3 * 24, 'six gates of marks, three passes each');
  calls.length = 0; paintRecord(ctx, blankRecord());
  assert.ok(calls.filter((c) => c.startsWith('fillText:—')).length > 0, 'unknown values are em dashes');
  assert.ok(recordTexture(blankRecord()) instanceof THREE.CanvasTexture);
});

test('the slab reads at phone size: value text 4.5:1 and labels 3:1 against the carved face', () => {
  assert.ok(contrast(SLAB.value, SLAB.face) >= 4.5, `values ${contrast(SLAB.value, SLAB.face).toFixed(2)}`);
  assert.ok(contrast(SLAB.label, SLAB.face) >= 3, `labels ${contrast(SLAB.label, SLAB.face).toFixed(2)}`);
  assert.ok(luminance(SLAB.face) > 0.2, 'a lit limestone, not the old dark slab');
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
  const refetch = feed.kills();                       // slow: the keys from the first fetch must stay until it answers
  assert.equal((await feed.record()).kills, 3, 'wins 3 over 3 loot legends with the keys still held: 3, not 6');
  release(); await refetch;
  let go: () => void = () => undefined;
  recordHold = new Promise<void>((r) => { go = r; });
  const late = feed.record();
  user = 'u2'; go();
  assert.equal((await late).losses, null, 'u1\'s record lands after the switch to u2: the fallback, not theirs');
  assert.equal(feed.recordNow().losses, null, 'and it is not cached');
});
