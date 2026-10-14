// The daily board screen's view model: every sentence is a row, every name comes from the namer, the reset arithmetic is the rule's, and the code names no task.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import DATA from './daily-board.json' with { type: 'json' };
import TEXT from './board-text.json' with { type: 'json' };
import { BOARD_TASKS, boardDay, boardRule, discoveryById } from './daily-board.ts';
import { BOARD_SEED, boardView, resetAtMs, taskText, timeUntil, type Namer } from './board-view.ts';
import { boardNamer } from './board-names.ts';

const fake: Namer = { character: (id) => `<c:${id}>`, item: (id) => `<i:${id}>`, family: (id) => `<f:${id}>`, zone: (id) => `<z:${id}>` };
const rule = boardRule()!;
const NOON = Date.UTC(2026, 9, 13, 12, 0, 0);

test('board text: every task kind, reward kind and discovery landmark has its words in board-text.json', () => {
  for (const k of DATA.boardKinds) assert.ok(TEXT.kinds.some((t) => t.id === k.id && t.template.length > 0), `no sentence for task kind ${k.id}`);
  for (const k of DATA.rewardKinds) assert.ok(TEXT.rewardKinds.some((t) => t.id === k.id && t.template.length > 0), `no sentence for reward kind ${k.id}`);
  for (const d of DATA.discoveries) assert.ok(TEXT.landmarks.some((l) => l.id === d.landmark), `no name for landmark ${d.landmark}`);
  assert.equal(new Set(TEXT.landmarks.map((l) => l.id)).size, TEXT.landmarks.length, 'a duplicate landmark name');
  assert.equal(TEXT.kinds.length, DATA.boardKinds.length, 'a sentence for a kind that does not exist');
  assert.equal(TEXT.rewardKinds.length, DATA.rewardKinds.length, 'a sentence for a reward kind that does not exist');
});

test('board view: today\'s board has the rule\'s slots, each task a sentence built from its row, the names from the namer, and a reward', () => {
  const v = boardView(NOON, fake)!;
  assert.equal(v.tasks.length, rule.slots); assert.equal(v.slots, rule.slots); assert.equal(v.cap, rule.completionCap);
  for (const t of v.tasks) {
    const task = BOARD_TASKS.find((x) => x.id === t.id)!;
    assert.ok(t.text.includes(String(task.count)) || task.kind === 'discover', `${t.id}: the count is in the sentence`);
    assert.ok(/<[cifz]:/.test(t.text), `${t.id}: the name came from the namer (${t.text})`);
    assert.ok(t.reward.length > 0, `${t.id}: a reward line`);
    assert.ok(!/\{\w+\}/.test(t.text + t.reward), `${t.id}: no placeholder left`);
  }
  assert.deepEqual(boardView(NOON, fake), v, 'the same time gives the same board');
  const boards = new Set<string>(); for (let d = 0; d < 30; d++) boards.add(boardView(NOON + d * 86_400_000, fake)!.tasks.map((t) => t.id).join());
  assert.ok(boards.size >= 10, `${boards.size} different boards over 30 days`);
});

test('board view: the reset is the rule\'s hour, the next one after now, at most a day away, and the day number turns exactly there', () => {
  for (const nowMs of [NOON, Date.UTC(2026, 9, 13, 0, 0, 0), Date.UTC(2026, 9, 13, 23, 59, 59), NOON + 3 * 86_400_000]) {
    const v = boardView(nowMs, fake)!, at = resetAtMs(v.day, rule);
    assert.equal(v.resetsAtMs, at); assert.equal(v.resetsInMs, at - nowMs);
    assert.ok(v.resetsInMs > 0 && v.resetsInMs <= 86_400_000, `${v.resetsInMs}`);
    assert.equal(new Date(at).getUTCHours(), rule.resetHourUtc); assert.equal(boardDay(at, rule), v.day + 1); assert.equal(boardDay(at - 1, rule), v.day);
  }
  assert.equal(boardView(NOON, fake, BOARD_SEED, null), null, 'no rule, no board');
});

test('board view: the time left reads in hours and minutes from the rows', () => {
  assert.equal(timeUntil(0), '0 min'); assert.equal(timeUntil(90 * 60_000), '1 h 30 min'); assert.equal(timeUntil(120 * 60_000), '2 h'); assert.equal(timeUntil(59 * 60_000 + 1), '1 h');
});

test('board view: the real namer names every task target and reward in words, never an id', () => {
  const namer = boardNamer();
  for (const t of BOARD_TASKS) {
    const text = taskText(t, namer);
    assert.ok(!/(character|item|family):|landmark_|zone\d|^[a-z]+-[a-z]+$/.test(text), `${t.id}: "${text}" shows an id`);
    if (t.kind === 'discover') assert.ok(discoveryById(t.target), t.target);
  }
  const all = [...Array(60).keys()].flatMap((d) => boardView(NOON + d * 86_400_000, namer)!.tasks);
  for (const t of all) assert.ok(t.reward.length > 0 && !/(item):|\{/.test(t.reward), `${t.id}: reward "${t.reward}"`);
});

test('data only: the screen and the view model name no task, reward, creature or landmark', () => {
  const src = ['./board-view.ts', './board-screen.ts', './board-names.ts', '../preview/main.ts'].map((f) => readFileSync(new URL(f, import.meta.url), 'utf8').replace(/^\/\/.*$/gm, '')).join('\n');
  const ids = [...DATA.tasks.map((t) => t.id), ...DATA.rewards.map((r) => r.id), ...DATA.discoveries.map((d) => d.id), ...DATA.tasks.map((t) => t.target), ...TEXT.landmarks.map((l) => l.id)];
  for (const id of new Set(ids)) assert.ok(!src.includes(`'${id}'`) && !src.includes(`"${id}"`), `the code names ${id}`);
});
