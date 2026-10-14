// sandbox-mech: clock fighter. A `poison` row makes a creature's landed special poison its target: `damage` health every `every` ticks for `duration` ticks, never to death. No rows (trunk) = nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const d = DEFS as unknown as { poison: { opponent: string; damage: number; every: number; duration: number }[] };
const shipped = d.poison.length;
d.poison.push({ opponent: 'plaguedoctor', damage: 2, every: 60, duration: 600 });
const { createFighter, opponentFighter, stepDuel, idleIntent } = await import('../src/fight/duel.ts');
const { OPPONENTS } = await import('../src/fight/moves.ts');
const { poisonOf, poisonTick } = await import('../src/fight/sandbox-rules.ts');
const idle = () => ({ ...idleIntent(), lock: false });
const setup = () => {
  const doctor = opponentFighter(OPPONENTS.plaguedoctor, { x: 0, z: 0, heading: 0, distance: 0 }, 'ready');
  const hero = { ...createFighter({ x: 0, z: 3, heading: Math.PI, distance: 0 }, 'ready'), poisonUntil: 600, poisonEnemy: 'plaguedoctor' };
  return { tick: 0, fighters: [hero, doctor], finish: null, events: [] } as never as { fighters: { health: number; poisonUntil?: number }[] };
};

test('trunk ships no poison', () => assert.equal(shipped, 0));
test('a row names its creature; the tick lands on every step and not between', () => {
  const row = poisonOf('plaguedoctor')!;
  assert.ok(row && !poisonOf('witch'));
  assert.equal(poisonTick(row, 600, 540), 2);
  assert.equal(poisonTick(row, 600, 541), 0);
  assert.equal(poisonTick(row, 600, 601), 0, 'over');
});
test('poisoned: 2 health a second for 10 s, then it ends', () => {
  let duel = setup(); const start = duel.fighters[0]!.health;
  for (let i = 0; i < 660; i++) duel = stepDuel(duel as never, [idle(), idle()]) as never;
  assert.equal(start - duel.fighters[0]!.health, 20, '10 ticks of 2');
  assert.equal(duel.fighters[0]!.poisonUntil, undefined, 'the poison has ended');
});
test('poison never kills: it stops at 1 health', () => {
  let duel = setup(); duel.fighters[0]!.health = 3;
  for (let i = 0; i < 660; i++) duel = stepDuel(duel as never, [idle(), idle()]) as never;
  assert.equal(duel.fighters[0]!.health, 1);
});
