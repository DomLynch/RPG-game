import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SCHOOLS, SCHOOL_OF, schoolTinter, schoolsFlag, schoolsStrength } from '../src/spell-school.ts';
import { SPECIAL_TESTS } from '../src/special-look.ts';

test('the flag is ?look=schools only, alone or in a list', () => {
  assert.equal(schoolsFlag(''), true); assert.equal(schoolsStrength(''), 'soft', 'soft is the default');
  assert.equal(schoolsFlag('?look=souls'), true); assert.equal(schoolsFlag('?look=schools-off'), false, 'the old colours stay one flag away');
  assert.equal(schoolsFlag('?look=schools'), true);
  assert.equal(schoolsFlag('?look=schools2'), true); assert.equal(schoolsFlag('?look=schools3'), true); assert.equal(schoolsStrength('?look=schools'), 'plain'); assert.equal(schoolsStrength('?look=schools2'), 'soft'); assert.equal(schoolsStrength('?look=schools3'), 'dark');
  assert.equal(schoolsFlag('?special=hades&look=pit,schools'), true);
});

test('every mapped special is a real special and every school has a colour', () => {
  for (const id of Object.keys(SCHOOL_OF)) assert.ok(Object.hasOwn(SPECIAL_TESTS, id), id);
  for (const school of new Set(Object.values(SCHOOL_OF))) assert.match(SCHOOLS[school], /^#[0-9a-f]{6}$/);
});

test('the tinter recolours a mapped material\'s pixels (alpha kept) and sets an unmapped one\'s colour, once', () => {
  const group = new THREE.Group(), flat = new THREE.MeshBasicMaterial({ color: '#101010', opacity: 0.4, transparent: true });
  const px = new Uint8Array([10, 10, 10, 200, 40, 40, 40, 90]), map = new THREE.DataTexture(px, 2, 1), mapped = new THREE.MeshBasicMaterial({ map, color: '#000000' });
  group.add(new THREE.Mesh(new THREE.BufferGeometry(), flat), new THREE.Mesh(new THREE.BufferGeometry(), mapped));
  const tint = schoolTinter(group, 'shadow'); tint();
  assert.equal(flat.color.getHexString(), new THREE.Color(SCHOOLS.shadow).getHexString());
  assert.equal(flat.opacity, 0.4);
  assert.equal(mapped.color.getHexString(), 'ffffff');
  assert.equal(px[3], 200); assert.equal(px[7], 90);
  assert.ok(px[2] > px[1] && px[0] > px[1], 'violet: blue and red over green');
  assert.ok(px[4] > px[0], 'the brighter source pixel stays brighter');
  const snapshot = [...px]; flat.color.set('#ffffff'); tint();
  assert.deepEqual([...px], snapshot); assert.equal(flat.color.getHexString(), 'ffffff', 'tinted once, not every frame');
});

test('each stronger look keeps the school\'s hue and is less saturated and darker than the one before', () => {
  const colour = (strength: 'plain' | 'soft' | 'dark') => { const m = new THREE.MeshBasicMaterial(), g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BufferGeometry(), m)); schoolTinter(g, 'shadow', strength)(); const hsl = { h: 0, s: 0, l: 0 }; m.color.getHSL(hsl); return hsl; };
  const plain = colour('plain'), soft = colour('soft'), dark = colour('dark');
  assert.ok(Math.abs(soft.h - plain.h) < 0.01 && Math.abs(dark.h - plain.h) < 0.01, 'same hue');
  assert.ok(soft.s < plain.s * 0.6 && soft.l < plain.l * 0.6, 'soft is desaturated and darker'); assert.ok(dark.s < soft.s && dark.l < soft.l * 0.7, 'dark is darker again');
});
