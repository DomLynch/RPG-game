import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, shadowPhase, FALL_AT, type Cast, type isHadesShadow } from './special-timing.ts';

// The Goblin's boss specials at ranks 8, 9, 10, GREY-BOX (Goblin lane, 2026-10-01; proposal sent to Strategy, who put it to Dom; nothing here is
// picked or shipped). Same seam as Hades' cloud and Red Wind: it reads the sim's special events and the two bodies' anchors, never the sim, the rig
// root or Math.random (every "random" is an index hash). Loaded lazily by the scene, only on a `?special=reynard|hermes|loki` page. Rules (the
// Centurion brief): unblockable, ~2 s wind-up in the sim, the visible build-up is the last ~0.4 s (the 'fall' phase, 24 ticks), one clean idea, no
// props, grounded, painted not drawn, no glow. Sprites and a few flat shapes stand in for the painted art, so Dom judges the IDEA.
//   reynard (rank 8)  Dirty Fistful: sand flung from his hand up into the target's face, a ragged fan, then it hangs there and thins.
//   hermes  (rank 9)  Gone: a dust puff, he is hidden, fast footprints stamp round the target, and he is behind him with the blow.
//   loki    (rank 10) Three Liars: two dust-grey afterimages run in beside him for under 0.4 s; the real one is the only solid one and it lands.
// The caster's own motion (hide, lunge, reappear) is applied by the effect itself to his rig anchor (special-modes.ts hands it over); the sim's body never moves.

const hash = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const smooth = (k: number) => { const c = clamp01(k); return c * c * (3 - 2 * c); };
const PUFFS = 28, SPECKS = 44, PRINTS = 8, GHOST_SINCE = 0.1;   // a ghost shows from k .1 to the end of the 0.4 s build-up: ~0.36 s

// Dirty Fistful's tell is the move itself (Strategy, 2026-10-01): he DROPS and scoops a fistful off the ground for SCOOP_TICKS before the fling, hand to the sand,
// grit trickling from the fist (the rig sinks DIP metres: a presentation knee-dip, like the claw's), then the fling is the 0.4 s fan across the gap.
export const SCOOP_TICKS = 48, DIP = 0.22;

// Unlit sprites in the working space, tone-mapped by the arena's exposure; the Night Pit (exposure above 1.5) needs paler dust to hold on dark clay.
const dust = (exposure: number) => (exposure > 1.5 ? { core: new THREE.Color(0.42, 0.41, 0.39), edge: new THREE.Color(0.3, 0.29, 0.27) } : { core: new THREE.Color(0.14, 0.135, 0.125), edge: new THREE.Color(0.36, 0.34, 0.3) });

// Sand, not smoke (Strategy on the first clip: the grey-white puff read as smoke): a brown cloud with darker grit specks. The day arena's floor is tan, so the
// cloud is a deeper brown there; in the Night Pit (exposure above 1.5) the same sand is paler to hold on dark clay. No glow, nothing saturated.
const sand = (exposure: number) => (exposure > 1.5 ? { core: new THREE.Color(0.2, 0.14, 0.08), edge: new THREE.Color(0.5, 0.37, 0.22) } : { core: new THREE.Color(0.07, 0.045, 0.025), edge: new THREE.Color(0.3, 0.2, 0.11) });

function speckTexture() {   // a small hard-edged grain: crisp, so a speck reads as grit and not as a puff
  const size = 16, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const r = Math.hypot((x - 7.5) / 7.5, (y - 7.5) / 7.5); pixels.set([255, 255, 255, 255 * Math.min(1, Math.max(0, (1 - r) * 3))], (y * size + x) * 4); }
  const map = new THREE.DataTexture(pixels, size, size); map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter;
  return map;
}

function puffTexture() {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x - 31.5) / 31.5, v = (y - 31.5) / 31.5, r = Math.hypot(u, v), churn = 0.65 + 0.35 * Math.sin(x * 0.37 + Math.sin(y * 0.23) * 3) * Math.cos(y * 0.29 - x * 0.11);
    pixels.set([255, 255, 255, 255 * Math.max(0, 1 - r) ** 1.4 * churn], (y * size + x) * 4);
  }
  const map = new THREE.DataTexture(pixels, size, size); map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter;
  return map;
}

// `caster`: his sim position on the ground; `feet` / `head`: the target's, in world space (null while a rig loads).
export type GoblinSpecial = 'reynard' | 'hermes' | 'loki';
export type GoblinAnchors = { caster: THREE.Vector3; feet: THREE.Vector3 | null; head: THREE.Vector3 | null };
// What the scene does to the caster this frame: hide him, and/or shift his group (world metres) off the sim position.
export type GoblinFrame = { hide: boolean; offset: THREE.Vector3 | null };
// The cast test this effect hands advanceCast (World's seam, #1120): every cast of his, on the opponent's side, whatever his class skill. Hades' own test
// stays the default, so a Goblin cast opens no cast anywhere that did not ask for this effect.
export const isGoblinCast: typeof isHadesShadow = (opponent, actor) => opponent === 'goblin' && actor === 1;
export type GoblinSpecialFx = ReturnType<typeof createGoblinSpecial>;

export function createGoblinSpecial(scene: THREE.Scene, kind: GoblinSpecial, exposure: number, opponent: OpponentId = 'goblin') {
  const look = kind === 'reynard' ? sand(exposure) : dust(exposure), map = puffTexture(), root = new THREE.Group(); root.name = `goblin special ${kind}`; root.visible = false; scene.add(root);
  const puffs = Array.from({ length: PUFFS }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: i % 3 ? look.edge : look.core, transparent: true, opacity: 0, depthWrite: false, fog: true })); s.visible = false; root.add(s); return s;
  });
  const specks = kind === 'reynard' ? Array.from({ length: SPECKS }, () => { const grain = speckTexture(), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: grain, color: look.core, transparent: true, opacity: 0, depthWrite: false, fog: true })); s.visible = false; root.add(s); return s; }) : [];
  const speck = (i: number, at: THREE.Vector3, scale: number, opacity: number) => { const s = specks[i]; s.position.copy(at); s.scale.setScalar(scale); (s.material as THREE.SpriteMaterial).opacity = opacity; s.visible = opacity > 0.01; };
  const flat = (geometry: THREE.BufferGeometry) => { const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: look.core, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; root.add(m); return m; };
  const ghosts = kind === 'loki' ? [0, 1].map(() => flat(new THREE.CapsuleGeometry(0.2, 0.92, 3, 10))) : [];   // grey-box afterimages at his 1.36 m
  const prints = kind === 'hermes' ? Array.from({ length: PRINTS }, () => { const m = flat(new THREE.CircleGeometry(1, 10)); m.rotation.x = -Math.PI / 2; m.scale.set(0.07, 0.15, 1); return m; }) : [];
  const dir = new THREE.Vector3(), side = new THREE.Vector3(), behind = new THREE.Vector3(), tmp = new THREE.Vector3(), frame: GoblinFrame = { hide: false, offset: null }, offset = new THREE.Vector3();
  let cast: Cast | null = null, clock = 0, lastTick = -1;

  const puff = (i: number, at: THREE.Vector3, scale: number, opacity: number) => { const s = puffs[i]; s.position.copy(at); s.scale.setScalar(scale); (s.material as THREE.SpriteMaterial).opacity = opacity; s.visible = opacity > 0.01; };
  const hideAll = () => { puffs.forEach((s) => (s.visible = false)); specks.forEach((s) => (s.visible = false)); ghosts.forEach((g) => (g.visible = false)); prints.forEach((p) => (p.visible = false)); };
  const clear = () => { cast = null; root.visible = false; hideAll(); frame.hide = false; frame.offset = null; };

  const inner = {
    // After the poses are final. `tick`: the sim tick of this frame; `yielding`: true while a finisher plays (no new cast starts).
    frame(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, a: GoblinAnchors, yielding: boolean): GoblinFrame {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;
      cast = advanceCast(cast, events, fighters, tick, opponent, yielding, isGoblinCast);
      hideAll(); frame.hide = false; frame.offset = null; root.visible = false;
      if (!cast || !a.feet || !a.head) return frame;
      const p = shadowPhase(cast, clock), feet = a.feet;   // `feet` keeps its narrowing inside the closures below
      const scoop = kind === 'reynard' && p.phase === 'gather' && p.age >= FALL_AT - SCOOP_TICKS;   // only the Fistful has a tell before the last 0.4 s
      if ((p.phase === 'gather' && !scoop) || p.phase === 'done' || p.phase === 'dissolve') return frame;   // the rest of the wind-up is the sim's alone; a fizzle draws nothing
      root.visible = true;
      const build = p.phase === 'fall', k = p.k;   // build: 0..1 over the last 0.4 s; else the aftermath, 0..1 over 0.75 s
      dir.copy(a.feet).sub(a.caster).setY(0); const dist = dir.length(); if (dist < 1e-3) dir.set(0, 0, 1); else dir.divideScalar(dist);
      side.set(-dir.z, 0, dir.x);

      if (kind === 'reynard') {   // Dirty Fistful: he drops and scoops, grit trickling from the fist, then the fling is a visible fan from the fist to the face
        const fist = new THREE.Vector3().copy(a.caster).addScaledVector(dir, 0.28), head = a.head;
        const sc = scoop ? clamp01((p.age - (FALL_AT - SCOOP_TICKS)) / SCOOP_TICKS) : 1;   // 0..1 through the scoop
        const dip = scoop ? smooth(sc * (SCOOP_TICKS / 10)) : build ? 1 - smooth(k / 0.35) : 0;   // sinks in ~0.17 s, holds, then rises as the fling starts
        frame.offset = offset.set(0, -DIP * dip, 0);
        if (scoop) {
          fist.y = 0.06 + 0.2 * smooth(sc);   // the hand rakes the sand, then lifts the fistful
          for (let i = 0; i < 8; i++) { const ang = i * 2.4 + sc * 3, r = 0.04 + 0.1 * hash(i, 1) * (1 - sc * 0.4); puff(i, new THREE.Vector3(fist.x + Math.cos(ang) * r, 0.04 + 0.16 * hash(i, 2) * (0.4 + sc), fist.z + Math.sin(ang) * r), 0.12 + 0.1 * hash(i, 3), 0.55 * smooth(sc * 4)); }
          for (let i = 0; i < 14; i++) {   // grit trickling out of the fist: each speck falls from the fist to the ground and starts again
            const u = (sc * 2.2 + hash(i, 4)) % 1;
            speck(i, new THREE.Vector3(fist.x + (hash(i, 5) - 0.5) * 0.09, fist.y * (1 - u * u), fist.z + (hash(i, 6) - 0.5) * 0.09), 0.028 + 0.012 * hash(i, 7), 0.95 * smooth(sc * 5) * (1 - u ** 3));
          }
          return frame;
        }
        const start = fist.clone(); start.y = 0.26;
        const hand = tmp.copy(a.caster).addScaledVector(dir, 0.3).setY(0.85);   // the arm whips up and out
        for (let i = 0; i < PUFFS; i++) {
          if (build) {
            const lag = hash(i, 1) * 0.4, u = clamp01((k - lag) / (1 - lag)), e = 1 - (1 - u) ** 2, origin = new THREE.Vector3().lerpVectors(start, hand, smooth(k * 2.5)), at = new THREE.Vector3().lerpVectors(origin, head, e);
            at.addScaledVector(side, (hash(i, 2) - 0.5) * 0.5 * u); at.y += (hash(i, 3) - 0.5) * 0.3 * u;
            puff(i, at, 0.1 + 0.3 * u, 0.7 * smooth(u * 4));
          } else {   // it hangs at the face, swirls, grows and thins: the blinding
            const ang = i * 2.4 + k * 2, r = (0.1 + 0.3 * hash(i, 4)) * (1 + k * 0.8);
            puff(i, new THREE.Vector3(head.x + Math.cos(ang) * r, head.y + (hash(i, 5) - 0.3) * 0.4 - k * 0.2, head.z + Math.sin(ang) * r), 0.36 + 0.24 * k, 0.8 * (1 - smooth((k - 0.25) / 0.75)));
          }
        }
        for (let i = 0; i < SPECKS; i++) {   // the grit itself: dark crisp specks, a wider and faster fan than the haze, falling once they have arrived
          if (build) {
            const lag = hash(i, 8) * 0.35, u = clamp01((k - lag) / (1 - lag)), e = 1 - (1 - u) ** 3, origin = new THREE.Vector3().lerpVectors(start, hand, smooth(k * 2.5)), at = new THREE.Vector3().lerpVectors(origin, head, e);
            at.addScaledVector(side, (hash(i, 9) - 0.5) * 0.7 * u); at.y += (hash(i, 10) - 0.4) * 0.45 * u;
            speck(i, at, 0.03 + 0.03 * hash(i, 11), 0.95 * smooth(u * 6));
          } else {
            const sway = (hash(i, 9) - 0.5) * 0.7, scatter = (hash(i, 12) - 0.5) * 0.5;
            speck(i, new THREE.Vector3(head.x + side.x * (sway + scatter * k), head.y + (hash(i, 10) - 0.4) * 0.45 - 0.9 * k * k, head.z + side.z * (sway + scatter * k)), 0.03 + 0.03 * hash(i, 11), 0.9 * (1 - smooth((k - 0.3) / 0.7)));
          }
        }
        return frame;
      }

      if (kind === 'hermes') {   // Gone: dust, nothing, footprints round him, and Hermes is behind with the blow
        behind.copy(a.feet).addScaledVector(dir, 0.85);
        const away = tmp.copy(behind).sub(a.caster).setY(0);
        offset.copy(away);
        if (build) {
          for (let i = 0; i < 12; i++) { const u = clamp01(k / 0.5), ang = i * 2.4 + hash(i, 1); puff(i, new THREE.Vector3(a.caster.x + Math.cos(ang) * (0.15 + 0.5 * u * hash(i, 2)), 0.1 + 0.8 * u * hash(i, 3), a.caster.z + Math.sin(ang) * (0.15 + 0.5 * u * hash(i, 2))), 0.25 + 0.35 * u, 0.7 * (1 - u)); }
          frame.hide = k >= 0.12; frame.offset = offset;
        } else {   // he stands behind the target for the first 40 % of the aftermath, then slides back to where the sim has him
          frame.offset = offset.multiplyScalar(1 - smooth((k - 0.4) / 0.6));
          for (let i = 12; i < 20; i++) { const ang = i * 2.1, u = clamp01(k / 0.5); puff(i, new THREE.Vector3(behind.x + Math.cos(ang) * (0.1 + 0.3 * u * hash(i, 2)), 0.12 + 0.5 * u * hash(i, 3), behind.z + Math.sin(ang) * (0.1 + 0.3 * u * hash(i, 2))), 0.2 + 0.3 * u, 0.55 * (1 - u)); }
        }
        prints.forEach((m, j) => {   // fast prints looping round the target, one every ~0.04 s
          const t = (j + 1) / (PRINTS + 1), show = build ? k > 0.15 + 0.75 * t : true, fade = build ? 0.55 : 0.55 * (1 - smooth(k));
          m.position.copy(a.caster).lerp(behind, t).addScaledVector(side, Math.sin(t * Math.PI) * 0.8 + (j % 2 ? 0.18 : -0.18)); m.position.y = 0.012; m.rotation.z = Math.atan2(dir.x, dir.z);
          (m.material as THREE.MeshBasicMaterial).opacity = show ? fade : 0; m.visible = show && fade > 0.01;
        });
        return frame;
      }

      // loki: Three Liars. The real one lunges and lands; the two ghosts are translucent and gone before the landing.
      const reach = Math.max(0, dist - 1.1);
      frame.offset = offset.copy(dir).multiplyScalar(reach * (build ? k * k : 1 - smooth((k - 0.4) / 0.6)));
      if (build && k >= GHOST_SINCE) {
        const u = (k - GHOST_SINCE) / (1 - GHOST_SINCE), e = 1 - (1 - u) ** 2;
        ghosts.forEach((g, n) => {
          const s = n ? 1 : -1;
          g.position.copy(a.caster).addScaledVector(side, s * 1.15).addScaledVector(dir, -0.15).lerp(behind.copy(feet).addScaledVector(dir, -0.95).addScaledVector(side, s * 0.45), e); g.position.y = 0.68;
          (g.material as THREE.MeshBasicMaterial).opacity = 0.36 * (1 - smooth((u - 0.6) / 0.4)); g.visible = (g.material as THREE.MeshBasicMaterial).opacity > 0.01;
          for (let j = 0; j < 3; j++) puff(n * 3 + j, tmp.copy(g.position).addScaledVector(dir, -(0.25 + 0.2 * j)).setY(0.08 + 0.05 * j), 0.16 + 0.04 * j, 0.3 * (1 - smooth((u - 0.5) / 0.5)));
        });
      }
      return frame;
    },
  };

  // The registry's seam (special-modes.ts): `at` is the two bodies' feet, then the extra arguments, the caster's rig anchor and the target's head. The anchor
  // is the presentation anchor inside his actor group, which the sim positions: shifted by what this frame wants (undone first, so nothing accumulates) and
  // hidden while Hermes is gone. The caster's base is his group's sim position.
  let host: THREE.Object3D | null = null, hidden = false;
  const shift = new THREE.Vector3(), local = new THREE.Vector3(), inverse = new THREE.Quaternion();
  const restore = () => { if (host) { host.position.sub(shift); shift.set(0, 0, 0); if (hidden) host.visible = true; } hidden = false; };
  return {
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, at: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean, anchor: THREE.Object3D | null = null, head: THREE.Vector3 | null = null) {
      if (anchor !== host) { restore(); host = anchor; }
      if (host) { host.position.sub(shift); shift.set(0, 0, 0); }   // last frame's shift off: everything else reads the sim's position
      const base = host?.parent?.position ?? at[1];
      const frame = base ? inner.frame(dt, events, fighters, tick, { caster: base, feet: at[0], head }, yielding) : null;
      if (!host || !frame) return;
      if (frame.offset) { inverse.copy(host.parent?.quaternion ?? inverse.identity()).invert(); local.copy(frame.offset).applyQuaternion(inverse); host.position.add(local); shift.copy(local); }
      if (frame.hide !== hidden) { host.visible = !frame.hide; hidden = frame.hide; }
    },
    clear() { clear(); restore(); },
  };
}
