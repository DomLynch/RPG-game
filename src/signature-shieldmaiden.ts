import * as THREE from 'three';
import { OPPONENT_SIDE, defendedBy, isHeavy, registerSignature, type SignatureFrame } from './signature.ts';

// The Shieldmaiden's signature A, Splintered Defiance (docs/briefs/signature-effects.md row 8): a heavy she blocks chips splinters and trim
// from the shield rim, pale wood underneath, and the shield looks more battered as the fight goes on. Cosmetic only: it reads the Blocked
// event the duel already emits (the defender is `actor`, the attacker's move rides on it).
// Her shield is a Shield-slot loot mesh (loot.glb `~kit.Shield`), which an opponent wears only once Phase L's carriers land. When she carries
// one, each chip is a pale-wood mark pinned to its rim (frame.marks.shield, 4 for the fight, oldest reused) and the splinters fly from there.
// Until then the splinters fly from her guard hand, so the block still reads; no mark is made on a shield she does not have.
export const SPLINTER = {
  pieces: 18, bursts: 2,          // splinters per blocked heavy; bursts alive at once
  speed: [1.8, 3.4], up: 2.2,     // m/s outward toward the attacker, and upward kick
  gravity: 9.8, seconds: 1.4,     // how long a splinter lives, landing flat on the sand before it goes
  chip: { width: 0.07, height: 0.04 },   // metres: the pale wood a chip exposes on the rim
} as const;

type Splinter = { position: THREE.Vector3; velocity: THREE.Vector3; spin: THREE.Vector3; rotation: THREE.Euler; size: THREE.Vector3; age: number; live: boolean; trim: boolean };

const WOOD = new THREE.Color('#cfb48a'), TRIM = new THREE.Color('#3b2e22');
let pieces: Splinter[] = [], mesh: THREE.InstancedMesh | null = null, parentScene: THREE.Object3D | null = null, fired = 0, chips = 0;
const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), scratch = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
let seed = 0x9e3779b9;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

function build(root: THREE.Object3D) {
  let top = root; while (top.parent) top = top.parent;
  if (parentScene === top) return;
  clearSplinters(); parentScene = top;
  const count = SPLINTER.pieces * SPLINTER.bursts;
  mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85 }), count);
  mesh.frustumCulled = false; mesh.count = 0; top.add(mesh);
  for (let i = 0; i < count; i++) mesh.setColorAt(i, WOOD);
  pieces = Array.from({ length: count }, () => ({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), spin: new THREE.Vector3(), rotation: new THREE.Euler(), size: new THREE.Vector3(), age: 0, live: false, trim: false }));
}

// The Shield-slot mesh on her rig, if she wears one (characters.ts tags loot pieces with userData.slot).
export function shieldOf(root: THREE.Object3D): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => { if (!found && o.userData?.slot === 'Shield' && o.visible) found = o; });
  return found;
}

function fire(_event: unknown, frame: SignatureFrame) {
  const root = frame.roots[OPPONENT_SIDE], foe = frame.roots[1 - OPPONENT_SIDE];
  if (!root) return;
  build(root); fired++;
  root.updateWorldMatrix(true, true);
  const toward = (foe ? foe.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3()).sub(root.getWorldPosition(scratch)).setY(0).normalize();
  const shield = shieldOf(root);
  let at: THREE.Vector3;
  if (shield) {
    // The rim on the attacker's side, near the top where a heavy comes down: the shield's box, pushed out along the facing.
    const box = new THREE.Box3().setFromObject(shield), centre = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    at = centre.clone().addScaledVector(toward, Math.max(size.x, size.z) * 0.5).setY(centre.y + size.y * (0.25 + 0.2 * rand()));
    const normal = at.clone().sub(centre).normalize();
    frame.marks.shield(OPPONENT_SIDE, shield, at, normal, { ...SPLINTER.chip, color: WOOD, roughness: 0.92, tilt: (rand() - 0.5) * 1.2, fadeIn: 0.05 });
    chips++;
  } else {
    const hand = root.getObjectByName('hand_r') ?? root;
    at = hand.getWorldPosition(new THREE.Vector3()).addScaledVector(toward, 0.12);
  }
  const side = scratch.copy(toward).cross(yAxis).normalize();
  const free = pieces.filter((p) => !p.live);
  const burst = (free.length >= SPLINTER.pieces ? free : [...pieces].sort((a, b) => b.age - a.age)).slice(0, SPLINTER.pieces);
  burst.forEach((p, i) => {
    const speed = SPLINTER.speed[0] + (SPLINTER.speed[1] - SPLINTER.speed[0]) * rand();
    p.position.copy(at);
    p.velocity.copy(toward).multiplyScalar(speed * 0.6).addScaledVector(side, (rand() < 0.5 ? -1 : 1) * (0.5 + rand()) * speed * 0.9)   // out past both sides of the player, who stands between her and the eye.addScaledVector(yAxis, SPLINTER.up * (0.4 + rand()));
    p.spin.set((rand() - 0.5) * 30, (rand() - 0.5) * 30, (rand() - 0.5) * 30);
    p.rotation.set(rand() * 6, rand() * 6, rand() * 6);
    p.trim = i % 4 === 0;   // one in four is the dark iron-bound trim, the rest pale split wood
    p.size.set(p.trim ? 0.07 : 0.016 + 0.012 * rand(), p.trim ? 0.014 : 0.01, p.trim ? 0.022 : 0.08 + 0.08 * rand());   // phone-readable at fight distance
    p.age = 0; p.live = true;
  });
}

function update(dt: number, frame: SignatureFrame) {
  if (!mesh) return;
  if (frame.yielding) { for (const p of pieces) p.live = false; mesh.count = 0; return; }   // the chips on her shield stay
  let n = 0;
  for (const p of pieces) {
    if (!p.live) continue;
    p.age += dt;
    if (p.age > SPLINTER.seconds) { p.live = false; continue; }
    if (p.position.y > 0.004) {
      p.velocity.y -= SPLINTER.gravity * dt;
      p.position.addScaledVector(p.velocity, dt);
      p.rotation.x += p.spin.x * dt; p.rotation.y += p.spin.y * dt; p.rotation.z += p.spin.z * dt;
      if (p.position.y <= 0.004) { p.position.y = 0.004; p.velocity.set(0, 0, 0); p.rotation.x = Math.PI / 2; }   // it lands flat and stays
    }
    mesh.setMatrixAt(n, matrix.compose(p.position, quat.setFromEuler(p.rotation), p.size));
    mesh.setColorAt(n++, p.trim ? TRIM : WOOD);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function clearSplinters() {
  for (const p of pieces) p.live = false;
  if (mesh) mesh.count = 0;
  chips = 0;
}
// For the tests and the capture script's probe (imported through the dev server).
export const signatureState = () => ({ fired, chips, splinters: pieces.filter((p) => p.live).length });

registerSignature({ opponent: 'shieldmaiden', variant: 'A', name: 'Splintered Defiance', when: (event) => defendedBy(event, 'Blocked') && isHeavy(event), fire, update, clear: clearSplinters });
