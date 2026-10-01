import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, castPhase, LAND_AT, type Cast } from './special-timing.ts';
import { clamp01, hash, smooth } from './special-fx-wind.ts';

// The Pitborn's boss specials, GREY-BOX (Pitborn lane, 2026-10-01; proposal sent to Strategy, Dom has not picked). Placeholder sprites and flat quads on
// Red Wind's seam (special-timing.ts): they prove the timing, the placement and the ~0.5 s build-up, nothing about the final art. Presentation only: reads
// the sim's special events and each side's feet, never the sim, the rig root or Math.random (every "random" is an index hash). Preview-only, ?special=<kind>.
//   antaeus (rank 8, level 36):  ragged cracks run out from his feet and clods lift off them, then drop back.
//   surtr   (rank 9, level 41):  grey ash falls over the arena and a dark scorch spreads under him; no light, no fire.
//   typhon  (rank 10, level 46): a gale from behind him whips sand sideways toward the target. (The crowd banners are not in the grey-box.)
export type PitbornKind = 'antaeus' | 'surtr' | 'typhon';
export const PITBORN_KINDS: readonly PitbornKind[] = ['antaeus', 'surtr', 'typhon'];
const BUILD = 30;   // ticks of visible build-up before the landing (0.5 s; Dom: a 1-2 s build-up was too slow)
const COUNT = { antaeus: 36, surtr: 110, typhon: 90 } as const;
const TINT = { antaeus: '#5a452d', surtr: '#2c2c2e', typhon: '#b09c7a' } as const;
const CRACKS = 9;

function softMap() {
  const size = 32, px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5), churn = 0.75 + 0.25 * Math.sin(x * 0.7 + Math.sin(y * 0.5) * 2);
    px.set([255, 255, 255, 255 * Math.max(0, 1 - r) ** 1.4 * churn], (y * size + x) * 4);
  }
  const map = new THREE.DataTexture(px, size, size); map.magFilter = map.minFilter = THREE.LinearFilter; map.needsUpdate = true; return map;
}

export type PitbornSpecial = ReturnType<typeof createPitbornSpecial>;
export function createPitbornSpecial(scene: THREE.Scene, opponent: OpponentId, kind: PitbornKind) {
  const root = new THREE.Group(); root.name = 'special fx'; root.visible = false; scene.add(root);
  const map = softMap();
  const bits = Array.from({ length: COUNT[kind] }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: TINT[kind], transparent: true, opacity: 0, depthWrite: false, fog: true }));
    s.name = `${kind} ${i}`; s.visible = false; root.add(s); return s;
  });
  // Flat pieces lying on the sand: antaeus's cracks (thin ragged strips from his feet), surtr's scorch (one dark disc).
  const flatGeometry = kind === 'surtr' ? new THREE.CircleGeometry(1, 20) : new THREE.PlaneGeometry(1, 1);
  flatGeometry.rotateX(-Math.PI / 2); if (kind === 'antaeus') flatGeometry.translate(0.5, 0, 0);
  const flat = kind === 'typhon' ? [] : Array.from({ length: kind === 'antaeus' ? CRACKS : 1 }, () => {
    const m = new THREE.Mesh(flatGeometry, new THREE.MeshBasicMaterial({ color: kind === 'antaeus' ? '#1a120a' : '#0d0d0e', transparent: true, opacity: 0, depthWrite: false, fog: true }));
    m.frustumCulled = false; m.visible = false; root.add(m); return m;
  });
  const caster = new THREE.Vector3(), target = new THREE.Vector3(), dir = new THREE.Vector3();
  let cast: Cast | null = null, clock = 0, lastTick = -1;

  function hide() { root.visible = false; bits.forEach((s) => (s.visible = false)); flat.forEach((m) => (m.visible = false)); }
  return {
    // `feet`: each side's feet midpoint on the sand in world space (null while a rig loads). Same call shape as Red Wind and the Shield Quake.
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, feet: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean) {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;
      cast = advanceCast(cast, events, fighters, tick, opponent, yielding);
      const from = cast ? feet[cast.actor] : null, to = cast ? feet[1 - cast.actor] : null;
      if (!cast || !from || !to) { hide(); return; }
      caster.copy(from); target.copy(to);
      const p = castPhase(cast, clock), age = p.phase === 'gather' || p.phase === 'fall' ? p.age : LAND_AT + p.age;
      const build = smooth((age - (LAND_AT - BUILD)) / BUILD), post = p.phase === 'recover' || p.phase === 'dissolve' ? smooth(p.k) : 0;
      const live = build * (1 - post * post), t = clock * 0.016, half = (target.x + caster.x) / 2, halfZ = (target.z + caster.z) / 2;
      dir.set(target.x - caster.x, 0, target.z - caster.z); const gap = dir.length() || 1; dir.divideScalar(gap);
      root.visible = true;
      if (kind === 'antaeus') {
        flat.forEach((m, i) => {   // ragged cracks: uneven length, width and heading, growing out over the build-up, gone as the clods settle
          const len = build * (0.9 + 1.5 * hash(i, 21)), wid = 0.05 + 0.06 * hash(i, 22);
          m.position.set(caster.x, caster.y + 0.02, caster.z); m.rotation.y = hash(i, 23) * Math.PI * 2; m.scale.set(len, 1, wid);
          (m.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - post * post); m.visible = build > 0.01 && post < 1;
        });
        bits.forEach((s, i) => {   // clods lift off the cracks through the build-up, hang, then drop back
          const a = hash(i, 24) * Math.PI * 2, r = 0.25 + 1.3 * hash(i, 25) * Math.max(0.3, build), rise = (0.15 + 0.75 * hash(i, 26)) * build * (1 - post);
          s.position.set(caster.x + Math.cos(a) * r, caster.y + 0.05 + rise, caster.z + Math.sin(a) * r);
          s.scale.setScalar(0.07 + 0.1 * hash(i, 27)); (s.material as THREE.SpriteMaterial).opacity = 0.9 * live; s.visible = live > 0.01;
        });
      } else if (kind === 'surtr') {
        const scorch = flat[0]; scorch.position.set(caster.x, caster.y + 0.02, caster.z); scorch.scale.setScalar(0.2 + 1.6 * build);
        (scorch.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - post); scorch.visible = build > 0.01 && post < 1;
        bits.forEach((s, i) => {   // ash flakes fall over the whole arena, thickening: flake i only shows once the build passes its own threshold
          const fall = (t * (0.35 + 0.25 * hash(i, 31)) + hash(i, 32)) % 1, spread = 2.4;
          s.position.set(half + (hash(i, 33) - 0.5) * spread * 2 + Math.sin(t + i) * 0.1, caster.y + 3 * (1 - fall), halfZ + (hash(i, 34) - 0.5) * spread * 2);
          s.scale.setScalar(0.05 + 0.07 * hash(i, 35)); const on = clamp01(build * 1.4 - hash(i, 36) * 0.4);
          (s.material as THREE.SpriteMaterial).opacity = 0.8 * on * (1 - post * post); s.visible = on > 0.01 && post < 1;
        });
      } else {
        bits.forEach((s, i) => {   // a gale from behind the caster toward the target: sand streaks run along the line and slide off to one side
          const span = gap + 3, along = (t * (1.4 + 0.8 * hash(i, 41)) * 2 + hash(i, 42) * span) % span, lateral = (hash(i, 43) - 0.5) * 3.2;
          s.position.set(caster.x - dir.x * 1.5 + dir.x * along - dir.z * lateral, caster.y + 0.05 + 0.9 * hash(i, 44), caster.z - dir.z * 1.5 + dir.z * along + dir.x * lateral);
          s.scale.setScalar(0.1 + 0.12 * hash(i, 45)); (s.material as THREE.SpriteMaterial).opacity = 0.6 * live; s.visible = live > 0.01;
        });
      }
    },
    clear() { cast = null; hide(); },
  };
}
