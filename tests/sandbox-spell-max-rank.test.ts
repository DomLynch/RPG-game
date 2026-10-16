// sandbox-mech: spellMaxRank (Dom + Strategy 2026-10-16): the beta ladder is levels 1-2, so the spell pickers offer only spells of level 1..N; trunk ships 0 (all).
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import ROWS from '../sandbox/rows.json' with { type: 'json' };
import EFFECTS from '../sandbox/spell-fx.json' with { type: 'json' };
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';

const value = (src: unknown): number | undefined => {   // the row anywhere in the file (families, or the sandbox's file -> family -> rows)
  if (Array.isArray(src)) { for (const r of src) { const row = r as { id?: string; value?: number }; if (row?.id === 'spellMaxRank') return row.value; const deep = typeof r === 'object' && r ? value(r) : undefined; if (deep !== undefined) return deep; } return undefined; }
  if (src && typeof src === 'object') for (const v of Object.values(src)) { const deep = value(v); if (deep !== undefined) return deep; }
  return undefined;
};
const fx = new Map((EFFECTS as unknown as { spellEffect: { id: string; fx: string }[] }).spellEffect.map((r) => [r.id, r.fx]));

test('trunk offers every spell (0); the sandbox rows cap the pickers at level 2', () => {
  assert.equal(value(DEFS), 0);
  assert.equal(value(ROWS), 2);
});
test('level 1-2 is 142 spells, all with an effect row, playing at most the 10 class A effects', () => {
  const offered = Object.entries(SPELL_INFO).filter(([, i]) => i.level <= 2).map(([id]) => id);
  assert.equal(offered.length, 142);
  assert.ok(offered.every((id) => fx.has(id)), 'each has an effect row');
  assert.ok(new Set(offered.map((id) => fx.get(id))).size <= 10);
});
