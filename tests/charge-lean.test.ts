import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARGE_LEAN, holdingCharge } from '../src/characters.ts';
import { TRIDENT, WEAPONS } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';

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

test('every active opponent leans out on a held heavy, and every one of their heavies charges (Strategy picked B, roster sheet)', () => {
  for (const [id, entry] of Object.entries(ROSTER)) {
    if ('hold' in entry && entry.hold) continue;
    const lean = CHARGE_LEAN[id as keyof typeof CHARGE_LEAN];
    assert.ok(lean && lean.side !== 0, `${id} leans out to the side`);
    assert.ok(WEAPONS[entry.weapon].moves.heavy_overhead.charges, `${id}'s ${entry.weapon} heavy charges, so the lean can show`);
  }
});

test('the Goblin lifts his knife arm clear instead of leaning low (Strategy 2026-09-24: LEAN_LOW hid it behind the player)', () => {
  assert.ok((CHARGE_LEAN.goblin?.lift ?? 0) < 0, 'the knife arm rises');
});
