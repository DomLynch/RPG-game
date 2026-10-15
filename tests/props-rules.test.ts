// The props rows (origins/world/props-defs.json): the loader refuses a broken table, the default dress set is identity, thinning scales the Cinder clutter, and the ambience maths is pinned.
import assert from 'node:assert/strict';
import test from 'node:test';
import { ambienceRow, dressSet, kitIds, loadProps, propKitRow, propRow, recipesOf } from '../origins/world/props-rules.ts';
import { fireGain, windAt } from '../origins/preview/ambience.ts';
import DEFS from '../origins/world/props-defs.json' with { type: 'json' };

type Defs = { tints: Record<string, unknown>[]; props: Record<string, any>[]; kits: Record<string, unknown>[]; recipes: Record<string, any>[]; dress: Record<string, unknown>[]; ambience: Record<string, unknown>[] };
const d = DEFS as unknown as Defs, bad = (patch: Partial<Defs>, re: RegExp) => assert.throws(() => loadProps({ ...d, ...patch }), re);

test('the goblin camp kit: small (a tent, a totem, a banner, a fire, palisade, bones, a tree), every prop in a recipe, every recipe prop in the kit', () => {
  assert.deepEqual(kitIds(), ['goblin-camp']); const ids = d.props.map((p) => p.id), used = new Set(recipesOf('goblin-camp').flatMap((r) => r.props.map((w) => w.prop)));
  assert.deepEqual([...used].sort(), [...ids].sort(), 'no prop is unused and none is missing'); assert.ok(ids.length <= 14, `${ids.length} props: keep the kit small`);
  assert.equal(propKitRow('goblin-camp')!.tries, 30); assert.equal(propRow('fire').emits, 'fire');
});
test('the loader refuses a bad part, an unknown tint, a prop outside its kit, a bad recipe kind, a bad dress multiplier and a duplicate id; a new prop is one entry', () => {
  const p0 = d.props[0]!;
  bad({ props: d.props.map((p, i) => (i ? p : { ...p, parts: [{ ...p.parts[0], shape: 'torus' }] })) }, /shape is box, cylinder, cone or sphere/);
  bad({ props: d.props.map((p, i) => (i ? p : { ...p, parts: [{ ...p.parts[0], size: [1, 1] }] })) }, /takes 3 sizes/);
  bad({ props: d.props.map((p, i) => (i ? p : { ...p, parts: [{ ...p.parts[0], tint: 'nope' }] })) }, /tint "nope" has no row/);
  bad({ props: d.props.map((p, i) => (i ? p : { ...p, r: 0 })) }, /r > 0/);
  bad({ recipes: d.recipes.map((r, i) => (i ? r : { ...r, kind: 'spiral' })) }, /kind is scatter, ring, cluster/);
  bad({ recipes: d.recipes.map((r, i) => (i ? r : { ...r, props: [{ prop: 'ghost', weight: 1 }] })) }, /not in kit/);
  bad({ recipes: d.recipes.map((r) => (r.kind === 'ring' ? { ...r, ringRadius: 0 } : r)) }, /ring needs ringRadius/);
  bad({ recipes: d.recipes.map((r, i) => (i ? r : { ...r, chance: 2 })) }, /chance is in/);
  bad({ dress: d.dress.map((x) => (x.id === 'fortress' ? { ...x, trees: 5 } : x)) }, /multiplier from 0 to 2/);
  bad({ dress: d.dress.map((x) => (x.id === 'default' ? { ...x, trees: 0.9 } : x)) }, /default" dress set is all 1s/);
  bad({ props: [...d.props, p0] }, /duplicate|twice|unique/i);
  assert.equal(loadProps({ ...d, props: [...d.props, { ...p0, id: 'extra' }] }).props.length, d.props.length + 1);
});
test('the default dress set is the base clutter as it was (all 1); an unknown or empty id is the default; the fortress set thins trees most', () => {
  assert.deepEqual(dressSet(), dressSet('')); assert.deepEqual(dressSet('nope'), dressSet('default')); assert.deepEqual(Object.values(dressSet('default')).slice(1), [1, 1, 1, 1, 1, 1]);
  const f = dressSet('fortress'); assert.ok(f.trees < f.skyline && f.trees < f.scrub && f.trees <= 0.2);
});
test('the wind drifts around its centre and the crackle falls off squared to zero at fireRange; an id with no row stays silent', () => {
  const a = ambienceRow('fortress-wind')!; assert.equal(ambienceRow('wind'), null); assert.equal(ambienceRow(undefined), null);
  for (let t = 0; t < 30; t += 0.7) { const w = windAt(t, a); assert.ok(Math.abs(w.freq - a.windFreq) <= a.windSweepDepth + 1e-9 && w.gain > 0 && w.gain <= a.windGain + 1e-9); }
  assert.equal(fireGain(0, a), a.crackleGain); assert.equal(fireGain(a.fireRange, a), 0); assert.equal(fireGain(a.fireRange * 3, a), 0); assert.ok(fireGain(a.fireRange / 2, a) < fireGain(a.fireRange / 4, a));
});
