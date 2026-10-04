// Legend name everywhere (Dom via Strategy, 2026-09-28): after the versus card the opponent is called by his legend on every surface,
// and the possessive is always "'s" — "Mars's boots", never "Mars' boots". These are the surfaces that are pure functions; the DOM ones
// (main.ts) are pinned by the browser rows.
import assert from 'node:assert/strict';
import test from 'node:test';
import { initialPractice, practiceHint } from '../src/combat.ts';
import { LEGEND_OPPONENTS, LEGENDS } from '../src/legends.ts';
import { LOOT, lootName, slotOf } from '../src/loot.ts';

test('legend surfaces: the take card names every legend with a plain "\'s", even a name ending in s', () => {
  let pieces = 0;
  for (const id of LEGEND_OPPONENTS) {
    for (const piece of LOOT[id] ?? []) {
      for (const { name } of LEGENDS[id]) {
        assert.equal(lootName(piece, name), `${name}'s ${slotOf(piece).toLowerCase()}`);
        pieces++;
      }
    }
  }
  assert.ok(pieces > 0, 'at least one legend opponent drops loot');
  assert.equal(lootName(LOOT.veteran![0]!, 'Mars'), `Mars's ${slotOf(LOOT.veteran![0]!).toLowerCase()}`);
});

test('legend surfaces: the win line names every legend, never the class', () => {
  const down = { ...initialPractice(), health: 0 };
  for (const id of LEGEND_OPPONENTS) {
    for (const { name } of LEGENDS[id]) assert.equal(practiceHint(down, 'Class', name), `You beat ${name}. Ready for a rematch?`);
  }
});
