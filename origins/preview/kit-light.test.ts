// The kit's torch lights: the extras row is checked and refused when bad (no code defaults), placed at each sconce, and lent to the nearest ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { kitLights, parseKitLight, sconcePool } from './kit-light.ts';
import { previewRule } from './preview-rules.ts';

const GOOD = '{"color":"#ff9a47","intensity":1.2,"reach":9.0,"flicker":0.15}';
test('the real kit file carries a light row that parses', () => {
  const b = readFileSync(new URL('../../public/world/kit/dungeon-kit.glb', import.meta.url)), json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as { nodes: { name: string; extras?: { light?: string } }[] };
  const node = json.nodes.find((n) => n.extras?.light !== undefined)!;
  assert.deepEqual(parseKitLight(node.extras!.light, node.name), { color: '#ff9a47', intensity: 1.2, reach: 9, flicker: 0.15 });
});
test('a bad light row is refused, and nothing has a default', () => {
  assert.throws(() => parseKitLight('{nope', 'n'), /not JSON/);
  assert.throws(() => parseKitLight('[1]', 'n'), /not an object/);
  assert.throws(() => parseKitLight('{"color":"#ff9a47","intensity":1.2,"reach":9}', 'n'), /flicker must be/);   // a missing field is not filled in
  assert.throws(() => parseKitLight('{"intensity":1.2,"reach":9,"flicker":0.1}', 'n'), /color must be/);
  assert.throws(() => parseKitLight('{"color":"orange","intensity":1.2,"reach":9,"flicker":0.1}', 'n'), /color must be/);
  assert.throws(() => parseKitLight('{"color":"#ff9a47","intensity":0,"reach":9,"flicker":0.1}', 'n'), /intensity must be/);
  assert.throws(() => parseKitLight('{"color":"#ff9a47","intensity":1,"reach":-1,"flicker":0.1}', 'n'), /reach must be/);
  assert.throws(() => parseKitLight('{"color":"#ff9a47","intensity":1,"reach":9,"flicker":1.5}', 'n'), /flicker must be/);
  assert.throws(() => parseKitLight('{"color":"#ff9a47","intensity":1,"reach":9,"flicker":0.1,"extra":1}', 'n'), /unknown field "extra"/);
  assert.equal(parseKitLight(GOOD, 'n').reach, 9);
});
function sconceScene(extra?: string): THREE.Group {
  const root = new THREE.Group(), host = new THREE.Group(); host.name = 'wall_sconce'; host.position.set(39, 0, 0);
  const l = new THREE.Object3D(); l.name = 'sconce_light'; l.position.set(0, 2.5, 0.4); l.userData.light = extra ?? GOOD; host.add(l); root.add(host); root.updateMatrixWorld(true); return root;
}
test('a light stands at each placement of its sconce, turned and scaled with it', () => {
  const lights = kitLights(sconceScene(), [{ node: 'wall_sconce', x: 10, z: 20, rotY: 0, scale: 1 }, { node: 'wall_sconce', x: 0, z: 0, rotY: Math.PI / 2, scale: 2 }, { node: 'cave_wall', x: 5, z: 5, rotY: 0, scale: 1 }])!;
  assert.equal(lights.points.length, 2);
  assert.deepEqual(lights.points[0], { x: 10, y: 2.5, z: 20.4 });
  const q = lights.points[1]!; assert.ok(Math.abs(q.x - 0.8) < 1e-9 && Math.abs(q.y - 5) < 1e-9 && Math.abs(q.z) < 1e-9, 'a quarter turn sends the +z offset to +x, doubled');
  assert.equal(kitLights(new THREE.Group(), [{ node: 'wall_sconce', x: 0, z: 0, rotY: 0, scale: 1 }]), null, 'a kit with no torch row has none');
  assert.throws(() => kitLights(sconceScene('{"color":"#fff"}'), []), /color must be|intensity must be/);
});
test('the pool lends the page\'s lights to the nearest sconces within the camp lights\' reach, with the row\'s colour and reach, and returns them', () => {
  const lights = kitLights(sconceScene(), [{ node: 'wall_sconce', x: 0, z: 0, rotY: 0, scale: 1 }, { node: 'wall_sconce', x: 4, z: 0, rotY: 0, scale: 1 }, { node: 'wall_sconce', x: 500, z: 0, rotY: 0, scale: 1 }])!, pool = sconcePool(lights);
  const a = new THREE.PointLight('#ff8a3a', 9, 9, 1.8), b = new THREE.PointLight('#ff8a3a', 9, 9, 1.8); a.position.set(-50, 1.9, 0); b.position.set(-51, 1.9, 0);
  pool.update({ x: 1, z: 0 }, [a, b]);
  assert.ok(pool.lends(a) && pool.lends(b));
  assert.equal(a.position.x, 0); assert.equal(b.position.x, 4);   // the nearest first
  assert.equal(a.distance, 9); assert.equal(a.color.getHexString(), 'ff9a47');
  pool.glow(a, 0); assert.ok(Math.abs(a.intensity - 1.2 * 9) < 1e-9, 'the row is a multiple of the lent light\'s own strength (9)');
  pool.glow(a, 1); assert.ok(Math.abs(a.intensity - 1.2 * 9 * 1.15) < 1e-9, 'the flicker deepens it by the row\'s depth'); pool.glow(a, -1); assert.ok(Math.abs(a.intensity - 1.2 * 9 * 0.85) < 1e-9);
  a.userData.base = 20; pool.glow(a, 0); assert.ok(Math.abs(a.intensity - 1.2 * 20) < 1e-9, 'a light that names its own base is scaled from that');
  pool.update({ x: 1000, z: 0 }, [a, b]);   // out of everyone's reach: home again
  assert.ok(!pool.lends(a)); assert.equal(a.position.x, -50); assert.equal(a.color.getHexString(), 'ff8a3a'); assert.equal(a.distance, 9);
  assert.ok(previewRule('campLightReach') > 0);
});
