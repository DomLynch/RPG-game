// K6: a zone creature's decapitation is keyed by its catalogue row (src/fight/zone-finisher.ts): it plays only for a creature whose row has a head to cut, once, with the row's bones.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { canPlayFinisher, createZoneFinisher, cutOf, type CutRig } from '../src/fight/zone-finisher.ts';

function fakeRig() {
  const calls: { sever: (readonly string[] | undefined)[]; unsever: number } = { sever: [], unsever: 0 };
  const rig: CutRig = {
    sever: (bones) => { calls.sever.push(bones); const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1))); return { group: g, radius: .1 }; },
    unsever: () => void calls.unsever++, boneWorld: () => new THREE.Vector3(1, 1, 1),
  };
  return { rig, calls };
}
const wolf = { character: 'character:ember-wolf', body: 'wolf' }, at = { x: 0, z: 0 }, from = { x: 0, z: -2 };

test('cutOf reads the row: the beasts name head and neck bones, an unknown creature has none', () => {
  for (const id of ['wolf', 'boar', 'bear']) { const c = cutOf(`character:${id}`, id)!; assert.ok(c.head.length && c.neck.length, id); }
  assert.deepEqual(cutOf('character:ember-wolf', 'wolf')!.head, cutOf('character:wolf', 'wolf')!.head, 'the Ember wolf shares the wolf rig');
  assert.equal(cutOf('character:nobody', 'not-a-body'), null);
  assert.equal(canPlayFinisher('plainDeath'), true); assert.equal(canPlayFinisher('decapitation'), true); assert.equal(canPlayFinisher('opened'), false);
});

test('a decapitation severs once with the row\'s bones after the fall has begun, bleeds at the neck, and the head is disposed later', () => {
  const scene = new THREE.Scene(), cuts: string[] = [], f = createZoneFinisher(scene, { bleed: (id) => void cuts.push(id) }), { rig, calls } = fakeRig();
  f.frame('w1', wolf, rig, 0.01, 'decapitation', at, from); assert.equal(calls.sever.length, 0, 'not before the fall has begun');
  f.frame('w1', wolf, rig, 0.2, 'decapitation', at, from);
  assert.deepEqual(calls.sever, [cutOf(wolf.character, wolf.body)!.head], 'the row\'s head bones');
  assert.equal(f.heads(), 1); assert.equal(scene.children.length, 1); assert.deepEqual(cuts, ['w1']);
  f.frame('w1', wolf, rig, 0.5, 'decapitation', at, from); assert.equal(calls.sever.length, 1, 'once per kill');
  for (let i = 0; i < 60; i++) f.update(1 / 30);
  assert.equal(f.heads(), 1, 'it lies a while'); for (let i = 0; i < 12 * 30; i++) f.update(1 / 30);
  assert.equal(f.heads(), 0, 'then it is gone'); assert.equal(scene.children.length, 0);
  f.release('w1'); assert.equal(calls.unsever, 1, 'the rig grows its head back for the respawn');
});

test('the plain death, another finisher or a creature with no cut never severs; a new kill after release can sever again', () => {
  const f = createZoneFinisher(new THREE.Scene()), a = fakeRig(), b = fakeRig(), c = fakeRig();
  f.frame('p', wolf, a.rig, 0.5, 'plainDeath', at, from); f.frame('p', wolf, a.rig, 0.5, undefined, at, from); f.frame('o', wolf, b.rig, 0.5, 'opened', at, from);
  f.frame('n', { character: 'character:nobody', body: 'not-a-body' }, c.rig, 0.5, 'decapitation', at, from);
  assert.equal(a.calls.sever.length + b.calls.sever.length + c.calls.sever.length, 0);
  f.frame('w', wolf, a.rig, 0.5, 'decapitation', at, from); f.release('w'); f.frame('w', wolf, a.rig, 0.5, 'decapitation', at, from);
  assert.equal(a.calls.sever.length, 2, 'a respawned creature can lose its head again');
  f.dispose();
});

test('no creature is named in the zone finisher: it reads rows', () => {
  const src = readFileSync(new URL('../src/fight/zone-finisher.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/['"`](wolf|boar|bear|goblin|ember-wolf)['"`]/.test(src));
});
