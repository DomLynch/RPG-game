// The Defensive stance's `recover` row (stance-defs.json: 250 per mille) is read by the sim: duel.ts drains posture by stanced(f, 'recover', R.posture.decay), so a Defensive fighter sheds posture 1.25x as fast.
// (A grep for `.recover` misses it: the key is a string argument to stanced().) This pins that it is LIVE, and that it is the row, not a constant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDuel, type Duel } from '../src/fight/duel.ts';
import { FIRST_STANCE_ROWS_VERSION, underStanceRows } from '../src/fight/stance-era.ts';
import { STANCES, type StanceId } from '../src/fight/stance.ts';
import { RULES } from '../src/fight/moves.ts';
import { arena, idle } from './strategies.ts';

const START = 60, TICKS = 30;
const shed = (stance: StanceId | undefined): number => {
  const d0 = arena();
  let d: Duel = { ...d0, fighters: [{ ...d0.fighters[0], posture: START, postureRest: 0, ...(stance ? { stance } : {}) }, d0.fighters[1]] };
  underStanceRows(FIRST_STANCE_ROWS_VERSION, () => { for (let t = 0; t < TICKS; t++) d = stepDuel(d, [idle(), idle()]); });
  return START - d.fighters[0].posture;
};

test('Defensive sheds posture faster by exactly its recover row; the others do not', () => {
  const plain = shed(undefined), defensive = shed('defensive');
  assert.ok(plain > 0 && plain < START, `posture drains at all (${plain} over ${TICKS} ticks)`);
  assert.equal(STANCES.defensive.recover, 250);
  const ratio = defensive / plain;
  assert.ok(Math.abs(ratio - (1000 + STANCES.defensive.recover!) / 1000) < 0.02, `Defensive drains ${ratio.toFixed(3)}x as fast, the row says 1.25x`);
  assert.equal(shed('aggressive'), plain, 'a stance with no recover row drains at the plain rate');
  assert.equal(shed('trickster'), plain);
  assert.ok(RULES.posture.decay > 0);
});
