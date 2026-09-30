// The ladder's level-1 gate (Strategy 2026-09-27: "the gate that matters most"): a first-timer who only taps attack, in reach or not,
// with the day-one Pommel carried, beats EVERY ladder opponent at level 1 in at least 44 of 48 fights. The full level screen (levels
// 1–46 × every strategy) is Combat's sweep, not a unit test; this row is what a change to the novice rule or body must never break.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS } from '../src/moves.ts';
import { TAP_ATTACK, battery } from './strategies.ts';

test('level 1: a tap-attacking first-timer beats every ladder opponent in ≥ 44 / 48 fights [slow]', () => {
  const rows = LADDER.map(o => [o.id, battery(1, 48, 7200, OPPONENTS[o.id], TAP_ATTACK, 'longsword', 'pommel')['tap attack'].wins] as const);
  const table = rows.map(([id, wins]) => `${id} ${wins}`).join(', ');
  for (const [id, wins] of rows) assert.ok(wins >= 44, `${id}: ${wins}/48 at level 1 (${table})`);
});
