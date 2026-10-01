import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import type { BossSpecial } from './special-look.ts';
import { advanceCast, LAND_AT, shadowPhase, type Cast } from './special-timing.ts';
import { BUILD, BUILD_AT, isBossCast, slingAngle } from './special-boss-timing.ts';

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

// The boss specials at ranks 8-10 for the Witch, the Plague Doctor and the Knight (Multi Chars; Dom approved the nine on 2026-10-01; presentation-only grey-boxes,
// one ?special= page each, in the Centurion brief's rules: unblockable ~2 s wind-up, a ~0.5 s visible build-up, one clean idea, no props, painted and irregular, no glow).
// Same seam as Red Wind and the Shield Quake (special-timing.ts): every effect reads the sim's special events and each side's feet, never the sim or Math.random
// (every "random" is an index hash). The build-up is the BUILD ticks before the landing; the aftermath is the 45 recover ticks.
export type Boss = ReturnType<typeof createBossSpecial>;
type Feet = readonly [THREE.Vector3 | null, THREE.Vector3 | null];
// What an effect is given: the caster's and the target's feet and heads (the heads are null while a rig loads, or when the page passes none).
type Where = { from: THREE.Vector3; to: THREE.Vector3; fromHead: THREE.Vector3 | null; toHead: THREE.Vector3 | null };
// Where the cast is: `build` 0..1 across the visible build-up, `rel` ticks since the landing (-1 before it), `life` 1 -> 0 across the recover (a fizzle fades it the same way).
type Stage = { build: number; rel: number; life: number };
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

// The Witch, rank 8, Morgan le Fay: Avalon mist. Pale cold mist gathers off the arena's edge, drifts in along the ground, thickens round the target's
// legs and closes tight on the landing, then thins away. Low (knees and below), semi-transparent, so both fighters stay readable.
const MIST = 26;
function avalonMist(root: THREE.Group, dim: boolean): Effect {
  const tints: [number, number, number][] = dim ? [[170, 176, 184], [140, 148, 160]] : [[198, 202, 206], [168, 176, 186]];
  const maps = [0, 1, 2, 3].map((k) => softBlob(k * 13 + 2, tints[k % 2]));
  const puffs = Array.from({ length: MIST }, (_, i) => sprite(maps[i % maps.length], root, 'mist'));
  return {
    update(s, { to }) {
      const close = smooth(s.build), hold = s.rel < 0 ? 1 : s.life, tight = s.rel >= 0 ? smooth(s.rel / 8) : 0;
      puffs.forEach((p, i) => {
        const a = hash(i, 1) * Math.PI * 2, start = 2.6 + 1.6 * hash(i, 2), end = 0.22 + 0.5 * hash(i, 3), r = lerp(start, end, close) * (1 - 0.45 * tight);
        const size = (0.7 + 0.6 * hash(i, 5)) * (0.7 + 0.5 * close + 0.3 * tight);   // the centre sits half its size off the floor, so the floor never slices the puff flat
        p.position.set(to.x + Math.cos(a + (1 - close) * 0.8) * r, to.y + size * 0.5 + 0.1 * hash(i, 4) + 0.1 * tight, to.z + Math.sin(a + (1 - close) * 0.8) * r); p.scale.setScalar(size);
        show(p, 0.34 * close * hold * (0.6 + 0.4 * hash(i, 6)));
      });
    },
    hide() { puffs.forEach((p) => (p.visible = false)); },
  };
}

// The Witch, rank 9, Merlin: Foretold step. For the last ~0.38 s (under Strategy's 0.4 s) a pale, painted ghost of the target slides on ahead of him along the lane,
// where she means to strike, and as the blow lands he arrives into it and the ghost is gone. A smear, not a copy of the rig: the ghost's true-rig version is the upgrade if Dom likes it.
const GHOST = 23;   // ticks the ghost lives, ending on the landing
function foretoldStep(root: THREE.Group, dim: boolean): Effect {
  const ghost = sprite(softBlob(31, dim ? [196, 206, 220] : [214, 222, 232], true), root, 'ghost'), echo = sprite(softBlob(37, dim ? [150, 162, 180] : [170, 182, 198], true), root, 'ghost trail');
  const dir = new THREE.Vector3();
  return {
    update(s, { from, to }) {
      const k = clamp01((s.build * BUILD - (BUILD - GHOST)) / GHOST);   // 0..1 over the last GHOST ticks before the landing
      dir.copy(from).sub(to).setY(0).normalize();   // toward her: he steps in to meet the blow
      const gone = s.rel >= 0 ? 0 : 1;
      for (const [g, lag, alpha] of [[ghost, 0, 0.4], [echo, 0.4, 0.22]] as const) {
        const along = lerp(0, 0.9, smooth(k)) * (1 - lag);
        g.position.set(to.x + dir.x * along + dir.z * 0.12 * lag, to.y + 0.95, to.z + dir.z * along - dir.x * 0.12 * lag); g.scale.set(0.9, 2, 1);
        show(g, alpha * smooth(k * 2.5) * gone * (1 - smooth((k - 0.85) / 0.15)));
      }
    },
    hide() { ghost.visible = false; echo.visible = false; },
  };
}

// The Witch, rank 10, Odin: the price. She shuts one eye; the arena's colour drains to grey-brown for a beat (the canvas's own saturation: not darkness, which is the
// Nightborn's), one strike, the colour comes back. The sound's drop is Audio's (the cue seam); this is the picture. The cost to measure: a CSS filter on the canvas.
function thePrice(canvas: HTMLElement | undefined): Effect {
  const set = (value: string) => { try { if (canvas) canvas.style.filter = value; } catch { /* a canvas with no style (a test double) */ } };
  return {
    update(s) {
      const amount = s.rel < 0 ? smooth(s.build) : s.life;   // holds ~0.17 s past the strike, then the colour returns over the recover
      set(amount > 0.01 ? `saturate(${(1 - 0.88 * amount).toFixed(3)}) sepia(${(0.25 * amount).toFixed(3)}) contrast(${(1 + 0.08 * amount).toFixed(3)})` : '');
    },
    hide() { set(''); },
  };
}

// The Plague Doctor, rank 8, Apollo: plague flies. A swarm of small dark specks lifts off the sand round him, streams across the arena at the target in a loose,
// uneven cloud, and settles on him as the blow lands, then thins and drops away. Specks, not an object: no two fly the same line.
const FLIES = 110;
function plagueFlies(root: THREE.Group, dim: boolean): Effect {
  const pos = new Float32Array(FLIES * 3).fill(-9), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.PointsMaterial({ size: 0.075, sizeAttenuation: true, map: softDot(), color: dim ? '#9a937c' : '#17140e', transparent: true, opacity: 0, depthWrite: false, fog: true });
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
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true; mat.opacity = clamp01(s.build * 4) * (s.rel < 0 ? 1 : s.life) * 0.9;
    },
    hide() { mat.opacity = 0; pos.fill(-9); (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true; },
  };
}

// The Plague Doctor, rank 9, Hecate: the poison stain. A dark, wet-looking blotch spreads outward under the target like ink in cloth: flat on the sand, three
// overlapping stains of their own shapes and speeds, no burst and nothing rising. When it completes his legs give (the scene's head-hit dip) and she is already striking.
function poisonStain(root: THREE.Group, dim: boolean): Effect {
  const rgb: [number, number, number] = dim ? [96, 100, 52] : [34, 38, 18];
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
        const op = 0.9 * (s.rel < 0 ? smooth(s.build * 3 - 0.1 * k) : s.life); (m.material as THREE.MeshBasicMaterial).opacity = clamp01(op); m.visible = op > 0.01;
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
    const a = smooth((1 - r) * 2.6) * (0.8 + 0.2 * fbm(x * 0.1, y * 0.1, seed + 9)), wet = smooth(fbm(u * 7, v * 7, seed + 21) * 2 - 1.15) * 0.35 * smooth(0.8 - r), core = 0.55 + 0.45 * smooth(r * 1.2);
    px.set([Math.min(255, rgb[0] * core + 200 * wet), Math.min(255, rgb[1] * core + 205 * wet), Math.min(255, rgb[2] * core + 190 * wet), Math.min(1, a) * 255], (y * n + x) * 4);
  }
  const map = new THREE.DataTexture(px, n, n); map.magFilter = map.minFilter = THREE.LinearFilter; map.needsUpdate = true; return map;
}

// The Plague Doctor, rank 10, Resheph: the last breath. A dark wisp is drawn out of the target's mouth and streams across the arena into the beak, thick at the
// target and thinning toward him; the target sags as it goes (the scene's dip on the landing), one strike, and the wisp ends in the beak.
const WISP = 18;
function lastBreath(root: THREE.Group, dim: boolean): Effect {
  const maps = [0, 1, 2].map((k) => softBlob(k * 19 + 9, dim ? [150, 150, 164] : [28, 26, 34]));
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
        p.scale.setScalar((0.5 - 0.3 * t) * (0.8 + 0.4 * hash(i, 2)) * (1 + 0.15 * s.build));
        show(p, (at <= draw + 0.02 ? 0.8 : 0) * (1 - out * smooth((at - 0.3) / 0.7)) * (s.rel < 0 ? 1 : s.life) * (0.6 + 0.4 * hash(i, 3)));
      });
    },
    hide() { puffs.forEach((p) => (p.visible = false)); },
  };
}

// The Knight, rank 8, Hector: the sling. He whirls the maul in one flat circle; the sand and dust of the floor draw into a spinning ring of torn ribbons round him,
// and he steps out of it into the blow. The turn itself is the scene's (special-timing.ts slingAngle on his heading); this is the ring, which keeps pace with it.
const RING = 18;
function theSling(root: THREE.Group, dim: boolean): Effect {
  const maps = [0, 1, 2].map((k) => softBlob(k * 29 + 3, dim ? [92, 62, 40] : [128, 92, 58])), ring = new THREE.Group(); root.add(ring);
  const puffs = Array.from({ length: RING }, (_, i) => sprite(maps[i % 3], ring, 'ring'));
  return {
    update(s, { from }) {
      ring.position.copy(from); const turn = -slingAngle(BUILD_AT + s.build * BUILD) * 1.4 - (s.rel >= 0 ? s.rel * 0.12 : 0), grow = 0.55 + 0.45 * smooth(s.build) + 0.5 * (s.rel >= 0 ? smooth(s.rel / 20) : 0);
      puffs.forEach((p, i) => {   // dust drawn off the floor into a ring of torn puffs that climbs as it turns
        const th = (i / RING) * Math.PI * 2 + hash(i, 1) * 0.4 + turn, r = (0.95 + 0.4 * hash(i, 2)) * grow;
        const size = (0.55 + 0.5 * hash(i, 4)) * (0.6 + 0.6 * smooth(s.build));
        p.position.set(Math.cos(th) * r, size * 0.5 + 0.05 + 0.4 * hash(i, 3) * smooth(s.build), Math.sin(th) * r); p.scale.setScalar(size);
        show(p, 0.7 * smooth(s.build * 2.2) * (s.rel < 0 ? 1 : s.life) * (0.6 + 0.4 * hash(i, 5)));
      });
    },
    hide() { puffs.forEach((p) => (p.visible = false)); },
  };
}

// The Knight, rank 9, Achilles: wrath. The air round him wavers and shakes, tightening onto him like a held breath, then one blow. Grey-box: pale wavering veils (no
// light) and the scene's tremor on his body; a true screen-space distortion would need a copy of the frame, which is the cost to decide on once Dom has seen this.
const VEILS = 12;
function wrathHaze(root: THREE.Group, dim: boolean): Effect {
  const maps = [0, 1].map((k) => softBlob(k * 23 + 6, dim ? [200, 196, 186] : [226, 220, 206], true));
  const veils = Array.from({ length: VEILS }, (_, i) => sprite(maps[i % 2], root, 'haze'));
  let t = 0;
  return {
    update(s, { from }, dt) {
      t += dt;
      const tight = smooth(s.build), out = s.rel >= 0 ? smooth(s.rel / 14) : 0;
      veils.forEach((v, i) => {
        const a = (i / VEILS) * Math.PI * 2 + hash(i, 1), r = lerp(1.1, 0.42, tight) * (1 + 0.9 * out) + Math.sin(t * 9 + i * 1.9) * 0.05 * tight;
        v.position.set(from.x + Math.cos(a) * r, from.y + 1.05 + Math.sin(t * 6 + i) * 0.06, from.z + Math.sin(a) * r); v.scale.set(0.75 + 0.3 * hash(i, 2), 2.5 + 0.4 * Math.sin(t * 7 + i * 2.3) * tight, 1);
        show(v, 0.22 * smooth(s.build * 2) * (s.rel < 0 ? 1 : s.life) * (0.7 + 0.3 * hash(i, 3)));
      });
    },
    hide() { veils.forEach((v) => (v.visible = false)); },
  };
}

// The Knight, rank 10, Thor: the storm follows him. Wind-driven slanted rain sweeps in from the side across both fighters (not a column on the head: that is the
// Nightborn's cloud), streaks of every length, falling at an angle; it thins out through the recover. The crack's sound is Audio's cue.
const DROPS = 260;
function stormFollows(root: THREE.Group, dim: boolean): Effect {
  const pos = new Float32Array(DROPS * 6), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.LineBasicMaterial({ color: dim ? '#b4c0d4' : '#d4dce4', transparent: true, opacity: 0, depthWrite: false, fog: true });
  const rain = new THREE.LineSegments(geo, mat); rain.name = 'rain'; rain.frustumCulled = false; root.add(rain);
  let t = 0; const slant = new THREE.Vector3(0.55, -1, 0.12).normalize();
  return {
    update(s, { from, to }, dt) {
      t += dt; const cx = (from.x + to.x) / 2, cz = (from.z + to.z) / 2, top = 3.4;
      for (let i = 0; i < DROPS; i++) {
        const len = 0.25 + 0.35 * hash(i, 3), speed = 5 + 3 * hash(i, 4), fall = (((hash(i, 1) * top - t * speed) % top) + top) % top, x = cx + (hash(i, 2) - 0.5) * 7 - 1.2, z = cz + (hash(i, 5) - 0.5) * 3.2;
        const sx = x + (top - fall) * 0.55, y = fall;   // down and along: the slant's own line
        pos.set([sx, y, z, sx + slant.x * len, y + slant.y * len, z + slant.z * len], i * 6);
      }
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true; mat.opacity = 0.75 * smooth(s.build * 2.2) * (s.rel < 0 ? 1 : s.life);
    },
    hide() { mat.opacity = 0; },
  };
}

export function createBossSpecial(scene: THREE.Scene, opponent: OpponentId, kind: BossSpecial, exposure: number, canvas?: HTMLElement) {
  const root = new THREE.Group(); root.name = 'special fx'; root.visible = false; scene.add(root);
  const dim = exposure > 1.5;   // the Night Pit
  const effect = ({ mist: () => avalonMist(root, dim), echo: () => foretoldStep(root, dim), price: () => thePrice(canvas), flies: () => plagueFlies(root, dim), stain: () => poisonStain(root, dim), breath: () => lastBreath(root, dim), sling: () => theSling(root, dim), haze: () => wrathHaze(root, dim), storm: () => stormFollows(root, dim) })[kind]();
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
      effect.update({ build: clamp01((age - BUILD_AT) / BUILD) * fade, rel, life: (rel >= 0 ? 1 - smooth((rel - 10) / 35) : 1) * fade }, where, dt);
    },
    clear() { cast = null; have = false; root.visible = false; effect.hide(); },
  };
}
