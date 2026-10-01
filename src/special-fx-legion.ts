import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, castPhase, isBloodTithe, LAND_AT, type Cast } from './special-timing.ts';

// The Centurion's class specials for ranks 4-7 (Veteran lane, 2026-10-02; proposal docs/briefs/specials/centurion-class-b-2026-10-02.md, Dom picks). Two
// options beside his Scutum Shove, each a preview-only flag: `?special=hobnail` (Hobnail Line) and `?special=standfast` (Stand Fast), both at rank 5 (level 21).
// Presentation only, in Charge's style (charge-fx.ts): it reads the sim's special events and each side's feet, never the sim, a rig or Math.random (every
// "random" is an index hash), so a frame is a pure function of the clock. Dom's bar: dark ink, nothing pale or glowing. Every mark is DARKER than the floor
// (churned wet sand, scuffed earth), low (knee height at most), semi-transparent, nothing additive, so both fighters stay readable. No prop is added.
export type LegionOption = 'hobnail' | 'standfast';
const hash = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (k: number) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

// A churned blot: a soft disc eaten into by two sine swirls and an uneven rim (Charge's), so each mark is a smear of dirt, not a gradient.
function blot(seed: number) {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x - 31.5) / 31.5, v = (y - 31.5) / 31.5, r = Math.hypot(u, v), a = Math.atan2(v, u);
    // rim <= 0.86: alpha is zero well before the texture's edge, so no sprite quad shows (hobnail-day-v2 had hard rectangle edges round the hero's legs)
    const rim = 0.6 + 0.16 * Math.sin(a * 3 + seed * 2.1) + 0.1 * Math.sin(a * 7 + seed * 5.3), churn = 0.62 + 0.38 * Math.sin(x * 0.31 + Math.sin(y * 0.21 + seed) * 3.1) * Math.cos(y * 0.27 - x * 0.13 + seed * 1.7);
    pixels.set([255, 255, 255, 255 * Math.min(1, Math.max(0, 1 - r / rim) ** 1.3 * churn)], (y * size + x) * 4);
  }
  const map = new THREE.DataTexture(pixels, size, size); map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter;
  return map;
}

const PRINTS = 3, BURST = 14, RING = 26, SCRAPE = 12;
export function createLegionSpecial(scene: THREE.Scene, opponent: OpponentId, option: LegionOption) {
  const root = new THREE.Group(); root.name = 'legion fx'; root.visible = false; scene.add(root);
  const bg = scene.background instanceof THREE.Color ? scene.background : null, night = !!bg && bg.r + bg.g + bg.b < 0.45;
  const ink = night ? ['#43221a', '#4d2a1d'] : ['#1f160b', '#281c0f'];   // the Pit: a dim warm-dark, not black (black is lost on its shadowed clay) and nothing pale   // dark earth, never grey and never lit: the Pit's is clay like its floor
  const tex = [0, 1, 2, 3].map(blot);
  const mark = (i: number) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex[i % 4], color: ink[i % 2], transparent: true, opacity: 0, depthWrite: false, fog: true, rotation: hash(i, 7) * Math.PI * 2 }));
    s.visible = false; s.frustumCulled = false; root.add(s); return s;
  };
  const prints = Array.from({ length: PRINTS * 2 }, (_, i) => mark(i)), scrape = Array.from({ length: SCRAPE }, (_, i) => mark(i + 20)), burst = Array.from({ length: BURST }, (_, i) => mark(i + 40)), ring = Array.from({ length: RING }, (_, i) => mark(i + 80));
  const show = (s: THREE.Sprite, x: number, y: number, z: number, size: number, opacity: number) => {
    s.visible = opacity > 0.004; if (!s.visible) return;
    s.position.set(x, y, z); s.scale.set(size, size * 0.7, 1); (s.material as THREE.SpriteMaterial).opacity = opacity;
  };
  const from = new THREE.Vector3(), to = new THREE.Vector3(), dir = new THREE.Vector3(), side = new THREE.Vector3();
  let cast: Cast | null = null, clock = 0, lastTick = -1, have = false;
  const hide = () => { for (const s of [...prints, ...scrape, ...burst, ...ring]) s.visible = false; };
  const cap = night ? 0.75 : 0.88;   // semi-transparent: ink over sand, both fighters still read

  return {
    // `feet`: each side's feet on the ground (null while a rig loads). `yielding`: true while a finisher plays.
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, feet: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean) {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;
      cast = advanceCast(cast, events, fighters, tick, opponent, yielding, isBloodTithe);   // his Scutum Shove is the cast; the shared test is Blood Tithe's
      const a = cast ? feet[cast.actor] : null, b = cast ? feet[1 - cast.actor] : null;
      if (a && b) { from.copy(a); to.copy(b); have = true; }
      root.visible = !!cast && have;
      if (!cast || !have) { hide(); return; }
      const p = castPhase(cast, clock), frozen = p.phase === 'dissolve' ? castPhase({ ...cast, fizzled: null }, cast.fizzled!) : p, fade = 1 - (p.phase === 'dissolve' ? smooth(p.k) : 0);
      const rel = p.phase === 'recover' ? p.age : -1, age = rel >= 0 ? LAND_AT + rel : frozen.age, after = rel >= 0 ? 1 - smooth((rel - 10) / 40) : 1;   // after: the marks thin through the aftermath
      dir.copy(to).sub(from).setY(0); const gap = Math.max(dir.length(), 0.9); dir.normalize(); side.set(-dir.z, 0, dir.x);
      if (option === 'hobnail') {
        // Three heavy steps toward the foe in the last ~0.9 s of the tell (a hobnailed boot scuff each, with a kick of grit), the third on the strike's beat.
        hide();
        for (let i = 0; i < PRINTS; i++) {
          const at = LAND_AT - 54 + i * 18, born = smooth((age - at) / 5), d = gap * (0.1 + 0.17 * i), lat = (i % 2 ? 1 : -1) * 0.8 + (hash(i, 3) - 0.5) * 0.12;   // wide stance: the hero's body hides anything on the line from the fight camera
          const x = from.x + dir.x * d + side.x * lat, z = from.z + dir.z * d + side.z * lat, kick = Math.max(0, 1 - (age - at) / 14);
          show(prints[i * 2], x, 0.03, z, 1.05 + 0.25 * hash(i, 4), born * cap * after * fade);                 // the print: a flat dark scuff (first look: too small to read past the hero, so wide, dark, and off the line to both sides)
          show(prints[i * 2 + 1], x - dir.x * 0.18, 0.08 + 0.18 * (1 - kick), z - dir.z * 0.18, 0.6 + 0.35 * (1 - kick), age >= at ? kick * 0.8 * cap * fade : 0);   // the heel's kicked crumb, low
        }
        // The scrape: two dark drag lines either side of the line, through the prints, the gladius-side boot dragging between steps; it grows with the last step and thins after the strike.
        const run = smooth((age - (LAND_AT - 54)) / 54);
        for (let i = 0; i < SCRAPE; i++) {
          const f = (Math.floor(i / 2) + 0.5) / (SCRAPE / 2), d = gap * (0.04 + 0.55 * f), lat = (i % 2 ? 1 : -1) * 0.72 + Math.sin(f * 9 + i) * 0.1 + (hash(i, 6) - 0.5) * 0.08;   // two trails, one each side of the line
          show(scrape[i], from.x + dir.x * d + side.x * lat, 0.03, from.z + dir.z * d + side.z * lat, 0.75 + 0.2 * hash(i, 8), f <= run ? 0.85 * cap * after * fade : 0);
        }
        const k = rel >= 0 ? clamp01(rel / 22) : 0;   // the strike: a low dark spray rolls out along the line from the foe's feet and thins
        for (let i = 0; i < BURST; i++) {
          if (rel < 0) { burst[i].visible = false; continue; }
          const reach = (0.2 + hash(i, 11)) * 1.2 * (1 - (1 - k) ** 2), ang = (hash(i, 12) - 0.5) * 2.2;
          show(burst[i], to.x + dir.x * Math.cos(ang) * reach + side.x * Math.sin(ang) * reach, 0.07 + 0.2 * k * hash(i, 13), to.z + dir.z * Math.cos(ang) * reach + side.z * Math.sin(ang) * reach, 0.9 + 0.8 * k, (1 - k) ** 1.1 * 0.9 * cap * fade);
        }
      } else {
        // Stand Fast: for ~1 s a ring of dark dust is drawn IN round his own feet (the braced weight) and held tight; on the strike it is flung out toward the foe in a short fan.
        hide();
        const gather = smooth((age - (LAND_AT - 60)) / 52), fling = rel >= 0 ? clamp01(rel / 24) : 0;
        for (let i = 0; i < RING; i++) {
          const th = (i / RING) * Math.PI * 2 + (hash(i, 21) - 0.5) * 0.5, r = (1.15 - 0.7 * gather) * (0.8 + 0.4 * hash(i, 22)), size = 0.85 + 0.4 * hash(i, 23);
          if (rel < 0) { show(ring[i], from.x + Math.cos(th) * r, 0.04 + 0.05 * gather, from.z + Math.sin(th) * r, size * (0.6 + 0.4 * gather), gather * cap * fade); continue; }
          const reach = (0.3 + 0.7 * hash(i, 24)) * gap * (1 - (1 - fling) ** 2), lat = (hash(i, 25) - 0.5) * 1.1 * fling;   // flung along the line, the fan widening a little
          show(ring[i], from.x + Math.cos(th) * 0.45 * (1 - fling) + dir.x * reach + side.x * lat, 0.05 + 0.18 * Math.sin(fling * Math.PI) * hash(i, 26), from.z + Math.sin(th) * 0.45 * (1 - fling) + dir.z * reach + side.z * lat, size, (1 - fling) ** 0.8 * after * cap * fade);
        }
      }
    },
    clear() { cast = null; have = false; root.visible = false; hide(); },
  };
}
