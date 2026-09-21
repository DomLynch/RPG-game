// Combat gore (finishers & gore 2026-09-17): the pooled ground splats and kill pool, the wound-site decals, and the blood on the
// killer's blade. Presentation only — every effect is driven by the simulation's events and positions, hidden in blood 'off',
// and cleared on rematch. The finisher blood (cut sites, arterial sources) lives in finisher-blood.ts; the impact dots stay
// with the scene's contact effects.
import * as THREE from 'three';
import { bloodiesMaterial } from './finisher-blood.ts';
import type { HitLocation } from './blade.ts';
import type { Direction } from './moves.ts';

export type BloodMode = 'red' | 'dark' | 'off';
type Rigs = { player: { anchor: THREE.Object3D }; opponent: { anchor: THREE.Object3D } };

// Twelve pooled ground splats; a kill takes one as the corpse's spreading pool.
export function createSplatPool(scene: THREE.Scene, splatTexture: THREE.Texture | null) {
  const splats = Array.from({ length: 12 }, () => {
    const splat = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({
        color: '#591415',
        map: splatTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    splat.rotation.x = -Math.PI / 2;
    splat.visible = false;
    scene.add(splat);
    return { mesh: splat, life: 0, grow: 0 }; // grow: a kill pool spreads over ~2 s instead of appearing at once
  });
  let splatIndex = 0;
  return {
    // A flesh hit: a splash under the struck fighter, living 20 s.
    splash(target: { x: number; z: number }, bloodMode: BloodMode) {
      const splat = splats[splatIndex++ % splats.length];
      splat.life = 20;
      splat.grow = 0;
      splat.mesh.position.set(target.x, 0.022 + (splatIndex % 12) * 0.0001, target.z);
      splat.mesh.scale.set(0.22 + (splatIndex % 3) * 0.05, 0.13 + (splatIndex % 4) * 0.035, 1);
      splat.mesh.rotation.z = splatIndex * 2.4;
      splat.mesh.material.color.set(bloodMode === 'dark' ? '#352426' : '#681a19');
    },
    // A kill: the corpse keeps pooling after the splashes fade (cleared on rematch like everything else).
    pool(target: { x: number; z: number }, bloodMode: BloodMode) {
      const pool = splats[splatIndex++ % splats.length];
      pool.life = 1e9;
      pool.grow = 1e-6;
      pool.mesh.position.set(target.x, 0.03, target.z);
      pool.mesh.rotation.z = splatIndex * 2.4;
      pool.mesh.scale.set(0.3, 0.2, 1);
      pool.mesh.material.color.set(bloodMode === 'dark' ? '#352426' : '#681a19');
    },
    update(dt: number) {
      for (const splat of splats) {
        splat.life = Math.max(0, splat.life - dt);
        splat.mesh.visible = splat.life > 0;
        if (splat.life > 1e8) {
          splat.grow = Math.min(1, splat.grow + dt / 2.2);
          splat.mesh.scale.set(0.3 + 0.7 * splat.grow, (0.2 + 0.55 * splat.grow) * 0.8, 1);
          splat.mesh.material.opacity = 0.7 * splat.grow;
        } // the kill pool spreads
        else splat.mesh.material.opacity = Math.min(0.65, splat.life / 4);
      }
    },
    // Rematch clears the lives (the next update hides the meshes); a blood-mode change hides them at once.
    clear(hide: boolean) {
      for (const splat of splats) {
        splat.life = 0;
        splat.grow = 0;
        if (hide) splat.mesh.visible = false;
      }
    },
    // Test/inspection view of the pool.
    get entries() {
      return splats as readonly { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; life: number; grow: number }[];
    },
  };
}

// The pooled wound decal: a dark mark with three drips, one per fighter. Since 2026-09-21 only the Quiet One's throat cut draws it
// (owner: the standing combat wound mark — the mark at the hit site for the four-second wound window — is gone; it floated
// beside short rigs and hid inside tall ones). The pool, the fade-out and the rematch clear stay so the finisher keeps working.
export function createWoundDecals(scene: THREE.Scene, splatTexture: THREE.Texture | null) {
  const wounds = [0, 1].map((side) => {
    const group = new THREE.Group();
    group.name = `Wound_${side}`;
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.2),
      new THREE.MeshBasicMaterial({
        color: '#4a1213',
        map: splatTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const drips = [0, 1, 2].map((i) => {
      const drip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.014, 0.1),
        new THREE.MeshBasicMaterial({
          color: '#4a1213',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      drip.position.set((i - 1) * 0.045, -0.13, 0);
      group.add(drip);
      return drip;
    });
    group.add(mark);
    group.visible = false;
    scene.add(group);
    return { group, mark, drips, life: 0 };
  });
  return {
    // The throat cut's own life runs out here: it fades over its last second and goes dark, like every blood effect in 'off'.
    update(dt: number, bloodMode: BloodMode) {
      for (const wound of wounds) {
        if (wound.life > 0) {
          wound.life = Math.max(0, wound.life - dt);
          const fade = Math.min(1, wound.life);
          wound.mark.material.opacity = Math.min(wound.mark.material.opacity, 0.82 * fade);
          for (const drip of wound.drips) drip.material.opacity = Math.min(drip.material.opacity, 0.6 * fade);
          wound.group.visible = bloodMode !== 'off' && wound.life > 0;
        } else wound.group.visible = false;
      }
    },
    // The Quiet One: reuse the opponent's pooled wound at the animated neck — a narrow cut, covered partly by the clutching hand.
    throatCut(neck: THREE.Vector3, head: THREE.Vector3, heading: number, finishClock: number, bloodMode: BloodMode) {
      const up = head.clone().sub(neck).normalize(),
        forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      forward.addScaledVector(up, -forward.dot(up)).normalize();
      const size = head.distanceTo(neck) / 0.075,
        wound = wounds[1];
      wound.life = 4;
      wound.group.position.copy(neck).addScaledVector(forward, 0.075 * size);
      wound.group.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(up.clone().cross(forward), up, forward),
      );
      wound.mark.scale.set(0.85 * size, 0.14 * size, 1);
      wound.mark.material.opacity = 0.82;
      const tone = bloodMode === 'dark' ? '#241314' : '#581017';
      wound.mark.material.color.set(tone);
      wound.drips.forEach((drip, i) => {
        drip.position.set((i - 1) * 0.025 * size, -0.05 * size, 0);
        drip.scale.set(0.55, 0.5 * size, 1);
        drip.material.color.set(tone);
        drip.material.opacity = 0.6 * Math.min(1, finishClock / 0.25);
      });
      wound.group.visible = bloodMode !== 'off';
    },
    clear() {
      for (const wound of wounds) wound.life = 0;
    },
    get entries() {
      return wounds as readonly { group: THREE.Group; mark: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; drips: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[]; life: number }[];
    },
  };
}

// Body wounds (owner 2026-09-21): every landed blade blow leaves a mark on the struck body — head, torso or legs from the
// simulation's hit location, on the side the swing came from (a right cut lands on the victim's left flank, an overhead on
// top, a thrust on the front). Marks are pooled per fighter, ride their bone every frame, and show only once that fighter
// is at 60 % health or below; from there the marks darken and the drips lengthen down to the death. Presentation only:
// the simulation decides the hit, the damage and the location. Hidden in blood 'off', cleared on rematch.
export const WOUND_THRESHOLD = 0.6, WOUNDS_PER_FIGHTER = 5;
export type WoundHit = { location: HitLocation; direction: Direction; heading: number };   // heading = the struck fighter's facing
type WoundSite = { bone: string; dir: [number, number, number]; radius: number; width: number };
// The struck fighter's own frame: +x his left, +z his front (the rig convention). A blow from the attacker's right crosses to the victim's left.
export function woundSite(hit: Pick<WoundHit, 'location' | 'direction'>): WoundSite {
  const side = hit.direction === 'right' ? 1 : hit.direction === 'left' ? -1 : 0;
  if (hit.location === 'head') return { bone: 'Head', dir: side ? [side * .9, .25, .35] : hit.direction === 'overhead' ? [0, .75, .65] : [0, .1, 1], radius: .105, width: .55 };
  if (hit.location === 'legs') return { bone: side < 0 ? 'thigh_r' : 'thigh_l', dir: side ? [side * .85, 0, .5] : [0, 0, 1], radius: .085, width: .6 };
  if (hit.direction === 'overhead') return { bone: 'spine_03', dir: [.35, .55, .75], radius: .16, width: .8 };   // the shoulder line, sword side up
  return { bone: side ? 'spine_02' : 'spine_03', dir: side ? [side * .9, .05, .45] : [0, 0, 1], radius: side ? .17 : .15, width: side ? .7 : 1 };
}
export function createBodyWounds(scene: THREE.Scene, splatTexture: THREE.Texture | null) {
  type Mark = { group: THREE.Group; mark: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; drips: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[]; bone: THREE.Object3D | null; dir: THREE.Vector3; radius: number; width: number; scale: number; age: number; used: boolean };
  const material = () => new THREE.MeshBasicMaterial({ color: '#581017', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const fighters = [0, 1].map(() => Array.from({ length: WOUNDS_PER_FIGHTER }, (): Mark => {
    const group = new THREE.Group(), mark = new THREE.Mesh(new THREE.PlaneGeometry(.12, .12), Object.assign(material(), { map: splatTexture }));
    const drips = [0, 1, 2].map((i) => { const drip = new THREE.Mesh(new THREE.PlaneGeometry(.011, .1), material()); drip.position.x = (i - 1) * .028; group.add(drip); return drip; });
    group.add(mark); group.visible = false; scene.add(group);
    return { group, mark, drips, bone: null, dir: new THREE.Vector3(), radius: 0, width: 1, scale: 1, age: 0, used: false };
  }));
  let next = [0, 0];
  const tone = (mode: BloodMode) => (mode === 'dark' ? '#241314' : '#581017');
  return {
    // A blow landed on `side`: take the next pooled mark (the oldest when all are used) and pin it to the struck bone, on the struck face.
    hit(side: 0 | 1, root: THREE.Object3D, hit: WoundHit, scale = 1) {
      const site = woundSite(hit), bone = root.getObjectByName(site.bone);
      if (!bone) return false;
      const mark = fighters[side][next[side] % WOUNDS_PER_FIGHTER]; next[side]++;
      const world = new THREE.Vector3(...site.dir).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), hit.heading);
      root.updateWorldMatrix(true, true);
      mark.dir.copy(world).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
      mark.bone = bone;   // cached (audit, 2026-09-22): update() ran a recursive getObjectByName search every frame for every used mark
      mark.radius = site.radius * scale; mark.width = site.width; mark.scale = scale; mark.age = 0; mark.used = true;
      return true;
    },
    // Each frame, after the rigs animate: follow the bones; strength from the fighter's health fraction (nothing above the threshold).
    update(dt: number, roots: readonly [THREE.Object3D | null, THREE.Object3D | null], health: readonly [number, number], bloodMode: BloodMode, hidden: readonly [boolean, boolean] = [false, false]) {
      for (const side of [0, 1] as const) {
        const severity = Math.min(1, Math.max(0, (WOUND_THRESHOLD - health[side]) / WOUND_THRESHOLD)), root = roots[side];
        for (const mark of fighters[side]) {
          const bone = mark.used ? mark.bone : null;
          const show = !!bone && !!root && health[side] <= WOUND_THRESHOLD && bloodMode !== 'off' && !hidden[side];
          mark.group.visible = show;
          if (!show || !bone) continue;
          mark.age += dt;
          const normal = mark.dir.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion())).normalize();
          mark.group.position.copy(bone.getWorldPosition(new THREE.Vector3())).addScaledVector(normal, mark.radius);
          const right = new THREE.Vector3(0, 1, 0).cross(normal); if (right.lengthSq() < 1e-4) right.set(1, 0, 0); right.normalize();
          mark.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, normal.clone().cross(right).normalize(), normal));
          const fade = Math.min(1, mark.age / .4), color = tone(bloodMode);
          mark.mark.scale.set(mark.width * (.9 + .5 * severity) * mark.scale, (.9 + .5 * severity) * mark.scale, 1);
          mark.mark.material.opacity = fade * (.5 + .4 * severity); mark.mark.material.color.set(color);
          mark.drips.forEach((drip, i) => {
            const length = (.25 + 1.75 * severity) * (i === 1 ? 1 : .7) * mark.scale;
            drip.scale.set(mark.scale, length, 1); drip.position.set((i - 1) * .028 * mark.scale, -.05 * length - .04 * mark.scale, .001);
            drip.material.opacity = fade * (.3 + .45 * severity) * (severity > .05 ? 1 : 0); drip.material.color.set(color);
          });
        }
      }
    },
    clear() { for (const side of fighters) for (const mark of side) { mark.used = false; mark.bone = null; mark.group.visible = false; } next = [0, 0]; },
    get entries() { return fighters as readonly (readonly Mark[])[]; },
  };
}

// Blood on the blade: the killer's weapon tints after a kill and stays bloodied until the next fight. Materials are cloned
// before tinting so a shared GLB never bloodies both swords.
export function createBladeBlood() {
  const bladeOriginals = new Map<THREE.Mesh, THREE.MeshStandardMaterial>();
  let bloodiedBlade = false,
    bloodiedSide: 0 | 1 = 0;
  return {
    get bloodied() {
      return bloodiedBlade;
    },
    // `on` tints `side`'s blade (default: the side last bloodied); off restores both. Nothing to tint until the rigs are loaded.
    set(on: boolean, warriors: Rigs | null | undefined, bloodMode: BloodMode, side: 0 | 1 = bloodiedSide) {
      bloodiedSide = side;
      if (!warriors) return;
      const anchors = on
        ? [side === 0 ? warriors.player.anchor : warriors.opponent.anchor]
        : [warriors.player.anchor, warriors.opponent.anchor];
      for (const anchor of anchors) {
        const twoHanded = anchor.getObjectByName('WeaponDrawn'),
          node = twoHanded ?? anchor.getObjectByName('SwordDrawn');
        node?.traverse((object) => {
          if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial))
            return;
          if (!bloodiesMaterial(object.material.name, !!twoHanded)) return; // the blade, never the haft
          const original = bladeOriginals.get(object) ?? (object.material as THREE.MeshStandardMaterial);
          if (on) {
            if (!bladeOriginals.has(object)) {
              bladeOriginals.set(object, object.material as THREE.MeshStandardMaterial);
              object.material = object.material.clone();
            }
            // A sword's thin blade takes the blood colour as a smear; a broad hafted blade (the scythe's crescent) is a
            // metallic mirror, so the same lerp turned the whole crescent into bright red plastic (owner, 2026-09-21).
            // Blood on a broad blade is a dark wet film: darker tone, and it stops mirroring the sky.
            const bloodied = object.material as THREE.MeshStandardMaterial;
            bloodied.color
              .copy(original.color)
              .lerp(new THREE.Color(bloodMode === 'dark' || twoHanded ? '#2a1516' : '#7a1410'), 0.55);
            if (twoHanded) {
              bloodied.metalness = Math.min(original.metalness, 0.3);
              bloodied.roughness = Math.max(original.roughness, 0.7);
            }
          } else if (bladeOriginals.has(object)) {
            object.material.dispose();
            object.material = original;
            bladeOriginals.delete(object);
          }
        });
      }
      bloodiedBlade = on;
    },
  };
}
