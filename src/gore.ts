// Combat gore (finishers & gore 2026-09-17): the pooled ground splats and kill pool, the wound-site decals, and the blood on the
// killer's blade. Presentation only — every effect is driven by the simulation's events and positions, hidden in blood 'off',
// and cleared on rematch. The finisher blood (cut sites, arterial sources) lives in finisher-blood.ts; the impact dots stay
// with the scene's contact effects.
import * as THREE from 'three';
import { bloodiesMaterial } from './finisher-blood.ts';

export type BloodMode = 'red' | 'dark' | 'off';
export type WoundSite = 'head' | 'torso' | 'legs';
type Body = { x: number; z: number; heading: number };
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

// Wound-site mark + drips: a small dark mark at the wound site with three drips below it, living the four-second wound window
// (the sim's wound refreshes without stacking — so does the mark: a fresh hit on the same fighter re-arms his decal). One pooled
// decal per fighter; hidden in 'off' like every blood effect.
// How far in front of the bone the skin is, per site: the mark must clear the mesh or the body hides it.
const SKIN: Record<WoundSite, number> = { head: 0.11, torso: 0.16, legs: 0.09 };
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
    return { group, mark, drips, life: 0, side: 0 as 0 | 1, site: 'torso' as WoundSite };
  });
  return {
    // A flesh hit re-arms the struck fighter's mark at the wound site: refreshed, never stacked.
    arm(side: 0 | 1, site: WoundSite) {
      const wound = wounds[side];
      wound.life = 4;
      wound.side = side;
      wound.site = site;
    },
    // The wound-site mark rides the wounded fighter for his four-second window — on his rig's bone for the site (chest, head,
    // thigh), pushed out to the skin in the direction he faces, so it sits on the body at every roster height (owner 2026-09-21:
    // the fixed 1.15 m torso height floated 40 cm above the 0.75 m Goblin and Dwarf chests and hid inside everyone else's).
    // Before the rigs are in, the old fixed heights stand in.
    update(dt: number, bodies: readonly [Body, Body], bloodMode: BloodMode, rigs?: Rigs) {
      for (const wound of wounds) {
        if (wound.life > 0) {
          wound.life = Math.max(0, wound.life - dt);
          const body = wound.side === 1 ? bodies[1] : bodies[0], anchor = wound.side === 1 ? rigs?.opponent.anchor : rigs?.player.anchor;
          const bone = anchor?.getObjectByName(wound.site === 'head' ? 'Head' : wound.site === 'legs' ? 'thigh_l' : 'spine_02');   // rig bone names (characters.ts): Head, spine_02, thigh_l
          if (bone) {
            anchor!.updateWorldMatrix(true, true);
            bone.getWorldPosition(wound.group.position);
            if (wound.site === 'legs') wound.group.position.y -= 0.12;   // the thigh bone sits at the hip: the mark hangs on the thigh
          } else wound.group.position.set(body.x, wound.site === 'head' ? 1.55 : wound.site === 'legs' ? 0.6 : 1.15, body.z);
          wound.group.position.x += Math.sin(body.heading) * SKIN[wound.site]; wound.group.position.z += Math.cos(body.heading) * SKIN[wound.site];
          wound.group.rotation.set(0, body.heading, 0);
          wound.mark.scale.set(1, 1, 1);
          const fade = Math.min(1, wound.life),
            seep = Math.min(1, (4 - wound.life) / 1.2); // drips run in the first ~1.2 s, the mark fades over the last
          const tone = bloodMode === 'dark' ? '#241314' : '#4a1213';
          wound.mark.material.color.set(tone);
          wound.mark.material.opacity = 0.55 * fade;
          wound.drips.forEach((drip, i) => {
            drip.position.set((i - 1) * 0.045, -0.13, 0);
            drip.material.color.set(tone);
            drip.material.opacity = 0.5 * fade * seep;
            drip.scale.set(1, 0.4 + 0.6 * seep, 1);
          });
          wound.group.visible = bloodMode !== 'off' && wound.life > 0;
        } else wound.group.visible = false;
      }
    },
    // Detailed finishers use their animated cut sites; the standing combat mark would float above a fallen body.
    hide(side: 0 | 1) {
      wounds[side].group.visible = false;
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
      return wounds as readonly { group: THREE.Group; mark: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; drips: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[]; life: number; side: 0 | 1; site: WoundSite }[];
    },
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
