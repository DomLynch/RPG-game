import test from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIAL_READY, parryNow, tutorialPrompt } from '../src/tutorial-ui.ts';
import { TUTORIAL_STEPS } from '../src/tutorial.ts';

const calm = { threat: false, threatMove: null, enemyAge: 0 } as const;

test('every tutorial step has one short word and a how line, in the step order', () => {
  const words = TUTORIAL_STEPS.map((id) => tutorialPrompt(id, 0, calm)!);
  for (const p of words) { assert.ok(p.word.length <= 8 && p.word === p.word.toUpperCase(), p.word); assert.ok(p.how.length > 0 && p.how.length <= 40, p.how); }
  assert.deepEqual(words.map((p) => p.word), ['SLASH', 'STAB', 'HEAVY', 'GUARD', 'PARRY', 'KICK', 'ROLL']);
});

test('the parry says NOW! only while the heavy swing is inside its last third of a second', () => {
  assert.equal(tutorialPrompt('parry', 4, { threat: true, threatMove: 'heavy_overhead', enemyAge: 4 }).word, 'PARRY');
  assert.equal(parryNow({ threat: true, threatMove: 'heavy_overhead', enemyAge: 12 }), true);
  assert.equal(tutorialPrompt('parry', 4, { threat: true, threatMove: 'heavy_overhead', enemyAge: 12 })!.now, true);
  assert.equal(parryNow({ threat: false, threatMove: 'heavy_overhead', enemyAge: 12 }), false, 'the blow is over');
  assert.equal(parryNow({ threat: true, threatMove: 'thrust', enemyAge: 12 }), false, 'a thrust is rolled, not parried');
  assert.equal(tutorialPrompt('roll', 6, { threat: true, threatMove: 'heavy_overhead', enemyAge: 12 })!.word, 'ROLL', 'NOW! belongs to the parry step only');
});

test('after the last step the prompt is the ready card; before any fight state it is nothing', () => {
  assert.equal(tutorialPrompt(null, TUTORIAL_STEPS.length, calm), TUTORIAL_READY);
  assert.equal(TUTORIAL_READY.ready, true);
  assert.equal(tutorialPrompt(null, 0, calm), null);
});
