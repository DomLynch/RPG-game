// dressMob scales the body, tints only cloth, leaves metal and skin on their own materials, shares one clone per (material, look), and gives two looks on one body two colours.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { MOB_LOOKS } from './mob-looks.ts';
import { dressMob, dressedColor, undressMob } from './mob-dress.ts';

const body = () => {
  const root = new Group(), cloth = new MeshStandardMaterial({ name: 'goblin.body.Gambeson_goblin'.split('.').slice(2).join('.'), color: 0xaaaaaa }), metal = new MeshStandardMaterial({ name: 'WeaponKnife', color: 0xcccccc }), skin = new MeshStandardMaterial({ name: 'Skin' });
  for (const m of [cloth, metal, skin]) root.add(new Mesh(new BoxGeometry(), m));
  return { root, cloth, metal, skin };
};

test('scale applies to the root and only cloth changes material', () => {
  const { root, cloth, metal, skin } = body(), look = MOB_LOOKS['character:cinder-scavenger']!;
  assert.equal(dressMob(root, look), 1);
  assert.equal(root.scale.y, look.scale);
  const mats = root.children.map(c => (c as Mesh).material as MeshStandardMaterial);
  assert.notEqual(mats[0], cloth); assert.equal(mats[1], metal); assert.equal(mats[2], skin);
  assert.ok(!mats[0]!.color.equals(cloth.color));
  assert.ok(cloth.color.equals(new Color(0xaaaaaa)), 'the source material is untouched');
});

test('one clone per (material, look); two looks on one body give two colours', () => {
  const a = body(), b = body(), l1 = MOB_LOOKS['character:cinder-scavenger']!, l2 = MOB_LOOKS['character:mere-brood']!;
  dressMob(a.root, l1); dressMob(b.root, l1);
  const matA = (a.root.children[0] as Mesh).material as MeshStandardMaterial, again = new Group(); again.add(new Mesh(new BoxGeometry(), a.cloth)); dressMob(again, l1);
  assert.equal((again.children[0] as Mesh).material, matA, 'same source + same look shares the clone');
  assert.ok(!dressedColor(new Color(0xaaaaaa), l1).equals(dressedColor(new Color(0xaaaaaa), l2)));
});

test('soot and burnt darken the cloth', () => {
  const base = new Color(0xaaaaaa), clean = { ...MOB_LOOKS['character:mere-brood']!, tint: 0xffffff, dressing: { soot: 0, burnt: 0 } }, dirty = { ...clean, dressing: { soot: 1, burnt: 1 } };
  assert.ok(dressedColor(base, dirty).getHSL({ h: 0, s: 0, l: 0 }).l < dressedColor(base, clean).getHSL({ h: 0, s: 0, l: 0 }).l);
});

test('the Witch and Knight baked surfaces are dressed (they carry no cloth draw of their own), a plain Skin is not', () => {
  for (const [id, name] of [['character:mere-mother', 'WitchSurface'], ['character:hrungnir', 'KnightSurface']] as const) {
    const root = new Group(), surface = new MeshStandardMaterial({ name, color: 0xffffff }), skin = new MeshStandardMaterial({ name: 'Skin' });
    root.add(new Mesh(new BoxGeometry(), surface), new Mesh(new BoxGeometry(), skin));
    assert.equal(dressMob(root, MOB_LOOKS[id]!), 1, id);
    assert.ok(!((root.children[0] as Mesh).material as MeshStandardMaterial).color.equals(surface.color));
    assert.equal((root.children[1] as Mesh).material, skin);
  }
});

test('a body reused for the next fight dresses from its original cloth: three fights give one colour and no new materials, and undress restores it', () => {
  const a = body(), look = MOB_LOOKS[Object.keys(MOB_LOOKS)[0]!]!, mesh = a.root.children[0] as Mesh, original = mesh.material;
  dressMob(a.root, look, false); const first = (mesh.material as MeshStandardMaterial), hex = first.color.getHex(), rough = first.roughness;
  for (let n = 0; n < 2; n++) { dressMob(a.root, look, false); const m = mesh.material as MeshStandardMaterial; assert.equal(m, first, 'the same shared clone, not a clone of a clone'); assert.equal(m.color.getHex(), hex); assert.equal(m.roughness, rough); }
  assert.notEqual(first, original);
  undressMob(a.root); assert.equal(mesh.material, original, 'a Pit legend on this body sees the cloth as loaded');
});
