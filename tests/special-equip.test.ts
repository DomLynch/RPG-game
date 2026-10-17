// The two SPECIAL slots' store (src/core/special-equip.ts): the picks come from the betaCut row, a skill never sits in both slots, a pick outside the row is dropped, a viewer without storage keeps nothing.
import assert from 'node:assert/strict';
import test from 'node:test';
import { SPECIAL_SLOT_COUNT, equipSpecial, equippedSpecial, equippedSpecials, onSpecialsChanged, specialChoices, useSpecialStore } from '../src/core/special-equip.ts';

const mem = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } }; };

test('the picker lists the row\'s six in order, each with a role line', () => {
  assert.deepEqual(specialChoices().map((c) => c.id), ['lunge', 'ironrush', 'pommel', 'shove', 'cleave', 'stomp']);
  assert.deepEqual(specialChoices().map((c) => c.role), ['opener', 'opener', 'control', 'control', 'heavy', 'posture break']);
  assert.equal(SPECIAL_SLOT_COUNT, 2);
});

test('a pick is kept per slot, moves rather than duplicates, and a skill outside the row is refused', () => {
  const s = mem(); useSpecialStore(s); let changes = 0; onSpecialsChanged(() => { changes++; });
  assert.deepEqual(equippedSpecials(), [undefined, undefined]);
  equipSpecial('pommel', 0); equipSpecial('stomp', 1);
  assert.deepEqual(equippedSpecials(), ['pommel', 'stomp']); assert.equal(equippedSpecial(1), 'stomp');
  equipSpecial('stomp', 0);   // the same skill in the other slot moves
  assert.deepEqual(equippedSpecials(), ['stomp', undefined], 'never the same skill in both slots');
  equipSpecial('witchfire', 1); assert.deepEqual(equippedSpecials(), ['stomp', undefined], 'a skill outside the row is not equipped');
  equipSpecial(undefined, 0); assert.deepEqual(equippedSpecials(), [undefined, undefined]); assert.equal(s.data.size, 0, 'an empty loadout leaves no key');
  assert.ok(changes >= 5, 'every pick tells the HUD');
});

test('a corrupt value reads as no pick, and a viewer without storage keeps none', () => {
  const s = mem(); useSpecialStore(s); s.setItem('frankendom.special.slots.v1', '{not json'); assert.deepEqual(equippedSpecials(), [undefined, undefined]);
  useSpecialStore(undefined); equipSpecial('lunge', 0); assert.deepEqual(equippedSpecials(), [undefined, undefined]);
});
