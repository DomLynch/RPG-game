// DRAFT (Lead 2026-10-19, the combat gate): the level-1 warden's first special waits the opener row's ticks (rows80-defs.json foeOpeners), so its first move is a telegraphed attack, not a shove.
// Under the RV80 rows only: an older record keeps the rules' number, the player keeps the 2 s row, a foe above the row's maxLevel keeps it too.
import './lib/era-on.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { forceSandbox, setRows80 } from '../src/fight/sandbox-era.ts';
import { foeSpecialFirst, specialFirst } from '../src/fight/rows80.ts';
import { withSpecials, type Duel } from '../src/fight/duel.ts';
import { RULES } from '../src/fight/moves.ts';
import DEFS from '../src/fight/rows80-defs.json' with { type: 'json' };

const opener = DEFS.foeOpeners[0]!;
const bare = (): Duel => ({ fighters: [{}, {}] } as unknown as Duel);

test('the opener row: a foe at or under its maxLevel waits its ticks for the first special, a higher level keeps the 2 s row', () => {
  assert.equal(foeSpecialFirst(1, RULES.special.first), opener.ticks);
  assert.ok(opener.ticks > specialFirst(RULES.special.first), 'later than the 2 s row');
  assert.equal(foeSpecialFirst(opener.maxLevel + 1, RULES.special.first), specialFirst(RULES.special.first));
});

test('withSpecials: the level-1 foe gets the opener ticks, the player and a level-2 foe the 2 s row', () => {
  const first = withSpecials(bare(), 1, null), later = withSpecials(bare(), opener.maxLevel + 1, null);
  assert.equal(first.fighters[1].skillCooldown, opener.ticks);
  assert.equal(first.fighters[0].skillCooldown, specialFirst(RULES.special.first), 'the player keeps the 2 s row');
  assert.equal(later.fighters[1].skillCooldown, specialFirst(RULES.special.first));
});

test('an older record (RV80 rows off) keeps the rules\' own first-special number', () => {
  setRows80(false);
  try { assert.equal(foeSpecialFirst(1, RULES.special.first), RULES.special.first); assert.equal(withSpecials(bare(), 1, null).fighters[1].skillCooldown, RULES.special.first); }
  finally { forceSandbox(undefined); setRows80(true); }
});
