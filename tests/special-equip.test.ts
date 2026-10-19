// The two SPECIAL slots' store (src/core/special-equip.ts): the picks come from the betaCut row, a skill never sits in both slots, a pick outside the row is dropped, a viewer without storage keeps nothing.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import { SPECIAL_SLOT_COUNT, equipSpecial, equippedSpecial, equippedSpecials, onSpecialsChanged, specialChoices, useSpecialStore } from '../src/core/special-equip.ts';

const mem = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } }; };

test('the picker lists the row\'s seven in order, each with a role line', () => {
  assert.deepEqual(specialChoices().map((c) => c.id), ['lunge', 'ironrush', 'pommel', 'shove', 'cleave', 'reaping', 'stomp']);
  assert.deepEqual(specialChoices().map((c) => c.role), ['opener', 'opener', 'control', 'control', 'heavy', 'sweep', 'posture break']);
  assert.equal(SPECIAL_SLOT_COUNT, 2);
});

test('a pick is kept per slot, moves rather than duplicates, and a skill outside the row is refused', () => {
  const s = mem(); useSpecialStore(s); let changes = 0; onSpecialsChanged(() => { changes++; });
  // RV80 (Dom 2026-10-19: the sandbox pre-fills SPECIAL 2): an empty SPECIAL 2 reads the betaCut row's slot2Default (cleave), or its slot2Alt (stomp) when SPECIAL 1 already is that skill.
  assert.deepEqual(equippedSpecials(), [undefined, 'cleave']);
  equipSpecial('pommel', 0); equipSpecial('stomp', 1);
  assert.deepEqual(equippedSpecials(), ['pommel', 'stomp']); assert.equal(equippedSpecial(1), 'stomp');
  equipSpecial('stomp', 0);   // the same skill in the other slot moves
  assert.deepEqual(equippedSpecials(), ['stomp', 'cleave'], 'never the same skill in both slots: the moved-out slot falls back to its default');
  equipSpecial('witchfire', 1); assert.deepEqual(equippedSpecials(), ['stomp', 'cleave'], 'a skill outside the row is not equipped');
  equipSpecial('cleave', 0); assert.deepEqual(equippedSpecials(), ['cleave', 'reaping'], 'SPECIAL 1 is the default skill: SPECIAL 2 takes the row\'s alternative (the sandbox\'s Whirlwind)');
  equipSpecial(undefined, 0); assert.deepEqual(equippedSpecials(), [undefined, 'cleave']); assert.equal(s.data.size, 0, 'an empty loadout leaves no key');
  assert.ok(changes >= 5, 'every pick tells the HUD');
});

test('a corrupt value reads as no pick, and a viewer without storage keeps none', () => {
  const s = mem(); useSpecialStore(s); s.setItem('frankendom.special.slots.v1', '{not json'); assert.deepEqual(equippedSpecials(), [undefined, 'cleave']);
  useSpecialStore(undefined); equipSpecial('lunge', 0); assert.deepEqual(equippedSpecials(), [undefined, 'cleave']);
});
