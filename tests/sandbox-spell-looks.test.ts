// sandbox-mech: spell looks. sandbox/spell-looks.json carries one `spellLook` row per catalogue spell { id, tint, size, pulse } (authored by sandbox/spell-looks-gen.mjs); the cast burst reads them through sandbox-rules.ts spellLookOf. Trunk ships the family empty.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import LOOKS from '../sandbox/spell-looks.json' with { type: 'json' };
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';

type Look = { id: string; tint: string; size: number; pulse: number };
const looks = (LOOKS as unknown as { spellLook: Look[] }).spellLook;

test('trunk ships spellLook empty; the sandbox file is the only author', () => {
  assert.deepEqual((DEFS as unknown as { spellLook: unknown[] }).spellLook, []);
});

test('one look row for every catalogue spell, none for an unknown one', () => {
  const ids = looks.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'no spell has two rows');
  assert.deepEqual([...ids].sort(), Object.keys(SPELL_INFO).sort());
});

test('every row is a colour, a positive per-mille size and a whole number of ticks', () => {
  for (const r of looks) {
    assert.match(r.tint, /^#[0-9a-f]{6}$/, r.id);
    assert.ok(Number.isInteger(r.size) && r.size >= 500 && r.size <= 2000, `${r.id} size ${r.size}`);
    assert.ok(Number.isInteger(r.pulse) && r.pulse >= 10 && r.pulse <= 120, `${r.id} pulse ${r.pulse}`);
  }
});

test('spells look different: far more than a handful of colours', () => {
  assert.ok(new Set(looks.map((r) => r.tint)).size > 600);
});
