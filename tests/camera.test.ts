import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { cameraPose } from '../src/scene.ts';
import { initialState, RADIUS, TARGET } from '../src/sim.ts';

test('all edge angles and orbit positions keep camera inside scenery', () => {
  for (let angle = 0; angle < 2 * Math.PI; angle += 0.1) {
    for (let yaw = 0; yaw < 2 * Math.PI; yaw += 0.1) {
      const state = { ...initialState(), x: Math.sin(angle) * RADIUS, z: Math.cos(angle) * RADIUS };
      for (const locked of [true, false]) {
        const pose = cameraPose(state, yaw, 0.45, locked);
        assert.ok(Math.hypot(pose.x, pose.z) <= 11.5 + 1e-10);
        assert.ok(pose.y > 2);
      }
    }
  }
});
test('locked camera frames both capsules at boundary and near contact in portrait and landscape', () => {
  for (const aspect of [390 / 844, 844 / 390, 16 / 9]) {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
      for (const near of [false, true]) {
        const state = { ...initialState(), x: Math.sin(angle) * (near ? 0.85 : RADIUS), z: (near ? TARGET.z : 0) + Math.cos(angle) * (near ? 0.85 : RADIUS) };
        const yaw = Math.atan2(state.x - TARGET.x, state.z - TARGET.z);
        const pose = cameraPose(state, yaw, 0.45, true);
        const camera = new PerspectiveCamera(51, aspect, 0.1, 180);
        camera.position.set(pose.x, pose.y, pose.z); camera.lookAt(pose.lookX, 1, pose.lookZ); camera.updateMatrixWorld();
        for (const target of [state, TARGET]) for (const height of [0, 1.8]) {
          const screen = new Vector3(target.x, height, target.z).project(camera);
          assert.ok(Math.abs(screen.x) < 0.95 && Math.abs(screen.y) < 0.95 && screen.z < 1, JSON.stringify({aspect,angle,near,screen}));
        }
      }
    }
  }
});

test('duel camera frames a moving opponent anywhere in the arena', () => {
  for (const aspect of [375/812,844/390,16/9]) for (let a=0;a<6.28;a+=.3) for(let b=0;b<6.28;b+=.4) {
    const state={...initialState(),x:Math.sin(a)*RADIUS,z:Math.cos(a)*RADIUS};
    const target={x:Math.sin(b)*7,z:Math.cos(b)*7};
    const pose=cameraPose(state,Math.atan2(state.x-target.x,state.z-target.z),.45,true,target);
    const camera=new PerspectiveCamera(51,aspect,.1,180);camera.position.set(pose.x,pose.y,pose.z);camera.lookAt(pose.lookX,1,pose.lookZ);camera.updateMatrixWorld();
    for(const actor of [state,target])for(const y of [0,1.8]) { const p=new Vector3(actor.x,y,actor.z).project(camera); assert.ok(Math.abs(p.x)<.95&&Math.abs(p.y)<.95&&p.z<1,JSON.stringify({aspect,a,b,p})); }
  }
});
