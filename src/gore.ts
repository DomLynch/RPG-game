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
// limb (owner 2026-09-22, "it can also run down the leg and arms", "a lot of skin here ... shoulder and arm, wrists"): 0 = the torso as
// always; 1 = the near upper arm; 2 = the near forearm at the wrist — bare skin on most rigs. mirror: the overhead cut's shoulder is
// picked per hit, either side — the Veteran's cloak covers one, the other is bare.
export function woundSite(hit: Pick<WoundHit, 'location' | 'direction'>, limb: 0 | 1 | 2 = 0, mirror = false): WoundSite {
  const side = hit.direction === 'right' ? 1 : hit.direction === 'left' ? -1 : 0;
  if (limb && side && hit.location === 'torso') {
    const l = side > 0 ? 'l' : 'r';
    return limb === 1 ? { bone: `upperarm_${l}`, dir: [side * .95, .1, .3], radius: .06, width: .5 } : { bone: `lowerarm_${l}`, dir: [side * .9, .2, .35], radius: .045, width: .45 };
  }
  if (hit.location === 'head') return { bone: 'Head', dir: side ? [side * .9, .25, .35] : hit.direction === 'overhead' ? [0, .75, .65] : [0, .1, 1], radius: .105, width: .55 };
  if (hit.location === 'legs') return { bone: side < 0 ? 'thigh_r' : 'thigh_l', dir: side ? [side * .85, 0, .5] : [0, 0, 1], radius: .085, width: .6 };
  if (hit.direction === 'overhead') return { bone: 'spine_03', dir: [mirror ? -.35 : .35, .55, .75], radius: .22, width: .8 };   // the shoulder line, sword side up; .22 clears a cloak or pauldron (Lead 2026-09-22: radius, not the depth test)
  return { bone: side ? 'spine_02' : 'spine_03', dir: side ? [side * .9, .05, .45] : [0, 0, 1], radius: side ? .17 : .15, width: side ? .7 : 1 };
}
// The blood's own look (owner 2026-09-22: "proper blood dripping", not a paint sticker): photo-grade textures generated with
// FLUX.1-Krea through the creature pipeline's own gradio_client route, alpha-keyed from a white plate — a lopsided glossy
// splat with a dark core and thin translucent edge, and a drip with a rounded bead at its leading edge and a tapering tail —
// plus small normal maps from their own luminance so the arena sun catches the bead. Loaded lazily in the browser only; the
// node tests build the pool without textures (the canvas splat stands in until the PNG lands, and forever under node).
const BLOOD_ASSET = (file: string) => new URL(`./assets/blood/${file}`, import.meta.url).href;
export const BLOOD_TEXTURES = { splat: 'blood-splat.png', splatNormal: 'blood-splat-normal.png', drip: 'blood-drip.png', dripNormal: 'blood-drip-normal.png' } as const;
// A run: after a landed hit each strand waits DRIP.start, then grows from a bead to a streak over DRIP.duration (both seeded
// per strand), stops, and dries — roughness DRY.roughness[0] → [1] and the fresh tone → the dried tone over DRY.seconds.
// New hits add fresh runs. Nothing here cycles: a run that has finished stays as it lies until the rematch clears it.
export const DRIP = { start: [0, 0.3], duration: [1.5, 3], width: [0.75, 1.3], offset: 0.03, bead: 0.028, length: [0.11, 0.19] } as const;   // seconds, seconds, ×, metres, metres, metres at threshold → at death (a man's torso)
export const DRY = { seconds: 20, roughness: [0.42, 0.75] } as const;   // a thin wet edge, not a gloss coat
export const ARM_SHARE = 0.5;   // share of side cuts across the torso that land on the near arm instead (half upper arm, half wrist)
const FRESH = new THREE.Color('#7a2a2c'), DRIED = new THREE.Color('#3a2426');   // multiplied over the photo texture's own reds: crimson, not the photo's neon (owner 2026-09-22: 'paintball sticker')
const CANVAS_FRESH = new THREE.Color('#581017'), CANVAS_DRIED = new THREE.Color('#2a1516');   // the tint the white canvas splat needs until the photo lands (and under node)
const DARK_MODE = new THREE.Color('#5a4d4c');
// Seeded per hit from what the simulation already decided — the fight's hit ordinal on this side, the blow's heading, its
// location and direction — so a replay of the same fight draws the same runs. A small LCG, never Math.random.
export function woundSeed(index: number, hit: Pick<WoundHit, 'location' | 'direction' | 'heading'>): number {
  const loc = { head: 1, torso: 2, legs: 3 }[hit.location], dir = { right: 1, left: 2, overhead: 3, thrust: 4, low: 5 }[hit.direction];
  return (Math.imul(index + 1, 2654435761) ^ Math.imul(Math.round(hit.heading * 1000) | 0, 40503) ^ (loc * 7919 + dir * 104729)) >>> 0;
}
export function lcg(state: number): number { return (Math.imul(state, 1664525) + 1013904223) >>> 0; }
// Where the skin (or the armour over it) actually is along the wound normal: a ray from well outside back toward the bone, against
// the rig's own skinned meshes in their current pose (owner 2026-09-22: "it floats off the chars" — the site table's radius is a
// guess per slot, and on a bare shoulder the guess for a pauldron hangs in the air). The table value stands when nothing is met
// (node tests, a rig with no skin) and the answer is clamped to its neighbourhood so a stray polygon cannot fling the mark.
const SURFACE = { reach: 0.6, proud: 0.004, clamp: [0.35, 1.5] } as const;
const surfaceRay = new THREE.Raycaster(), surfaceFrom = new THREE.Vector3(), surfaceDir = new THREE.Vector3(), surfaceBone = new THREE.Vector3();
export function surfaceRadius(root: THREE.Object3D, bone: THREE.Object3D, normal: THREE.Vector3, fallback: number): number {
  const skins: THREE.Object3D[] = []; root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.visible) skins.push(o); });
  if (!skins.length) return fallback;
  bone.getWorldPosition(surfaceBone); surfaceFrom.copy(surfaceBone).addScaledVector(normal, SURFACE.reach); surfaceDir.copy(normal).negate();
  surfaceRay.set(surfaceFrom, surfaceDir); surfaceRay.far = SURFACE.reach;
  const hit = surfaceRay.intersectObjects(skins, false)[0];
  if (!hit) return fallback;
  const r = SURFACE.reach - hit.distance + SURFACE.proud;
  return Math.min(fallback * SURFACE.clamp[1], Math.max(fallback * SURFACE.clamp[0], r));
}
const unit = (state: number) => state / 4294967296;
export function createBodyWounds(scene: THREE.Scene, splatTexture: THREE.Texture | null) {
  type Strand = { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>; map: THREE.Texture | null; start: number; duration: number; width: number; offset: number; live: boolean };
  type Mark = { group: THREE.Group; mark: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>; strands: Strand[]; bone: THREE.Object3D | null; dir: THREE.Vector3; radius: number; width: number; scale: number; age: number; used: boolean; runs: number };
  // Lit, wet, and drawn OVER the rig (Strategy ruling 2026-09-22, Dom: "leaks through, over"): no depth test, so a cloak or a
  // pauldron never hides the wound; no depth write. What stops it bleeding through the body is the facing test in update():
  // a mark whose surface normal points away from the eye is hidden, not depth-buffered.
  const material = (map: THREE.Texture | null, normalMap: THREE.Texture | null) => new THREE.MeshStandardMaterial({
    color: FRESH, map, normalMap, normalScale: new THREE.Vector2(0.45, 0.45), roughness: DRY.roughness[0], metalness: 0,
    transparent: true, opacity: 0, depthWrite: false, depthTest: false,
  });
  const fighters = [0, 1].map(() => Array.from({ length: WOUNDS_PER_FIGHTER }, (): Mark => {
    const group = new THREE.Group(), mark = new THREE.Mesh(new THREE.PlaneGeometry(.12, .12), material(splatTexture, null));
    const strands = [0, 1, 2].map((): Strand => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material(null, null));   // unit quad: scale = (width, length)
      mesh.geometry.translate(0, -0.5, 0);   // hang from the top edge: y=0 is the wound, the quad grows downward
      group.add(mesh);
      return { mesh, map: null, start: 0, duration: 1, width: 1, offset: 0, live: false };
    });
    group.add(mark); group.visible = false; scene.add(group);
    return { group, mark, strands, bone: null, dir: new THREE.Vector3(), radius: 0, width: 1, scale: 1, age: 0, used: false, runs: 0 };
  }));
  let next = [0, 0], photo = false;   // photo: the FLUX textures have landed (they carry their own colour; the canvas splat needs the tint)
  // Textures land after the pool exists (browser only). Every strand gets its own clone of the drip map so its UV window can
  // show only the part of the run that has happened — the bead at the leading edge never stretches.
  if (typeof document !== 'undefined') {
    const loader = new THREE.TextureLoader();
    const srgb = (t: THREE.Texture) => { t.colorSpace = THREE.SRGBColorSpace; return t; };
    Promise.all([BLOOD_TEXTURES.splat, BLOOD_TEXTURES.splatNormal, BLOOD_TEXTURES.drip, BLOOD_TEXTURES.dripNormal].map((f) => loader.loadAsync(BLOOD_ASSET(f)))).then(([splat, splatNormal, drip, dripNormal]) => {
      srgb(splat); srgb(drip); photo = true;
      for (const side of fighters) for (const mark of side) {
        mark.mark.material.map = splat; mark.mark.material.normalMap = splatNormal; mark.mark.material.needsUpdate = true;
        for (const strand of mark.strands) {
          strand.map = drip.clone(); strand.map.needsUpdate = true;
          strand.mesh.material.map = strand.map; strand.mesh.material.normalMap = dripNormal; strand.mesh.material.needsUpdate = true;
        }
      }
    }).catch(() => {});   // no textures: the canvas splat and untextured strands still draw; nothing throws mid-fight
  }
  // Scratch objects (Lead review, 2026-09-22): reused across marks and frames — the loop is synchronous and single-threaded,
  // so nothing reads a scratch value across iterations. Per frame the update writes only transforms, opacity, roughness and
  // colour; it allocates nothing.
  const scratchQuat = new THREE.Quaternion(), scratchPos = new THREE.Vector3(), scratchNormal = new THREE.Vector3();
  const scratchRight = new THREE.Vector3(), scratchForward = new THREE.Vector3(), scratchMatrix = new THREE.Matrix4(), scratchColor = new THREE.Color(), scratchEye = new THREE.Vector3();
  const ease = (t: number) => 1 - (1 - t) * (1 - t);   // a run starts fast and slows as it thins out
  return {
    // A blow landed on `side`: take the next pooled mark (the oldest when all are used), pin it to the struck bone on the
    // struck face, and seed this hit's runs: how many strands (1–3), each one's width, x offset, start delay and duration.
    hit(side: 0 | 1, root: THREE.Object3D, hit: WoundHit, scale = 1) {
      let seed = woundSeed(next[side], hit);
      seed = lcg(seed); const draw = unit(seed);   // seeded like the runs: a replay lands the same cut on the same limb, the same shoulder
      const limb = draw < ARM_SHARE ? (draw < ARM_SHARE / 2 ? 1 : 2) : 0, mirror = draw >= .5;
      const site = woundSite(hit, limb, mirror), bone = root.getObjectByName(site.bone) ?? (limb ? root.getObjectByName(woundSite(hit, 0, mirror).bone) : null);
      if (!bone) return false;
      const mark = fighters[side][next[side] % WOUNDS_PER_FIGHTER]; next[side]++;
      const world = new THREE.Vector3(...site.dir).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), hit.heading);
      root.updateWorldMatrix(true, true);
      mark.dir.copy(world).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
      mark.bone = bone;   // cached (audit, 2026-09-22): update() ran a recursive getObjectByName search every frame for every used mark
      mark.radius = surfaceRadius(root, bone, world, site.radius * scale); mark.width = site.width; mark.scale = scale; mark.age = 0; mark.used = true;
      seed = lcg(seed); mark.mark.rotation.z = unit(seed) * Math.PI * 2;   // the splat's own lopsided shape, turned per hit
      seed = lcg(seed); mark.runs = 1 + Math.floor(unit(seed) * 3);
      mark.strands.forEach((strand, i) => {
        strand.live = i < mark.runs;
        seed = lcg(seed); strand.width = DRIP.width[0] + unit(seed) * (DRIP.width[1] - DRIP.width[0]);
        seed = lcg(seed); strand.offset = (unit(seed) * 2 - 1) * DRIP.offset;
        seed = lcg(seed); strand.start = DRIP.start[0] + unit(seed) * (DRIP.start[1] - DRIP.start[0]);
        seed = lcg(seed); strand.duration = DRIP.duration[0] + unit(seed) * (DRIP.duration[1] - DRIP.duration[0]);
      });
      return true;
    },
    // Each frame, after the rigs animate: follow the bones; strength from the fighter's health fraction (nothing above the
    // threshold); each live strand's run on its own clock; the whole wound drying out once its runs have stopped.
    update(dt: number, roots: readonly [THREE.Object3D | null, THREE.Object3D | null], health: readonly [number, number], bloodMode: BloodMode, hidden: readonly [boolean, boolean] = [false, false], eye: THREE.Vector3 | null = null) {
      for (const side of [0, 1] as const) {
        const severity = Math.min(1, Math.max(0, (WOUND_THRESHOLD - health[side]) / WOUND_THRESHOLD)), root = roots[side];
        for (const mark of fighters[side]) {
          const bone = mark.used ? mark.bone : null;
          const show = !!bone && !!root && health[side] <= WOUND_THRESHOLD && bloodMode !== 'off' && !hidden[side];
          mark.group.visible = show;
          if (!show || !bone) continue;
          mark.age += dt;
          // Follow the bone. The basis puts world-up projected onto the surface along the group's +Y, so a strand hanging
          // down −Y runs along world-down on the skin whatever the bone's rotation (a shoulder, a thigh, a bowed head).
          const normal = scratchNormal.copy(mark.dir).applyQuaternion(bone.getWorldQuaternion(scratchQuat)).normalize();
          mark.group.position.copy(bone.getWorldPosition(scratchPos)).addScaledVector(normal, mark.radius);
          const right = scratchRight.set(0, 1, 0).cross(normal); if (right.lengthSq() < 1e-4) right.set(1, 0, 0); right.normalize();
          const forward = scratchForward.copy(normal).cross(right).normalize();
          mark.group.quaternion.setFromRotationMatrix(scratchMatrix.makeBasis(right, forward, normal));
          // Facing: with no depth test, the body's far side would show through the near side — so a mark on the surface that
          // faces away from the eye is hidden outright (its clock keeps running; it is back the moment the fighter turns).
          if (eye && scratchEye.copy(eye).sub(mark.group.position).dot(normal) < 0) { mark.group.visible = false; continue; }
          // The dry-out: from the moment the last run has stopped, 20 s from wet and bright to matte and dark.
          const stopped = mark.strands.reduce((t, s) => (s.live ? Math.max(t, s.start + s.duration) : t), 0);
          const dry = Math.min(1, Math.max(0, (mark.age - stopped) / DRY.seconds));
          const roughness = DRY.roughness[0] + (DRY.roughness[1] - DRY.roughness[0]) * dry;
          scratchColor.copy(photo ? FRESH : CANVAS_FRESH).lerp(photo ? DRIED : CANVAS_DRIED, dry); if (bloodMode === 'dark') scratchColor.multiply(DARK_MODE);
          const fade = Math.min(1, mark.age / .25);
          mark.mark.scale.set(mark.width * (.9 + .5 * severity) * mark.scale, (.9 + .5 * severity) * mark.scale, 1);
          mark.mark.material.opacity = fade * (.75 + .25 * severity); mark.mark.material.color.copy(scratchColor); mark.mark.material.roughness = roughness;
          for (const strand of mark.strands) {
            const run = strand.live ? ease(Math.min(1, Math.max(0, (mark.age - strand.start) / strand.duration))) : 0;
            strand.mesh.visible = strand.live && mark.age >= strand.start;
            if (!strand.mesh.visible) continue;
            // Length: the bead alone at the start, then the run's share of its ceiling — DRIP.length at the threshold rising with
            // severity (#356's linear curve, re-floored so the slowest seeded run still passes 8 cm by 1.5 s on a man's torso).
            const maxLength = (DRIP.length[0] + (DRIP.length[1] - DRIP.length[0]) * severity) * mark.scale, length = DRIP.bead * mark.scale + run * Math.max(0, maxLength - DRIP.bead * mark.scale);
            const width = .032 * strand.width * mark.scale;
            strand.mesh.scale.set(width, length, 1);
            strand.mesh.position.set(strand.offset * mark.scale, -.02 * mark.scale, .0015);
            // The texture's bead sits at v=0: show the bottom `length / full` of the map so the bead leads and only the tail lengthens.
            if (strand.map) { const full = width * 4; strand.map.repeat.y = Math.min(1, length / full); strand.map.offset.y = 0; }
            strand.mesh.material.opacity = fade * (.85 + .15 * severity);
            strand.mesh.material.color.copy(scratchColor); strand.mesh.material.roughness = roughness;
          }
        }
      }
    },
    clear() { for (const side of fighters) for (const mark of side) { mark.used = false; mark.bone = null; mark.group.visible = false; mark.age = 0; mark.runs = 0; for (const s of mark.strands) { s.live = false; s.mesh.visible = false; } } next = [0, 0]; },
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
