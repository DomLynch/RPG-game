import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, openingOf } from '../src/combat.ts';
import { RULES } from '../src/moves.ts';
import type { CombatEvent, Duel } from '../src/duel.ts';

const base = (): Duel => initialPractice().duel;
const staggered = (d: Duel, side: 0 | 1, stun: number, age: number, events: CombatEvent[] = []): Duel => {
  const fighters = [...d.fighters] as Duel['fighters'];
  fighters[side] = { ...d.fighters[side], phase: 'hurt', stun, age };
  fighters[1 - side as 0 | 1] = { ...d.fighters[1 - side as 0 | 1], punish: stun - age };
  return { ...d, fighters, events };
};

test('nobody is open in a plain fight', () => assert.equal(openingOf(base()), null));

test('a parried attacker is open for exactly the stagger the sim gives him', () => {
  const parried: CombatEvent = { tick: 1, type: 'Parried', actor: 0, target: 1, move: 'light_right' };
  const first = openingOf(staggered(base(), 1, RULES.parryStun, 0, [parried]));
  assert.deepEqual(first, { side: 1, kind: 'parry', left: RULES.parryStun, of: RULES.parryStun });
  const later = openingOf(staggered(base(), 1, RULES.parryStun, 50), first);
  assert.deepEqual(later, { side: 1, kind: 'parry', left: RULES.parryStun - 50, of: RULES.parryStun }, 'the kind is carried, the count runs down');
  assert.equal(openingOf(staggered(base(), 1, RULES.parryStun, RULES.parryStun)), null, 'closed when the punish window is spent');
});

test('a broken posture is an opening of its own kind; an ordinary hit stagger is not (no punish window)', () => {
  const broken: CombatEvent = { tick: 1, type: 'PostureBroken', actor: 0, target: 1 };
  assert.equal(openingOf(staggered(base(), 1, 60, 0, [broken]))?.kind, 'posture');
  const hurt = base(), f = [...hurt.fighters] as Duel['fighters'];
  f[1] = { ...f[1], phase: 'hurt', stun: 24, age: 3 };
  assert.equal(openingOf({ ...hurt, fighters: f }), null);
});
