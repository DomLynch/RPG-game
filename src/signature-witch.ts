import * as THREE from 'three';
import type { CombatEvent } from './duel.ts';
import { OPPONENT_SIDE, registerSignature, type SignatureFrame } from './signature.ts';

// The Witch's signature, A: The Grasp, short range, no projectile (docs/briefs/signature-effects.md row 10). Two parts on events the sim
// already emits, on her only; the shared charge tell (glow + drone) stays for everyone.
//  - While her heavy is CHARGED, her staff head crackles: a few hot sparks jump round the tip (Dom: "sparks from the staff").
//  - When that charged blow LANDS (a Hit or a GuardBroken carrying `charged`), a black clawed hand closes over the struck shoulder and
//    crumbles to ash. The hit is her real melee hit; the hand only shows where it landed.
export const GRASP = { size: 0.26, close: 0.18, hold: 0.22, crumble: 0.55 } as const;   // metres; seconds: closing, holding, crumbling
const SPARKS = 24, ASH = 22;

export const graspLands = (event: CombatEvent) =>
  (event.type === 'Hit' || event.type === 'GuardBroken') && event.actor === OPPONENT_SIDE && event.charged === true;

// Canvas art (browser only; under node the meshes draw untextured and nothing throws). The hand: a palm and five hooked fingers, black
// with a deep-red rim, its alpha broken by noise so raising alphaTest crumbles it into specks rather than fading it evenly.
function handArt(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const draw = (colour: string, grow: number) => {
    g.strokeStyle = g.fillStyle = colour;
    g.beginPath(); g.ellipse(64, 84, 22 + grow, 20 + grow, 0, 0, Math.PI * 2); g.fill();   // the palm, low in the frame
    // Four fingers reaching up and hooking in, and a thumb from the side: quadratic curves, tapering by stroke width.
    const fingers: [number, number, number, number, number, number][] = [[44, 72, 30, 34, 44, 14], [56, 68, 52, 26, 62, 6], [70, 68, 80, 26, 76, 8], [82, 72, 102, 36, 92, 16], [42, 92, 14, 84, 20, 62]];
    for (const [x0, y0, cx, cy, x1, y1] of fingers) {
      g.lineWidth = 11 + grow * 2; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
      g.lineWidth = 5 + grow; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 + (64 - x1) * 0.18, y1 + 10); g.stroke();   // the claw tip hooks inward
    }
  };
  draw('rgb(110,10,14)', 2.5);   // the rim, drawn fat underneath
  draw('rgb(10,6,8)', 0);
  // Break the alpha with noise: each pixel keeps a random threshold, so alphaTest rising 0 -> 1 eats the hand speck by speck.
  const image = g.getImageData(0, 0, size, size), data = image.data;
  let seed = 1234567;
  for (let i = 3; i < data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    if (data[i]) data[i] = Math.min(data[i], 40 + Math.floor((seed / 4294967296) * 215));
  }
  g.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The staff head in the Witch's hands: the drawn weapon's contact end (characters.ts puts `contact.to` on it, as the blade tip).
function staffTip(root: THREE.Object3D | null): { weapon: THREE.Object3D; tip: number } | null {
  const weapon = root?.getObjectByName('WeaponDrawn') ?? root?.getObjectByName('SwordDrawn');
  if (!weapon) return null;
  return { weapon, tip: (weapon.userData.contact as { to: number } | undefined)?.to ?? 0.86 };
}

// One small pool of points for the staff sparks and one for the ash, plus the hand itself; built on first use, nothing allocated after.
type Bit = { life: number; age: number; v: THREE.Vector3 };
function pointsPool(count: number, colour: string, size: number, blending: THREE.Blending) {
  const geometry = new THREE.BufferGeometry(), position = new Float32Array(count * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: colour, size, transparent: true, depthWrite: false, blending, toneMapped: false }));
  points.frustumCulled = false; points.visible = false;
  const bits: Bit[] = Array.from({ length: count }, () => ({ life: 0, age: 1, v: new THREE.Vector3() }));
  return { points, position, bits };
}

let seed = 99;
const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
let sparks: ReturnType<typeof pointsPool> | null = null, ash: ReturnType<typeof pointsPool> | null = null;
let hand: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null, handAge = Infinity;
const scratch = new THREE.Vector3(), scratchQuat = new THREE.Quaternion(), up = new THREE.Vector3(0, 0, 1);

function build(root: THREE.Object3D) {
  let scene = root; while (scene.parent) scene = scene.parent;   // the pools are in world space: they hang off the scene itself
  sparks = pointsPool(SPARKS, '#ffe2a0', 0.07, THREE.AdditiveBlending);   // 7 cm: 3.5 cm read as specks from the fight camera (first strip)
  ash = pointsPool(ASH, '#2a2424', 0.045, THREE.NormalBlending);
  hand = new THREE.Mesh(new THREE.PlaneGeometry(GRASP.size, GRASP.size), new THREE.MeshBasicMaterial({ map: handArt(), color: '#ffffff', transparent: true, depthWrite: false, depthTest: false, alphaTest: 0.01, side: THREE.DoubleSide }));
  hand.renderOrder = 4; hand.visible = false;
  scene.add(sparks.points, ash.points, hand);
}

// Where the hand closes: the top of the struck shoulder (the Dwarf's reasoning — the fight camera sits behind and above the player she
// strikes, and a chest mark faces away from it), picked from the tick. Placed in the world at the moment of the blow, then it follows
// the shoulder bone for its short life.
let handBone: THREE.Object3D | null = null;
const handLocal = new THREE.Vector3(), handNormal = new THREE.Vector3();
function grasp(event: CombatEvent, frame: SignatureFrame) {
  const victim = event.target, root = victim === undefined ? null : frame.roots[victim];
  if (!root) return;
  if (!hand) build(root);
  const side = event.tick % 2 ? 1 : -1, bone = root.getObjectByName(side > 0 ? 'upperarm_l' : 'upperarm_r') ?? root.getObjectByName('spine_03');
  if (!bone || !hand) return;
  root.updateWorldMatrix(true, true);
  const heading = frame.fighters[victim!].body.heading, scale = frame.scale[victim!];
  const out = new THREE.Vector3(side * 0.25, 0.9, -0.35).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
  const at = bone.getWorldPosition(new THREE.Vector3()).addScaledVector(out, 0.09 * scale);
  handBone = bone; handLocal.copy(bone.worldToLocal(at.clone())); handNormal.copy(out).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
  handAge = 0; hand.visible = true; hand.userData.scale = scale;
}

function update(dt: number, frame: SignatureFrame) {
  const witch = frame.fighters[OPPONENT_SIDE], root = frame.roots[OPPONENT_SIDE];
  if (!sparks && root) build(root);
  if (!sparks || !ash || !hand) return;
  // Staff sparks: while charged (and not yielding to a finisher), keep the pool busy round the tip; each spark lives 0.12–0.3 s.
  const tip = staffTip(root), charging = !frame.yielding && witch.charged && witch.phase === 'attack';
  let live = 0;
  if (tip) tip.weapon.updateWorldMatrix(true, false);
  sparks.bits.forEach((bit, i) => {
    bit.age += dt;
    if (bit.age >= bit.life && charging && tip) {
      tip.weapon.localToWorld(scratch.set((rand() - 0.5) * 0.06, tip.tip + (rand() - 0.3) * 0.08, (rand() - 0.5) * 0.06));
      sparks!.position.set([scratch.x, scratch.y, scratch.z], i * 3);
      bit.v.set(rand() - 0.5, rand() * 0.8, rand() - 0.5).multiplyScalar(1.6); bit.age = 0; bit.life = 0.12 + rand() * 0.18;
    }
    if (bit.age < bit.life) {
      live++;
      sparks!.position[i * 3] += bit.v.x * dt; sparks!.position[i * 3 + 1] += bit.v.y * dt; sparks!.position[i * 3 + 2] += bit.v.z * dt;
    } else sparks!.position.set([0, -10, 0], i * 3);   // spent: parked under the floor
  });
  sparks.points.visible = live > 0; sparks.points.geometry.attributes.position.needsUpdate = true;
  (sparks.points.material as THREE.PointsMaterial).opacity = 0.7 + rand() * 0.3;   // the crackle flickers
  // The Grasp: closes (scale 1.35 -> 0.9, squeezing across), holds, then crumbles (alphaTest rises through the noise) and sheds ash.
  const t = handAge += dt, end = GRASP.close + GRASP.hold + GRASP.crumble;
  if (hand.visible && handBone && t < end && !frame.yielding) {
    const scale = hand.userData.scale as number;
    hand.position.copy(handLocal).applyMatrix4(handBone.matrixWorld);
    const normal = scratch.copy(handNormal).applyQuaternion(handBone.getWorldQuaternion(scratchQuat)).normalize();
    hand.quaternion.setFromUnitVectors(up, normal);
    const closing = Math.min(1, t / GRASP.close), squeeze = 1.35 - 0.45 * closing * closing;
    hand.scale.set(squeeze * 0.85 * scale, squeeze * scale, 1);
    const crumbling = Math.max(0, (t - GRASP.close - GRASP.hold) / GRASP.crumble);
    hand.material.alphaTest = 0.01 + 0.98 * crumbling; hand.material.opacity = Math.min(1, t / 0.05); hand.material.needsUpdate = crumbling > 0;
    if (crumbling > 0) for (let i = 0; i < ASH; i++) {
      const bit = ash.bits[i];
      if (bit.age >= bit.life && rand() < dt * 30) {
        ash.position.set([hand.position.x + (rand() - 0.5) * GRASP.size * 0.6, hand.position.y + (rand() - 0.5) * 0.08, hand.position.z + (rand() - 0.5) * GRASP.size * 0.6], i * 3);
        bit.v.set((rand() - 0.5) * 0.3, 0.1 + rand() * 0.2, (rand() - 0.5) * 0.3); bit.age = 0; bit.life = 0.5 + rand() * 0.4;
      }
    }
  } else if (hand.visible) { hand.visible = false; handBone = null; }
  let ashLive = 0;
  ash.bits.forEach((bit, i) => {
    bit.age += dt;
    if (bit.age < bit.life) { ashLive++; bit.v.y -= 0.9 * dt; ash!.position[i * 3] += bit.v.x * dt; ash!.position[i * 3 + 1] += bit.v.y * dt; ash!.position[i * 3 + 2] += bit.v.z * dt; }
    else ash!.position.set([0, -10, 0], i * 3);
  });
  ash.points.visible = ashLive > 0; ash.points.geometry.attributes.position.needsUpdate = true;
}

registerSignature({
  opponent: 'witch', variant: 'A', name: 'The Grasp',
  when: graspLands,
  fire: grasp,
  update,
  clear() {
    handAge = Infinity; handBone = null;
    if (hand) hand.visible = false;
    for (const pool of [sparks, ash]) if (pool) { pool.bits.forEach((b) => { b.age = b.life = 0; }); pool.points.visible = false; }
  },
});
