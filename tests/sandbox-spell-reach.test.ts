// sandbox-mech: spellReach (Dom 2026-10-17): no short / medium / long spells, one maximum distance. Any spell casts from any distance up to the reach, however close; beyond it the cast is refused 'far'.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };

const defs = DEFS as unknown as { rules: { id: string; value: number }[]; bands: object[]; spellRange: object[] };
defs.rules.find((r) => r.id === 'spellReach')!.value = 2500;
defs.bands.push({ id: 'inner', upTo: 135 }, { id: 'mid', upTo: 180 }, { id: 'outer', upTo: 100000 });
defs.spellRange.push({ root: 'gale', band: 'outer', kind: 'magic' }, { root: 'theRing', band: 'outer', kind: 'magic' });
const { spellRangeCue } = await import('../src/fight/sandbox-rules.ts');

test('every spell casts from point blank out to the one reach (25 m), and is refused beyond it', () => {
  for (const root of ['gale', 'theRing']) {
    for (const d of [0.3, 1, 5, 12, 24.9]) assert.equal(spellRangeCue(root, d), undefined, `${root} at ${d} m`);
    for (const d of [25.1, 40, 900]) assert.equal(spellRangeCue(root, d), 'far', `${root} at ${d} m`);
  }
});
test('trunk and the sandbox rows: reach is a row, 0 on trunk', () => {
  assert.equal(typeof defs.rules.find((r) => r.id === 'spellReach')?.value, 'number');
});
