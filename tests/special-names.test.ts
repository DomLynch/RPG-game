// What a SPECIAL button is called (src/fight/special-names.ts): a bow shows its bowSpecial row's label, a melee weapon the sandbox's specialPick label (Dom's beta specials ruling 2026-10-20), anything else the skill row's own name.
import assert from 'node:assert/strict';
import test from 'node:test';
import { specialName } from '../src/fight/special-names.ts';

test('a melee special shows its sandbox name, a bow its own, an unknown skill the fallback', () => {
  assert.deepEqual(['cleave', 'reaping', 'stomp', 'lunge'].map((id) => specialName('longsword', id, 'old name')), ['Skull Crack', 'Whirlwind', 'Ground Slam', 'Lunge']);
  assert.deepEqual(['cleave', 'reaping', 'stomp', 'lunge'].map((id) => specialName('bow', id, 'old name')), ['Power Shot', 'Fan Volley', 'Pinning Shot', 'Quick Shot']);
  assert.equal(specialName('longsword', 'ironrush', 'Iron Rush'), 'Iron Rush');
  assert.equal(specialName(undefined, null, 'none'), 'none');
});
