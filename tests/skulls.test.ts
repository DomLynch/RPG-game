// The skull wall's data (src/pit/skulls.ts): the loot fallback, Backend's two RPCs, the merge, the fetch that never throws, the demo set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PORTRAIT_KEYS } from '../src/legends.ts';
import { demoSkulls, fetchSkulls, mergeSkulls, opponentsOf, skullsFromLoot, skullsFromRows, type SkullDb, type Skulls } from '../src/pit/skulls.ts';
import { skullsDemoFrom } from '../src/look-flag.ts';
import { PANEL, duelSlots, slots } from '../src/pit/wall.ts';
import type { Loot } from '../src/loot.ts';

const OPP = opponentsOf(PORTRAIT_KEYS);
const loot = (extra: object): Loot => ({ owned: [], equipped: {}, ...extra }) as Loot;
const beaten = (s: Skulls) => s.ai.filter((a) => a.beaten).map((a) => a.opponent);
const prov = (opponent: string, tier?: number) => ({ opponent, attempt: 1, healthLeft: 1, recordId: null, day: '2026-10-01', ...(tier ? { tier } : {}) });

test('opponentsOf takes every 10th portrait key: ten opponents in legends order', () => {
  assert.equal(OPP.length, 10);
  assert.equal(OPP[0], 'veteran'); assert.equal(OPP[9], 'knight');
});

test('skullsFromLoot: defeats only, taken only, declined only, mixed', () => {
  const d = skullsFromLoot(loot({ defeats: ['veteran-3', 'veteran-1', 'knight-10'] }), OPP);
  assert.deepEqual(beaten(d), ['veteran', 'knight']);
  assert.deepEqual(d.ai[0], { opponent: 'veteran', ranks: [1, 3], wins: 0, losses: 0, draws: 0, beaten: true });
  assert.deepEqual(d.duels, []);
  const t = skullsFromLoot(loot({ taken: { 'dwarf.Axe': prov('dwarf', 4) } }), OPP);
  assert.deepEqual(beaten(t), ['dwarf']); assert.deepEqual(t.ai.find((a) => a.opponent === 'dwarf')!.ranks, [4]);
  const c = skullsFromLoot(loot({ declined: [prov('witch', 9), prov('witch', 2)] }), OPP);
  assert.deepEqual(c.ai.find((a) => a.opponent === 'witch')!.ranks, [2, 9]);
  const m = skullsFromLoot(loot({ defeats: ['goblin-2'], taken: { 'goblin.Dagger': prov('goblin', 2) }, declined: [prov('goblin', 5), prov('pitborn')] }), OPP);
  assert.deepEqual(beaten(m), ['pitborn', 'goblin']);
  assert.deepEqual(m.ai.find((a) => a.opponent === 'goblin')!.ranks, [2, 5], 'unique, sorted');
});

test('skullsFromLoot: rankless wins count as beaten, and garbage never throws', () => {
  const r = skullsFromLoot(loot({ declined: [prov('executioner')] }), OPP);
  assert.deepEqual(r.ai.find((a) => a.opponent === 'executioner'), { opponent: 'executioner', ranks: [], wins: 0, losses: 0, draws: 0, beaten: true });
  for (const bad of [undefined, null, 5, 'x', [], { defeats: 'veteran-1', taken: 4, declined: 'x' }, { defeats: [1, null, 'nobody-3', 'veteran-99', 'veteran-x'], taken: { a: null, b: 7, c: { opponent: 9 } }, declined: [null, 3] }]) {
    const s = skullsFromLoot(bad as unknown as Loot, OPP);
    assert.equal(s.ai.length, 10);
    assert.ok(beaten(s).length <= 1);
  }
  assert.deepEqual(beaten(skullsFromLoot({ defeats: ['veteran-99'] } as unknown as Loot, OPP)), ['veteran'], 'a real opponent with a bad rank is still beaten, no rank');
});

test('skullsFromRows: ten opponents in the given order, missing ones unbeaten, bad rows skipped', () => {
  const s = skullsFromRows([
    { opponent: 'knight', ranks_beaten: [3, 1, 3, 'x', 99], wins: 5, losses: 2, draws: 1, beaten: true },
    { opponent: 'veteran', ranks_beaten: [], wins: 0, losses: 4, draws: 0, beaten: false },
    { opponent: 'stranger', ranks_beaten: [1], wins: 1, losses: 0, draws: 0, beaten: true },
    null, 7, 'x', { opponent: 5 }, { ranks_beaten: [1] },
  ], [], OPP);
  assert.deepEqual(s.ai.map((a) => a.opponent), OPP);
  assert.deepEqual(s.ai[9], { opponent: 'knight', ranks: [1, 3], wins: 5, losses: 2, draws: 1, beaten: true });
  assert.deepEqual(s.ai[0], { opponent: 'veteran', ranks: [], wins: 0, losses: 4, draws: 0, beaten: false });
  assert.deepEqual(beaten(s), ['knight']);
  assert.deepEqual(s.ai[1], { opponent: 'pitborn', ranks: [], wins: 0, losses: 0, draws: 0, beaten: false });
  assert.deepEqual(skullsFromRows(undefined, undefined, OPP).ai.length, 10);
  assert.deepEqual(skullsFromRows('x', { a: 1 }, OPP).duels, []);
});

test('skullsFromRows: duel rows parsed defensively, strings clamped, gear string-only and capped, 30 max', () => {
  const gear = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`slot${i}`, `item${i}`]));
  const s = skullsFromRows([], [
    { opponent_key: 'u1', opponent_name: 'N'.repeat(100), opponent_level: 12.7, opponent_gear: { ...gear, bad: 3 }, last_win_at: '2026-10-03T19:20:00Z', wins: 2, losses: 1, draws: 0 },
    { opponent_key: 'u2', opponent_name: 'Ivy', opponent_level: 'x', opponent_gear: null, last_win_at: 'not a date', wins: -3, losses: 'many' },
    { opponent_key: 'u3' }, { opponent_name: 'x' }, null, 4,
  ], OPP);
  assert.equal(s.duels.length, 2);
  assert.equal(s.duels[0]!.name.length, 40); assert.equal(s.duels[0]!.level, 12);
  assert.equal(Object.keys(s.duels[0]!.gear).length, 12); assert.ok(!('bad' in s.duels[0]!.gear));
  assert.deepEqual(s.duels[1], { key: 'u2', name: 'Ivy', level: 0, gear: {}, lastWinAt: null, wins: 0, losses: 0, draws: 0 });
  const many = Array.from({ length: 45 }, (_, i) => ({ opponent_key: `u${i}`, opponent_name: `P${i}`, opponent_level: 1, opponent_gear: {}, last_win_at: null, wins: 1, losses: 0, draws: 0 }));
  const capped = skullsFromRows([], many, OPP).duels;
  assert.equal(capped.length, 30); assert.equal(capped[0]!.key, 'u0'); assert.equal(capped[29]!.key, 'u29', 'the given order, the first 30');
});

test('mergeSkulls: beaten if either says so, ranks the union, the server\'s counts never below local, the duels the server\'s', () => {
  const local = skullsFromLoot(loot({ defeats: ['veteran-1', 'veteran-2', 'pitborn-1'] }), OPP);
  const remote = skullsFromRows([
    { opponent: 'veteran', ranks_beaten: [2, 5], wins: 9, losses: 3, draws: 0, beaten: true },
    { opponent: 'goblin', ranks_beaten: [1], wins: 1, losses: 0, draws: 0, beaten: true },
  ], [{ opponent_key: 'u1', opponent_name: 'Marcus', opponent_level: 5, opponent_gear: {}, last_win_at: null, wins: 1, losses: 0, draws: 0 }], OPP);
  const m = mergeSkulls(local, remote);
  assert.deepEqual(beaten(m), ['veteran', 'pitborn', 'goblin']);
  assert.deepEqual(m.ai[0], { opponent: 'veteran', ranks: [1, 2, 5], wins: 9, losses: 3, draws: 0, beaten: true });
  assert.deepEqual(m.ai[1], local.ai[1], 'local-only stays');
  assert.equal(m.duels.length, 1);
  const higher = mergeSkulls({ ...local, ai: local.ai.map((a) => ({ ...a, wins: 20 })) }, remote);
  assert.equal(higher.ai[0]!.wins, 20, 'never lower than local');
  assert.deepEqual(m.ai.map((a) => a.opponent), OPP);
});

test('fetchSkulls: no db, an rpc error, an rpc throw, a rejected promise: local; success: merged; both rpcs asked', async () => {
  const local = skullsFromLoot(loot({ defeats: ['veteran-1'] }), OPP);
  assert.equal(await fetchSkulls(null, local, OPP), local); assert.equal(await fetchSkulls(undefined, local, OPP), local);
  const asked: string[] = [];
  const db = (reply: (name: string) => PromiseLike<{ data: unknown; error: unknown }>): SkullDb => ({ rpc: (name) => { asked.push(name); return reply(name); } });
  assert.equal(await fetchSkulls(db(async (n) => ({ data: [], error: n === 'pit_duel_beaten' ? { message: 'denied' } : null })), local, OPP), local);
  assert.equal(await fetchSkulls(db(() => { throw new Error('boom'); }), local, OPP), local);
  assert.equal(await fetchSkulls(db(() => Promise.reject(new Error('offline'))), local, OPP), local);
  asked.length = 0;
  const ok = await fetchSkulls(db(async (n) => ({ error: null, data: n === 'pit_ai_standing' ? [{ opponent: 'dwarf', ranks_beaten: [2], wins: 1, losses: 0, draws: 0, beaten: true }] : [{ opponent_key: 'u1', opponent_name: 'Marcus', opponent_level: 9, opponent_gear: {}, last_win_at: null, wins: 1, losses: 0, draws: 0 }] })), local, OPP);
  assert.deepEqual(asked.sort(), ['pit_ai_standing', 'pit_duel_beaten']);
  assert.deepEqual(beaten(ok), ['veteran', 'dwarf']); assert.equal(ok.duels[0]!.name, 'Marcus');
});

test('demoSkulls is deterministic: about six opponents beaten, nine players, plausible', () => {
  const a = demoSkulls(OPP), b = demoSkulls(OPP);
  assert.deepEqual(a, b);
  assert.equal(a.ai.length, 10); assert.equal(beaten(a).length, 6);
  assert.ok(a.ai.filter((x) => x.beaten).every((x) => x.ranks.length > 0 && x.wins >= x.ranks.length));
  assert.equal(a.duels.length, 9);
  assert.ok(a.duels.every((d) => d.level >= 3 && d.level <= 40 && !Number.isNaN(Date.parse(d.lastWinAt!)) && Object.keys(d.gear).length > 0));
  assert.equal(new Set(a.duels.map((d) => d.key)).size, 9);
  a.duels[0]!.gear.x = 'y'; assert.ok(!('x' in demoSkulls(OPP).duels[0]!.gear), 'a caller cannot change the next set');
});

test('skullsDemoFrom: only skulls=demo', () => {
  assert.equal(skullsDemoFrom('?look=pit-glow&skulls=demo'), true);
  assert.equal(skullsDemoFrom('?skulls=demo'), true);
  for (const q of ['', '?look=pit-glow', '?skulls=1', '?skulls=', '?skulls=demos']) assert.equal(skullsDemoFrom(q), false, q);
});

test('wall slots: 10 on the left, 30 on the right, unique stable ids, inside the panels', () => {
  const left = slots(OPP), right = duelSlots();
  assert.equal(left.length, 10); assert.equal(right.length, 30);
  const ids = [...left, ...right].map((s) => s.id);
  assert.equal(new Set(ids).size, 40);
  assert.deepEqual(ids, [...OPP.map((o) => `ai:${o}`), ...Array.from({ length: 30 }, (_, i) => `duel:${i}`)]);
  assert.deepEqual(slots(OPP), left, 'stable');
  for (const s of left) assert.ok(-s.x >= PANEL.inner && -s.x <= PANEL.outer, `${s.id} x ${s.x}`);
  for (const s of right) assert.ok(s.x >= PANEL.inner && s.x <= PANEL.outer, `${s.id} x ${s.x}`);
  assert.ok(left.every((s) => s.x < 0) && right.every((s) => s.x > 0));
  assert.deepEqual([left[0]!.x, left[0]!.y], [-(PANEL.inner + PANEL.colPitch / 2), PANEL.top], 'the first opponent at the panel\'s inner edge, top row');
});
