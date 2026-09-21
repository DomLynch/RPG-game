import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Color, Group, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry, Scene, Vector3 } from 'three';
import { createBladeBlood, createSplatPool, createWoundDecals } from '../src/gore.ts';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

test('splat pool: a splash lives 20 s at the struck fighter, fades over its last 4 s, and the pool of twelve wraps', () => {
  const scene = new Scene(), pool = createSplatPool(scene, null);
  assert.equal(pool.entries.length, 12);
  assert.equal(scene.children.length, 12, 'every splat is in the scene, hidden');
  assert.ok(pool.entries.every(s => !s.mesh.visible));
  pool.splash({ x: 2, z: -1 }, 'red');
  const s = pool.entries[0];   // first draw is index 0; the counter reads 1 after it
  assert.equal(s.life, 20);
  assert.deepEqual(s.mesh.position.toArray().map(v => +v.toFixed(6)), [2, +(0.022 + 0.0001).toFixed(6), -1]);
  assert.ok(near(s.mesh.scale.x, 0.22 + 0.05) && near(s.mesh.scale.y, 0.13 + 0.035), 'size varies with the counter');
  assert.ok(near(s.mesh.rotation.z, 2.4));
  assert.equal(s.mesh.material.color.getHexString(), new Color('#681a19').getHexString());
  pool.update(1 / 60);
  assert.ok(s.mesh.visible && near(s.mesh.material.opacity, 0.65), 'full opacity while young');
  s.life = 2; pool.update(0);
  assert.ok(near(s.mesh.material.opacity, 0.5), 'fades over the last four seconds');
  pool.clear(false);
  assert.ok(s.mesh.visible, 'a rematch clear leaves visibility to the next update');
  pool.update(0);
  assert.ok(!s.mesh.visible);
  pool.splash({ x: 0, z: 0 }, 'dark');
  assert.equal(pool.entries[1].mesh.material.color.getHexString(), new Color('#352426').getHexString(), 'dark blood tone');
  pool.clear(true);
  assert.ok(pool.entries.every(x => !x.mesh.visible && x.life === 0), 'a blood-mode change hides at once');
  for (let i = 0; i < 12; i++) pool.splash({ x: i, z: 0 }, 'red');
  assert.equal(pool.entries[1].mesh.position.x, 11, 'the thirteenth splash reuses slot 1 (the counter was at 2)');
});

test('splat pool: the kill pool spreads over 2.2 s to 1.0 × 0.6 at 0.7 opacity and never fades', () => {
  const pool = createSplatPool(new Scene(), null);
  pool.pool({ x: 1, z: 1 }, 'red');
  const p = pool.entries[0];
  assert.equal(p.life, 1e9); assert.equal(p.mesh.position.y, 0.03);
  assert.deepEqual(p.mesh.scale.toArray().map(v => +v.toFixed(6)), [0.3, 0.2, 1]);
  pool.update(1.1);
  assert.ok(near(p.grow, 0.5 + 1e-6, 1e-9), "grow starts at 1e-6 and adds dt / 2.2");
  assert.ok(near(p.mesh.scale.x, 0.3 + 0.35, 1e-6) && near(p.mesh.scale.y, (0.2 + 0.275) * 0.8, 1e-6) && near(p.mesh.material.opacity, 0.35, 1e-6));
  for (let i = 0; i < 200; i++) pool.update(1 / 60);
  assert.equal(p.grow, 1);
  assert.ok(near(p.mesh.scale.x, 1) && near(p.mesh.scale.y, 0.6) && near(p.mesh.material.opacity, 0.7) && p.mesh.visible, 'fully spread and still there');
});

test('wound decals: no standing combat mark any more — the pool exists only for the throat cut, fades over its last second, hides in off, clears on rematch', () => {
  const scene = new Scene(), wounds = createWoundDecals(scene, null);
  assert.equal(wounds.entries.length, 2);
  assert.deepEqual(scene.children.map(c => c.name), ['Wound_0', 'Wound_1']);
  assert.ok(!('arm' in wounds) && !('hide' in wounds), 'the flesh-hit mark API is gone (owner 2026-09-21)');
  wounds.update(0.5, 'red');
  assert.ok(wounds.entries.every(w => !w.group.visible && w.life === 0), 'nothing shows without a throat cut');
  const neck = new Vector3(0, 1.5, 0), head = new Vector3(0, 1.65, 0), w = wounds.entries[1];
  wounds.throatCut(neck, head, 0, 1, 'red');
  assert.ok(w.group.visible && near(w.mark.material.opacity, 0.82) && near(w.life, 4));
  wounds.update(3.5, 'red');
  assert.ok(w.group.visible && near(w.life, 0.5) && near(w.mark.material.opacity, 0.82 * 0.5) && near(w.drips[0].material.opacity, 0.6 * 0.5), 'fades over the last second');
  wounds.update(0, 'off'); assert.ok(!w.group.visible && w.life > 0, 'off hides but keeps the window running');
  wounds.update(0.6, 'red'); assert.equal(w.life, 0); assert.ok(!w.group.visible, 'the window ran out');
  wounds.throatCut(neck, head, 0, 1, 'red'); wounds.clear(); wounds.update(0, 'red');
  assert.equal(w.life, 0); assert.ok(!w.group.visible, 'a rematch clears the mark');
});

test('wound decals: the Quiet One throat cut sits the mark on the neck, sized to the neck–head span, drips opening over the first quarter second', () => {
  const wounds = createWoundDecals(new Scene(), null);
  const neck = new Vector3(0, 1.5, 0), head = new Vector3(0, 1.65, 0);   // 0.15 m apart: size 2
  wounds.throatCut(neck, head, 0, 0.1, 'red');
  const w = wounds.entries[1];
  assert.equal(w.life, 4);
  assert.deepEqual(w.group.position.toArray().map(v => +v.toFixed(9)), [0, 1.5, 0.15], 'neck + forward × 0.075 × size');
  assert.ok(near(w.mark.scale.x, 1.7) && near(w.mark.scale.y, 0.28));
  assert.ok(near(w.mark.material.opacity, 0.82));
  assert.equal(w.mark.material.color.getHexString(), new Color('#581017').getHexString());
  assert.ok(near(w.drips[0].material.opacity, 0.6 * 0.4) && near(w.drips[2].position.x, 0.05) && near(w.drips[0].scale.y, 1));
  assert.ok(w.group.visible);
  wounds.throatCut(neck, head, 0, 1, 'off');
  assert.ok(!w.group.visible && near(w.drips[0].material.opacity, 0.6), 'off: hidden; drips fully open after 0.25 s');
});

function rigs() {
  const blade = (name: string) => new Mesh(new PlaneGeometry(), Object.assign(new MeshStandardMaterial({ color: '#ffffff' }), { name }));
  const player = new Group(), sword = new Object3D(); sword.name = 'SwordDrawn'; player.add(sword);
  const edge = blade('Blade'), haft = blade('Handle'); sword.add(edge, haft);
  const opponent = new Group(), weapon = new Object3D(); weapon.name = 'WeaponDrawn'; opponent.add(weapon);
  const twoHanded = blade('Blade'); weapon.add(twoHanded);
  return { warriors: { player: { anchor: player }, opponent: { anchor: opponent } }, edge, haft, twoHanded };
}

test('blade blood: tints only the blade of the given side from its original colour, never compounds, restores on off, and waits for rigs', () => {
  const { warriors, edge, haft, twoHanded } = rigs(), blood = createBladeBlood();
  const original = edge.material;
  blood.set(true, null, 'red', 0);
  assert.equal(blood.bloodied, false, 'no rigs yet: nothing tints and the flag stays off');
  blood.set(true, warriors, 'red', 0);
  assert.ok(blood.bloodied);
  assert.notEqual(edge.material, original, 'the blade material is cloned before tinting');
  assert.equal(edge.material.color.getHexString(), new Color('#ffffff').lerp(new Color('#7a1410'), 0.55).getHexString());
  assert.equal(haft.material.color.getHexString(), 'ffffff', 'the haft is never tinted');
  assert.equal(twoHanded.material.color.getHexString(), 'ffffff', 'the other side is untouched');
  blood.set(true, warriors, 'dark');   // a blood-mode retint keeps the side and starts from the original, not the red tint
  assert.equal(edge.material.color.getHexString(), new Color('#ffffff').lerp(new Color('#2a1516'), 0.55).getHexString());
  blood.set(false, warriors, 'dark');
  assert.equal(edge.material, original, 'off restores the original material object');
  assert.equal(blood.bloodied, false);
  const broad = twoHanded.material; broad.metalness = 0.9; broad.roughness = 0.4;
  blood.set(true, warriors, 'red', 1);
  // A broad hafted blade is a metallic mirror: it takes the dark film (owner, 2026-09-21: the scythe crescent rendered bright red).
  assert.equal(twoHanded.material.color.getHexString(), new Color('#ffffff').lerp(new Color('#2a1516'), 0.55).getHexString(), 'side 1: the two-handed weapon takes the dark film, never the red mirror');
  assert.equal(twoHanded.material.metalness, 0.3, 'the film stops the blade mirroring the sky');
  assert.equal(twoHanded.material.roughness, 0.7);
  assert.equal(edge.material, original);
  blood.set(false, warriors, 'red');
  assert.equal(twoHanded.material, broad, 'off restores the original two-handed material, metalness intact');
  assert.equal(twoHanded.material.metalness, 0.9);
});
