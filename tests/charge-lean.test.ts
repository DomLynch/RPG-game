import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARGE_LEAN, holdingCharge } from '../src/characters.ts';
import { TRIDENT } from '../src/moves.ts';

const chamber = TRIDENT.moves.heavy_overhead.chamber!;
const f = (o: Partial<Parameters<typeof holdingCharge>[0]>) => holdingCharge({ phase: 'attack', move: 'heavy_overhead', charge: 5, age: chamber, weapon: 'trident', ...o });

test('the charged-heavy lean holds while a charging swing is parked at its chamber, and drops the tick it is released', () => {
  assert.equal(f({}), true, 'parked at the chamber, charging');
  assert.equal(f({ charge: 40 }), true, 'still held once charged');
  assert.equal(f({ charge: 0, age: chamber - 3 }), false, 'the wind-up before the park');
  assert.equal(f({ age: chamber + 1 }), false, 'released: the swing runs on');
  assert.equal(f({ move: 'light_right' }), false, 'a move that does not charge');
  assert.equal(f({ phase: 'ready' }), false, 'not attacking');
});

test('the lean is presentation data for the Witch first (Strategy picked B, Lean-out)', () => {
  assert.ok(CHARGE_LEAN.witch && CHARGE_LEAN.witch.side > 0 && CHARGE_LEAN.witch.arm > 0);
});
