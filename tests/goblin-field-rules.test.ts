// The goblin field's rows (origins/world/goblin-field-defs.json): the loader refuses a broken table, and the look's defaults are pinned.
import assert from 'node:assert/strict';
import test from 'node:test';
import { goblinRule, goblinSky, goblinTint, goblinZone, loadGoblinField } from '../origins/world/goblin-field-rules.ts';
import DEFS from '../origins/world/goblin-field-defs.json' with { type: 'json' };

test('the defaults are the look Dom is shown: pinned', () => {
  assert.equal(goblinZone(), 'cinder-fields');
  assert.deepEqual([goblinRule('palisadeSegments'), goblinRule('palisadeStakes'), goblinRule('totemCount'), goblinRule('fireCount'), goblinRule('bonePiles'), goblinRule('treeClumps')], [3, 9, 4, 2, 9, 3]);
  assert.deepEqual(goblinTint('bone'), [1.25, 1.18, 1]); assert.equal(goblinSky('horizon'), '#d8b48c', 'the dome horizon is the goblin-haze fog colour');
});
test('the loader refuses a missing named row, a non-positive value, a bad colour and a duplicate id; a new row is one entry', () => {
  const d = DEFS as unknown as { rules: { id: string; value: number; unit: string }[]; tints: { id: string; r: number; g: number; b: number }[]; sky: { id: string; hex: string }[]; names: { id: string; text: string }[] };
  assert.throws(() => loadGoblinField({ ...d, rules: d.rules.filter((r) => r.id !== 'totemCount') }), /"totemCount" rule by name/);
  assert.throws(() => loadGoblinField({ ...d, rules: d.rules.map((r) => (r.id === 'smokeRise' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadGoblinField({ ...d, sky: d.sky.map((s) => (s.id === 'glow' ? { ...s, hex: 'orange' } : s)) }), /#rrggbb/);
  assert.throws(() => loadGoblinField({ ...d, tints: d.tints.filter((t) => t.id !== 'bone') }), /"bone" tint/);
  assert.throws(() => loadGoblinField({ ...d, rules: [...d.rules, d.rules[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadGoblinField({ ...d, rules: [...d.rules, { id: 'extra', value: 2, unit: 'm' }] }).rules.length, d.rules.length + 1);
});
test('the goblin-haze look row exists and its fog is the dome horizon colour', async () => {
  const { lookOf } = await import('../origins/preview/look.ts'); assert.equal(lookOf('goblin-haze').fog, goblinSky('horizon'));
});
