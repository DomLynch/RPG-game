import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDuel, withRoll, type Duel } from '../src/duel.ts';
import { ROLL_BAND, percentOf, rollPercent, rolledDamage, rollUnit } from '../src/roll.ts';
import { hashDuel } from '../src/net/rollback.ts';
import { rollDamage, seededSource } from '../origins/luck/luck.ts';
import { act, arena, idle } from './strategies.ts';

// The world-mob damage roll (Dom 2026-10-07: +/-10% on every blow, both directions, world-mob fights only). One engine: the sim owns the draw and the arithmetic,
// origins/luck/luck.ts stays the Origins view of the same numbers, and the first test pins them equal.
// One definition (src/roll.ts), imported by the duel and by origins/luck: this is an IDENTITY test, not a copy-equality test. If either side ever grows its own formula again it fails here.
test('origins/luck and the duel share the one roll definition: same draw, same percent, same damage', () => {
  assert.equal(seededSource, rollUnit, 'luck.ts re-exports the sim\'s draw, it does not redefine it');
  for (const seed of [0, 1, 7, 0xdeadbeef, 0xffffffff]) for (let hit = 0; hit < 200; hit++) {
    const origin = rollDamage(25, seededSource(seed, hit));
    assert.equal(rollPercent(seed, hit), origin.percent);
    assert.equal(percentOf(seededSource(seed, hit)), origin.percent);
    for (const base of [1, 2, 9, 14, 25, 40]) assert.equal(rolledDamage(base, rollPercent(seed, hit)), rollDamage(base, seededSource(seed, hit)).damage);
  }
  const seen = new Set<number>(); for (let hit = 0; hit < 500; hit++) seen.add(rollPercent(3, hit));
  assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: 2 * ROLL_BAND + 1 }, (_, k) => k - ROLL_BAND), 'every whole percent from -10 to +10 occurs, none outside');
});

// Both men swing every 40 ticks at each other; the first blow of each lands the same tick with or without the roll.
const fight = (roll: number | null, ticks: number): Duel => {
  let d = arena(); if (roll !== null) d = withRoll(d, roll);
  for (let i = 0; i < ticks; i++) d = stepDuel(d, [i % 40 === 0 ? act('light') : idle(), i % 40 === 20 ? act('light') : idle()]);
  return d;
};
const hits = (d: Duel) => d.events.filter(e => e.type === 'Hit');

test('no roll: the step never grows a roll field and no event carries one (the Pit, PvP and the ladder)', () => {
  let d = arena();
  for (let i = 0; i < 400; i++) { d = stepDuel(d, [i % 40 === 0 ? act('light') : idle(), idle()]); assert.ok(!('roll' in d)); assert.ok(d.events.every(e => !('roll' in e))); }
  assert.ok(d.fighters[1].health < d.fighters[1].maxHealth, 'the swings did land');
  assert.equal(hashDuel(fight(null, 300)), hashDuel(fight(null, 300)));
});

test('a rolled blow is the plain blow scaled by its draw, numbered in order, and the health lost is exactly that', () => {
  const plain = arena(), seed = 12345;
  let a = plain, b = withRoll(plain, seed), n = 0;
  for (let i = 0; i < 500; i++) {
    const intents: [ReturnType<typeof idle>, ReturnType<typeof idle>] = [i % 40 === 0 ? act('light') : idle(), i % 40 === 20 ? act('light') : idle()];
    const hpB = [b.fighters[0].health, b.fighters[1].health];
    a = stepDuel(a, intents); b = stepDuel(b, intents);
    for (const e of hits(b)) {
      const p = rollPercent(seed, n++);
      assert.equal(e.roll, p);
      assert.equal(e.damage, rolledDamage(hits(a).find(x => x.actor === e.actor)?.damage ?? e.damage ?? 0, p), 'the rolled blow is the plain one scaled');
      assert.equal(hpB[e.target!] - b.fighters[e.target!].health, e.damage, 'the health lost is the event\'s damage');
    }
    if (hits(b).length) break;
  }
  assert.ok(n >= 1, 'a blow landed');
  assert.equal(b.roll!.hits, n);
});

test('the roll runs both directions and replays: the same seed gives the same fight, another seed another', () => {
  const x = fight(77, 600), y = fight(77, 600), z = fight(78, 600);
  assert.equal(hashDuel(x), hashDuel(y));
  assert.notEqual(hashDuel(x), hashDuel(z));
  assert.ok(x.roll!.hits >= 2);
});
