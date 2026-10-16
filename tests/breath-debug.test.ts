import { test } from 'node:test';
import * as THREE from 'three';
import { createBreath } from '../src/fight/breath.ts';

test('debug', () => {
  const scene = new THREE.Scene(), breath = createBreath(scene);
  breath.start('s1', new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 3), 7);
  for (let k = 0; k < 40; k++) breath.update(0.02);
  const t = (scene.children[0] as THREE.Group).children.find((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh, m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  console.log('DEBUG', [...Array(t.count).keys()].map((k) => { t.getMatrixAt(k, m); m.decompose(p, q, s); return `${k}:${s.x.toFixed(2)},${s.z.toFixed(2)},z${p.z.toFixed(2)}`; }).join(' '));
});
