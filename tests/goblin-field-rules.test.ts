// The goblin field's rows (origins/world/goblin-field-defs.json): the loader refuses a broken table, and the look's defaults are pinned.
import assert from 'node:assert/strict';
import test from 'node:test';
import { goblinBackdrop, goblinPalette, goblinPalettes, goblinRule, goblinTint, goblinZone, loadGoblinField } from '../origins/world/goblin-field-rules.ts';
import DEFS from '../origins/world/goblin-field-defs.json' with { type: 'json' };

type Defs = { rules: { id: string; value: number; unit: string }[]; tints: { id: string; r: number; g: number; b: number }[]; palettes: Record<string, unknown>[]; backdrops: Record<string, unknown>[]; harmonics: { id: string; k: number; a: number }[]; names: { id: string; text: string }[] };
const d = DEFS as unknown as Defs;

test('the defaults are the look Dom is shown: pinned; the default palette is World\'s first pass, unchanged', () => {
  assert.equal(goblinZone(), 'cinder-fields');
  assert.deepEqual([goblinRule('palisadeSegments'), goblinRule('palisadeStakes'), goblinRule('totemCount'), goblinRule('fireCount'), goblinRule('bonePiles'), goblinRule('treeClumps')], [3, 9, 4, 2, 9, 3]);
  assert.deepEqual(goblinTint('bone'), [1.25, 1.18, 1]);
  const f = goblinPalette();
  assert.deepEqual([f.id, f.haze, f.zenith, f.mid, f.horizon, f.glow, f.ridge, f.ridgeFar, f.smoke, f.torchPower, f.backdropPortrait, f.backdropLandscape], ['field', 'goblin-haze', '#566286', '#a58b7c', '#d8b48c', '#f0c080', '#4c3c36', '#74604f', '#5c4c44', 0, '', '']);
  assert.equal(goblinPalette('nope').id, 'field', 'an unknown ?goblin= id is the default row');
  assert.equal(goblinPalette('dusk').id, 'dusk');
});
test('the loader refuses a missing named row, a non-positive value, a bad colour, a duplicate id, a dangling backdrop and a bad crop; a new row is one entry', () => {
  assert.throws(() => loadGoblinField({ ...d, rules: d.rules.filter((r) => r.id !== 'totemCount') }), /"totemCount" rule by name/);
  assert.throws(() => loadGoblinField({ ...d, rules: d.rules.map((r) => (r.id === 'smokeRise' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadGoblinField({ ...d, palettes: d.palettes.map((p) => (p.id === 'ash' ? { ...p, glow: 'orange' } : p)) }), /#rrggbb/);
  assert.throws(() => loadGoblinField({ ...d, palettes: d.palettes.map((p) => (p.id === 'dusk' ? { ...p, torchPower: -1 } : p)) }), /torchPower/);
  assert.throws(() => loadGoblinField({ ...d, palettes: d.palettes.map((p) => (p.id === 'ash' ? { ...p, backdropPortrait: 'missing' } : p)) }), /names no backdrop row/);
  assert.throws(() => loadGoblinField({ ...d, backdrops: d.backdrops.map((b) => ({ ...b, y0: 0.9, y1: 0.5 })) }), /the crop is fractions/);
  assert.throws(() => loadGoblinField({ ...d, backdrops: d.backdrops.map((b) => ({ ...b, repeat: 3 })) }), /even whole number/);
  assert.throws(() => loadGoblinField({ ...d, backdrops: d.backdrops.map((b) => ({ ...b, file: '/abs.webp' })) }), /no leading slash/);
  assert.throws(() => loadGoblinField({ ...d, harmonics: d.harmonics.map((h) => ({ ...h, k: 2.5 })) }), /whole number of periods/);
  assert.throws(() => loadGoblinField({ ...d, tints: d.tints.filter((t) => t.id !== 'bone') }), /"bone" tint/);
  assert.throws(() => loadGoblinField({ ...d, names: d.names.map((n) => (n.id === 'palette' ? { ...n, text: 'gone' } : n)) }), /names a palette row/);
  assert.throws(() => loadGoblinField({ ...d, rules: [...d.rules, d.rules[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadGoblinField({ ...d, rules: [...d.rules, { id: 'extra', value: 2, unit: 'm' }] }).rules.length, d.rules.length + 1);
  assert.equal(loadGoblinField({ ...d, palettes: [...d.palettes, { ...d.palettes[0]!, id: 'sixth' }] }).palettes.length, d.palettes.length + 1, 'a new mood is one palette row');
});
test('every palette\'s haze is a look row whose fog is the dome horizon colour (the ground fades into the painting with no line)', async () => {
  const { lookOf, PRESETS } = await import('../origins/preview/look.ts');
  for (const p of goblinPalettes()) { assert.ok(PRESETS[p.haze], `${p.id}: look row ${p.haze} exists`); assert.equal(lookOf(p.haze).fog, p.horizon, `${p.id}: fog = horizon`); }
});
test('a palette with pictures shows the portrait row on a tall screen and the landscape row on a wide one; the files are in public/', async () => {
  const { existsSync } = await import('node:fs');
  const f = goblinPalette('fortress');
  assert.equal(goblinBackdrop(f, true)?.id, 'fortress-portrait'); assert.equal(goblinBackdrop(f, false)?.id, 'fortress-landscape');
  assert.equal(goblinBackdrop(goblinPalette('field'), true), null, 'no picture: the painted sky alone');
  for (const p of goblinPalettes()) for (const b of [goblinBackdrop(p, true), goblinBackdrop(p, false)]) if (b) assert.ok(existsSync(`public/${b.file}`), `public/${b.file}`);
  const turn = 360 / (180 * goblinRule('domeHalf'));   // the dome texture spans 360 degrees across and domeHalf x 180 down: a picture keeps its shape only when texW:texH is that ratio
  for (const p of goblinPalettes()) for (const b of [goblinBackdrop(p, true), goblinBackdrop(p, false)]) if (b) assert.ok(Math.abs(b.texW / b.texH / turn - 1) < 0.05, `${b.id}: texW/texH ${(b.texW / b.texH).toFixed(2)} is within 5 % of ${turn.toFixed(2)} (else the picture stretches)`);
});
