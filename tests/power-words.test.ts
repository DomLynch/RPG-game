import test from 'node:test';
import assert from 'node:assert/strict';
import { announcePowerWord, POWER_WORD_GAIN, POWER_WORDS, powerWordFor, powerWordsLook } from '../src/power-words.ts';

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

test('the wind-up announces the word as a muted event, and nothing for other casters', () => {
  const seen: { word: string; actor: number; tick: number; gain: number }[] = [];
  const target = { dispatchEvent: (e: Event) => { seen.push((e as CustomEvent).detail); return true; } };
  announcePowerWord('witch', 4, target); announcePowerWord('goblin', 4, target);
  assert.deepEqual(seen, [{ word: 'Ixoreth', actor: 1, tick: 4, gain: 0, opponent: 'witch' }]);
});

test('?look=powerwords is a look test: absent = silent', () => {
  assert.equal(powerWordsLook(''), false);
  assert.equal(powerWordsLook('?look=armfeel'), false);
  assert.equal(powerWordsLook('?look=powerwordsx'), false);
  assert.equal(powerWordsLook('?x=1&look=powerwords&y=2'), true);
});

test('the chant: a syllable per vowel group, onset and coda kept', async () => {
  const { syllables } = await import('../src/fight/sound/power-word.ts');
  assert.deepEqual(syllables('Ashvael'), [{ onset: '', vowels: 'a', coda: '' }, { onset: 'shv', vowels: 'ae', coda: 'l' }]);
  for (const w of Object.values(POWER_WORDS).flat()) assert.ok(syllables(w).length >= 2, w);
});
