// sandbox-mech: spellPick (Dom 2026-10-17): the alpha / pre-beta spell pickers offer 4 hand-picked spells, the four whose designed effect looked best in a real browser, whatever their level:
// the start spell, then one for the Gladiator Pit's first win, one for Zone 1, one for Zone 2 (the dungeon). Trunk ships no rows (every spell).
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import ROWS from '../sandbox/rows.json' with { type: 'json' };
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';
import { SPECIAL_MODES } from '../src/fight/special-modes.ts';
import { SPECIAL_TESTS, type SpecialTest } from '../src/fight/special-look.ts';

type Pick = { id: string; level: number; fx?: string; unlock?: string };
const find = (src: unknown): Pick[] | undefined => {   // the family anywhere in the rows file (file -> family -> rows)
  if (!src || typeof src !== 'object') return undefined;
  const own = (src as Record<string, unknown>).spellPick;
  if (Array.isArray(own)) return own as Pick[];
  for (const v of Object.values(src)) { const deep = find(v); if (deep) return deep; }
  return undefined;
};
const picks = find(ROWS) ?? [];

test('trunk ships no spellPick rows (every spell is offered); the sandbox rows pick 4, one per unlock point', () => {
  assert.deepEqual((DEFS as unknown as { spellPick: unknown[] }).spellPick, []);
  assert.deepEqual(picks.map((p) => p.unlock), ['start', 'pit', 'zone1', 'zone2']);
  assert.equal(new Set(picks.map((p) => p.id)).size, 4, 'no spell twice');
});
test('each pick is a real catalogue spell of the level its row says, playing its own real designed effect (4 different)', () => {
  for (const p of picks) {
    assert.ok(SPELL_INFO[p.id], `${p.id} is in the catalogue`); assert.equal(SPELL_INFO[p.id]!.level, p.level, `${p.id} level`);
    assert.ok(p.fx && SPECIAL_MODES[p.fx as SpecialTest] && SPECIAL_TESTS[p.fx as SpecialTest], `${p.id}: ${p.fx} has a mode and a look-test`);
  }
  assert.equal(new Set(picks.map((p) => p.fx)).size, 4, '4 different effects');
});
