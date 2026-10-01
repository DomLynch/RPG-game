import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, LAND_AT, shadowPhase, type Cast } from './special-timing.ts';
import { BUILD, BUILD_AT, isBossCast, type BossKind } from './special-boss-timing.ts';

const hash = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const smooth = (k: number) => { const c = clamp01(k); return c * c * (3 - 2 * c); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const noise = (x: number, y: number, seed: number) => {   // 2-D value noise
  const ix = Math.floor(x), iy = Math.floor(y), kx = smooth(x - ix), ky = smooth(y - iy), cell = (cx: number, cy: number) => hash(cx * 127 + cy * 311, seed);
  return lerp(lerp(cell(ix, iy), cell(ix + 1, iy), kx), lerp(cell(ix, iy + 1), cell(ix + 1, iy + 1), kx), ky);
};
const fbm = (x: number, y: number, seed: number) => noise(x, y, seed) * 0.55 + noise(x * 2.1, y * 2.1, seed + 7) * 0.3 + noise(x * 4.3, y * 4.3, seed + 13) * 0.15;
function softDot() {
  const n = 16, px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) px.set([255, 255, 255, 255 * smooth(1 - Math.hypot(x - 7.5, y - 7.5) / 8)], (y * n + x) * 4);
  const map = new THREE.DataTexture(px, n, n); map.needsUpdate = true; return map;
}

// The boss specials at ranks 8-10 for the Plague Doctor (Multi Chars; Dom approved the nine on 2026-10-01; presentation-only grey-boxes,
// one ?special= page each, in the Centurion brief's rules: unblockable ~2 s wind-up, a ~0.5 s visible build-up, one clean idea, no props, painted and irregular, no glow).
// Same seam as Red Wind and the Shield Quake (special-timing.ts): every effect reads the sim's special events and each side's feet, never the sim or Math.random
// (every "random" is an index hash). The build-up is the BUILD ticks before the landing; the aftermath is the 45 recover ticks.
export type Boss = ReturnType<typeof createBossSpecial>;
type Feet = readonly [THREE.Vector3 | null, THREE.Vector3 | null];
// What an effect is given: the caster's and the target's feet and heads (the heads are null while a rig loads, or when the page passes none).
type Where = { from: THREE.Vector3; to: THREE.Vector3; fromHead: THREE.Vector3 | null; toHead: THREE.Vector3 | null; targetAnchor?: THREE.Object3D };
// Where the cast is: `build` 0..1 across the visible build-up, `rel` ticks since the landing (-1 before it), `life` 1 -> 0 across the recover (a fizzle fades it the same way).
type Stage = { build: number; rel: number; life: number; wind: number };   // `wind`: 0..1 over the whole 2 s wind-up (and 1 after the landing)
type Effect = { update(s: Stage, w: Where, dt: number): void; hide(): void };

// A soft torn blob: alpha falls off from a wandering, noise-bitten rim and reaches nothing at the sprite's own edge. `tall` stretches it into a smear.
function softBlob(seed: number, rgb: readonly [number, number, number], tall = false) {
  const n = 64, px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x - 31.5) / 31.5, v = (y - 31.5) / 31.5, r = Math.hypot(u, tall ? v * 0.55 : v) + (fbm(u * 2.4 + 5, v * 2.4 + 5, seed) - 0.5) * 0.9;
    const a = smooth((1 - r) * 1.7) * (0.55 + 0.45 * fbm(x * 0.2, y * 0.2, seed + 3)) * smooth((1 - Math.max(Math.abs(u), Math.abs(v))) * 4), k = 0.8 + 0.2 * fbm(x * 0.15, y * 0.15, seed + 8);
    px.set([rgb[0] * k, rgb[1] * k, rgb[2] * k, Math.min(1, a) * 255], (y * n + x) * 4);
  }
  const map = new THREE.DataTexture(px, n, n); map.magFilter = map.minFilter = THREE.LinearFilter; map.needsUpdate = true; return map;
}
const sprite = (map: THREE.Texture, parent: THREE.Object3D, name: string) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false, fog: true })); s.name = name; s.visible = false; parent.add(s); return s;
};
const show = (s: THREE.Sprite, opacity: number) => { (s.material as THREE.SpriteMaterial).opacity = clamp01(opacity); s.visible = opacity > 0.01; };

// The Plague Doctor, rank 8, Apollo: plague flies. A swarm of small dark specks lifts off the sand round him, streams across the arena at the target in a loose,
// uneven cloud, and settles on him as the blow lands, then thins and drops away. Specks, not an object: no two fly the same line.
const FLIES = 280;
function plagueFlies(root: THREE.Group, dim: boolean): Effect {
  const pos = new Float32Array(FLIES * 3).fill(-9), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.PointsMaterial({ size: 0.11, sizeAttenuation: true, map: softDot(), color: dim ? '#9a937c' : '#0f0d09', transparent: true, opacity: 0, depthWrite: false, fog: true });
  const points = new THREE.Points(geo, mat); points.name = 'flies'; points.frustumCulled = false; root.add(points);
  return {
    update(s, { from, to }) {
      for (let i = 0; i < FLIES; i++) {
        const lift = smooth(s.build * 3), go = clamp01(s.build * 1.35 - 0.35 * hash(i, 1)), settle = s.rel >= 0 ? smooth(s.rel / 16) : 0, scatter = s.rel >= 0 ? smooth((s.rel - 8) / 37) : 0;
        const t = smooth(go), jx = (hash(i, 2) - 0.5) * 0.9, jz = (hash(i, 3) - 0.5) * 0.9, h = 0.2 + 1.3 * hash(i, 4);
        const wob = Math.sin(i * 1.7 + t * 11 + s.rel * 0.5) * 0.18 * (1 - 0.6 * settle), arc = Math.sin(t * Math.PI) * (0.25 + 0.6 * hash(i, 5));
        const swirl = i * 2.4 + s.build * 6 + Math.max(0, s.rel) * 0.35, around = (0.2 + 0.35 * hash(i, 6)) * settle;
        pos[i * 3] = lerp(from.x + jx * 0.5, to.x + jx * 0.4, t) + wob + Math.cos(swirl) * around + scatter * (hash(i, 7) - 0.5) * 2.2;
        pos[i * 3 + 1] = to.y + lerp(0.02, h, t) * (0.2 + 0.8 * lift) + arc - scatter * h * 0.9;
        pos[i * 3 + 2] = lerp(from.z + jz * 0.5, to.z + jz * 0.4, t) + wob * 0.6 + Math.sin(swirl) * around + scatter * (hash(i, 9) - 0.5) * 2.2;
      }
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true; mat.opacity = clamp01(s.build * 4) * (s.rel < 0 ? 1 : s.life) * 0.7;
    },
    hide() { mat.opacity = 0; pos.fill(-9); (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true; },
  };
}

// The Plague Doctor, rank 9, Hecate: the poison stain. A dark, wet-looking blotch spreads outward under the target like ink in cloth: flat on the sand, three
// overlapping stains of their own shapes and speeds, no burst and nothing rising. When it completes his legs give (the scene's head-hit dip) and she is already striking.
function poisonStain(root: THREE.Group, dim: boolean): Effect {
  const rgb: [number, number, number] = dim ? [50, 54, 24] : [30, 34, 14];
  const stains = [0, 1, 2].map((k) => {
    const mat = new THREE.MeshBasicMaterial({ map: stainTexture(k * 17 + 5, rgb), transparent: true, opacity: 0, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2 - k, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat); mesh.name = 'stain'; mesh.visible = false; mesh.position.y = 0.025 + 0.004 * k; mesh.rotation.y = k * 2.1; root.add(mesh); return mesh;
  });
  const reach = [1.05, 1.5, 0.8];
  return {
    update(s, { to }) {
      stains.forEach((m, k) => {
        const grow = smooth(clamp01(s.build * (1.1 - 0.1 * k) - 0.12 * k)), size = reach[k] * 2 * (0.12 + 0.88 * grow);
        m.position.x = to.x + (k - 1) * 0.12; m.position.z = to.z + (1 - k) * 0.1; m.scale.set(size, 1, size);
        const op = 0.7 * (s.rel < 0 ? smooth(s.build * 3 - 0.1 * k) : s.life); (m.material as THREE.MeshBasicMaterial).opacity = clamp01(op); m.visible = op > 0.01;
      });
    },
    hide() { stains.forEach((m) => (m.visible = false)); },
  };
}
// A wet blot: a noise-bitten rim, a darker core, and a few pale glossy flecks where the sand has not drunk it yet.
function stainTexture(seed: number, rgb: readonly [number, number, number]) {
  const n = 128, px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x - 63.5) / 63.5, v = (y - 63.5) / 63.5, r = Math.hypot(u, v) + (fbm(u * 2.2 + 3, v * 2.2 + 3, seed) - 0.5) * 0.85 + (fbm(u * 6, v * 6, seed + 4) - 0.5) * 0.25;
    const a = smooth((1 - r) * 2.6) * (0.8 + 0.2 * fbm(x * 0.1, y * 0.1, seed + 9)), wet = smooth(fbm(u * 7, v * 7, seed + 21) * 2 - 1.15) * 0.18 * smooth(0.8 - r), core = 0.55 + 0.45 * smooth(r * 1.2);
    px.set([Math.min(255, rgb[0] * core + 200 * wet), Math.min(255, rgb[1] * core + 205 * wet), Math.min(255, rgb[2] * core + 190 * wet), Math.min(1, a) * 255], (y * n + x) * 4);
  }
  const map = new THREE.DataTexture(px, n, n); map.magFilter = map.minFilter = THREE.LinearFilter; map.needsUpdate = true; return map;
}

// The Plague Doctor, rank 10, Resheph: the last breath. A dark wisp is drawn out of the target's mouth and streams across the arena into the beak, thick at the
// target and thinning toward him; the target sags as it goes (the scene's dip on the landing), one strike, and the wisp ends in the beak.
const WISP = 30;
function lastBreath(root: THREE.Group, dim: boolean): Effect {
  const maps = [0, 1, 2].map((k) => softBlob(k * 19 + 9, dim ? [92, 90, 100] : [8, 7, 10]));
  const puffs = Array.from({ length: WISP }, (_, i) => sprite(maps[i % maps.length], root, 'wisp'));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), m = new THREE.Vector3();
  return {
    update(s, { from, to, fromHead, toHead }) {
      a.copy(toHead ?? to.clone().setY(to.y + 1.5)); b.copy(fromHead ?? from.clone().setY(from.y + 1.6));
      m.copy(a).add(b).multiplyScalar(0.5); m.y += 0.35;   // the wisp rises in a loose arc between the two mouths
      const draw = s.rel < 0 ? smooth(s.build * 1.15) : 1, out = s.rel >= 0 ? smooth((s.rel - 6) / 30) : 0;   // how far along the path the wisp's head has got; after the landing its tail catches up
      puffs.forEach((p, i) => {
        const at = (i + 0.5) / WISP, t = clamp01(lerp(at * draw, at, out) + (hash(i, 1) - 0.5) * 0.04), w = (1 - t) * (1 - t), w1 = 2 * (1 - t) * t, w2 = t * t;
        const curl = Math.sin(t * 9 + i) * 0.12 * (1 - 0.5 * t);
        p.position.set(w * a.x + w1 * m.x + w2 * b.x + curl, w * a.y + w1 * m.y + w2 * b.y + Math.cos(t * 7 + i) * 0.08, w * a.z + w1 * m.z + w2 * b.z + curl * 0.6);
        p.scale.setScalar((0.36 - 0.2 * t) * (0.8 + 0.4 * hash(i, 2)) * (1 + 0.15 * s.build));
        show(p, (draw > 0 && at <= draw ? 0.7 : 0) * (1 - out * smooth((at - 0.3) / 0.7)) * (s.rel < 0 ? 1 : s.life) * (0.6 + 0.4 * hash(i, 3)));
      });
    },
    hide() { puffs.forEach((p) => (p.visible = false)); },
  };
}

export function createBossSpecial(scene: THREE.Scene, opponent: OpponentId, kind: BossKind, exposure: number) {
  const root = new THREE.Group(); root.name = 'special fx'; root.visible = false; scene.add(root);
  const dim = exposure > 1.5;   // the Night Pit
  const effect = ({ flies: () => plagueFlies(root, dim), stain: () => poisonStain(root, dim), breath: () => lastBreath(root, dim) })[kind]();
  const from = new THREE.Vector3(), to = new THREE.Vector3(), fromHead = new THREE.Vector3(), toHead = new THREE.Vector3(), where: Where = { from, to, fromHead: null, toHead: null };
  let cast: Cast | null = null, clock = 0, lastTick = -1, have = false;
  return {
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, feet: Feet, yielding: boolean, heads?: Feet) {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;
      cast = advanceCast(cast, events, fighters, tick, opponent, yielding, isBossCast);
      const a = cast ? feet[cast.actor] : null, b = cast ? feet[1 - cast.actor] : null;
      if (a && b) { from.copy(a); to.copy(b); have = true; }
      const ha = cast ? heads?.[cast.actor] : null, hb = cast ? heads?.[1 - cast.actor] : null;
      where.fromHead = ha ? fromHead.copy(ha) : null; where.toHead = hb ? toHead.copy(hb) : null;
      root.visible = !!cast && have;
      if (!cast || !have) { effect.hide(); return; }
      const p = shadowPhase(cast, clock), frozen = p.phase === 'dissolve' ? shadowPhase({ ...cast, fizzled: null }, cast.fizzled!) : p;
      const rel = p.phase === 'recover' ? p.age : -1, age = rel >= 0 ? LAND_AT + rel : frozen.age;
      const fade = p.phase === 'dissolve' ? 1 - smooth(p.k) : 1;   // a fizzle lets it go where it hangs
      effect.update({ build: clamp01((age - BUILD_AT) / BUILD) * fade, wind: clamp01(age / LAND_AT) * fade, rel, life: (rel >= 0 ? 1 - smooth((rel - 10) / 35) : 1) * fade }, where, dt);
    },
    clear() { cast = null; have = false; root.visible = false; effect.hide(); },
  };
}
