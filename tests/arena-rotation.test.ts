// Arena rotation (Lead + Dom 2026-10-06, "all live"): the first fight is Arena 1, then a shuffle-bag over the eleven painted arenas, no arena twice in a row.
// Record version 26 names the arena a fight was fought in; every older link decodes and replays in the ladder band it always had (replay, never refuse).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_ROTATION, arenaFor, isRotationArena, type ArenaKey } from '../src/arena-themes.ts';
import { nextArena, passKey } from '../src/ladder.ts';
import { loadProfile } from '../src/profile.ts';
import { ARENAS, RECORD_VERSION, createRecorder, decodeRecord, encodeRecord, packRecord, unpackRecord } from '../src/record.ts';
import { peekRecordHeader } from '../src/record-header.ts';
import { setLateNotice } from '../src/play-radius.ts';
import { setStab } from '../src/stab-rule.ts';
import { LADDER } from '../src/ladder.ts';

// A record minted by trunk's v25 codec (ad8f517f), before the arena byte existed: goblin, level 18, seed 731, 12 ticks.
const V25 = 'H4sIAAAAAAAAE3PzlmRPy6woKS1KZUvPT8rJzOPMyc9LLy7PL0phYBC6zcTAwMPAwMDM4OAAR2lIgAEJMKIScMCBBABV-2MucAAAAA';

const walk = (steps: number, start: ArenaKey = '1', seed = 'guest-aaaa1111'): ArenaKey[] => {
  const out: ArenaKey[] = [start]; let current = start, seen: string[] = [start];
  for (let i = 0; i < steps; i++) { const n = nextArena(current, seen, passKey(seed, i + 1)); out.push(n.arena); current = n.arena; seen = n.pass; }
  return out;
};

test('rotation: eleven painted arenas, Arena 1 first, the generated looks stay out', () => {
  assert.deepEqual([...ARENA_ROTATION], ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  assert.ok(ARENA_ROTATION.every(isRotationArena) && !['a', 'b', 'c', 'd', '12', undefined, 7].some(isRotationArena));
});

test('nextArena: each arena once per cycle, never the same twice in a row (also across the cycle boundary), and a refresh draws the same one', () => {
  for (const seed of ['guest-aaaa1111', 'guest-bbbb2222', 'guest-cccc3333']) {
    const w = walk(60, '1', seed);
    for (let i = 1; i < w.length; i++) assert.notEqual(w[i], w[i - 1], `${seed}: ${w[i]} twice at ${i}`);
    assert.deepEqual([...w.slice(0, 11)].sort(), [...ARENA_ROTATION].sort(), `${seed}: the first cycle (starting at Arena 1) shows all eleven once`);
    assert.equal(new Set(w.slice(11, 22)).size, 11, `${seed}: the second cycle shows all eleven once`);
  }
  const a = nextArena('1', ['1'], 5), b = nextArena('1', ['1'], 5);
  assert.deepEqual(a, b);
  assert.ok(a.pass.includes('1') && a.pass.includes(a.arena) === false, 'the pass holds what was fought; the pick joins it on the next win');
});

test('nextArena: unknown stored values drop out and a full bag starts a new cycle without the arena just fought', () => {
  assert.deepEqual(nextArena('2', ['2', 'zz', 'a'], 0).pass, ['2']);
  const full = nextArena('7', [...ARENA_ROTATION], 99);
  assert.notEqual(full.arena, '7'); assert.deepEqual(full.pass, ['7']);
});

test('profile: arena and arenaPass are read back sanitised; no stored arena means Arena 1 and a fresh cycle', () => {
  const store = (v: unknown) => ({ getItem: () => JSON.stringify(v), setItem() {}, removeItem() {} }) as never, mint = () => 'guest-new00000';
  const base = { version: 1, id: 'guest-aaaa1111', name: 'Test' };
  const { profile } = loadProfile(store({ ...base, arena: '5', arenaPass: ['1', '5', '5', 'zz', 'a', 9] }), mint);
  assert.equal(profile.arena, '5'); assert.deepEqual(profile.arenaPass, ['1', '5']);
  const bad = loadProfile(store({ ...base, arena: 'a', arenaPass: 'x' }), mint).profile;
  assert.equal(bad.arena, undefined); assert.equal(bad.arenaPass, undefined);
});

test('record v26: the arena byte round-trips, and an unnamed arena stays unnamed', async () => {
  setLateNotice(true); setStab(true);
  const named = createRecorder({ build: 'b', opponent: 'goblin', weapon: 'longsword', level: 18, seed: 9, arena: '10' });
  const plain = createRecorder({ build: 'b', opponent: 'goblin', weapon: 'longsword', level: 18, seed: 9 });
  setLateNotice(false); setStab(false);
  const r = named.finish('abandoned'), p = plain.finish('abandoned');
  assert.equal(RECORD_VERSION, 26); assert.equal(r.v, 26);
  assert.equal(unpackRecord(packRecord(r)).arena, '10'); assert.equal((await decodeRecord(await encodeRecord(r))).arena, '10');
  assert.equal('arena' in unpackRecord(packRecord(p)), false);
  assert.equal((await peekRecordHeader(await encodeRecord(r)))?.outcome, 'abandoned', 'the header peek skips the arena byte');
  const raw = packRecord(r), at = raw.indexOf(10, 3 + 1 + 1 + 1 + 6 + 1 + 9 + 2); raw[3 + 1 + 1 + 'b'.length + 1 + 'goblin'.length + 1 + 'longsword'.length + 1 + 1] = 99;   // the arena byte, past the table
  assert.throws(() => unpackRecord(raw), /unknown arena/); void at;
  assert.ok(ARENAS.length === 16 && ARENAS[0] === undefined);
});

test('record v25 and older: a link minted before the arena byte decodes unchanged and names no arena, so it replays in its ladder band', async () => {
  const old = await decodeRecord(V25);
  assert.equal(old.v, 25); assert.equal(old.arena, undefined); assert.equal(old.ticks, 12); assert.equal(old.opponent, 'goblin'); assert.equal(old.seed, 731);
  const band = arenaFor(old.opponent).id;
  assert.equal(band, arenaFor(old.opponent, undefined).id);
  assert.equal(band, arenaFor('goblin').id, 'the default for a record with no arena is the opponent\'s ladder band, exactly as before');
  assert.equal(arenaFor('veteran').id, '1');
  assert.ok(LADDER.length >= 10);
  assert.deepEqual(unpackRecord(packRecord(old)), old, 'repacking a v25 record keeps its layout and its version');
  assert.equal((await peekRecordHeader(V25))?.outcome, 'abandoned');
});

test('a v26 rotation fight replays in its named arena, not the band', () => {
  const r = { arena: '9' as const };
  assert.equal(arenaFor('goblin', r.arena).id, '9');
  assert.notEqual(arenaFor('goblin').id, '9');
});
