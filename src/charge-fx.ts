import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, type Cast } from './special-timing.ts';
import { charge, CUE_AT, isCharge } from './charge-timing.ts';

// The Centurion's Charge (Alexander, his rank-9 boss special), the in-game effect (World, 2026-10-01; Strategy's brief
// docs/briefs/specials/centurion-l8-l10-2026-10-01.md, Dom's pick). Presentation only, like nightfall-fx.ts beside it: it reads the sim's special
// events and the fighters' Head bones, never the sim, a rig or Math.random (every "random" is an index hash, so a frame is a pure function of the
// clock). No horse and no prop: a line of sand-coloured dust races along the ground, reaches the target on the landing tick (the blow), then
// hangs and settles. The caster stands where the sim keeps him; the dust comes up out of the far side of him, so he reads as arriving out of it.
// Painted and irregular: every puff is its own churned blot at its own turn and size, none a perfect disc. Semi-transparent and low, so it
// never hides both fighters; no glow, nothing additive. Hoof sound is Audio's. Loaded lazily by the scene only on `?special=centurion`.
const TRAIL = 64, BURST = 30, GRAIN = 24;
const LEAD = 3.2;   // metres the line begins behind the caster: the dust has run the arena before it passes him
const TRAIL_LEN = 4.2, BURST_RUN = 2.2;
const hash = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (k: number) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };

// A churned blot: a soft disc eaten into by two sine "swirls" and an uneven rim, so each puff is a smear of dust, not a gradient.
function dustTexture(seed: number, grain: boolean) {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x - 31.5) / 31.5, v = (y - 31.5) / 31.5, r = Math.hypot(u, v), a = Math.atan2(v, u), i = (y * size + x) * 4;
    const rim = 0.72 + 0.2 * Math.sin(a * 3 + seed * 2.1) + 0.12 * Math.sin(a * 7 + seed * 5.3);
    const churn = 0.62 + 0.38 * Math.sin(x * 0.31 + Math.sin(y * 0.21 + seed) * 3.1) * Math.cos(y * 0.27 - x * 0.13 + seed * 1.7);
    const body = grain ? Math.max(0, 1 - r / (rim * 0.8)) ** 0.5 : Math.max(0, 1 - r / rim) ** 1.5 * churn;
    pixels.set([255, 255, 255, 255 * Math.min(1, body)], i);
  }
  const map = new THREE.DataTexture(pixels, size, size); map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter;
  return map;
}

export type ChargeFx = ReturnType<typeof createChargeFx>;
// `cue`: Audio's hooves (src/audio/special.ts, PR #1216), called once per cast CUE_AT ticks in; the scene passes it when that lands. A cast that fizzles after it cannot recall it.
export function createChargeFx(scene: THREE.Scene, opponent: OpponentId, cue?: () => void) {
  const root = new THREE.Group(); root.name = 'charge fx'; root.visible = false; scene.add(root);
  const bg = scene.background instanceof THREE.Color ? scene.background : null, dark = !!bg && bg.r + bg.g + bg.b < 0.45;   // the Night Pit's own dark sky: a darker, cooler dust
  const body = dark ? 0.6 : 1.0, tints = dark ? ['#5e5449', '#4a4239', '#6b6054'] : ['#8d6f46', '#765c38', '#a08258'];
  const textures = [0, 1, 2, 3].map((n) => dustTexture(n, false)), grains = dustTexture(9, true);
  const puff = (i: number, tex: THREE.Texture, color: string) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false, fog: true, rotation: hash(i, 7) * Math.PI * 2 }));
    s.visible = false; s.frustumCulled = false; root.add(s); return s;
  };
  const trail = Array.from({ length: TRAIL }, (_, i) => puff(i, textures[i % 4], tints[i % 3]));
  const burst = Array.from({ length: BURST }, (_, i) => puff(i + 50, textures[(i + 1) % 4], tints[(i + 1) % 3]));
  const sand = Array.from({ length: GRAIN }, (_, i) => puff(i + 90, grains, tints[(i + 2) % 3]));
  const from = new THREE.Vector3(), to = new THREE.Vector3(), dir = new THREE.Vector3(), side = new THREE.Vector3();
  let cast: Cast | null = null, clock = 0, lastTick = -1, cued: number | null = null;   // cued: the start tick of the cast whose cue has fired
  const show = (s: THREE.Sprite, x: number, y: number, z: number, size: number, opacity: number) => {
    s.visible = opacity > 0.004; if (!s.visible) return;
    s.position.set(x, y, z); s.scale.set(size, size * 0.8, 1); (s.material as THREE.SpriteMaterial).opacity = opacity;
  };

  return {
    // After the poses are final, as nightfall-fx.ts: `tick` is this frame's sim tick, `heads` each side's Head bone in world space (null while a rig loads).
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, heads: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean) {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;   // smooth between sim ticks, never ahead by more than one
      cast = advanceCast(cast, events, fighters, tick, opponent, yielding, isCharge);
      if (cast && cued !== cast.start && clock - cast.start >= CUE_AT && cast.fizzled === null) { cued = cast.start; cue?.(); }
      const caster = cast ? heads[cast.actor] : null, target = cast ? heads[1 - cast.actor] : null, state = cast && caster && target ? charge(cast, clock) : null;
      root.visible = !!state;
      if (!state || !caster || !target) return;
      from.set(caster.x, 0, caster.z); to.set(target.x, 0, target.z); dir.subVectors(to, from).setY(0);
      const gap = Math.max(dir.length(), 0.5); dir.normalize(); side.set(-dir.z, 0, dir.x);
      const total = LEAD + gap, front = state.front * total, settle = state.settle ?? 0, out = state.fade * (1 - smooth((settle - 0.35) / 0.65));
      // The line: puffs trail back from the front, older = further back = bigger, higher, thinner. Once it has landed they stay and thin.
      for (let i = 0; i < TRAIL; i++) {
        const back = (0.04 + 0.96 * hash(i, 1)) * TRAIL_LEN, along = front - back;
        if (along < 0) { trail[i].visible = false; continue; }
        const age = back / TRAIL_LEN, lateral = (hash(i, 2) - 0.5) * (0.9 + 1.4 * age), lift = 0.15 + 1.0 * age * (0.6 + 0.4 * hash(i, 3)) + settle * 0.35;
        const at = along - LEAD + settle * 0.5 * (0.5 + hash(i, 4)), size = 0.9 + 1.6 * age + 0.5 * settle;
        show(trail[i], from.x + dir.x * at + side.x * lateral, lift, from.z + dir.z * at + side.z * lateral, size, body * 0.85 * (1 - age) ** 0.7 * Math.min(1, along / 0.5) * out * (0.7 + 0.3 * hash(i, 5)));
      }
      // Trembling sand: grains thrown up just ahead of the front, each hopping on its own beat.
      for (let i = 0; i < GRAIN; i++) {
        const ahead = (hash(i, 6) - 0.2) * 0.9, hop = Math.abs(Math.sin(clock * 0.45 + hash(i, 8) * 6.28)), at = front + ahead - LEAD, lateral = (hash(i, 9) - 0.5) * 1.1;
        show(sand[i], from.x + dir.x * at + side.x * lateral, 0.04 + 0.26 * hop, from.z + dir.z * at + side.z * lateral, 0.07 + 0.08 * hash(i, 10), state.settle === null && state.front > 0 && state.front < 1 ? 0.75 * state.fade : 0);
      }
      // The blow: at the landing the front breaks over the target's feet, a low spray that rolls out and thins.
      for (let i = 0; i < BURST; i++) {
        if (state.settle === null) { burst[i].visible = false; continue; }
        const k = Math.min(1, settle / 0.8), spread = (0.35 + hash(i, 11)) * BURST_RUN * (1 - (1 - k) ** 2), angle = (hash(i, 12) - 0.5) * 2.4;
        const run = Math.cos(angle) * spread, wide = Math.sin(angle) * spread;
        show(burst[i], to.x + dir.x * run + side.x * wide, 0.15 + 0.5 * k * hash(i, 13), to.z + dir.z * run + side.z * wide, 0.9 + 1.3 * k, body * 0.8 * (1 - k) ** 1.1 * (0.6 + 0.4 * hash(i, 14)));
      }
    },
    clear() { cast = null; root.visible = false; },
  };
}
