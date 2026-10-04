// Legends (Dom via Strategy, 2026-09-27): ten opponents × ten rungs, every row filled, every backstory short enough for the 375-wide card,
// and the rung read off the career ladder the HUD uses rather than a second mapping.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rankFor } from '../src/career.ts';
import { levelOf } from '../src/grades.ts';
import { LEGEND_OPPONENTS, LEGENDS, legendAt, legendForLevel, portraitPath } from '../src/legends.ts';
import { ROSTER } from '../src/roster.ts';

test('legends: all 10 opponents × 10 tiers present, every field filled, backstories fit the card', () => {
  assert.deepEqual(Object.keys(LEGENDS), [...LEGEND_OPPONENTS]);
  assert.equal(LEGEND_OPPONENTS.length, 10);
  for (const id of LEGEND_OPPONENTS) {
    assert.ok(id in ROSTER, `${id} is a roster opponent`);
    assert.equal(LEGENDS[id].length, 10, `${id} has ten rungs`);
    for (const [i, legend] of LEGENDS[id].entries()) {
      for (const field of ['name', 'source', 'backstory'] as const) assert.ok(legend[field].trim(), `${id} tier ${i + 1} ${field} is empty`);
      assert.ok(legend.backstory.length <= 220, `${id} tier ${i + 1} (${legend.name}) backstory is ${legend.backstory.length} chars (max 220)`);
      // What the versus card renders (main.ts versus-lore): the source prefix counts against the clamp too.
      const lore = legend.source === 'generic' ? legend.backstory : `${legend.source}. ${legend.backstory}`;
      assert.ok(lore.length <= 171, `${id} tier ${i + 1} (${legend.name}) renders ${lore.length} chars: 171 is the longest known to fit the versus card's 3-line clamp at 375`);
      assert.match(legend.backstory, /In Frankendom (he|she) fights/, `${id} tier ${i + 1} speaks in the arena voice`);
    }
  }
  assert.equal(new Set(LEGEND_OPPONENTS.flatMap((id) => LEGENDS[id].map((l) => l.name))).size, 100, 'no name used twice');
});

test('legends: a fight shows the legend of its own level\'s rank — the HUD\'s title, dial-down included', () => {
  assert.equal(legendForLevel('veteran', 1).name, 'Crixus');
  assert.equal(legendForLevel('knight', 46).name, 'Thor');
  assert.equal(legendForLevel('goblin', 6).name, 'Kobold', 'level 6 = Legionary I = tier 2');
  for (let level = 1; level <= 46; level++) {
    assert.equal(rankFor(level - 1).level, level, 'level L is the rank of L − 1 wins');
    assert.equal(legendForLevel('witch', level), legendAt('witch', levelOf(rankFor(level - 1).title)), `level ${level}`);
  }
});
test('legends: the painted face is legends/<opponent>-<rung>.webp at the same rung as the name (versus card B4)', () => {
  assert.equal(portraitPath('goblin', 1), 'legends/goblin-1.webp');
  assert.equal(portraitPath('goblin', 6), 'legends/goblin-2.webp', 'level 6 = Legionary I = tier 2, as legendForLevel');
  assert.equal(portraitPath('knight', 46), 'legends/knight-10.webp');
  for (let level = 1; level <= 46; level++) assert.equal(portraitPath('witch', level), `legends/witch-${LEGENDS.witch.indexOf(legendForLevel('witch', level)) + 1}.webp`, `level ${level}`);
});

test('legends: the pronoun matches the opponent — the Dwarf is he at every rung, the Shieldmaiden she', () => {
  for (const [id, pronoun] of [['dwarf', 'he'], ['shieldmaiden', 'she']] as const) {
    for (const [i, legend] of LEGENDS[id].entries()) assert.match(legend.backstory, new RegExp(`In Frankendom ${pronoun} fights`), `${id} tier ${i + 1} (${legend.name})`);
  }
});

// Scripture of a living religion (Judaism, Christianity, Islam, Hinduism, Sikhism, Buddhism, Zoroastrianism, LDS): a source naming one fails.
// Living named-people folk heroes are out too (Anansi → Reynard, 2026-09-27); not machine-checkable, so review by hand.
const LIVING_SCRIPTURE = ['Bible', 'Hebrew Bible', 'Old Testament', 'New Testament', 'Tanakh', 'Torah', 'Talmud', 'Genesis', 'Exodus', 'Psalms', 'Gospel', 'Revelation', 'Quran', 'Koran', 'Hadith', 'Vedas', 'Upanishads', 'Bhagavad Gita', 'Mahabharata', 'Ramayana', 'Puranas', 'Guru Granth', 'Tripitaka', 'Avesta', 'Book of Mormon'];
// Empty since #930 and #936 swapped the last four (2026-09-28). Shrinks only: a name here that no longer fails fails this test.
const SCRIPTURE_KNOWN_FAIL: string[] = [];

test('legends: no source is the scripture of a living religion (known fails named, not skipped)', () => {
  const words = new RegExp(`\\b(${LIVING_SCRIPTURE.join('|')})\\b`, 'i');
  const failing = LEGEND_OPPONENTS.flatMap((id) => LEGENDS[id].filter((l) => words.test(l.source)).map((l) => l.name));
  assert.deepEqual(failing.filter((n) => !SCRIPTURE_KNOWN_FAIL.includes(n)), [], 'new rows sourced from living-religion scripture');
  assert.deepEqual(SCRIPTURE_KNOWN_FAIL.filter((n) => !failing.includes(n)), [], 'swapped out: remove these from SCRIPTURE_KNOWN_FAIL');
});
