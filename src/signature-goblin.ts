import * as THREE from 'three';
import { weaponOf } from './moves.ts';
import { surfaceHit, woundSite } from './gore.ts';
import { hitBy, OPPONENT_SIDE, registerSignature, type SignatureFrame } from './signature.ts';
import type { CombatEvent } from './duel.ts';

// Goblin, variant A: Hooked Wound (docs/briefs/signature-effects.md row 3). His knife catches on the wound as it withdraws: a strand of
// blood runs from the wound to his knuckles and blade, stretches thinner as the knife pulls away, snaps, and the two ends whip back while
// a few drops fall. The stretch is the real withdrawal: both ends follow the rigs (the wound on the victim's bone, the other end on the
// knife), so the strand only lengthens as far as his animation takes the blade. Visual only.
export const HOOK = { points: 14, snapAt: 0.42, snapLength: 0.8, recoil: 0.16, width: [0.034, 0.012], sag: 0.1, drops: 5, gravity: 9.8 } as const;   // count, s, m, s, m (thick → stretched thin), m, count, m/s²

// The strand between the wound `a` and the knife `b` at stretch `share` of the way to snapping: a catenary-ish sag that tightens as it
// stretches. After the snap, `recoil` (0 → 1) pulls the two halves back into their own ends. Writes `points` into `out`.
export function strandPoints(out: THREE.Vector3[], a: THREE.Vector3, b: THREE.Vector3, share: number, recoil: number): THREE.Vector3[] {
  const n = out.length, sag = HOOK.sag * (1 - 0.7 * Math.min(1, share));
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    // After the snap each half shortens toward its own end: the wound half toward a, the knife half toward b.
    const w = recoil <= 0 ? u : u < 0.5 ? u * (1 - recoil) : 1 - (1 - u) * (1 - recoil);
    out[i].lerpVectors(a, b, w);
    out[i].y -= sag * 4 * w * (1 - w) * (1 - recoil);
  }
  return out;
}

export function createHookedWound() {
  const material = new THREE.MeshStandardMaterial({ color: '#7a0a0c', emissive: '#3a0004', roughness: 0.2, metalness: 0.05, side: THREE.DoubleSide });
  // The strand draws over the rigs (no depth test), gore.ts's rule for wounds: he is short and the fight camera sits behind the player,
  // so a strand at his chest height is behind the player's back more often than not. The falling drops depth-test as normal.
  const strandMaterial = material.clone(); strandMaterial.depthTest = false; strandMaterial.depthWrite = false;
  const n = HOOK.points, ribbons = 2;   // two ribbons crossed at right angles read as a round strand from any camera, with no camera needed
  const positions = new Float32Array(ribbons * n * 2 * 3);
  const index: number[] = [];
  for (let r = 0; r < ribbons; r++) for (let i = 0; i < n - 1; i++) {
    const k = (r * n + i) * 2;
    index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(index);
  const drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material, HOOK.drops);
  let strand: THREE.Mesh | null = null;
  const points = Array.from({ length: n }, () => new THREE.Vector3());
  const woundLocal = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), snapPoint = new THREE.Vector3();
  const tangent = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), scratch = new THREE.Object3D();
  const dropVelocity = Array.from({ length: HOOK.drops }, () => new THREE.Vector3()), dropAt = Array.from({ length: HOOK.drops }, () => new THREE.Vector3());
  let bone: THREE.Object3D | null = null, age = -1, snapped = -1, seed = 1;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

  // The knife end: halfway up the blade, so the strand runs over his knuckles and along the steel.
  const knifeEnd = (frame: SignatureFrame, out: THREE.Vector3) => {
    const drawn = frame.roots[OPPONENT_SIDE]?.getObjectByName('WeaponDrawn') ?? frame.roots[OPPONENT_SIDE]?.getObjectByName('SwordDrawn');
    if (!drawn) return false;
    drawn.updateWorldMatrix(true, false);
    const contact = drawn.userData.contact as { from: number; to: number } | undefined;
    out.copy(drawn.localToWorld(out.set(0, contact ? contact.from + (contact.to - contact.from) * 0.5 : 0.25, 0)));
    return true;
  };
  const hide = () => { if (strand) strand.visible = false; drops.visible = false; age = -1; snapped = -1; bone = null; };
  const writeRibbons = (width: number) => {
    for (let i = 0; i < n; i++) {
      const p = points[i];
      tangent.subVectors(points[Math.min(n - 1, i + 1)], points[Math.max(0, i - 1)]).normalize();
      // Thickest at the ends where it clings, thinnest in the middle where it is drawn out.
      const u = i / (n - 1), w = width * (0.55 + 0.45 * Math.abs(2 * u - 1));
      for (let r = 0; r < ribbons; r++) {
        side.crossVectors(tangent, up); if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
        side.normalize(); if (r === 1) side.cross(tangent).normalize();
        const k = ((r * n + i) * 2) * 3;
        positions[k] = p.x + side.x * w; positions[k + 1] = p.y + side.y * w; positions[k + 2] = p.z + side.z * w;
        positions[k + 3] = p.x - side.x * w; positions[k + 4] = p.y - side.y * w; positions[k + 5] = p.z - side.z * w;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeBoundingSphere();
  };

  return {
    fire(event: CombatEvent, frame: SignatureFrame) {
      const victim = event.target ?? 0, root = frame.roots[victim];
      if (!root || !event.location || !event.move) return;
      const hit = { location: event.location, direction: weaponOf(frame.fighters[OPPONENT_SIDE].weapon).moves[event.move].direction, heading: frame.fighters[victim].body.heading };
      const site = woundSite(hit), found = root.getObjectByName(site.bone);
      if (!found) return;
      root.updateWorldMatrix(true, true);
      const outward = new THREE.Vector3(...site.dir).normalize().applyAxisAngle(up, hit.heading);
      const met = surfaceHit(root, found, outward);
      const point = met ? met.point : found.getWorldPosition(new THREE.Vector3()).addScaledVector(outward, site.radius * frame.scale[victim]);
      woundLocal.copy(found.worldToLocal(point.clone()));   // the wound end rides his bone as he staggers
      bone = found;
      if (!strand) {
        let world: THREE.Object3D = root; while (world.parent) world = world.parent;
        strand = new THREE.Mesh(geometry, strandMaterial); strand.frustumCulled = false; strand.renderOrder = 3;
        drops.frustumCulled = false;
        world.add(strand, drops);
      }
      seed = event.tick * 2654435761 >>> 0;
      age = 0; snapped = -1; strand.visible = true; drops.visible = false;
    },
    update(dt: number, frame: SignatureFrame) {
      if (!strand || age < 0 || !bone) return;
      if (frame.yielding) { hide(); return; }
      age += dt;
      a.copy(woundLocal); bone.localToWorld(a);
      if (snapped < 0) {
        if (!knifeEnd(frame, b)) { hide(); return; }
        if (age >= HOOK.snapAt || a.distanceTo(b) >= HOOK.snapLength) {
          // The snap: where the strand was thinnest, the drops fall from there.
          snapped = age; snapPoint.lerpVectors(a, b, 0.5); snapPoint.y -= HOOK.sag * 0.3;
          for (let i = 0; i < HOOK.drops; i++) { dropAt[i].copy(snapPoint); dropVelocity[i].set((rand() - 0.5) * 0.6, rand() * 0.4, (rand() - 0.5) * 0.6); }
          drops.visible = true;
        }
      } else knifeEnd(frame, b);
      const recoil = snapped < 0 ? 0 : Math.min(1, (age - snapped) / HOOK.recoil);
      if (recoil >= 1) strand.visible = false;
      else {
        const share = Math.min(1, age / HOOK.snapAt);
        strandPoints(points, a, b, share, recoil);
        writeRibbons((HOOK.width[0] + (HOOK.width[1] - HOOK.width[0]) * share) * (1 - recoil * 0.5));
      }
      if (snapped >= 0) {
        let falling = 0;
        for (let i = 0; i < HOOK.drops; i++) {
          dropVelocity[i].y -= HOOK.gravity * dt;
          dropAt[i].addScaledVector(dropVelocity[i], dt);
          const s = dropAt[i].y > 0.02 ? 0.011 + (i % 3) * 0.003 : 0;
          if (s) falling++;
          scratch.position.copy(dropAt[i]); scratch.scale.set(s, s * 1.6, s); scratch.updateMatrix();
          drops.setMatrixAt(i, scratch.matrix);
        }
        drops.instanceMatrix.needsUpdate = true;
        if (!falling && recoil >= 1) hide();
      }
    },
    clear: hide,
  };
}

const hooked = createHookedWound();
registerSignature({
  opponent: 'goblin', variant: 'A', name: 'Hooked Wound',
  when: (event) => hitBy(event) && !!event.location,
  fire: hooked.fire, update: hooked.update, clear: hooked.clear,
});
