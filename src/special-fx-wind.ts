import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, castPhase, type Cast } from './special-timing.ts';

// Set's Red Wind, the in-game effect (Nightborn lane, 2026-09-30, Dom's GO via Lead; the seam is Hades' special-fx.ts and special-timing.ts).
// One idea, the arena's own sand, on the TARGET only. Presentation only: it reads the sim's special events and the target's feet, never the
// sim, the rig root or Math.random (every "random" is an index hash). Loaded lazily by the scene, only in a fight with Special Moves.
//   wind-up (2 s): a veil of streaked sand turns round the target's feet, a low ring you can see rotating, tightening and rising to knee height;
//   release: the ring snaps into one tight column that scours up through him to above his head in ~0.3 s, then the sand rains back and settles.
// Two draws: an open cylinder (the veil, its streaks scrolled round and then up) and one LineSegments of grains drawn as streaks along their
// own direction of travel. No lights, no shadows, no GLB, no debris.
const GRAINS = 520, SEGMENTS = 40, ROWS = 8;
export const COLUMN_HEIGHT = 2.5, COLUMN_RADIUS = 0.27, RING_RADIUS = 1, KNEE = 0.5;   // metres: the scour's top, the tight column, the wide ring, knee height
const hash = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (k: number) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };
// Semi-transparent: the fighter stays clearly visible through the wind.
const SEE_THROUGH = 0.6;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// The wind's colours. Dom's verdict on v2 (2026-09-30): the fire-orange red "looks cheesy", make it grey / wind coloured and semi-transparent.
// So: a dust-grey core, darker than the pale floor so the streaks read on motion and density, with a lighter warm-grey rim; no saturation, no glow.
// In a dim arena (the Night Pit, exposure above 1.5) the core is a pale grey, bright enough for the unlit veil to hold against dark clay.
// Linear values: the unlit veil is drawn in the working space and tone-mapped by the arena's own exposure.
export function sandLook(exposure: number) {
  const dim = exposure > 1.5;
  return dim ? { core: new THREE.Color(0.42, 0.41, 0.39), edge: new THREE.Color(0.3, 0.29, 0.27), dim }
    : { core: new THREE.Color(0.14, 0.135, 0.125), edge: new THREE.Color(0.36, 0.34, 0.3), dim };
}
export type SandLook = ReturnType<typeof sandLook>;

// Streaks of sand round a cylinder, tiling in both directions (scroll U to turn it, V to draw it upward). Painted, not drawn (Dom, v3: "too
// uniform, more jagged, like the blood"): every row has its own crest count, sharpness and width; periodic value noise tears each crest into
// broken fragments, varies its opacity along the stroke, and leaves clumps and gaps round the ring and up the column.
const vnoise = (x: number, freq: number, seed: number) => {   // periodic in x (0..1), so the texture still tiles
  const f = x * freq, i = Math.floor(f), k = smooth(f - i);
  return lerp(hash(i % freq, seed), hash((i + 1) % freq, seed), k);
};
function streakTexture() {
  const w = 256, h = 128, pixels = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const cycles = 2 + hash(y, 1) * 6, phase = hash(y, 2), sharp = 2 + hash(y, 3) * 4, weight = 0.4 + 0.6 * hash(y, 6), bias = 0.3 + 0.35 * hash(y, 8);
    const tear = 3 + Math.floor(hash(y, 9) * 5), clump = 2 + Math.floor(hash(y, 10) * 3);
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const crest = (Math.sin(2 * Math.PI * (u * cycles + phase)) * 0.5 + 0.5) ** sharp;
      const torn = smooth((vnoise(u, tear, y + 20) - bias) * 4);   // broken fragments
      const along = 0.35 + 0.65 * vnoise(u, tear * 2, y + 40);   // opacity varying along the stroke
      const clumps = 0.25 + 0.75 * smooth(vnoise(u, clump, (y >> 2) + 60) * 1.6 - 0.2);   // denser and thinner patches
      const a = 255 * Math.min(1, 0.12 + crest * weight * torn * along * clumps * 1.5);
      pixels.set([a, a, a, 255], (y * w + x) * 4);
    }
  }
  const map = new THREE.DataTexture(pixels, w, h); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter;
  return map;
}

export type RedWind = ReturnType<typeof createRedWind>;
export function createRedWind(scene: THREE.Scene, opponent: OpponentId, look: SandLook) {
  const root = new THREE.Group(); root.name = 'special fx'; root.visible = false; scene.add(root);
  // The veil: an open cylinder, unit height, base at the floor; vertex colours (RGBA) carry the dark core, the lighter dusty rim and the soft ends.
  const veilGeometry = new THREE.CylinderGeometry(1.08, 1, 1, SEGMENTS, ROWS, true); veilGeometry.translate(0, 0.5, 0);
  const at = veilGeometry.attributes.position as THREE.BufferAttribute, veilColours = new Float32Array(at.count * 4);
  for (let i = 0; i < at.count; i++) {
    const t = at.getY(i), rim = smooth((t - 0.45) / 0.55), ends = Math.min(smooth(t / 0.14), 1 - smooth((t - 0.8) / 0.2) * 0.85);
    const c = look.core.clone().lerp(look.edge, rim); veilColours.set([c.r, c.g, c.b, ends], i * 4);
  }
  veilGeometry.setAttribute('color', new THREE.BufferAttribute(veilColours, 4));
  const alphaMap = streakTexture();
  const veilMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, alphaMap, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: true });
  const veil = new THREE.Mesh(veilGeometry, veilMaterial); veil.name = 'red wind veil'; veil.frustumCulled = false; root.add(veil);
  // The grains: each a short streak from where it is to where it was, head in the rim colour, tail in the core colour fading out.
  const prev = new Float32Array(GRAINS * 3).fill(-9), segments = new Float32Array(GRAINS * 6), segmentColours = new Float32Array(GRAINS * 8);
  for (let i = 0; i < GRAINS; i++) {
    const shade = 0.75 + 0.5 * hash(i, 11), h = look.core.clone().lerp(look.edge, 0.25).multiplyScalar(shade), t = look.core.clone();
    segmentColours.set([h.r, h.g, h.b, 0.35 + 0.65 * hash(i, 22), t.r, t.g, t.b, 0], i * 8);   // each grain its own opacity
  }
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(segments, 3).setUsage(THREE.DynamicDrawUsage));
  streakGeometry.setAttribute('color', new THREE.BufferAttribute(segmentColours, 4));
  const streakMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: true });
  const streaks = new THREE.LineSegments(streakGeometry, streakMaterial); streaks.name = 'red wind streaks'; streaks.frustumCulled = false; root.add(streaks);
  const foot = new THREE.Vector3(), here = new THREE.Vector3();
  let cast: Cast | null = null, clock = 0, lastTick = -1, haveFoot = false, spin = 0, spun = 0;

  // Where grain i is on the veil: round it at its own fraction of the turning, at the veil's radius (a little either side), up its height.
  // `age` is the ticks since the release, or -1; `settle` 0..1 is a fizzle letting it fall.
  function place(i: number, out: THREE.Vector3, radius: number, height: number, age: number, settle: number) {
    const u = hash(i, 1), a = (u + 0.1 * Math.sin(2 * Math.PI * 3 * u + 1) + 0.05 * Math.sin(2 * Math.PI * 7 * u)) * Math.PI * 2 + spin * (0.85 + 0.3 * hash(i, 4)), rad = radius * (0.82 + 0.3 * hash(i, 2)), h0 = hash(i, 3) ** 1.7;   // denser at the base of the column
    if (age >= 0) {   // after the release: each grain rides the column, lets go at its own moment and falls, drifting outward
      const letGo = 8 + 18 * hash(i, 5), fall = Math.max(0, age - letGo) / 60, drift = 1 + 1.1 * smooth(fall * 2.2);
      const y = h0 * height - 14 * fall * fall * (0.6 + 0.8 * hash(i, 7));
      out.set(foot.x + Math.cos(a) * rad * drift, foot.y + Math.max(0.02, y), foot.z + Math.sin(a) * rad * drift);
      return;
    }
    out.set(foot.x + Math.cos(a) * rad * (1 + 0.6 * settle), foot.y + h0 * height * (1 - settle), foot.z + Math.sin(a) * rad * (1 + 0.6 * settle));
  }

  return {
    // After the poses are final: `tick` is the sim tick of this frame, `feet` each side's feet (the point on the ground between them; null
    // while a rig loads), `yielding` true while a finisher plays (no new cast starts; one in flight finishes, per Combat's double-kill rule).
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, feet: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean) {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;   // smooth between sim ticks, never ahead by more than one
      const before = cast;
      cast = advanceCast(cast, events, fighters, tick, opponent, yielding);
      if (!before && cast) { spin = 0; spun = clock; alphaMap.offset.set(0, 0); prev.fill(-9); }
      const target = cast ? feet[1 - cast.actor] : null;
      if (target) { foot.copy(target); haveFoot = true; }
      root.visible = !!cast && haveFoot;
      if (!cast || !haveFoot) { veilMaterial.opacity = streakMaterial.opacity = 0; return; }
      const p = castPhase(cast, clock);
      // A fizzle (the caster fell in the windup) freezes the wind where it was and lets it settle: no column, no scour.
      const shown = p.phase === 'dissolve' ? castPhase({ ...cast, fizzled: null }, cast.fizzled!) : p, settle = p.phase === 'dissolve' ? smooth(p.k) : 0, k = shown.k, age = p.phase === 'recover' ? p.age : -1;
      let radius: number, height: number, alpha: number, turns: number;   // turns: revolutions per second
      if (shown.phase === 'gather') { radius = lerp(RING_RADIUS, 0.74, smooth(k)); height = lerp(0.07, KNEE * 0.8, smooth(k)); alpha = 0.3 + 0.6 * smooth(k * 1.6); turns = lerp(0.7, 1.7, k); }
      else if (shown.phase === 'form') { radius = lerp(0.74, 0.5, smooth(k)); height = lerp(KNEE * 0.8, KNEE * 1.1, smooth(k)); alpha = 0.9; turns = lerp(1.7, 2.8, k); }
      else if (shown.phase === 'fall') { radius = lerp(0.5, COLUMN_RADIUS, smooth(k)); height = lerp(KNEE * 1.1, 1, smooth(k)); alpha = 0.92; turns = lerp(2.8, 4, k); }
      else {   // recover: the column scours up past his head in ~0.3 s (18 ticks), thins as the sand lets go, and is gone by the end
        const up = smooth(p.age / 18); radius = COLUMN_RADIUS * (1 + 0.25 * up); height = lerp(1, COLUMN_HEIGHT, up); alpha = 0.92 * (1 - smooth((p.age - 14) / (45 - 14))); turns = 4;
      }
      alpha *= 1 - settle; height *= 1 - settle; radius *= 1 + 0.5 * settle;
      const step = Math.min(3, Math.max(0, clock - spun)) / 60; spun = clock;
      spin += step * turns * Math.PI * 2; alphaMap.offset.x -= step * turns * 0.5;
      if (age >= 0) alphaMap.offset.y += step * 3;   // the streaks climb the column
      veil.position.set(foot.x, foot.y, foot.z); veil.scale.set(radius, Math.max(0.01, height), radius);
      veilMaterial.opacity = Math.max(0, alpha) * SEE_THROUGH;
      // The grains ride the veil, drawn as streaks along where they have just been.
      for (let i = 0; i < GRAINS; i++) {
        if (shown.phase === 'gather' && i >= GRAINS * (0.2 + 0.8 * smooth(k * 1.4))) { segments.fill(-9, i * 6, i * 6 + 6); prev.fill(-9, i * 3, i * 3 + 3); continue; }
        if (hash(i + Math.floor(clock / 7) * 977, 23) < 0.22) { segments.fill(-9, i * 6, i * 6 + 6); prev.fill(-9, i * 3, i * 3 + 3); continue; }   // broken fragments come and go
        place(i, here, radius, Math.max(0.04, height), age, settle);
        const first = prev[i * 3 + 1] < -8;
        let dx = first ? 0 : prev[i * 3] - here.x, dy = first ? 0 : prev[i * 3 + 1] - here.y, dz = first ? 0 : prev[i * 3 + 2] - here.z;
        const len = Math.hypot(dx, dy, dz), scale = len > 1e-6 ? Math.min(3.2, 0.45 * (0.3 + 1.7 * hash(i, 21) ** 2) / len) : 0; dx *= scale; dy *= scale; dz *= scale;   // every streak its own length
        segments.set([here.x, here.y, here.z, here.x + dx, here.y + dy, here.z + dz], i * 6);
        prev.set([here.x, here.y, here.z], i * 3);
      }
      (streakGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      streakMaterial.opacity = Math.min(1, alpha * 1.1) * SEE_THROUGH;
    },
    clear() { cast = null; haveFoot = false; root.visible = false; veilMaterial.opacity = streakMaterial.opacity = 0; prev.fill(-9); },
  };
}
