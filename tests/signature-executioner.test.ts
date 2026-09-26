import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { SIGNATURES } from '../src/signature.ts';
import '../src/signature-executioner.ts';

const fighters = [{}, {}] as unknown as readonly [Fighter, Fighter];
const missed = (actor: 0 | 1, move: string): CombatEvent => ({ tick: 1, type: 'AttackMissed', actor, move: move as CombatEvent['move'] });

test('the Reaping Scar answers only his own heavy that missed: not a light miss, the player\'s miss, or a heavy that landed', () => {
  const scar = SIGNATURES.executioner?.find((e) => e.variant === 'A');
  assert.equal(scar?.name, 'Reaping Scar');
  const when = (e: CombatEvent) => scar!.when(e, fighters);
  assert.equal(when(missed(1, 'heavy_overhead')), true, 'his heavy missed');
  assert.equal(when(missed(1, 'light_right')), false, 'his light missed');
  assert.equal(when(missed(0, 'heavy_overhead')), false, 'the player\'s heavy missed');
  assert.equal(when({ tick: 1, type: 'Hit', actor: 1, target: 0, move: 'heavy_overhead', damage: 18 }), false, 'his heavy landed');
  assert.equal(when({ tick: 1, type: 'Dodged', actor: 0, target: 1, move: 'heavy_overhead' }), false, 'the player dodged it');
});
