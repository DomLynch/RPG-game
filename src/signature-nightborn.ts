import * as THREE from 'three';
import { weaponOf } from './moves.ts';
import { surfaceHit, woundSite } from './gore.ts';
import { hitBy, OPPONENT_SIDE, registerSignature, type SignatureFrame } from './signature.ts';
import type { CombatEvent } from './duel.ts';

// Nightborn, variant A: Blood Recall (docs/briefs/signature-effects.md row 4). A wound he opens throws a few droplets that stop and hang
// for a beat, then fly back up his blade and are gone into it. Feeding, visual only: nothing is healed, nothing is drawn from a bar.
// One instanced mesh of RECALL.drops beads, reused per hit; a new hit restarts it from the new wound.
export const RECALL = { drops: 14, burst: 0.12, hang: 0.38, fly: 0.3, spread: [0.22, 0.5], size: [0.018, 0.032] } as const;   // count, s, s, s, m, m
export const recallTime = RECALL.burst + RECALL.hang + RECALL.fly;

// Where a bead is at time t: thrown out from the wound to `offset` and braked to a stop (burst), a small lift while it hangs, then an
// ease-in to the tip.
export function recallPosition(out: THREE.Vector3, from: THREE.Vector3, offset: THREE.Vector3, tip: THREE.Vector3, t: number): THREE.Vector3 {
  const settle = RECALL.burst + RECALL.hang;
  out.copy(from).addScaledVector(offset, 1 - Math.exp(-Math.min(t, settle) / RECALL.burst * 3));
  if (t > RECALL.burst) out.y += 0.025 * Math.sin((t - RECALL.burst) / RECALL.hang * Math.PI);   // a small lift while it hangs
  if (t <= settle) return out;
  const k = Math.min(1, (t - settle) / RECALL.fly);
  return out.lerp(tip, k * k);
}

export function createBloodRecall() {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const material = new THREE.MeshStandardMaterial({ color: '#8a0a0e', emissive: '#5a0006', roughness: 0.15, metalness: 0.1 });   // lit from inside a little: dark red on the sand does not read at phone size
  let mesh: THREE.InstancedMesh | null = null;
  const from = new THREE.Vector3(), tip = new THREE.Vector3(), at = new THREE.Vector3(), scratch = new THREE.Object3D(), across = new THREE.Vector3(), up = new THREE.Vector3();
  const velocities = Array.from({ length: RECALL.drops }, () => new THREE.Vector3());
  const sizes = new Float32Array(RECALL.drops), delays = new Float32Array(RECALL.drops);
  let age = -1, seed = 1;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

  const bladeTip = (frame: SignatureFrame, out: THREE.Vector3) => {
    const drawn = frame.roots[OPPONENT_SIDE]?.getObjectByName('WeaponDrawn') ?? frame.roots[OPPONENT_SIDE]?.getObjectByName('SwordDrawn');
    if (!drawn) return false;
    drawn.updateWorldMatrix(true, false);
    out.copy(drawn.localToWorld(at.set(0, (drawn.userData.contact as { to: number } | undefined)?.to ?? 0.86, 0)));
    return true;
  };
  const hide = () => { if (mesh) mesh.visible = false; age = -1; };

  return {
    fire(event: CombatEvent, frame: SignatureFrame) {
      const victim = event.target ?? 0, root = frame.roots[victim];
      if (!root || !event.location || !event.move) return;
      const attacker = frame.fighters[OPPONENT_SIDE];
      const hit = { location: event.location, direction: weaponOf(attacker.weapon).moves[event.move].direction, heading: frame.fighters[victim].body.heading };
      const site = woundSite(hit), bone = root.getObjectByName(site.bone);
      if (!bone) return;
      root.updateWorldMatrix(true, true);
      const outward = new THREE.Vector3(...site.dir).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), hit.heading);
      const met = surfaceHit(root, bone, outward);
      if (met) from.copy(met.point); else bone.getWorldPosition(from).addScaledVector(outward, site.radius * frame.scale[victim]);
      if (!mesh) {
        mesh = new THREE.InstancedMesh(geometry, material, RECALL.drops);
        mesh.frustumCulled = false;
        let world: THREE.Object3D = root; while (world.parent) world = world.parent;   // world-space beads: they belong to the scene
        world.add(mesh);
      }
      const me = frame.fighters[victim].body, him = frame.fighters[OPPONENT_SIDE].body;
      across.set(him.z - me.z, 0, me.x - him.x).normalize();
      seed = event.tick * 2654435761 >>> 0;
      for (let i = 0; i < RECALL.drops; i++) {
        // Thrown up and out to either side of the line between the two men, so the beads hang clear of the victim's silhouette where the
        // fight camera (behind the player) sees them, not in the gap his own body hides.
        const v = velocities[i].copy(across).multiplyScalar((rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.7)).add(up.set(0, 0.7 + rand() * 0.6, 0)).addScaledVector(outward, 0.25).normalize();
        v.multiplyScalar(RECALL.spread[0] + rand() * (RECALL.spread[1] - RECALL.spread[0]));
        sizes[i] = RECALL.size[0] + rand() * (RECALL.size[1] - RECALL.size[0]);
        delays[i] = rand() * 0.08;   // they leave for the blade one after another, not as a block
      }
      age = 0; mesh.visible = true;
    },
    update(dt: number, frame: SignatureFrame) {
      if (!mesh || age < 0) return;
      if (frame.yielding) { hide(); return; }
      age += dt;
      if (age > recallTime + 0.1 || !bladeTip(frame, tip)) { hide(); return; }
      for (let i = 0; i < RECALL.drops; i++) {
        const t = Math.max(0, age - delays[i]);
        recallPosition(scratch.position, from, velocities[i], tip, t);
        const fly = Math.max(0, (t - RECALL.burst - RECALL.hang) / RECALL.fly);
        // Round while it hangs; stretched along its path as it is pulled in; gone as it reaches the steel.
        const s = sizes[i] * (fly >= 1 ? 0 : 1 - fly * fly * 0.6);
        at.copy(tip).sub(scratch.position);
        if (fly > 0 && at.lengthSq() > 1e-6) scratch.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, at.normalize()); else scratch.quaternion.identity();
        scratch.scale.set(s, s * (1 + fly * 2.5), s);
        scratch.updateMatrix();
        mesh.setMatrixAt(i, scratch.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    clear: hide,
  };
}

const recall = createBloodRecall();
registerSignature({
  opponent: 'nightborn', variant: 'A', name: 'Blood Recall',
  when: (event) => hitBy(event) && !!event.location,
  fire: recall.fire, update: recall.update, clear: recall.clear,
});
