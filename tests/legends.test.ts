// Legends (Dom via Strategy, 2026-09-27): ten opponents × ten rungs, every row filled, every backstory short enough for the 375-wide card,
// and the rung read off the career ladder the HUD uses rather than a second mapping.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rankFor } from '../src/career.ts';
import { levelOf } from '../src/grades.ts';
import { LEGEND_OPPONENTS, LEGENDS, legendAt, legendForLevel } from '../src/legends.ts';
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
      assert.match(legend.backstory, /In Frankendom (he|she) fights/, `${id} tier ${i + 1} speaks in the arena voice`);
    }
  }
  assert.equal(new Set(LEGEND_OPPONENTS.flatMap((id) => LEGENDS[id].map((l) => l.name))).size, 100, 'no name used twice');
});

test('legends: a fight shows the legend of its own level\'s rank — the HUD\'s title, dial-down included', () => {
  assert.equal(legendForLevel('veteran', 1).name, 'Marcus the Recruit');
  assert.equal(legendForLevel('knight', 46).name, 'Thor');
  assert.equal(legendForLevel('goblin', 6).name, 'Kobold', 'level 6 = Legionary I = tier 2');
  for (let level = 1; level <= 46; level++) {
    assert.equal(rankFor(level - 1).level, level, 'level L is the rank of L − 1 wins');
    assert.equal(legendForLevel('witch', level), legendAt('witch', levelOf(rankFor(level - 1).title)), `level ${level}`);
  }
});

test('legends: the pronoun matches the opponent — the Dwarf is he at every rung, the Shieldmaiden she', () => {
  for (const [id, pronoun] of [['dwarf', 'he'], ['shieldmaiden', 'she']] as const) {
    for (const [i, legend] of LEGENDS[id].entries()) assert.match(legend.backstory, new RegExp(`In Frankendom ${pronoun} fights`), `${id} tier ${i + 1} (${legend.name})`);
  }
});
