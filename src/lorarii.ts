// The lorarii (Brief 13, owner via Strategy 2026-09-22: "the guards themselves are invisible, they should be pacing up and
// down, 6 guards on equal spacing around the perimeter"). Six whip-guards on the walkway on top of the ring wall — never on
// the sand, never inside the camera clamp — each pacing his own sixth slowly and turning to watch the nearest fighter. On the
// whip beat the guard nearest the whipped fighter stops, raises and lashes: `WhipRaised` (Combat, 1 s ahead) plays the raise,
// `Whipped` the lash; a `Whipped` with no raise before it raises fast and lashes. Presentation only: RULES.wall.loiter decides
// WHEN (duel.ts); this decides where the guard stands and what he does. `lorariusAngle(i, tick)` is a pure function of the
// SIM TICK — not wall time — so Combat can source the shove direction from the same guard and a replay places him identically
// (lead review). The raise/lash beat runs on animation time; only the pacing is tick-driven.
//
// v1 body: a placeholder — capsule, head, a stick for the whip — instanced ×6 (one draw). The shared GLB + clips from Multi
// Chars replace `placeholderGeometry` when they land; the placement, pacing and the raise/lash timing stay.
import * as THREE from 'three';
import type { CombatEvent } from './duel.ts';
import type { SimView } from './arena.ts';

const TICK = 1 / 60;   // the sim's fixed step (duel.ts stepDuel at 60 Hz)

export const LORARII = {
  count: 6,
  radius: 12.1,          // mid-walkway: LAYOUT.wall.inner 11.7 .. outer 12.5 (arena.ts); CAMERA_CLAMP is 11.5, so never in the fight camera's clear zone
  top: 2.6,              // LAYOUT.wall.top: the walkway surface
  sixth: Math.PI / 3,
  reach: 0.28,           // radians each side of his post that he paces (±16°): sixths never overlap and the gate (π ± 0.13, plus a shoulder) stays clear (tests/lorarii.test.ts)
  period: 26,            // seconds for one there-and-back; 4 × reach × radius / period ≈ 0.52 m/s — a slow walk (guards 1, 2 walk a little slower still)
  turn: 4,               // yaw lerp rate toward the nearest fighter (per second)
  raise: 0.35, lash: 0.22, recover: 0.6,   // seconds
} as const;

// Where guard `i` stands at sim tick `tick`: his post is the centre of his sixth, offset by half a sixth so no post sits on the
// gate axis, and he walks a slow triangle wave along the wall with his own phase and period. Pure — Combat may call it too.
export function lorariusAngle(i: number, tick: number): number {
  const t = tick * TICK, post = LORARII.sixth * (i + 0.5), period = LORARII.period + (i % 3) * 4, u = ((t / period) + i * 0.29) % 1;
  const tri = u < 0.5 ? u * 4 - 1 : 3 - u * 4;   // -1 → 1 → -1
  return post + tri * LORARII.reach;
}

export type Lorarii = { update(dt: number, events: readonly CombatEvent[], sim?: SimView, camera?: THREE.Camera): void; dispose(): void; readonly mesh: THREE.InstancedMesh };

type Phase = 'pace' | 'raise' | 'hold' | 'lash' | 'recover';

export function placeholderGeometry(): THREE.BufferGeometry {
  // 1.78 m figure: capsule body (0.5 m wide), a head, and the whip stock held up at the right hand. Merged, so one instanced draw.
  const body = new THREE.CapsuleGeometry(0.22, 1.05, 4, 10); body.translate(0, 0.22 + 1.05 / 2, 0);
  const head = new THREE.SphereGeometry(0.13, 10, 8); head.translate(0, 1.62, 0);
  const stock = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6); stock.rotateX(-0.6); stock.translate(0.28, 1.25, 0.15);
  const parts = [body, head, stock].map(g => g.toNonIndexed());
  const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const position = new Float32Array(count * 3), normal = new Float32Array(count * 3);
  let at = 0;
  for (const g of parts) { position.set(g.attributes.position.array as Float32Array, at * 3); normal.set(g.attributes.normal.array as Float32Array, at * 3); at += g.attributes.position.count; g.dispose(); }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3)); merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.computeBoundingSphere();
  return merged;
}

export function buildLorarii(parent: THREE.Object3D, geometry: THREE.BufferGeometry = placeholderGeometry(), material: THREE.Material = new THREE.MeshStandardMaterial({ color: 0x3a3229, roughness: 0.92, metalness: 0.05 })): Lorarii {
  const mesh = new THREE.InstancedMesh(geometry, material, LORARII.count);
  mesh.name = 'lorarii'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;   // culled per guard below
  parent.add(mesh);
  const guards = Array.from({ length: LORARII.count }, (_, i) => ({ i, angle: lorariusAngle(i, 0), yaw: 0, phase: 'pace' as Phase, since: 0, held: 0 }));
  let tick = 0;
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler(), scale = new THREE.Vector3(1, 1, 1);
  const frustum = new THREE.Frustum(), viewProjection = new THREE.Matrix4(), sphere = new THREE.Sphere(new THREE.Vector3(), 1.3);
  const nearest = (x: number, z: number) => { let best = 0, d = Infinity; for (const g of guards) { const gx = LORARII.radius * Math.sin(g.angle), gz = LORARII.radius * Math.cos(g.angle), dd = (gx - x) ** 2 + (gz - z) ** 2; if (dd < d) { d = dd; best = g.i; } } return guards[best]; };
  function update(dt: number, events: readonly CombatEvent[], sim?: SimView, camera?: THREE.Camera) {
    if (sim) tick = sim.tick; const fighters = sim?.fighters;
    for (const e of events) {
      if (e.type !== 'Whipped' && (e.type as string) !== 'WhipRaised') continue;
      if (e.x === undefined || e.z === undefined) continue;
      const g = nearest(e.x, e.z);
      if ((e.type as string) === 'WhipRaised') { g.phase = 'raise'; g.since = 0; g.held = 1.2; }                        // raise, then hold until the lash lands
      else if (g.phase === 'hold' || g.phase === 'raise') { g.phase = 'lash'; g.since = 0; }                             // the promised lash
      else { g.phase = 'raise'; g.since = 0; g.held = 0; }                                                              // no warning: a fast raise straight into the lash
    }
    if (camera) frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const g of guards) {
      g.since += dt;
      if (g.phase === 'pace') g.angle = lorariusAngle(g.i, tick);
      else if (g.phase === 'raise' && g.since >= LORARII.raise) { g.phase = g.held > 0 ? 'hold' : 'lash'; g.since = 0; }
      else if (g.phase === 'hold' && g.since >= g.held) { g.phase = 'lash'; g.since = 0; }
      else if (g.phase === 'lash' && g.since >= LORARII.lash) { g.phase = 'recover'; g.since = 0; }
      else if (g.phase === 'recover' && g.since >= LORARII.recover) { g.phase = 'pace'; g.since = 0; }
      const x = LORARII.radius * Math.sin(g.angle), z = LORARII.radius * Math.cos(g.angle);
      // Face the nearest fighter (or the ring's centre when none are known); a slow turn, never a snap.
      let tx = 0, tz = 0;
      if (fighters?.length) { let d = Infinity; for (const f of fighters) { const dd = (f.x - x) ** 2 + (f.z - z) ** 2; if (dd < d) { d = dd; tx = f.x; tz = f.z; } } }
      const want = Math.atan2(tx - x, tz - z);
      let delta = want - g.yaw; delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      g.yaw += delta * Math.min(1, LORARII.turn * dt);
      // The beat: lean back on the raise, whip forward on the lash, settle on the recover (tilt about the hips, radians).
      const u = g.since;
      const tilt = g.phase === 'raise' ? -0.28 * Math.min(1, u / LORARII.raise) : g.phase === 'hold' ? -0.28 : g.phase === 'lash' ? -0.28 + 0.75 * Math.min(1, u / LORARII.lash) : g.phase === 'recover' ? 0.47 * (1 - Math.min(1, u / LORARII.recover)) : 0;
      if (camera && !frustum.intersectsSphere(sphere.set(sphere.center.set(x, LORARII.top + 0.9, z), 1.3))) { scale.set(0, 0, 0); } else scale.set(1, 1, 1);
      position.set(x, LORARII.top, z); quaternion.setFromEuler(euler.set(tilt, g.yaw, 0, 'YXZ'));
      mesh.setMatrixAt(g.i, matrix.compose(position, quaternion, scale));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0, []);
  return { mesh, update, dispose() { parent.remove(mesh); mesh.dispose(); geometry.dispose(); material.dispose(); } };
}
