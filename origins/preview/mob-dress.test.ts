// dressMob scales the body, tints only cloth, leaves metal and skin on their own materials, shares one clone per (material, look), and gives two looks on one body two colours.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { MOB_LOOKS } from './mob-looks.ts';
import { dressMob, dressedColor } from './mob-dress.ts';

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
