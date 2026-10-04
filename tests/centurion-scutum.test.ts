// The Centurion's loadout by level and the scutum's guard (SCOPE shield line; RV18, Combat 2026-09-27).
import test from 'node:test';
import assert from 'node:assert/strict';
import { covers, guardOf, opponentFighter } from '../src/duel.ts';
import { LEVELS, LEVEL_ANCHORS, OPPONENTS, SCUTUM, opponentAt } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';

test('the Centurion fights with the trident as a Recruit and with gladius + scutum from Legionary (level 6) on', () => {
  for (let l = 1; l <= LEVELS; l++) {
    const o = opponentAt(OPPONENTS.veteran, l), armed = l >= LEVEL_ANCHORS.easy;
    assert.equal(o.weapon, armed ? 'gladius' : 'trident', `level ${l}`);
    assert.equal(o.guard?.wide ?? false, armed, `level ${l}`);
  }
  assert.equal(OPPONENTS.veteran.weapon, 'trident', 'the roster entry is the Recruit\'s');
});

test('the scutum is a guard profile only: both flanks, stops heavies, a cheaper hold, posture drains faster', () => {
  const f = opponentFighter(opponentAt(OPPONENTS.veteran, LEVEL_ANCHORS.normal), { ...TARGET, heading: 0, distance: 0 });
  const g = guardOf(f);
  assert.equal(g.wide, true); assert.equal(g.stopsHeavy, true); assert.equal(g.heavyBreaks, false);
  assert.ok(g.costScale < 1 && g.postureDecay > 1, JSON.stringify(g));
  assert.deepEqual(Object.keys(SCUTUM).sort(), ['costScale', 'heavyBreaks', 'postureDecay', 'stopsHeavy', 'wide'], 'no damage or attack field');
  for (const side of ['left', 'right'] as const) {
    assert.ok(covers({ ...f, guardDirection: side }, 'left') && covers({ ...f, guardDirection: side }, 'right'), `a ${side} guard covers both flanks`);
    assert.equal(covers({ ...f, guardDirection: side }, 'overhead'), false, 'a flank guard does not cover overhead');
  }
  const plain = opponentFighter(OPPONENTS.pitborn, { ...TARGET, heading: 0, distance: 0 });
  assert.equal(covers({ ...plain, guardDirection: 'left' }, 'left'), false, 'no shield: a left guard still misses the left cut (it covers the right)');
  assert.equal(guardOf(plain).wide, false); assert.equal(guardOf(plain).postureDecay, 1);
});
