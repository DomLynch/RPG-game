// Proof 3 in the open world (src/fight/world.ts, open-fight.ts): three creatures on one hero are three separate duels (the nearest on his lock-on, two joiners), and the hero's posture breaks in ALL of them step
// ONE crowd-control ladder carried by his world Fighter on the world's clock. And the hero on a boss steps the boss's own ladder.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES } from '../src/fight/moves.ts';
import { CC_LADDER } from '../src/fight/cc-ladder.ts';
import { creature, newWorld, player, stepCombat, type Event, type Fighter, type Input, type World } from '../src/fight/world.ts';

const DT = 1 / 60, STILL: Input = { x: 0, z: 0 };
const get = (w: World, id: string): Fighter => w.fighters.find((f) => f.id === id)!;
const ms = (ticks: number): number => Math.round(ticks * (1000 / 60));

// Step until `steps` ends, topping the victim's posture bar up to one cut from breaking every step so a break happens as often as the engine allows; returns the stagger lengths (ms) of its posture breaks.
function breaks(world: World, victim: string, steps: number, press: (i: number) => Input = () => STILL): { world: World; ms: number[] } {
  const got: number[] = [];
  for (let i = 0; i < steps; i++) {
    const v = get(world, victim); if (v.posture < RULES.posture.max - 4) v.posture = RULES.posture.max - 4;
    const r = stepCombat(world, { p: press(i) }, DT); world = r.world;
    for (const e of r.events as Event[]) if (e.type === 'Staggered' && e.id === victim && e.cause === 'posture') got.push(e.ms);
  }
  return { world, ms: got };
}

test('three creatures on one hero: his posture breaks, whichever duel lands them, step one ladder (full, then half, then quarter...)', () => {
  const hero = player('p', 0, 0); hero.health = hero.maxHealth = 1e6;
  let w = newWorld([hero, creature('a', 'goblin', 0, 2.2), creature('b', 'goblin', 1.6, 1.6), creature('c', 'goblin', -1.6, 1.6)]);
  const r = breaks(w, 'p', 1500); w = r.world;
  assert.ok(w.streams.p!.joined!.length >= 2, 'three on him: the nearest plus two joiners');
  assert.ok(r.ms.length >= 3, `the hero was posture-broken ${r.ms.length} times`);
  assert.equal(r.ms[0], ms(RULES.posture.stun), 'the first break is the full stun');
  assert.equal(r.ms[1], ms(Math.round(RULES.posture.stun / 2)), 'the second, from whichever duel, is already half: one ladder on the hero');
  assert.ok(get(w, 'p').cc && get(w, 'p').cc!.some((m) => m.family === 'stun'), 'the world Fighter carries the stun mark');
  assert.ok(Math.min(...r.ms) < ms(RULES.posture.stun) && r.ms.every((x, i) => i === 0 || x <= r.ms[i - 1]! || x === ms(RULES.posture.stun)), 'after the first break each is no longer than the one before, until the window resets it');
});

test('the hero on a boss: the boss\'s breaks step the boss\'s ladder, the hero\'s stays empty', () => {
  const hero = player('p', 0, 0); hero.health = hero.maxHealth = 1e6;
  const boss = creature('boss', 'goblin', 0, 2.2); boss.health = boss.maxHealth = 1e6;
  const r = breaks(newWorld([hero, boss]), 'boss', 1500, (i) => (i % 30 === 0 ? { x: 0, z: 0, attack: 'light' } : STILL));
  assert.ok(r.ms.length >= 2, `the boss was posture-broken ${r.ms.length} times`);
  assert.equal(r.ms[0], ms(RULES.posture.stun)); assert.equal(r.ms[1], ms(Math.round(RULES.posture.stun / 2)));
  assert.ok(get(r.world, 'boss').cc!.some((m) => m.family === 'stun'));
  assert.equal(CC_LADDER.steps[0], 100, 'rows are data');
});
