// Discovery and daily-board rows: they load, refer to real zones and landmarks, and the pure pick is stable, varied and fair.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BOARD_RULES, BOARD_TASKS, DISCOVERIES, boardDay, boardRule, dailyBoardFor, discoveryById, firstFindReward, loadDailyBoard } from './daily-board.ts';
import DATA from './daily-board.json' with { type: 'json' };

const zoneRow = (n: number) => JSON.parse(readFileSync(new URL(`../zone-rows/zone${n}.row.json`, import.meta.url), 'utf8')) as { kit: { landmarks: string[] } };

test('daily board: every discovery sits on a real landmark of a real zone, once', () => {
  const seen = new Set<string>();
  for (const d of DISCOVERIES) {
    const n = Number(/^zone(\d)$/.exec(d.zone)?.[1]);
    assert.ok(n >= 1 && n <= 4, `${d.id}: zone ${d.zone}`);
    assert.ok(zoneRow(n).kit.landmarks.includes(d.landmark), `${d.id}: ${d.landmark} is in ${d.zone}`);
    const key = `${d.zone}/${d.landmark}`; assert.ok(!seen.has(key), `${key} listed twice`); seen.add(key);
  }
  assert.equal(DISCOVERIES.length, 16);
  assert.equal(firstFindReward('ash-arch')!.kind, 'fame');
  assert.equal(firstFindReward('nowhere'), null);
});

test('daily board: tasks are sane, and a discover task targets a real discovery', () => {
  for (const t of BOARD_TASKS) {
    assert.ok(t.count >= 1 && t.weight >= 1 && t.target.length > 0, t.id);
    if (t.kind === 'discover') { assert.ok(discoveryById(t.target), `${t.id} targets ${t.target}`); assert.equal(t.count, 1); }
  }
  const r = boardRule()!;
  assert.ok(r.slots >= 1 && r.slots <= BOARD_TASKS.length && r.completionCap >= r.slots && r.resetHourUtc >= 0 && r.resetHourUtc < 24);
  assert.ok(new Set(BOARD_TASKS.map((t) => t.kind)).size >= r.slots, 'enough kinds to fill a distinct board');
});

test('daily board: a bad reference or missing field is refused at load', () => {
  const badRef = structuredClone(DATA); badRef.tasks[0]!.reward = 'no-such-reward';
  assert.throws(() => loadDailyBoard(badRef));
  const badKind = structuredClone(DATA); badKind.tasks[0]!.kind = 'dance';
  assert.throws(() => loadDailyBoard(badKind));
  const missing = structuredClone(DATA) as { boards: Record<string, unknown>[] }; delete missing.boards[0]!.slots;
  assert.throws(() => loadDailyBoard(missing));
});

test('daily board: the same seed and day always give the same board; other days and seeds differ', () => {
  const a = dailyBoardFor(1234, 20000).map((t) => t.id);
  assert.deepEqual(dailyBoardFor(1234, 20000).map((t) => t.id), a);
  assert.equal(a.length, boardRule()!.slots);
  const days = new Set<string>(), seeds = new Set<string>();
  for (let d = 0; d < 30; d++) { days.add(dailyBoardFor(1234, 20000 + d).map((t) => t.id).join()); seeds.add(dailyBoardFor(d, 20000).map((t) => t.id).join()); }
  assert.ok(days.size >= 10, `${days.size} different boards over 30 days`);
  assert.ok(seeds.size >= 10, `${seeds.size} different boards over 30 seeds`);
});

test('daily board: kinds differ, no task repeats the day before (bar anchor days), and every task gets picked in a year', () => {
  const seen = new Map<string, number>(); 
  for (let d = 0; d < 365; d++) {
    const today = dailyBoardFor(77, 20000 + d), yesterday = dailyBoardFor(77, 20000 + d - 1), anchor = (20000 + d) % boardRule()!.anchorEvery === 0;
    assert.equal(new Set(today.map((t) => t.kind)).size, today.length, `day ${d}: kinds differ`);
    assert.equal(new Set(today.map((t) => t.id)).size, today.length);
    for (const t of today) { if (!anchor) assert.ok(!yesterday.some((y) => y.id === t.id), `day ${d}: ${t.id} repeats`); seen.set(t.id, (seen.get(t.id) ?? 0) + 1); }
  }
  for (const t of BOARD_TASKS) assert.ok(seen.has(t.id), `${t.id} is never on the board`);
  assert.ok(seen.get('kill-wolves')! > seen.get('kill-marsh-lurkers')!, 'a heavier weight shows more often');
});

test('daily board: a pool too small for the no-repeat rule still fills the board; no rule gives none', () => {
  const rule = { ...BOARD_RULES[0]!, slots: 3, noRepeatDays: 1 };
  const small = BOARD_TASKS.slice(0, 3);
  assert.equal(dailyBoardFor(5, 100, rule, small).length, 3);
  assert.deepEqual(dailyBoardFor(5, 100, null), []);
});

test('daily board: boundary rules: 0 slots is an empty board, 0 noRepeatDays bars nothing, firstFindReward is null for an unknown id', () => {
  const base = BOARD_RULES[0]!;
  assert.deepEqual(dailyBoardFor(5, 100, { ...base, slots: 0 }), []);
  const free = { ...base, noRepeatDays: 0 };
  assert.deepEqual(dailyBoardFor(5, 100, free).map((t) => t.id), dailyBoardFor(5, 100, free).map((t) => t.id));
  assert.equal(dailyBoardFor(5, 100, free).length, base.slots);
  assert.equal(firstFindReward('no-such-discovery'), null);
});

test('daily board: the day number turns over at the reset hour', () => {
  const r = { ...BOARD_RULES[0]!, resetHourUtc: 4 }, midnight = 20000 * 86_400_000;
  assert.equal(boardDay(midnight + 3 * 3_600_000, r), 19999);
  assert.equal(boardDay(midnight + 4 * 3_600_000, r), 20000);
});
