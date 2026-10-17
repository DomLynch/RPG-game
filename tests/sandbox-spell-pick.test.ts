// sandbox-mech: spellPick (Dom 2026-10-17): the alpha / pre-beta spell pickers offer 4 hand-picked spells, the four whose designed effect looked best in a real browser, whatever their level:
// the start spell, then one for the Gladiator Pit's first win, one for Zone 1, one for Zone 2 (the dungeon). Trunk ships no rows (every spell).
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import ROWS from '../sandbox/rows.json' with { type: 'json' };
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';
import { castOutcome, resolveSpell, spellRoot } from '../src/fight/spell-cast.ts';
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

test('trunk ships no spellPick rows (every spell is offered); the sandbox rows pick 4 attack spells, one per unlock point, plus the universal heal', () => {
  assert.deepEqual((DEFS as unknown as { spellPick: unknown[] }).spellPick, []);
  assert.deepEqual(picks.map((p) => p.unlock), ['start', 'pit', 'zone1', 'zone2', 'universal']);
  assert.equal(new Set(picks.map((p) => p.id)).size, 5, 'no spell twice');
});
test('each pick is a real catalogue spell of the level its row says, playing its own real designed effect (4 different)', () => {
  for (const p of picks) {
    assert.ok(SPELL_INFO[p.id], `${p.id} is in the catalogue`); assert.equal(SPELL_INFO[p.id]!.level, p.level, `${p.id} level`);
    if (p.unlock === 'universal') { assert.equal(p.fx, undefined, 'the heal has its own look (missile-fx.ts), no designed special effect'); continue; }
    assert.ok(p.fx && SPECIAL_MODES[p.fx as SpecialTest] && SPECIAL_TESTS[p.fx as SpecialTest], `${p.id}: ${p.fx} has a mode and a look-test`);
  }
  assert.equal(new Set(picks.filter((p) => p.fx).map((p) => p.fx)).size, 4, '4 different effects on the 4 attack spells');
});
test('every pick lands at the sandbox skill floor (100): at least 90% of casts succeed or crit, and its root is the outer band (cast from any distance)', () => {
  const floor = Number(JSON.stringify(ROWS).match(/"id":"spellSkillFloor","value":(\d+)/)?.[1]);
  assert.equal(floor, 100);
  const bands = new Map([...JSON.stringify(ROWS).matchAll(/\{"root":"(\w+)","band":"(\w+)"/g)].map((m) => [m[1], m[2]]));
  for (const p of picks.filter((x) => x.unlock !== 'universal')) {   // the heal always lands (spellHeal) and needs no band
    const s = resolveSpell(p.id, floor)!, n = 1000; let ok = 0;
    for (let k = 0; k < n; k++) { const o = castOutcome(s, k / n); if (o === 'success' || o === 'crit') ok++; }
    assert.ok(ok / n >= 0.9, `${p.id}: ${ok / n} of casts land at skill ${floor}`);
    assert.equal(bands.get(spellRoot(p.id)!), 'outer', `${p.id}: root ${spellRoot(p.id)} is the outer band`);
  }
});
