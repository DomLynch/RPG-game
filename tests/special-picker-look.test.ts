// The ?picker=sandbox look-test (src/fight/special-picker-look.ts): the flag parses, the four sandbox picks and their names come from the sandbox rows, and a page without the flag lists the betaCut's picks.
import './lib/era-off.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickerLookFlag, sandboxPickerChoices, sandboxPickerName } from '../src/fight/special-picker-look.ts';
import { specialChoices, useSpecialChoices } from '../src/core/special-equip.ts';
import { BETA_SPECIAL_PICK } from '../src/core/career-ladder.ts';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

test('the flag is ?picker=sandbox and nothing else', () => {
  assert.equal(pickerLookFlag('?picker=sandbox'), true);
  assert.equal(pickerLookFlag('?stances=off&picker=sandbox'), true);
  assert.equal(pickerLookFlag('?picker=sandbox&x=1'), true);
  assert.equal(pickerLookFlag(''), false);
  assert.equal(pickerLookFlag('?picker=live'), false);
  assert.equal(pickerLookFlag('?picker=sandboxes'), false);
});

test('the sandbox picks, their order and their names are the sandbox rows, read with the era off', () => {
  const rows = (DEFS as unknown as { specialPick: { id: string; role: string; label?: string }[] }).specialPick;
  assert.deepEqual(sandboxPickerChoices().map((c) => c.id), rows.map((r) => r.id));
  assert.deepEqual(sandboxPickerChoices().map((c) => c.role), rows.map((r) => r.role));
  for (const r of rows) assert.equal(sandboxPickerName(r.id), r.label);
  assert.equal(sandboxPickerName('no-such-skill'), undefined);
});

test('the picker lists the betaCut picks until the look-test swaps them, and puts them back', () => {
  assert.deepEqual(specialChoices().map((c) => c.id), [...BETA_SPECIAL_PICK]);
  useSpecialChoices(sandboxPickerChoices);
  assert.deepEqual(specialChoices().map((c) => c.id), sandboxPickerChoices().map((c) => c.id));
  useSpecialChoices(undefined);
  assert.deepEqual(specialChoices().map((c) => c.id), [...BETA_SPECIAL_PICK]);
});
