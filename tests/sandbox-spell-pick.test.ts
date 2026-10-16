// sandbox-mech: spellPick (Dom 2026-10-16): the alpha / pre-beta ladder is levels 1-2, so the spell pickers offer 20 hand-picked spells (10 a level); trunk ships no rows (every spell).
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import ROWS from '../sandbox/rows.json' with { type: 'json' };
import EFFECTS from '../sandbox/spell-fx.json' with { type: 'json' };
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';

type Pick = { id: string; level: number };
const find = (src: unknown): Pick[] | undefined => {   // the family anywhere in the rows file (file -> family -> rows)
  if (!src || typeof src !== 'object') return undefined;
  const own = (src as Record<string, unknown>).spellPick;
  if (Array.isArray(own)) return own as Pick[];
  for (const v of Object.values(src)) { const deep = find(v); if (deep) return deep; }
  return undefined;
};
const fx = new Map((EFFECTS as unknown as { spellEffect: { id: string; fx: string }[] }).spellEffect.map((r) => [r.id, r.fx]));
const picks = find(ROWS) ?? [];

test('trunk ships no spellPick rows (every spell is offered); the sandbox rows pick 20', () => {
  assert.deepEqual((DEFS as unknown as { spellPick: unknown[] }).spellPick, []);
  assert.equal(picks.length, 20);
  assert.equal(new Set(picks.map((p) => p.id)).size, 20, 'no spell twice');
});
test('10 spells a level, each a real catalogue spell of that level, with a spread of designed effects', () => {
  for (const level of [1, 2]) assert.equal(picks.filter((p) => p.level === level).length, 10, `level ${level}`);
  for (const p of picks) { assert.ok(SPELL_INFO[p.id], `${p.id} is in the catalogue`); assert.equal(SPELL_INFO[p.id]!.level, p.level, `${p.id} level`); }
  for (const level of [1, 2]) assert.equal(new Set(picks.filter((p) => p.level === level).map((p) => fx.get(p.id))).size, 10, `level ${level} plays 10 different effects`);
});
