import test from 'node:test';
import assert from 'node:assert/strict';
import { createFight } from '../src/fight/index.ts';
import { createFighter, idleIntent, opponentFighter } from '../src/duel.ts';
import { OPPONENTS, opponentAt, profileAt } from '../src/moves.ts';

const hero = () => createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'ready', 'longsword');
const foe = (x: number) => opponentFighter(opponentAt(OPPONENTS.goblin, 1), { x, z: 0, heading: Math.PI, distance: 0 }, 'ready');

test('createFight carries the wall and steps a duel; an Intent steers a slot without a profile', () => {
  const f = createFight({ fighters: [{ fighter: hero() }, { fighter: foe(1.2) }], wall: 1000 });
  assert.equal(f.duel.radius, 1000);
  const evs = f.step([{ ...idleIntent(), action: 'light' }]);
  assert.equal(f.duel.tick, 1);
  assert.ok(evs.some((e) => e.type === 'AttackStarted' && e.actor === 0));
  assert.deepEqual(f.duel.events, [...evs], 'the tick\'s events are on the duel too, as on the Pit\'s practice.duel');
  f.step();
  assert.ok(f.duel.events.every((e) => e.type !== 'AttackStarted'), 'and replaced by the next tick\'s');
});

test('a slot with a profile thinks for itself, and the same seed replays the same fight', () => {
  const run = () => {
    const seen: string[] = [];
    const f = createFight({ fighters: [{ fighter: hero() }, { fighter: foe(1.2), profile: profileAt(OPPONENTS.goblin, 1), seed: 7 }], onEvent: (e) => seen.push(`${f.duel.tick}:${e.type}:${e.actor}`) });
    for (let i = 0; i < 600; i++) f.step();
    return seen.join();
  };
  assert.ok(run().length > 0, 'the goblin attacks on its own');
  assert.equal(run(), run());
});
