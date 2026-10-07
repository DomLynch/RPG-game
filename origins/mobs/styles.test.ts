// Mob styles: each resolves to a real roster opponent with real AI profile rows, and only the beast flees, below its threshold.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OPPONENTS, opponentAt } from '../../src/moves.ts';
import { ROSTER } from '../../src/roster.ts';
import { MOB_STYLE, MOB_STYLES, fleesNow, styleOpponent } from './styles.ts';

test('every mob style resolves to a live roster opponent with an AI profile at the first and last ladder level', () => {
  for (const style of MOB_STYLES) {
    const id = styleOpponent(style);
    assert.ok(id && id in ROSTER, `${style} -> ${id} is not in the roster`);
    assert.ok(!(ROSTER[id] as { hold?: boolean }).hold, `${style} -> ${id} is held off the beta ladder`);
    assert.ok(OPPONENTS[id], `${style} -> ${id} has no OPPONENTS row`);
    for (const level of [1, 50]) assert.ok(opponentAt(OPPONENTS[id], level).profiles.normal.reaction > 0, `${style} has no profile at level ${level}`);
  }
  assert.equal(styleOpponent('dragon'), undefined);
});

test('only the beast flees, and only strictly below its threshold; a dead or zero-max mob never flees', () => {
  assert.equal(MOB_STYLE.beast.fleeBelow, 0.3);
  assert.equal(fleesNow('beast', 100, 100), false);
  assert.equal(fleesNow('beast', 30, 100), false);
  assert.equal(fleesNow('beast', 29, 100), true);
  assert.equal(fleesNow('beast', 1, 100), true);
  assert.equal(fleesNow('beast', 0, 100), false);
  assert.equal(fleesNow('beast', 5, 0), false);
  for (const s of ['brute', 'skirmisher', 'caster'] as const) assert.equal(fleesNow(s, 1, 100), false);
});
