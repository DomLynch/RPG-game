import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_ORDER, lessonText, nextLesson, type LessonId } from '../src/lessons.ts';

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
