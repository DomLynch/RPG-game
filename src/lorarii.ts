// The lorarii (Brief 13, owner via Strategy 2026-09-22: "the guards themselves are invisible, they should be pacing up and
// down, 6 guards on equal spacing around the perimeter"). Six whip-guards on the walkway on top of the ring wall — never on
// the sand, never inside the camera clamp — each pacing his own sixth slowly and turning to watch the nearest fighter. On the
// whip beat the guard nearest the whipped fighter stops, raises and lashes: `WhipRaised` (Combat, 1 s ahead) plays the raise,
// `Whipped` the lash; a `Whipped` with no raise before it raises fast and lashes. Presentation only: RULES.wall.loiter decides
// WHEN (duel.ts); this decides where the guard stands and what he does. `lorariusAngle(i, tick)` is a pure function of the
// SIM TICK — not wall time — so Combat can source the shove direction from the same guard and a replay places him identically
// (lead review). The raise/lash beat runs on animation time; only the pacing is tick-driven.
//
// The body is Multi Chars' src/assets/guard.glb (#428): the hero rig's bones, five clips — Pace, Stand, Turn, Raise, Lash.
// It is SKINNED, so six of them are six SkeletonUtils clones with their own mixers, not one InstancedMesh (bones cannot ride
// an instance matrix). The placeholder capsules stay as the fallback: if the file fails to load the six still pace, so a
// missing asset never empties the wall. `?guards=<n>` caps how many are built (documented fallback if the phone tier busts).
// The asset's URL is handed in (scene.ts already globs ./assets/*.glb): this module stays plain TypeScript, so the unit test
// can import it under node without Vite's `?url`.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import type { CombatEvent } from './duel.ts';
import type { SimView } from './arena.ts';
import { retryTransient } from './characters.ts';

const TICK = 1 / 60;   // the sim's fixed step (duel.ts stepDuel at 60 Hz)

export const LORARII = {
  count: 6,
  radius: 12.1,          // mid-walkway: LAYOUT.wall.inner 11.7 .. outer 12.5 (arena.ts); CAMERA_CLAMP is 11.5, so never in the fight camera's clear zone
  top: 2.6,              // LAYOUT.wall.top: the walkway surface
  sixth: Math.PI / 3,
  reach: 0.28,           // radians each side of his post that he paces (±16°): sixths never overlap and the gate (π ± 0.13, plus a shoulder) stays clear (tests/lorarii.test.ts)
  // Pace's own ground speed, measured by Multi Chars off guard.glb (maximum forward foot separation 0.642 m across the clip's
  // 1.333 s = 1.284 m per cycle): 0.963 m/s at timeScale 1. Walking them slower than the clip makes the feet skate, and below
  // ~0.7 m/s the gait wants re-authoring — so the patrol moves at the clip's own speed and the mixer stays at 1. Every guard
  // walks the same speed and only his phase differs, so one timeScale serves all six.
  speed: 0.963,          // metres per second along the wall; the period follows from it (see lorariusAngle)
  raiseClip: 0.5,        // seconds: guard.glb's Raise (Lash is 0.6) — what the lead is filled with
  turn: 4,               // yaw lerp rate toward the nearest fighter (per second)
  raise: 0.35, lash: 0.22, recover: 0.6,   // seconds: the placeholder's beat. With the real body, Raise and Lash are the clips' own lengths (0.6 s each)
  lead: 60,                // default ticks between WhipRaised and Whipped when the event carries no `lead` (RULES.wall.loiter: 60 before the first lash, 30 before a repeat)
} as const;

// Where guard `i` stands at sim tick `tick`: his post is the centre of his sixth, offset by half a sixth so no post sits on the
// gate axis, and he walks a slow triangle wave along the wall with his own phase and period. Pure — Combat may call it too.
export function lorariusAngle(i: number, tick: number): number {
  const t = tick * TICK, post = LORARII.sixth * (i + 0.5), period = 4 * LORARII.reach * LORARII.radius / LORARII.speed, u = ((t / period) + i * 0.29) % 1;
  const tri = u < 0.5 ? u * 4 - 1 : 3 - u * 4;   // -1 → 1 → -1
  return post + tri * LORARII.reach;
}

export type Lorarii = { update(dt: number, events: readonly CombatEvent[], sim?: SimView, camera?: THREE.Camera): void; bodies(url: string): Promise<void>; dispose(): void; readonly mesh: THREE.InstancedMesh };

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

// The five clips guard.glb carries (tests/guard.test.ts pins the names and that Turn and Lash are 0.6 s each).
const CLIPS = ['Pace', 'Stand', 'Turn', 'Raise', 'Lash'] as const;
type Clip = typeof CLIPS[number];
type Rig = { root: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Record<Clip, THREE.AnimationAction>; playing: Clip };
// Turn is deliberately never played. It is a 180 degree about-face with a root.quaternion track INSIDE the GLB (Multi Chars),
// one level under the node this module positions, so playing it would compose with the yaw below and spin the guard 360.
// The yaw-lerp wins here because a guard watches whichever fighter is nearest, which is a continuous heading, not a flip.

// One guard's body: a clone of the shared asset with its own mixer. Cross-faded, so a raise never snaps out of the walk.
function rig(asset: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }): Rig {
  const root = cloneSkeleton(asset.scene);
  root.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(root), actions = {} as Record<Clip, THREE.AnimationAction>;
  for (const name of CLIPS) {
    const clip = asset.animations.find((a) => a.name === name);
    if (!clip) throw new Error(`guard.glb is missing the ${name} clip`);
    actions[name] = mixer.clipAction(clip);
    actions[name].setEffectiveWeight(name === 'Pace' ? 1 : 0).play();
    if (name === 'Raise' || name === 'Lash') { actions[name].setLoop(THREE.LoopOnce, 1); actions[name].clampWhenFinished = true; }
  }
  return { root, mixer, actions, playing: 'Pace' };
}

function playClip(r: Rig, next: Clip, fade = 0.18) {
  if (r.playing === next) return;
  r.actions[r.playing].fadeOut(fade);
  const action = r.actions[next];
  if (next === 'Raise' || next === 'Lash') { action.reset(); }
  action.setEffectiveWeight(1).fadeIn(fade).play();
  r.playing = next;
}

// The asset, fetched once for all six. A failure is not fatal: `bodies` stays empty and the capsules carry the scene.
export async function loadGuardAsset(url: string) {
  const asset = await retryTransient(() => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url));
  for (const name of CLIPS) if (!asset.animations.some((a) => a.name === name)) throw new Error(`guard.glb is missing the ${name} clip`);
  return asset as unknown as { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
}

export function buildLorarii(parent: THREE.Object3D, geometry: THREE.BufferGeometry = placeholderGeometry(), material: THREE.Material = new THREE.MeshStandardMaterial({ color: 0x3a3229, roughness: 0.92, metalness: 0.05 })): Lorarii {
  // `?guards=<n>` caps the six (the documented fallback if the phone tier busts). Read defensively: this module is imported by
  // node unit tests and by the arena preview, where there is no `location`.
  const asked = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('guards');
  const count = Math.max(1, Math.min(LORARII.count, Number(asked ?? LORARII.count) || LORARII.count));
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = 'lorarii'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;   // culled per guard below
  parent.add(mesh);
  const guards = Array.from({ length: count }, (_, i) => ({ i, angle: lorariusAngle(i, 0), yaw: 0, phase: 'pace' as Phase, since: 0, held: 0, raiseScale: 1 }));
  // The real bodies land later (one fetch, six clones). Until then — or if the fetch fails — the capsules above carry the wall.
  const bodies: Rig[] = [];
  // The real bodies are fetched when the caller hands the asset's URL over (scene.ts, once its glob is in scope). Until then —
  // or if the fetch fails — the capsules carry the wall, so a missing asset never empties it.
  // Cloning six skinned rigs in one pass stalls the main thread long enough that a phone drops frames mid-fight (and
  // scripts/quiet-one-browser-check.mjs timed out waiting for the canvas to go stable). One clone per frame instead: the
  // guards fade in over six frames and nothing hitches.
  let pending: { scene: THREE.Object3D; animations: THREE.AnimationClip[] } | null = null;
  let fetched = false;
  const bodiesIn = (url: string) => {
    if (fetched) return Promise.resolve(); fetched = true;
    return loadGuardAsset(url).then((asset) => { pending = asset; }).catch(() => { /* the capsules stay */ });
  };
  let tick = 0;
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler(), scale = new THREE.Vector3(1, 1, 1);
  const frustum = new THREE.Frustum(), viewProjection = new THREE.Matrix4(), sphere = new THREE.Sphere(new THREE.Vector3(), 1.3);
  const nearest = (x: number, z: number) => { let best = 0, d = Infinity; for (const g of guards) { const gx = LORARII.radius * Math.sin(g.angle), gz = LORARII.radius * Math.cos(g.angle), dd = (gx - x) ** 2 + (gz - z) ** 2; if (dd < d) { d = dd; best = g.i; } } return guards[best]; };
  function update(dt: number, events: readonly CombatEvent[], sim?: SimView, camera?: THREE.Camera) {
    if (sim) tick = sim.tick; const fighters = sim?.fighters;
    if (pending && bodies.length < count) {
      const r = rig(pending); parent.add(r.root); bodies.push(r);
      if (bodies.length === count) { mesh.visible = false; pending = null; }   // the capsules step aside once all six are in
    }
    for (const e of events) {
      if (e.type !== 'Whipped' && (e.type as string) !== 'WhipRaised') continue;
      if (e.x === undefined || e.z === undefined) continue;
      const g = nearest(e.x, e.z);
      if ((e.type as string) === 'WhipRaised') {
        // The lead is NOT constant (Combat, verified against RULES.wall.loiter on trunk: 60 ticks before the first lash, 30
        // before every repeat at `again`). So the raise is stretched to whatever lead the event carries — never a hard-coded
        // hold — and the arm is up exactly when the lash lands, however the owner retunes `again`.
        const lead = (((e as { lead?: number }).lead ?? LORARII.lead) | 0) / 60;
        // Raise is 0.5 s of clip; play it at clip/lead so the arm is up exactly as the lash lands. Clamped: past ~2.5x the
        // wind-up stops reading as a wind-up (Multi Chars), and the sim's own leads (60 ticks, then 30) land at 0.5x and 1x.
        g.phase = 'raise'; g.since = 0; g.held = Math.max(0, lead - LORARII.raise);
        g.raiseScale = Math.min(2.5, Math.max(0.4, LORARII.raiseClip / Math.max(0.05, lead)));
      }
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
      const seen = !camera || frustum.intersectsSphere(sphere.set(sphere.center.set(x, LORARII.top + 0.9, z), 1.3));
      scale.set(seen ? 1 : 0, seen ? 1 : 0, seen ? 1 : 0);
      position.set(x, LORARII.top, z); quaternion.setFromEuler(euler.set(tilt, g.yaw, 0, 'YXZ'));
      mesh.setMatrixAt(g.i, matrix.compose(position, quaternion, scale));
      // The real body, when it is in: the clip says what he is doing, the transform where he stands. Off-camera he keeps his
      // place but stops animating — a mixer nobody sees is the one cost worth saving on a phone.
      const body = bodies[g.i];
      if (body) {
        body.root.visible = seen;
        body.root.position.set(x, LORARII.top, z);
        body.root.rotation.set(0, g.yaw, 0);
        if (g.phase === 'raise' && body.playing !== 'Raise') body.actions.Raise.setEffectiveTimeScale(g.raiseScale);   // the clip fills the lead the sim gave us
        playClip(body, g.phase === 'raise' || g.phase === 'hold' ? 'Raise' : g.phase === 'lash' ? 'Lash' : g.phase === 'recover' ? 'Stand' : 'Pace');
        if (seen) body.mixer.update(dt);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0, []);
  return {
    mesh, update, bodies: bodiesIn,
    dispose() {
      parent.remove(mesh); mesh.dispose(); geometry.dispose(); material.dispose();
      for (const b of bodies) { b.mixer.stopAllAction(); parent.remove(b.root); b.root.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); }
      bodies.length = 0;
    },
  };
}
