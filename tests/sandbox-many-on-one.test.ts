// sandbox-mech: manyOnOne. A world-mob fight stream that names its attacker index scales that foe's damage to the player by the swarm-defs.json `attackers` row (1st 100%, 2nd 50%, 3rd 30%); no rows or no index = untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import SWARM_DEFS from '../src/fight/swarm-defs.json' with { type: 'json' };

const shipped = (SWARM_DEFS as unknown as { attackers: unknown[] }).attackers.length;
(SWARM_DEFS as unknown as { attackers: unknown[] }).attackers = [{ index: 1, 'world-mob': 1000 }, { index: 2, 'world-mob': 500 }, { index: 3, 'world-mob': 300 }];
const { createFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
type Duel = Parameters<typeof stepDuel>[0];

// The foe (side 1) swings a light at the player (side 0), who stands still; same seed every time so the only difference is the attacker index.
const damageFrom = (attacker: number | undefined): number => {
  let d: Duel = { tick: 0, fighters: [createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready'), createFighter({ x: 0, z: 1.4, heading: Math.PI, distance: 0 }, 'ready')], finish: null, events: [], roll: { seed: 77, hits: 0, ...(attacker ? { attacker } : {}) } };
  const start = d.fighters[0].health;
  for (let t = 0; t < 60; t++) d = stepDuel(d, [idleIntent(), t === 0 ? { ...idleIntent(), action: 'light' } : idleIntent()]);
  return start - d.fighters[0].health;
};

test('trunk ships no attackers rows', () => assert.equal(shipped, 0));
test('the nth attacker hits for its row\'s share', () => {
  const first = damageFrom(1), second = damageFrom(2), third = damageFrom(3), none = damageFrom(undefined);
  assert.ok(first > 0, 'the light lands');
  assert.equal(none, first, 'no index = untouched');
  assert.equal(second, Math.round(first * 0.5));
  assert.equal(third, Math.round(first * 0.3));
});
