import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_FELL, LESSON_NEXT, LESSON_ORDER, firstLossDue, lessonText, nextLesson, type LessonId } from '../src/lessons.ts';
import { LESSONS } from '../src/first-loss.ts';

test('five lessons in the briefed order, one line each, short enough for the status line', () => {
  assert.deepEqual([...LESSON_ORDER], ['stayAfterParry', 'blockEarnsNothing', 'rollSideways', 'woundedStamina', 'tapStepHoldRoll']);
  for (const id of LESSON_ORDER) { const t = lessonText(id); assert.ok(t.length > 0 && t.length <= 42, `${id}: ${t.length} chars`); assert.doesNotMatch(t, /guard (broken|shattered)|warcraft|azeroth/i); }
});

test('nextLesson walks the ladder in order and ends at null', () => {
  const shown = new Set<LessonId>(); const seen: (LessonId | null)[] = [];
  for (let i = 0; i < 6; i++) { const n = nextLesson(shown); seen.push(n); if (n) shown.add(n); }
  assert.deepEqual(seen, [...LESSON_ORDER, null]);
  assert.equal(nextLesson(new Set<LessonId>(['blockEarnsNothing'])), 'stayAfterParry', 'skips nothing: the first unseen in order');
});

test('the file header keeps the MIT notice and the @f46f30f provenance', async () => {
  const { readFileSync } = await import('node:fs');
  const head = readFileSync(new URL('../src/lessons.ts', import.meta.url), 'utf8').slice(0, 1400);
  assert.match(head, /MIT/); assert.match(head, /f46f30f/); assert.match(head, /Levy Street/);
});

test('the order is first-loss.ts LESSONS, and the after-loss words say what happened and what is next', () => {
  assert.deepEqual([...LESSON_ORDER], [...LESSONS]);
  assert.match(LESSON_FELL, /fell/); assert.ok(LESSON_NEXT.length <= 14, 'fits the reset button');
});

test('the lesson is due once: a plain page, nothing stored, no fight yet', () => {
  const base = { stored: false, fights: 0, search: '', pathname: '/' };
  assert.equal(firstLossDue(base), true);
  for (const off of [{ stored: true }, { fights: 1 }, { search: '?opponent=goblin' }, { search: '?duel=new' }, { pathname: '/s/abc' }]) assert.equal(firstLossDue({ ...base, ...off }), false, JSON.stringify(off));
});

test('"Fight for real" is a full page load, so the lesson kit, weapon and level never carry into the real fight; the notice lists every port', async () => {
  const { readFileSync } = await import('node:fs');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), notice = readFileSync(new URL('../public/licenses/world-of-claudecraft.txt', import.meta.url), 'utf8');
  assert.match(main, /if \(match\.mode === 'lesson'\) \{ location\.assign\(`\$\{location\.pathname\}\?fight=1`\); return; \}/, 'a reload, not a Match restore (startLesson sets weapon/skill/level and nothing restores them), and to a non-empty search so a page that cannot store the flag never reloads into the lesson');
  for (const file of ['src/net/backoff.ts', 'src/net/reconnect-policy.ts', 'src/first-loss.ts', 'src/lessons.ts', 'src/touch-router.ts', 'src/layout-tier.ts']) assert.ok(notice.includes(file), `${file} is listed`);
  assert.ok(!notice.includes('render-budget'), 'Dom scrapped the render budget (Lead 2026-10-06): the notice lists only ports that ship');
  assert.match(notice, /MIT License/); assert.match(notice, /f46f30f/);
});

test('the exit URL fails the trigger even when the flag cannot be stored', () => {
  assert.equal(firstLossDue({ stored: false, fights: 0, search: '?fight=1', pathname: '/' }), false, 'blocked storage: stored is false and fights 0, the search alone keeps the real fight');
  assert.equal(firstLossDue({ stored: false, fights: 0, search: '', pathname: '/' }), true);
});

test('lessons.ts cites Lead\'s ruling, not Dom\'s 10-05 words, for the override', async () => {
  const { readFileSync } = await import('node:fs');
  const head = readFileSync(new URL('../src/lessons.ts', import.meta.url), 'utf8').slice(0, 2200);
  assert.match(head, /Lead ruling 2026-10-06 under Dom's delegation, scoped to the scripted first loss/); assert.doesNotMatch(head, /Dom 2026-10-05/);
});
