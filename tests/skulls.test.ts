// The skull wall's data (src/pit/skulls.ts): the loot fallback, Backend's pit_recent_kills mapping, the fetch that never throws, the demo set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoKills, fetchKills, killsFromLoot, killsFromRows, lootKills, splitKey, type Kill, type SkullDb } from '../src/pit/skulls.ts';
import { skullsDemoFrom } from '../src/look-flag.ts';
import type { Loot } from '../src/loot.ts';

const loot = (extra: object): Loot => ({ owned: [], equipped: {}, ...extra }) as Loot;
const prov = (opponent: string, tier?: number, day = '2026-10-01') => ({ opponent, attempt: 1, healthLeft: 1, recordId: null, day, ...(tier ? { tier } : {}) });
const keys = (k: Kill[]) => k.map((x) => x.key);

test('splitKey: opponent and rank from a legend key, null for a bad rank', () => {
  assert.deepEqual(splitKey('veteran-3'), { opponent: 'veteran', rank: 3 });
  assert.deepEqual(splitKey('veteran-99'), { opponent: 'veteran', rank: null });
  assert.deepEqual(splitKey('veteran'), { opponent: 'veteran', rank: null });
  assert.deepEqual(splitKey('plague-doctor-10'), { opponent: 'plague-doctor', rank: 10 });
});

test('lootKills: every take and refusal is a kill, newest day first, later entry first on a tie, no day last', () => {
  const k = lootKills(loot({
    taken: { 'dwarf.Axe': prov('dwarf', 4, '2026-09-20'), 'goblin.Dagger': prov('goblin', 2, '2026-10-02') },
    declined: [prov('witch', 9, '2026-10-02'), prov('pitborn', undefined, '2026-09-01')],
  }));
  assert.deepEqual(keys(k), ['witch-9', 'goblin-2', 'dwarf-4', 'pitborn']);
  assert.deepEqual(k[0], { kind: 'ai', key: 'witch-9', name: 'witch', level: 9, gear: {}, at: '2026-10-02', opponent: 'witch', rank: 9 });
  assert.equal(k[3]!.rank, null);
  const named = lootKills(loot({ declined: [prov('witch', 9)] }), (o, r) => `${o}#${r}`);
  assert.equal(named[0]!.name, 'witch#9');
});

test('lootKills: two takes of one opponent and rank are two kills; defeats not covered by a take add an undated kill at the end', () => {
  const k = lootKills(loot({
    taken: { 'dwarf.Axe': prov('dwarf', 4, '2026-09-20') }, declined: [prov('dwarf', 4, '2026-09-21')],
    defeats: ['dwarf-4', 'veteran-3', 'veteran-3', 'knight-99', 'x'],
  }));
  assert.deepEqual(keys(k), ['dwarf-4', 'dwarf-4', 'veteran-3']);
  assert.equal(k[2]!.at, null); assert.equal(k[2]!.rank, 3);
});

test('killsFromLoot caps at 30: 29 taken and 4 declined show 30', () => {
  const taken = Object.fromEntries(Array.from({ length: 29 }, (_, i) => [`dwarf.p${i}`, prov('dwarf', 1 + (i % 10), `2026-09-${String(i % 28 + 1).padStart(2, '0')}`)]));
  const l = loot({ taken, declined: Array.from({ length: 4 }, (_, i) => prov('witch', 2, `2026-10-0${i + 1}`)) });
  assert.equal(lootKills(l).length, 33);
  const k = killsFromLoot(l);
  assert.equal(k.length, 30);
  assert.equal(k[0]!.at, '2026-10-04', 'newest first');
  for (let i = 1; i < k.length; i++) assert.ok(k[i - 1]!.at! >= k[i]!.at!, `order at ${i}`);
});

test('lootKills: garbage never throws', () => {
  for (const bad of [undefined, null, 5, 'x', [], { defeats: 'veteran-1', taken: 4, declined: 'x' }, { defeats: [1, null], taken: { a: null, b: 7, c: { opponent: 9 } }, declined: [null, 3] }]) assert.deepEqual(lootKills(bad as unknown as Loot), []);
});

test('killsFromRows: rows mapped defensively, strings clamped, gear string-only and capped, 30 max, ai rank from the key', () => {
  const gear = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`slot${i}`, `item${i}`]));
  const k = killsFromRows([
    { kind: 'duel', opponent_key: 'u1', opponent_name: 'N'.repeat(100), opponent_level: 12.7, opponent_gear: { ...gear, bad: 3 }, created_at: '2026-10-03T19:20:00Z' },
    { kind: 'ai', opponent_key: 'witch-9', opponent_name: 'Morgause', opponent_level: 9, opponent_gear: null, created_at: 'not a date' },
    { kind: 'ai', opponent_key: 'knight', opponent_name: 'Old', opponent_level: 'x', opponent_gear: {}, created_at: null },
    { kind: 'x', opponent_key: 'u', opponent_name: 'n' }, { kind: 'ai', opponent_key: 'u3' }, { opponent_name: 'x' }, null, 4,
  ]);
  assert.equal(k.length, 3);
  assert.equal(k[0]!.name.length, 40); assert.equal(k[0]!.level, 12); assert.equal(Object.keys(k[0]!.gear).length, 12); assert.ok(!('bad' in k[0]!.gear));
  assert.equal(k[0]!.opponent, undefined);
  assert.deepEqual(k[1], { kind: 'ai', key: 'witch-9', name: 'Morgause', level: 9, gear: {}, at: null, opponent: 'witch', rank: 9 });
  assert.equal(k[2]!.rank, null); assert.equal(k[2]!.level, 0);
  const many = Array.from({ length: 45 }, (_, i) => ({ kind: 'duel', opponent_key: `u${i}`, opponent_name: `P${i}`, opponent_level: 1, opponent_gear: {}, created_at: null }));
  const capped = killsFromRows(many);
  assert.equal(capped.length, 30); assert.equal(capped[29]!.key, 'u29');
  assert.deepEqual(killsFromRows('x'), []); assert.deepEqual(killsFromRows(undefined), []);
});

test('fetchKills: no db, rpc error, throw, rejection, empty rows with local kills: local; empty with no local: empty; rows: the rows', async () => {
  const local = killsFromLoot(loot({ declined: [prov('witch', 2)] }));
  const asked: string[] = [];
  const db = (reply: (name: string) => PromiseLike<{ data: unknown; error: unknown }>): SkullDb => ({ rpc: (name) => { asked.push(name); return reply(name); } });
  assert.equal(await fetchKills(null, local), local); assert.equal(await fetchKills(undefined, local), local);
  assert.equal(await fetchKills(db(async () => ({ data: [], error: { message: 'denied' } })), local), local);
  assert.equal(await fetchKills(db(() => { throw new Error('boom'); }), local), local);
  assert.equal(await fetchKills(db(() => Promise.reject(new Error('offline'))), local), local);
  assert.equal(await fetchKills(db(async () => ({ data: [], error: null })), local), local, 'the migration has no rows yet: the fallback');
  assert.deepEqual(await fetchKills(db(async () => ({ data: [], error: null })), []), []);
  asked.length = 0;
  const ok = await fetchKills(db(async () => ({ error: null, data: [{ kind: 'duel', opponent_key: 'u1', opponent_name: 'Marcus', opponent_level: 9, opponent_gear: {}, created_at: '2026-10-01T00:00:00Z' }] })), local);
  assert.deepEqual(asked, ['pit_recent_kills']); assert.equal(ok[0]!.name, 'Marcus'); assert.equal(ok.length, 1);
});

test('demoKills is deterministic and plausible: 12 kills, eight computer (one rank unknown) and four players, newest first', () => {
  const a = demoKills(), b = demoKills();
  assert.deepEqual(a, b);
  assert.equal(a.length, 12);
  assert.equal(a.filter((k) => k.kind === 'ai').length, 8); assert.equal(a.filter((k) => k.kind === 'duel').length, 4);
  assert.equal(a.filter((k) => k.kind === 'ai' && k.rank === null).length, 1);
  assert.ok(new Set(a.filter((k) => k.kind === 'ai').map((k) => k.opponent)).size >= 6, 'a spread of opponents');
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1]!.at! >= a[i]!.at!, `newest first at ${i}`);
  assert.ok(a.filter((k) => k.kind === 'duel').every((k) => k.level > 0 && Object.keys(k.gear).length > 0 && k.name));
  a.find((k) => k.kind === 'duel')!.gear.x = 'y'; assert.ok(!demoKills().some((k) => 'x' in k.gear), 'a caller cannot change the next set');
  assert.equal(demoKills((o) => o.toUpperCase())[0]!.name.length > 0, true);
});

test('skullsDemoFrom: only skulls=demo', () => {
  assert.equal(skullsDemoFrom('?look=pit-glow&skulls=demo'), true);
  assert.equal(skullsDemoFrom('?skulls=demo'), true);
  for (const q of ['', '?look=pit-glow', '?skulls=1', '?skulls=', '?skulls=demos']) assert.equal(skullsDemoFrom(q), false, q);
});
