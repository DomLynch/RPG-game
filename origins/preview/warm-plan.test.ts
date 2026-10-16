import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAYER, warmDone, warmKitsWithin, warmList } from './warm-plan.ts';

test('the player\'s actor is in every zone\'s warm-up list, first, whatever the creature kinds', () => {
  for (const kinds of [[], ['goblin', 'wolf'], ['goblin', 'boar', 'knight', 'pitborn', 'bear', 'witch', 'wolf'], ['player']]) {
    const list = warmList(kinds); assert.equal(list[0], PLAYER); assert.equal(list.filter((k) => k === PLAYER).length, 1); assert.deepEqual(list.slice(1), kinds.filter((k) => k !== PLAYER));
  }
});
test('a zone is ready only when the player and every kind are warmed or failed', () => {
  const list = warmList(['goblin', 'wolf']);
  assert.equal(warmDone(list, ['goblin', 'wolf'], []), false, 'creatures warmed but the player is not');
  assert.equal(warmDone(list, ['player', 'goblin'], []), false);
  assert.equal(warmDone(list, ['player', 'goblin', 'wolf'], []), true);
  assert.equal(warmDone(list, ['goblin', 'wolf'], ['player']), true, 'a player actor that failed to load does not hold the zone');
});

// The kit warm-up is bounded: at the cap it stops before its next kit, reports failed, and compiles nothing further (the Auditor on #2938).
const timeoutSettle = async (_label: string, work: Promise<unknown>, boundMs: number) => Promise.race([work.then(() => true, () => true), new Promise<false>((r) => setTimeout(() => r(false), boundMs))]);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

test('a kit warm-up that hits its cap stops before the next kit, reports failed, and compiles nothing more', async () => {
  const compiled: number[] = []; let cleaned = 0;
  const result = await warmKitsWithin([1, 2, 3, 4, 5, 6], async (k) => { await sleep(40); compiled.push(k); }, 70, timeoutSettle, () => { cleaned++; });
  assert.equal(result.failed, true);
  const atCap = compiled.length;
  assert.ok(atCap >= 1 && atCap < 6, `some kits ran before the cap (${atCap})`);
  await sleep(200);   // the loop would have finished all six by now
  assert.ok(compiled.length <= atCap + 1, `at most the kit already compiling finishes (${atCap} -> ${compiled.length}), none after`);
  assert.equal(compiled.length < 6, true);
  assert.equal(cleaned, 1, 'cleanup runs once, when the loop really ended');
});

test('a warm-up inside its cap warms every kit and is not failed; a kit that throws fails it and stops', async () => {
  const ok: number[] = [];
  assert.deepEqual(await warmKitsWithin([1, 2, 3], async (k) => { ok.push(k); }, 1000, timeoutSettle), { failed: false, warmed: 3 });
  const seen: number[] = [];
  const bad = await warmKitsWithin([1, 2, 3], async (k) => { seen.push(k); if (k === 2) throw new Error('compile failed'); }, 1000, timeoutSettle);
  assert.equal(bad.failed, true); assert.deepEqual(seen, [1, 2]);
});
