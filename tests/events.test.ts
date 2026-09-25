// Who took the damage (src/events.ts): the one helper every summary reads, held against duel.ts's side conventions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { blowsTaken, struck } from '../src/events.ts';
import type { CombatEvent } from '../src/duel.ts';

const e = (fields: Partial<CombatEvent> & { type: CombatEvent['type'] }): CombatEvent => ({ tick: 1, actor: 0, ...fields });

test('events: a landed blow hurts its target; a block hurts its ACTOR (the defender) by the chip it let through; a whip hurts the whipped; a clean defence hurts nobody', () => {
  assert.equal(struck(e({ type: 'Hit', actor: 1, target: 0, damage: 12 })), 0);
  assert.equal(struck(e({ type: 'Hit', actor: 0, target: 1, damage: 12 })), 1);
  assert.equal(struck(e({ type: 'GuardBroken', actor: 1, target: 0, damage: 20 })), 0);
  assert.equal(struck(e({ type: 'Killed', actor: 0, target: 1, damage: 9 })), 1);
  assert.equal(struck(e({ type: 'Blocked', actor: 0, target: 1, damage: 3 })), 0, 'the player blocked and took the chip');
  assert.equal(struck(e({ type: 'Blocked', actor: 1, target: 0, damage: 3 })), 1, 'the warden blocked and took the chip: not the player\'s');
  assert.equal(struck(e({ type: 'Blocked', actor: 0, target: 1, perfect: true })), null, 'a perfect block lets nothing through');
  assert.equal(struck(e({ type: 'Whipped', actor: 0, target: 0, damage: 3 })), 0);
  for (const type of ['Parried', 'Dodged', 'Staggered', 'AttackStarted', 'PostureBroken'] as const) assert.equal(struck(e({ type, actor: 0, target: 1, damage: 5 })), null, type);
});

test('events: blowsTaken counts the opponent\'s blows on one side only — the daily count that read `target` for every type counted the warden\'s chip against the player and missed the player\'s own', () => {
  const log: CombatEvent[] = [
    e({ type: 'Hit', actor: 1, target: 0, damage: 12 }),             // player hit: 1
    e({ type: 'Blocked', actor: 0, target: 1, damage: 3 }),          // player blocked, chip: 2 (the old filter missed it: target is 1)
    e({ type: 'Blocked', actor: 1, target: 0, damage: 3 }),          // warden blocked, chip: the warden's (the old filter counted it: target is 0)
    e({ type: 'Blocked', actor: 0, target: 1, perfect: true }),      // perfect block: nothing
    e({ type: 'GuardBroken', actor: 1, target: 0, damage: 20 }),     // 3
    e({ type: 'Whipped', actor: 0, target: 0, damage: 3 }),          // the wall's, not the warden's
    e({ type: 'Hit', actor: 0, target: 1, damage: 15 }),             // the warden's
  ];
  assert.equal(blowsTaken(log, 0), 3);
  assert.equal(blowsTaken(log, 1), 2);
  const old = log.filter((x) => x.target === 0 && (x.type === 'Hit' || x.type === 'GuardBroken' || (x.type === 'Blocked' && (x.damage ?? 0) > 0))).length;
  assert.equal(old, 3, 'the old expression lands on the same total here only by coincidence: one wrong chip in, one right chip out');
  assert.equal(blowsTaken(log.filter((x) => x.type !== 'Blocked' || x.actor === 0), 0), 3);
  assert.equal(log.filter((x) => x.type !== 'Blocked' || x.actor === 1).filter((x) => x.target === 0 && (x.type === 'Hit' || x.type === 'GuardBroken' || (x.type === 'Blocked' && (x.damage ?? 0) > 0))).length, 3, 'drop the player\'s own chip and the old count does not move: it never saw it');
});
