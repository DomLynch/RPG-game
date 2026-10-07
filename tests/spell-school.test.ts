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

test('plain then dark keep the hue and get darker; soft keeps today\'s pixels and only leans toward the school', () => {
  const colour = (strength: 'plain' | 'dark') => { const m = new THREE.MeshBasicMaterial(), g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BufferGeometry(), m)); schoolTinter(g, 'shadow', strength)(); const hsl = { h: 0, s: 0, l: 0 }; m.color.getHSL(hsl); return hsl; };
  const plain = colour('plain'), dark = colour('dark');
  assert.ok(Math.abs(dark.h - plain.h) < 0.01, 'same hue'); assert.ok(dark.s < plain.s && dark.l < plain.l * 0.5, 'dark is desaturated and darker');
  // soft: a near-black ink pixel stays near-black (a faint violet), a mid pixel keeps ~80% of itself, alpha untouched, and nothing gets lighter than a 20% pull toward the dark hue
  const px = new Uint8Array([2, 2, 2, 200, 100, 100, 100, 90]), tex = new THREE.DataTexture(px, 2, 1), m = new THREE.MeshBasicMaterial({ map: tex }), g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BufferGeometry(), m)); schoolTinter(g, 'shadow', 'soft')();
  assert.ok(px[0] < 40 && px[1] < 40 && px[2] < 40, 'ink stays near-black'); assert.ok(px[2] > px[1] && px[0] > px[1], 'with a faint violet lean');
  assert.ok(px[4] >= 80 && px[4] <= 100 && px[7] === 90 && px[3] === 200, 'mid pixel keeps most of itself, alpha untouched');
});
