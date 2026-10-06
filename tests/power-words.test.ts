import test from 'node:test';
import assert from 'node:assert/strict';
import { POWER_WORD_GAIN, POWER_WORDS, powerWordFor } from '../src/power-words.ts';

test('muted, like the other voices', () => assert.equal(POWER_WORD_GAIN, 0));

test('every word is invented letters only, 2-3 syllables, and unique across both casters', () => {
  const all = Object.values(POWER_WORDS).flat();
  assert.equal(new Set(all.map((w) => w.toLowerCase())).size, all.length);
  for (const w of all) {
    assert.match(w, /^[A-Z][a-z]+$/);
    const syllables = (w.toLowerCase().match(/[aeiouy]+/g) ?? []).length;
    assert.ok(syllables >= 2 && syllables <= 3, `${w}: ${syllables} syllables`);
  }
});

test('the word is picked by the cast tick for the Witch and the Plague Doctor only', () => {
  assert.equal(powerWordFor('witch', 0), 'Ashvael');
  assert.equal(powerWordFor('witch', 4), 'Ixoreth');
  assert.equal(powerWordFor('plaguedoctor', 5), 'Thaniveck');
  assert.equal(powerWordFor('witch', 4), powerWordFor('witch', 4));
  assert.equal(powerWordFor('goblin', 3), undefined);
});
