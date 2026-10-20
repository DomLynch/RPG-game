// The four beta specials (src/fight/special-pick-rows.ts): the picker lists the sandbox's four, in row order, with the rows' roles and labels, and the rows' default slots fill SPECIAL 1 / 2; with nothing handed over the betaCut row's list stays.
import './lib/era-off.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickChoices, pickDefaults, pickName } from '../src/fight/special-pick-rows.ts';
import { equipSpecial, equippedSpecials, specialChoices, useSpecialChoices, useSpecialDefaults, useSpecialStore } from '../src/core/special-equip.ts';
import { BETA_SPECIAL_PICK } from '../src/core/career-ladder.ts';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

type Row = { id: string; role: string; label?: string; slot1Default?: number; slot2Default?: number; slot2Alt?: number };
const rows = (): Row[] => (DEFS as unknown as { specialPick: Row[] }).specialPick;
const mem = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> => { const d = new Map<string, string>(); return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => { d.set(k, v); }, removeItem: (k) => { d.delete(k); } }; };

test('the picks, their order, roles and names are the sandbox rows, read with the era off', () => {
  assert.deepEqual(pickChoices().map((c) => c.id), rows().map((r) => r.id));
  assert.deepEqual(pickChoices().map((c) => c.role), rows().map((r) => r.role));
  for (const r of rows()) assert.equal(pickName(r.id), r.label);
  assert.equal(pickName('no-such-skill'), undefined);
});

test('the picker lists the betaCut picks until the rows are handed over, and puts them back', () => {
  assert.deepEqual(specialChoices().map((c) => c.id), [...BETA_SPECIAL_PICK]);
  useSpecialChoices(pickChoices);
  assert.deepEqual(specialChoices().map((c) => c.id), pickChoices().map((c) => c.id));
  useSpecialChoices(undefined);
  assert.deepEqual(specialChoices().map((c) => c.id), [...BETA_SPECIAL_PICK]);
});

test('the rows\' default slots fill both buttons, and a pick that takes the other slot\'s skill swaps instead of leaving a button empty', () => {
  useSpecialStore(mem());
  useSpecialDefaults(() => ({ slot1: 'lunge', slot2: 'cleave', slot2Alt: 'reaping' }));
  assert.deepEqual(equippedSpecials(), ['lunge', 'cleave'], 'two slotted from the start');
  equipSpecial('cleave', 0);
  assert.deepEqual(equippedSpecials(), ['cleave', 'reaping'], 'SPECIAL 1 now is the SPECIAL 2 default: SPECIAL 2 takes the alternative');
  equipSpecial('lunge', 1);
  assert.deepEqual(equippedSpecials(), ['cleave', 'lunge'], 'an explicit pick in SPECIAL 2 stays');
  useSpecialDefaults(undefined);
  useSpecialStore(undefined);
  assert.equal(pickDefaults().slot2, rows().find((r) => r.slot2Default)?.id, 'the defaults the page hands over are the rows\' own flags');
  assert.equal(pickDefaults().slot2Alt, rows().find((r) => r.slot2Alt)?.id);
  assert.equal(pickDefaults().slot1, rows().find((r) => r.slot1Default)?.id);
});
