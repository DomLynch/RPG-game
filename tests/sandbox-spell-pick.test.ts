// sandbox-mech: spellPick (Dom 2026-10-16): the alpha / pre-beta ladder reaches level 3, so the spell pickers offer 30 hand-picked spells (10 a level); trunk ships no rows (every spell).
// Each level plays the 10 designed boss specials of one rank (level 1 = rank 8's ten, level 2 = rank 9's, level 3 = rank 10's), one each: 30 different effects.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import ROWS from '../sandbox/rows.json' with { type: 'json' };
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';
import { SPECIAL_MODES } from '../src/fight/special-modes.ts';
import { SPECIAL_TESTS, type SpecialTest } from '../src/fight/special-look.ts';

type Pick = { id: string; level: number; fx?: string };
const find = (src: unknown): Pick[] | undefined => {   // the family anywhere in the rows file (file -> family -> rows)
  if (!src || typeof src !== 'object') return undefined;
  const own = (src as Record<string, unknown>).spellPick;
  if (Array.isArray(own)) return own as Pick[];
  for (const v of Object.values(src)) { const deep = find(v); if (deep) return deep; }
  return undefined;
};
const picks = find(ROWS) ?? [];

test('trunk ships no spellPick rows (every spell is offered); the sandbox rows pick 30', () => {
  assert.deepEqual((DEFS as unknown as { spellPick: unknown[] }).spellPick, []);
  assert.equal(picks.length, 30);
  assert.equal(new Set(picks.map((p) => p.id)).size, 30, 'no spell twice');
});
test('10 spells a level, each a real catalogue spell of that level', () => {
  for (const level of [1, 2, 3]) assert.equal(picks.filter((p) => p.level === level).length, 10, `level ${level}`);
  for (const p of picks) { assert.ok(SPELL_INFO[p.id], `${p.id} is in the catalogue`); assert.equal(SPELL_INFO[p.id]!.level, p.level, `${p.id} level`); }
});
test('level N plays exactly the ten boss specials of rank 7+N, each once; every effect is real and has a mode', () => {
  for (const level of [1, 2, 3]) {
    const rankLevel = 5 * (7 + level) - 4;   // ladder level of rank 8 / 9 / 10: 36 / 41 / 46
    const want = Object.entries(SPECIAL_TESTS).filter(([, t]) => t.level === rankLevel).map(([id]) => id).sort();
    assert.equal(want.length, 10, `ten boss specials at ladder level ${rankLevel}`);
    assert.deepEqual(picks.filter((p) => p.level === level).map((p) => p.fx).sort(), want, `level ${level}`);
  }
  for (const p of picks) assert.ok(p.fx && SPECIAL_MODES[p.fx as SpecialTest], `${p.id}: ${p.fx} has a mode`);
});
