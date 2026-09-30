import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, castPhase, type Cast } from './special-timing.ts';

// Set's Red Wind, the in-game effect (Nightborn lane, 2026-09-30, Dom's GO via Lead; the pattern and the seam are Hades' special-fx.ts and
// special-timing.ts). Presentation only: it reads the sim's special events and the target's feet, never the sim, the rig root or Math.random
// (every "random" here is an index hash). Loaded lazily by the scene, only in a fight with Special Moves.
// The arena's own sand lifts and turns round the target's feet through the windup, low, thin and fast (grains, a few short streaks); in the last
// 30 ticks it tightens and snaps into a column; on SpecialLanded the column scours up through the target and the sand rains back down. A
// fizzle just lets it fall. One Points draw and one LineSegments draw, no lights, no shadows, no GLB, no allocation per frame.
const GRAINS = 380, STREAKS = 96;
export const COLUMN_RADIUS = 0.24, COLUMN_HEIGHT = 2.1, SPIRAL_RADIUS = 0.95;   // metres: the tight column, its scour height, the wide low spiral
const hash = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (k: number) => k * k * (3 - 2 * k);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// The arena's sand as the floor prints it: Arena 1's gravel mean (arena.ts) times the theme's own tint, dimmed by the exposure the unlit
// grain is drawn under so it sits in the floor's family in daylight and in the pit's firelight alike.
export function sandColour(tint: readonly [number, number, number], exposure: number) {
  const base = [146, 120, 90], k = 1.15 / Math.max(0.5, exposure);
  return new THREE.Color(...base.map((c, i) => Math.min(1, (c / 255) * tint[i] * k)) as [number, number, number]);
}

function grainTexture() {   // a soft round grain, 32 px
  const size = 32, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
    pixels.set([255, 255, 255, 255 * Math.max(0, 1 - r) ** 0.8], (y * size + x) * 4);
  }
  const map = new THREE.DataTexture(pixels, size, size); map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter;
  return map;
}

export type RedWind = ReturnType<typeof createRedWind>;
export function createRedWind(scene: THREE.Scene, opponent: OpponentId, sand: THREE.Color) {
  const root = new THREE.Group(); root.name = 'special fx'; root.visible = false; scene.add(root);
  const positions = new Float32Array(GRAINS * 3), colours = new Float32Array(GRAINS * 3), streakPositions = new Float32Array(STREAKS * 6);
  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  for (let i = 0; i < GRAINS; i++) { const shade = 0.72 + 0.4 * hash(i, 11); colours.set([sand.r * shade, sand.g * shade, sand.b * shade], i * 3); }   // a grain lighter or darker than the mean
  pointGeometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const grainMaterial = new THREE.PointsMaterial({ map: grainTexture(), size: 0.075, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: true });
  const grains = new THREE.Points(pointGeometry, grainMaterial); grains.name = 'red wind grains'; grains.frustumCulled = false; root.add(grains);
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const streakMaterial = new THREE.LineBasicMaterial({ color: sand.clone().multiplyScalar(1.25), transparent: true, opacity: 0, depthWrite: false, fog: true });
  const streaks = new THREE.LineSegments(streakGeometry, streakMaterial); streaks.name = 'red wind streaks'; streaks.frustumCulled = false; root.add(streaks);
  const foot = new THREE.Vector3(), here = new THREE.Vector3();
  let cast: Cast | null = null, clock = 0, lastTick = -1, haveFoot = false, spin = 0, spun = 0;   // spin: the one turning angle of the whole wind, integrated so a change of speed never jumps it

  // Where grain i is, given how far the cast has got. `spin` is the one turning angle of the whole wind (radians); a grain rides it at its
  // own fraction of that speed, from its own start angle, radius and height.
  function place(i: number, spin: number, phase: ReturnType<typeof castPhase>, out: THREE.Vector3) {
    const a0 = hash(i, 1) * Math.PI * 2, r0 = 0.3 + 0.7 * hash(i, 2), h0 = hash(i, 3), rate = 0.75 + 0.5 * hash(i, 4);
    let angle = a0 + spin * rate, radius = r0 * SPIRAL_RADIUS, height: number;
    if (phase.phase === 'gather') { const k = smooth(phase.k); radius *= 1 - 0.12 * k; height = 0.03 + h0 * (0.16 + 0.34 * k); }
    else if (phase.phase === 'form') { const k = smooth(phase.k); radius *= 0.88 - 0.4 * k; height = 0.03 + h0 * (0.5 + 0.5 * k); }
    else if (phase.phase === 'fall') { const k = smooth(phase.k); radius = lerp(radius * 0.48, COLUMN_RADIUS * (0.5 + 0.5 * r0), k); height = 0.03 + h0 * lerp(1, 1.5, k); }
    else {   // recover / dissolve: the scour then the rain
      const t = phase.age / 60, up = 5 + 5 * hash(i, 5), fall = phase.phase === 'recover' ? 9 : 14;
      radius = COLUMN_RADIUS * (0.5 + 0.5 * r0) * (1 + 1.6 * phase.k) + (phase.phase === 'dissolve' ? 0.4 * phase.k : 0);
      height = 0.03 + h0 * 1.5 + (phase.phase === 'recover' ? up * t - 0.5 * fall * t * t : -1.2 * t);
      angle += phase.age * 0.05 * rate;
      if (height < 0.02) height = 0.02;
    }
    out.set(foot.x + Math.cos(angle) * radius, foot.y + height, foot.z + Math.sin(angle) * radius);
  }

  return {
    // After the poses are final: `tick` is the sim tick of this frame, `feet` each side's feet (the point on the ground between them; null
    // while a rig loads), `yielding` true while a finisher plays (no new cast starts; one in flight finishes, per Combat's double-kill rule).
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, feet: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean) {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;   // smooth between sim ticks, never ahead by more than one
      const before = cast;
      cast = advanceCast(cast, events, fighters, tick, opponent, yielding);
      if (!before && cast) { spin = 0; spun = clock; }
      const target = cast ? feet[1 - cast.actor] : null;
      if (target) { foot.copy(target); haveFoot = true; }
      root.visible = !!cast && haveFoot;
      if (!cast || !haveFoot) { grainMaterial.opacity = streakMaterial.opacity = 0; return; }
      const p = castPhase(cast, clock);
      const build = p.phase === 'gather' ? smooth(p.k) : 1, fade = p.phase === 'recover' || p.phase === 'dissolve' ? 1 - smooth(Math.max(0, (p.k - 0.35) / 0.65)) : 1;
      const speed = p.phase === 'gather' ? lerp(5, 11, build) : p.phase === 'form' ? lerp(11, 17, p.k) : p.phase === 'fall' ? lerp(17, 24, p.k) : 24;   // rad/s, thin and fast
      spin += Math.min(3, Math.max(0, clock - spun)) / 60 * speed; spun = clock;
      const live = p.phase === 'gather' ? Math.floor(GRAINS * (0.15 + 0.85 * build)) : GRAINS;   // the wind picks up: more grains lift as it builds
      for (let i = 0; i < GRAINS; i++) {
        if (i >= live) { positions.set([foot.x, foot.y - 5, foot.z], i * 3); continue; }
        place(i, spin, p, here); positions.set([here.x, here.y, here.z], i * 3);
      }
      // A streak trails behind a grain along its turning direction: the spiral reads as motion, not a ring of dots.
      const trail = 0.05 + 0.1 * Math.min(1, speed / 24);
      for (let s = 0; s < STREAKS; s++) {
        const g = s * 3 % GRAINS;
        if (g >= live) { streakPositions.fill(-5, s * 6, s * 6 + 6); continue; }
        place(g, spin, p, here); streakPositions.set([here.x, here.y, here.z], s * 6);
        place(g, spin - trail * 4, p, here); streakPositions.set([here.x, here.y, here.z], s * 6 + 3);
      }
      (pointGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (streakGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      grainMaterial.opacity = 0.9 * Math.min(1, build * 1.6) * fade; streakMaterial.opacity = 0.5 * Math.min(1, build * 1.6) * fade;
    },
    clear() { cast = null; haveFoot = false; root.visible = false; grainMaterial.opacity = streakMaterial.opacity = 0; },
  };
}
