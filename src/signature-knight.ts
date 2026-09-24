import * as THREE from 'three';
import { isHeavy, OPPONENT_SIDE, registerSignature, type SignatureFrame } from './signature.ts';
import { surfaceHit, woundSite, type WoundHit } from './gore.ts';
import { weaponOf } from './moves.ts';
import type { CombatEvent } from './duel.ts';

// The Knight's signature (brief row 7, variant A): the Rivet Burst. A substantial blow landed ON him (a heavy, or any cut past the light
// cut's 14) pops one or two rivets off the plate where the sim says it struck; the plate shudders, the rivets drop and rattle on the sand,
// and a dent stays there for the fight (the body pool's 6, oldest reused, cleared with the wounds). Cosmetic: no stat, no sim.
const SUBSTANTIAL = 16, RIVETS = 4, GRAVITY = 9.8, SETTLE = 2.2, SHUDDER = 0.28;

let dentTexture: THREE.CanvasTexture | null = null;
// A dent in dark iron, drawn once: a shadowed hollow, a bright crescent where the rim catches the light, a few scored lines from the blow.
function dent(): THREE.CanvasTexture {
  if (dentTexture) return dentTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const hollow = g.createRadialGradient(60, 68, 4, 64, 64, 50);
  hollow.addColorStop(0, 'rgba(8,8,9,0.95)'); hollow.addColorStop(0.55, 'rgba(22,22,24,0.8)'); hollow.addColorStop(1, 'rgba(22,22,24,0)');
  g.fillStyle = hollow; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(232,232,238,0.95)'; g.lineWidth = 5;
  g.beginPath(); g.arc(64, 64, 34, Math.PI * 0.9, Math.PI * 1.95); g.stroke();   // the lit rim
  g.strokeStyle = 'rgba(215,215,222,0.85)'; g.lineWidth = 2;
  for (const [x0, y0, x1, y1] of [[40, 50, 90, 82], [48, 40, 84, 70], [56, 76, 96, 90]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  dentTexture = new THREE.CanvasTexture(canvas);
  dentTexture.colorSpace = THREE.SRGBColorSpace;
  return dentTexture;
}

type Rivet = { mesh: THREE.Mesh; velocity: THREE.Vector3; spin: THREE.Vector3; age: number };
const rivets: Rivet[] = [];
let group: THREE.Group | null = null, pops = 0;
let shaken: THREE.Object3D | null = null, shake = SHUDDER;
const axis = new THREE.Vector3(), turn = new THREE.Quaternion(), out = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

function ensureRivets(root: THREE.Object3D) {
  let top: THREE.Object3D = root;
  while (top.parent) top = top.parent;
  if (group) { if (group.parent !== top) top.add(group); return; }   // a rebuilt scene takes the rivets with it
  group = new THREE.Group();
  top.add(group);
  const geometry = new THREE.CylinderGeometry(0.045, 0.055, 0.03, 10);   // a rivet head drawn at about 10 cm so a phone at 375 px can follow it off the plate
  const material = new THREE.MeshStandardMaterial({ color: '#e2ddd2', metalness: 0.55, roughness: 0.3, emissive: '#6a6458' });
  for (let i = 0; i < RIVETS; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    group.add(mesh);
    rivets.push({ mesh, velocity: new THREE.Vector3(), spin: new THREE.Vector3(), age: SETTLE });
  }
}

const struck = (event: CombatEvent) => event.type === 'Hit' && event.target === OPPONENT_SIDE && event.move !== 'kick' && (isHeavy(event) || (event.damage ?? 0) >= SUBSTANTIAL);

registerSignature({
  opponent: 'knight', variant: 'A', name: 'Rivet Burst',
  when: struck,
  fire(event, frame: SignatureFrame) {
    const root = frame.roots[OPPONENT_SIDE], knight = frame.fighters[OPPONENT_SIDE], attacker = frame.fighters[event.actor];
    if (!root || !event.move) return;
    const hit: WoundHit = { location: event.location ?? 'torso', direction: weaponOf(attacker.weapon).moves[event.move]?.direction ?? 'center', heading: knight.body.heading };
    const scale = frame.scale[OPPONENT_SIDE];
    // The dent: the sim's hit site on his body (the blood wounds' site table and surface ray), in the body pool.
    if (!frame.marks.body(OPPONENT_SIDE, root, hit, { width: 0.42 * scale, height: 0.42 * scale, map: dent(), metalness: 0.6, roughness: 0.5, fadeIn: 0.03, tilt: pops * 1.3 }, scale)) return;
    // The same site again for where the rivets leave from, and the bone that shudders.
    const site = woundSite(hit), bone = root.getObjectByName(site.bone)!;
    out.set(...site.dir).normalize().applyAxisAngle(up, hit.heading);
    const met = surfaceHit(root, bone, out), from = met ? met.point : bone.getWorldPosition(new THREE.Vector3()).addScaledVector(out, site.radius * scale), normal = met ? met.normal : out;
    shaken = bone; shake = 0;
    ensureRivets(root);
    const count = isHeavy(event) || (event.damage ?? 0) >= 24 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const r = rivets[pops++ % RIVETS], j = pops * 0.618;
      r.mesh.position.copy(from).addScaledVector(normal, 0.01);
      r.velocity.copy(normal).multiplyScalar(1.4 + (j % 0.8)).add(axis.set(Math.sin(j * 7), 0.9 + (j % 0.6), Math.cos(j * 5)));
      r.spin.set(14 * Math.sin(j * 3), 10 * Math.cos(j * 2), 12 * Math.sin(j * 5));
      r.age = 0; r.mesh.visible = true;
    }
  },
  update(dt) {
    // The plate shudders: a fast, dying twist of the struck bone laid over the pose the rig just evaluated (the next pose overwrites it).
    if (shaken && shake < SHUDDER) {
      shake += dt;
      const amount = 0.045 * Math.exp(-shake * 14) * Math.sin(shake * 95);
      shaken.quaternion.multiply(turn.setFromAxisAngle(axis.set(0.3, 1, 0.2).normalize(), amount));
      shaken.updateMatrixWorld(true);
    }
    for (const r of rivets) {
      if (r.age >= SETTLE) continue;
      r.age += dt;
      r.velocity.y -= GRAVITY * dt;
      r.mesh.position.addScaledVector(r.velocity, dt);
      if (r.mesh.position.y < 0.008) { r.mesh.position.y = 0.008; r.velocity.multiplyScalar(0.4); r.velocity.y = Math.abs(r.velocity.y) * 0.45; r.spin.multiplyScalar(0.4); }   // it rattles, then lies there
      r.mesh.rotation.x += r.spin.x * dt; r.mesh.rotation.y += r.spin.y * dt; r.mesh.rotation.z += r.spin.z * dt;
      if (r.age >= SETTLE) r.mesh.visible = false;
    }
  },
  clear() {
    shaken = null; shake = SHUDDER; pops = 0;
    for (const r of rivets) { r.age = SETTLE; r.mesh.visible = false; }
  },
});
