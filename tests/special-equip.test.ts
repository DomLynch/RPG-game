// The two SPECIAL slots' store (src/core/special-equip.ts): the picks come from the betaCut row, a skill never sits in both slots, a pick outside the row is dropped, a viewer without storage keeps nothing.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import { SPECIAL_SLOT_COUNT, equipSpecial, equippedSpecial, equippedSpecials, onSpecialsChanged, specialChoices, useSpecialStore } from '../src/core/special-equip.ts';

const mem = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } }; };

test('the picker lists the row\'s four in order, each with a role line', () => {
  assert.deepEqual(specialChoices().map((c) => c.id), ['cleave', 'reaping', 'stomp', 'lunge']);
  assert.deepEqual(specialChoices().map((c) => c.role), ['heavy', 'sweep', 'posture break', 'opener']);
  assert.equal(SPECIAL_SLOT_COUNT, 2);
});

test('a pick is kept per slot, moves rather than duplicates, and a skill outside the row is refused', () => {
  const s = mem(); useSpecialStore(s); let changes = 0; onSpecialsChanged(() => { changes++; });
  // RV80 (Dom 2026-10-19: the sandbox pre-fills SPECIAL 2): an empty SPECIAL 2 reads the betaCut row's slot2Default (cleave), or its slot2Alt (stomp) when SPECIAL 1 already is that skill.
  // 2026-10-20 (Dom's beta specials ruling): a fresh player, guests included, has BOTH slots filled from the first fight: SPECIAL 1 Skull Crack (cleave), SPECIAL 2 Whirlwind (reaping).
  assert.deepEqual(equippedSpecials(), ['cleave', 'reaping']);
  equipSpecial('lunge', 0); equipSpecial('stomp', 1);
  assert.deepEqual(equippedSpecials(), ['lunge', 'stomp']); assert.equal(equippedSpecial(1), 'stomp');
  equipSpecial('stomp', 0);   // the same skill in the other slot moves
  assert.deepEqual(equippedSpecials(), ['stomp', 'reaping'], 'never the same skill in both slots: the moved-out slot falls back to its default');
  equipSpecial('witchfire', 1); assert.deepEqual(equippedSpecials(), ['stomp', 'reaping'], 'a skill outside the row is not equipped');
  equipSpecial('reaping', 0); assert.deepEqual(equippedSpecials(), ['reaping', 'cleave'], 'SPECIAL 1 holds SPECIAL 2\'s default: SPECIAL 2 takes the row\'s alternative (Skull Crack)');
  equipSpecial('cleave', 1); assert.deepEqual(equippedSpecials(), ['reaping', 'cleave']);
  equipSpecial(undefined, 0); assert.deepEqual(equippedSpecials(), ['reaping', 'cleave'], 'an emptied SPECIAL 1 reads its alternative while SPECIAL 2 holds the default skill');
  equipSpecial(undefined, 1); assert.deepEqual(equippedSpecials(), ['cleave', 'reaping']); assert.equal(s.data.size, 0, 'an empty loadout leaves no key');
  assert.ok(changes >= 5, 'every pick tells the HUD');
});

test('a corrupt value reads as no pick, and a viewer without storage keeps none', () => {
  const s = mem(); useSpecialStore(s); s.setItem('frankendom.special.slots.v1', '{not json'); assert.deepEqual(equippedSpecials(), ['cleave', 'reaping']);
  useSpecialStore(undefined); equipSpecial('lunge', 0); assert.deepEqual(equippedSpecials(), ['cleave', 'reaping'], 'a viewer without storage reads the defaults, so a guest always has both buttons');
});
