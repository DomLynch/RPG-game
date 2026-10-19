import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { specialName } from '../src/fight/special-names.ts';
import { BETA_SPECIAL_PICK } from '../src/core/career-ladder.ts';

// The name a special shows while a bow is wielded (Lead 2026-10-19): the bowSpecial rows' own labels. Presentation only.
test('a bow wielder sees the bow special names, from the bowSpecial rows', () => {
  assert.deepEqual(['cleave', 'reaping', 'stomp', 'lunge'].map((s) => specialName('bow', s, 'melee')), ['Power Shot', 'Fan Volley', 'Pinning Shot', 'Quick Shot']);
});

test('every other weapon, and any skill with no bow row, keeps the skill\'s own name', () => {
  for (const weapon of ['longsword', 'staff', 'knife', 'trident']) assert.equal(specialName(weapon, 'cleave', 'Butcher\'s Cleave'), 'Butcher\'s Cleave', weapon);
  for (const skill of ['ironrush', 'pommel', 'shove']) assert.equal(specialName('bow', skill, `own ${skill}`), `own ${skill}`);
  assert.equal(specialName(undefined, 'cleave', 'x'), 'x');
  assert.equal(specialName('bow', undefined, 'x'), 'x');
  assert.equal(specialName('bow', null, 'x'), 'x');
});

test('the four bow specials are all picks on offer (the picker lists them, so a bow wielder can equip each)', () => {
  const rows = JSON.parse(readFileSync(new URL('../src/fight/sandbox-rules-defs.json', import.meta.url), 'utf8')).bowSpecial as { skill: string; label: string }[];
  assert.equal(rows.length, 4);
  for (const r of rows) assert.ok((BETA_SPECIAL_PICK as readonly string[]).includes(r.skill), `${r.skill} (${r.label}) is in specialPick`);
});
