import test from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIAL_READY, tutorialPrompt } from '../src/tutorial-ui.ts';
import { TUTORIAL_STEPS } from '../src/tutorial.ts';


test('every tutorial step has one short word and a how line, in the step order', () => {
  const words = TUTORIAL_STEPS.map((id) => tutorialPrompt(id, 0, false)!);
  for (const p of words) { assert.ok(p.word.length <= 8 && p.word === p.word.toUpperCase(), p.word); assert.ok(p.how.length > 0 && p.how.length <= 40, p.how); }
  assert.deepEqual(words.map((p) => p.word), ['SLASH', 'STAB', 'HEAVY', 'GUARD', 'PARRY', 'KICK', 'ROLL']);
});

test('the parry says NOW! only while the fight says the window is open, and only on that step', () => {
  assert.equal(tutorialPrompt('parry', 4, false)!.word, 'PARRY');
  assert.deepEqual([tutorialPrompt('parry', 4, true)!.word, tutorialPrompt('parry', 4, true)!.now], ['NOW!', true]);
  assert.equal(tutorialPrompt('roll', 6, true)!.word, 'ROLL', 'NOW! belongs to the parry step only');
});

test('after the last step the prompt is the ready card; before any fight state it is nothing', () => {
  assert.equal(tutorialPrompt(null, TUTORIAL_STEPS.length, false), TUTORIAL_READY);
  assert.equal(TUTORIAL_READY.ready, true);
  assert.equal(tutorialPrompt(null, 0, false), null);
});
