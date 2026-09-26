import * as THREE from 'three';
import { isHeavy, OPPONENT_SIDE, registerSignature, type SignatureEffect, type SignatureFrame } from './signature.ts';
import { surfaceHit, woundSite, type WoundHit } from './gore.ts';
import { weaponOf } from './moves.ts';
import type { CombatEvent } from './duel.ts';

// The Knight's signature (brief row 7, variant A): the Rivet Burst. A substantial blow landed ON him (a heavy, or any cut past the light
// cut's 14) pops one or two rivets off the plate where the sim says it struck; the plate shudders, the rivets drop and rattle on the sand,
// and a dent stays there for the fight (the body pool's 6, oldest reused, cleared with the wounds). Cosmetic: no stat, no sim.
const SUBSTANTIAL = 16, RIVETS = 4, GRAVITY = 9.8, SETTLE = 2.2, SHUDDER = 0.28;

let dentTexture: THREE.CanvasTexture | null = null;
// A dent IN the plate, drawn once (Strategy 2026-09-26: "the plate itself deforming", no outline, no ring, no lines): a soft crescent of
// shadow where the metal is pushed in, and one short lit edge on the far lip where the rim catches the light. Everything fades to nothing
// at the edge, so the quad's outline never shows.
function dent(): THREE.CanvasTexture {
  if (dentTexture) return dentTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const shadow = g.createRadialGradient(56, 58, 6, 60, 62, 44);   // the hollow, darkest toward the upper left where the blow pushed in
  shadow.addColorStop(0, 'rgba(10,10,11,0.85)'); shadow.addColorStop(0.6, 'rgba(18,18,20,0.45)'); shadow.addColorStop(1, 'rgba(18,18,20,0)');
  g.fillStyle = shadow; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'destination-out';   // cut the lower right away so the shadow is a crescent, not a disc
  const cut = g.createRadialGradient(78, 80, 4, 78, 80, 34);
  cut.addColorStop(0, 'rgba(0,0,0,1)'); cut.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = cut; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'source-over';
  const lip = g.createLinearGradient(58, 96, 98, 60);   // the one lit edge, bright in its middle and gone at both ends
  lip.addColorStop(0, 'rgba(225,225,230,0)'); lip.addColorStop(0.5, 'rgba(225,225,230,0.7)'); lip.addColorStop(1, 'rgba(225,225,230,0)');
  g.strokeStyle = lip; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.arc(62, 64, 30, Math.PI * 0.05, Math.PI * 0.45); g.stroke();
  dentTexture = new THREE.CanvasTexture(canvas);
  dentTexture.colorSpace = THREE.SRGBColorSpace;
  return dentTexture;
}

let darkTexture: THREE.CanvasTexture | null = null;
// B's dent: a bruised dark-steel impression, darkest a little below centre, with the bright rim only on the top (lit) edge.
function darkDent(): THREE.CanvasTexture {
  if (darkTexture) return darkTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const bruise = g.createRadialGradient(64, 72, 6, 64, 64, 56);
  bruise.addColorStop(0, 'rgba(4,4,5,0.95)'); bruise.addColorStop(0.5, 'rgba(14,14,16,0.85)'); bruise.addColorStop(0.85, 'rgba(30,30,33,0.4)'); bruise.addColorStop(1, 'rgba(30,30,33,0)');
  g.fillStyle = bruise; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 10;
  g.beginPath(); g.arc(64, 62, 36, Math.PI * 0.2, Math.PI * 0.8); g.stroke();   // the shadowed lower wall of the hollow
  g.strokeStyle = 'rgba(200,200,206,0.9)'; g.lineWidth = 9;
  g.beginPath(); g.arc(64, 66, 38, Math.PI * 1.22, Math.PI * 1.78); g.stroke();   // canvas top = up on the plate: the edge the light falls on
  darkTexture = new THREE.CanvasTexture(canvas);
  darkTexture.colorSpace = THREE.SRGBColorSpace;
  return darkTexture;
}

type Rivet = { mesh: THREE.Mesh; velocity: THREE.Vector3; spin: THREE.Vector3; age: number };
const rivets: Rivet[] = [];
let group: THREE.Group | null = null, pops = 0, rivetMaterial: THREE.MeshStandardMaterial | null = null;
let shaken: THREE.Object3D | null = null, shake = SHUDDER;
const axis = new THREE.Vector3(), turn = new THREE.Quaternion(), out = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

function ensureRivets(root: THREE.Object3D) {
  let top: THREE.Object3D = root;
  while (top.parent) top = top.parent;
  if (group) { if (group.parent !== top) top.add(group); return; }   // a rebuilt scene takes the rivets with it
  group = new THREE.Group();
  top.add(group);
  const geometry = new THREE.CylinderGeometry(0.045, 0.055, 0.03, 10);   // a rivet head drawn at about 10 cm so a phone at 375 px can follow it off the plate
  const material = (rivetMaterial = new THREE.MeshStandardMaterial());
  for (let i = 0; i < RIVETS; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    group.add(mesh);
    rivets.push({ mesh, velocity: new THREE.Vector3(), spin: new THREE.Vector3(), age: SETTLE });
  }
}

const struck = (event: CombatEvent) => event.type === 'Hit' && event.target === OPPONENT_SIDE && event.move !== 'kick' && (isHeavy(event) || (event.damage ?? 0) >= SUBSTANTIAL);

// One burst, two looks: A (a crescent dent in the plate, small dark bolts) and B (Strategy's AGAIN: a dark bruised dent lit only on its top edge, dark iron
// rivets). The rivet pool is shared; only one variant is ever chosen, and each dresses the shared material when it fires.
type Look = { name: string; map: () => THREE.CanvasTexture; dent: { size: number; depthTest?: boolean }; rivet: { color: string; emissive: string; metalness: number; roughness: number; size: number } };
const rivetBurst = (variant: 'A' | 'B', look: Look): SignatureEffect => ({
  opponent: 'knight', variant, name: look.name,
  when: struck,
  fire(event, frame: SignatureFrame) {
    const root = frame.roots[OPPONENT_SIDE], knight = frame.fighters[OPPONENT_SIDE], attacker = frame.fighters[event.actor];
    if (!root || !event.move) return;
    const hit: WoundHit = { location: event.location ?? 'torso', direction: weaponOf(attacker.weapon).moves[event.move]?.direction ?? 'center', heading: knight.body.heading };
    const scale = frame.scale[OPPONENT_SIDE];
    // The dent: the sim's hit site on his body (the blood wounds' site table and surface ray), in the body pool.
    if (!frame.marks.body(OPPONENT_SIDE, root, hit, { width: look.dent.size * scale, height: look.dent.size * scale, map: look.map(), metalness: 0.6, roughness: 0.5, fadeIn: 0.03, tilt: pops * 1.3, depthTest: look.dent.depthTest }, scale)) return;
    // The same site again for where the rivets leave from, and the bone that shudders.
    const site = woundSite(hit), bone = root.getObjectByName(site.bone)!;
    out.set(...site.dir).normalize().applyAxisAngle(up, hit.heading);
    const met = surfaceHit(root, bone, out), from = met ? met.point : bone.getWorldPosition(new THREE.Vector3()).addScaledVector(out, site.radius * scale), normal = met ? met.normal : out;
    shaken = bone; shake = 0;
    ensureRivets(root);
    Object.assign(rivetMaterial!, { metalness: look.rivet.metalness, roughness: look.rivet.roughness }); rivetMaterial!.color.set(look.rivet.color); rivetMaterial!.emissive.set(look.rivet.emissive);
    const count = isHeavy(event) || (event.damage ?? 0) >= 24 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const r = rivets[pops++ % RIVETS], j = pops * 0.618;
      r.mesh.position.copy(from).addScaledVector(normal, 0.01);
      r.velocity.copy(normal).multiplyScalar(1.4 + (j % 0.8)).add(axis.set(Math.sin(j * 7), 0.9 + (j % 0.6), Math.cos(j * 5)));
      r.spin.set(14 * Math.sin(j * 3), 10 * Math.cos(j * 2), 12 * Math.sin(j * 5));
      r.mesh.scale.setScalar(look.rivet.size); r.age = 0; r.mesh.visible = true;
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
// The Knight ships A (the dent in the plate, dark bolts); B stays registered for the admin preview. On resolves to A (pickSignature takes A first).
// A (Strategy 2026-09-26, second still): the dent sits IN the plate (depth-tested, so the player in front hides it; half B's size) and the rivet
// is a small dark bolt, not a pale disc.
export const rivetBurstA = rivetBurst('A', { name: 'Rivet Burst', map: dent, dent: { size: 0.2, depthTest: true }, rivet: { color: '#2e2c29', emissive: '#000000', metalness: 0.85, roughness: 0.45, size: 0.5 } });
registerSignature(rivetBurstA);   // Rivet A ships (Strategy 2026-09-25: the dark dent (a) failed on the full frame, failure two)
registerSignature(rivetBurst('B', { name: 'Rivet Burst (dark dent)', map: darkDent, dent: { size: 0.42 }, rivet: { color: '#3a3936', emissive: '#000000', metalness: 0.85, roughness: 0.5, size: 1 } }));
