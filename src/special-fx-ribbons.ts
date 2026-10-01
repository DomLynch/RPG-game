import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, castPhase, LAND_AT, type Cast } from './special-timing.ts';
import type { WindStyle } from './special-look.ts';

// Red Wind, v7: three directions after Dom's verdict on v6 ("a manufacturing-plant circular piece of plastic", 2026-10-01). No cylinder and no
// code-drawn lines: BROAD painted ribbons and sheets, each a different length, width, curl and opacity, with torn, streaked edges, grey-white with
// a darker core, semi-transparent, and a little grit lifted off the floor. The sprites are painted procedurally here (fbm-torn edges, streaks
// along the stroke), six variants shared by the three looks. ?special=set&wind=a|b|c picks the look; the cast timeline is the claw's, the one 120.
//   a  ground burst:    radial streaks at the target's feet and broad sheets peeling up and over him like a wave breaking
//   b  spiral updraft:  four wide uneven ribbons winding up round him, tilted, gapped, tops tearing into wisps, a ring of lifted sand
//   c  wind wall:       two soft vertical sheets sweep through him from the caster's side, wisps and a drift trailing behind
// Presentation only: the sim's events and the target's feet in, never Math.random (every "random" is an index hash), no lights, no shadows.
const hash = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (k: number) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const cell = (x: number, y: number, seed: number) => hash(x * 127 + y * 311, seed);
const noise = (x: number, y: number, seed: number) => {   // 2-D value noise
  const ix = Math.floor(x), iy = Math.floor(y), kx = smooth(x - ix), ky = smooth(y - iy);
  return lerp(lerp(cell(ix, iy, seed), cell(ix + 1, iy, seed), kx), lerp(cell(ix, iy + 1, seed), cell(ix + 1, iy + 1, seed), kx), ky);
};
const fbm = (x: number, y: number, seed: number) => noise(x, y, seed) * 0.55 + noise(x * 2.1, y * 2.1, seed + 7) * 0.3 + noise(x * 4.3, y * 4.3, seed + 13) * 0.15;
const CAP = 0.8;   // semi-transparent: the fighter stays readable through every look

// One painted stroke: x runs across its width, y along its length. Alpha = a torn-edged band (the edges wander and fray), streaked along the
// length, soft at its head and torn away at its tail; colour = the dark core of the stroke into the light dusty rim, streaks darker than the rest.
function paintSheet(seed: number, look: SandLook, wide = false) {
  const w = 64, h = 192, px = new Uint8Array(w * h * 4), core = look.core, edge = look.edge;
  const width = wide ? 1.15 + 0.25 * hash(seed, 1) : 0.4 + 0.35 * hash(seed, 1), centre = 0.5 + 0.12 * (hash(seed, 2) - 0.5), wobble = 0.1 + 0.18 * hash(seed, 3);
  for (let y = 0; y < h; y++) {
    const l = y / (h - 1);
    const c = centre + (fbm(l * 3, seed, seed) - 0.5) * wobble * 2, half = width * (0.5 + 0.35 * fbm(l * 4, seed + 5, seed)) * (1 - 0.35 * l);
    for (let x = 0; x < w; x++) {
      const a = x / (w - 1), d = Math.abs(a - c) / half;   // 0 at the spine, 1 at the nominal edge
      const frayed = d + (noise(a * 18, l * 26, seed + 3) - 0.5) * 0.7;   // torn: the edge is pushed in and out by fine noise
      const body = smooth((1 - frayed) * 2.2);
      const streak = 0.3 + 0.7 * smooth(fbm(a * 22, l * 2.4, seed + 9) * 1.5 - 0.15);   // streaks along the stroke
      const head = smooth(l / 0.1), tail = smooth((1 - l) * 2.4 - 0.55 * noise(a * 9, l * 9, seed + 11));   // soft head, ragged tail
      const alpha = Math.min(1, body * streak * head * tail * 1.15);
      const dark = Math.min(1, smooth(1 - d) * (0.55 + 0.45 * streak) * 1.3), r = lerp(edge.r, core.r, dark), g = lerp(edge.g, core.g, dark), b = lerp(edge.b, core.b, dark);
      px.set([Math.min(255, r * 255), Math.min(255, g * 255), Math.min(255, b * 255), alpha * 255], (y * w + x) * 4);
    }
  }
  const map = new THREE.DataTexture(px, w, h); map.magFilter = map.minFilter = THREE.LinearFilter; map.needsUpdate = true;
  return map;
}
function softDot() {
  const n = 16, px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const d = Math.hypot(x - 7.5, y - 7.5) / 8; px.set([255, 255, 255, 255 * smooth(1 - d)], (y * n + x) * 4); }
  const map = new THREE.DataTexture(px, n, n); map.needsUpdate = true; return map;
}

type P3 = [number, number, number];
// A grid surface over (along 0..1, across 0..1): the geometry of one stroke. UV: x across, y along, matching paintSheet.
function surface(fn: (l: number, a: number) => P3, nl = 18, na = 4) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= nl; i++) for (let j = 0; j <= na; j++) { const l = i / nl, a = j / na; pos.push(...fn(l, a)); uv.push(a, l); }
  for (let i = 0; i < nl; i++) for (let j = 0; j < na; j++) { const k = i * (na + 1) + j; idx.push(k, k + 1, k + na + 1, k + 1, k + na + 2, k + na + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
type Piece = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; i: number };
const GRIT = 80, GATHER_TICKS = 30;

// One ground streak of the burst, different on every cast (`seed` is the cast's start tick, so it is a pure function of the sim: no Math.random). Uneven
// angles, one of three lengths, a slight curve either way; a couple of streaks are dropped (the gaps) by `streakGap`.
const LENGTHS = [[0.8, 1.15], [1.6, 2.0], [2.6, 3.2]] as const;
const streakGap = (i: number, seed: number) => i === Math.floor(hash(seed, 101) * 11) || i === Math.floor(hash(seed, 102) * 11) || (hash(seed, 103) < 0.5 && i === Math.floor(hash(seed, 104) * 11));
function streakGeometry(i: number, seed: number) {
  const h = (salt: number) => hash(i + seed * 13, salt), spacing = (Math.PI * 2) / 11;
  const th = i * spacing + (h(131) - 0.5) * spacing * 1.7 + hash(seed, 105) * Math.PI * 2;   // the whole star is turned by the cast, each streak off its slot
  const [lo, hi] = LENGTHS[Math.min(2, Math.floor(h(132) * 3))], len = lerp(lo, hi, h(133)), wid = 0.4 + 0.6 * h(134), r0 = 0.22, bend = (h(135) - 0.5) * 1.1;
  return surface((l, a) => {
    const rad = r0 + l * len, ang = th + bend * l * l, across = (a - 0.5) * wid * (1 - 0.5 * l);
    return [Math.cos(ang) * rad - Math.sin(ang) * across, 0.03 + 0.07 * l * h(136), Math.sin(ang) * rad + Math.cos(ang) * across];
  }, 14, 3);
}

// The look is the lazy chunk's own: the two colours of sandLook() in special-fx-wind.ts (not imported, so nothing pulls that chunk in early).
type SandLook = { core: THREE.Color; edge: THREE.Color };
export function createRibbonWind(scene: THREE.Scene, opponent: OpponentId, look: SandLook, style: WindStyle) {
  const root = new THREE.Group(); root.name = 'special fx'; root.visible = false; scene.add(root);
  const sprites = Array.from({ length: 6 }, (_, s) => paintSheet(s * 5 + 2, look)), broad = Array.from({ length: 3 }, (_, s) => paintSheet(s * 7 + 40, look, true));   // broad: a stroke that fills its sprite (sheets, walls)
  const pieces: Piece[] = [];
  const add = (g: THREE.BufferGeometry, sprite: number, name: string, wide = false) => {
    const mat = new THREE.MeshBasicMaterial({ map: wide ? broad[sprite % broad.length] : sprites[sprite % sprites.length], transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: true });
    const mesh = new THREE.Mesh(g, mat); mesh.name = name; mesh.frustumCulled = false; root.add(mesh);
    const p = { mesh, mat, i: pieces.length }; pieces.push(p); return p;
  };
  const grit = new Float32Array(GRIT * 3).fill(-9), gritGeo = new THREE.BufferGeometry();
  gritGeo.setAttribute('position', new THREE.BufferAttribute(grit, 3).setUsage(THREE.DynamicDrawUsage));
  const gritMat = new THREE.PointsMaterial({ size: 0.05, sizeAttenuation: true, map: softDot(), color: look.edge.clone().multiplyScalar(0.8), transparent: true, opacity: 0, depthWrite: false, fog: true });
  const gritPoints = new THREE.Points(gritGeo, gritMat); gritPoints.name = 'wind grit'; gritPoints.frustumCulled = false; root.add(gritPoints);

  // ---- a: ground burst ----------------------------------------------------------------------------------------------------------------------
  const streakA: Piece[] = [], sheetA: Piece[] = [], sheetAngle: number[] = [];
  if (style === 'a') {
    for (let i = 0; i < 11; i++) streakA.push(add(streakGeometry(i, 0), i, 'wind streak'));
    for (let j = 0; j < 4; j++) {
      const phi = 0.5 + j * 1.55 + 0.6 * hash(j, 41), R = 1 + 0.35 * hash(j, 42), H = 1.5 + 0.8 * hash(j, 43), wid = 1.1 + 0.7 * hash(j, 44);
      const g = surface((l, a) => {
        const arc = l * Math.PI * 0.62, rad = R * (0.35 + 0.65 * Math.cos(arc)), y = H * Math.sin(arc), across = (a - 0.5) * wid * (0.6 + 0.8 * l);
        return [Math.cos(phi) * rad - Math.sin(phi) * across, y, Math.sin(phi) * rad + Math.cos(phi) * across];
      }, 20, 4);
      sheetA.push(add(g, j, 'wind sheet', true)); sheetAngle.push(phi);
    }
  }
  // ---- b: spiral updraft ----------------------------------------------------------------------------------------------------------------------
  const ribbonB: { p: Piece; speed: number; height: number }[] = [], ringB: Piece[] = [];
  if (style === 'b') {
    const spec = [{ R: 0.55, W: 0.62, turns: 1.5, H: 2.3, lean: 0.12 }, { R: 0.78, W: 0.4, turns: 1.2, H: 2.0, lean: -0.1 }, { R: 0.45, W: 0.38, turns: 1.7, H: 2.5, lean: 0.06 }, { R: 0.66, W: 0.18, turns: 1.3, H: 1.8, lean: -0.14 }];
    spec.forEach((s, j) => {
      const th0 = j * 1.7 + hash(j, 51), tilt = 0.45 + 0.4 * hash(j, 52);
      const g = surface((l, a) => {
        const th = th0 + s.turns * Math.PI * 2 * l, radius = s.R * (0.8 + 0.4 * l), y = l * s.H, side = (a - 0.5) * s.W * (1 - 0.45 * l);
        const cx = Math.cos(th), sz = Math.sin(th), rx = cx * tilt, rz = sz * tilt, up = Math.sqrt(Math.max(0, 1 - tilt * tilt));   // the ribbon's width leans between radial and up
        return [cx * radius + rx * side + s.lean * y, y + up * side, sz * radius + rz * side - s.lean * 0.6 * y];
      }, 28, 4);
      ribbonB.push({ p: add(g, j, 'wind ribbon'), speed: 0.8 + 0.5 * hash(j, 53), height: s.H });
    });
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * Math.PI * 2 + 0.3 * hash(k, 61), arcLen = 0.7 + 0.5 * hash(k, 62), R = 0.85 + 0.3 * hash(k, 63), wid = 0.12 + 0.2 * hash(k, 64);
      const g = surface((l, a) => { const th = a0 + arcLen * l, rad = R + (a - 0.5) * wid; return [Math.cos(th) * rad, 0.05 + 0.35 * l * (0.4 + hash(k, 65)) + 0.12 * (a - 0.5), Math.sin(th) * rad]; }, 12, 4);
      ringB.push(add(g, k + 1, 'wind ring'));
    }
  }
  // ---- c: wind wall ---------------------------------------------------------------------------------------------------------------------------
  const wallC: { p: Piece; delay: number }[] = [], wispC: Piece[] = [];
  if (style === 'c') {
    [{ W: 2.2, H: 1.7, d: 0 }, { W: 1.8, H: 1.5, d: 5 }].forEach((s, j) => {
      const g = surface((l, a) => {   // l across (the streaks run side to side), a up; bowed, the top leaning back. The wall crosses sideways, so the camera sees its whole face.
        const x = (l - 0.5) * s.W, y = a * s.H;
        return [x + 0.1 * Math.sin(a * 3 + j), y, 0.3 * Math.sin(l * Math.PI) * (1 - 0.4 * a) - 0.18 * a * a + (j ? 0.12 : 0)];
      }, 20, 8);
      wallC.push({ p: add(g, j, 'wind wall', true), delay: s.d });
    });
    for (let k = 0; k < 3; k++) {
      const y0 = 0.3 + 0.55 * k, x0 = (hash(k, 71) - 0.5) * 0.9, len = 0.9 + 0.5 * hash(k, 72), wid = 0.5 + 0.3 * hash(k, 73);
      const g = surface((l, a) => [x0 + 0.12 * Math.sin(l * 4 + k * 2), y0 + (a - 0.5) * wid + 0.08 * Math.sin(l * 5 + k), l * len], 16, 3);
      wispC.push(add(g, k + 1, 'wind wisp'));
    }
  }

  const foot = new THREE.Vector3(), dir = new THREE.Vector3(1, 0, 0);
  let cast: Cast | null = null, clock = 0, lastTick = -1, haveFoot = false;
  const hide = () => { for (const p of pieces) p.mat.opacity = 0; gritMat.opacity = 0; };
  const setPiece = (p: Piece, opacity: number, sx = 1, sy = 1, sz = 1) => { p.mat.opacity = clamp01(opacity) * CAP; p.mesh.scale.set(sx, sy, sz); p.mesh.visible = opacity > 0.01; };
  const setGrit = (fn: (i: number, out: P3) => void, opacity: number) => {
    const o: P3 = [0, 0, 0];
    for (let i = 0; i < GRIT; i++) { fn(i, o); grit[i * 3] = o[0]; grit[i * 3 + 1] = o[1]; grit[i * 3 + 2] = o[2]; }
    (gritGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true; gritMat.opacity = clamp01(opacity);
  };

  return {
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, feet: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean) {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;
      const before = cast;
      cast = advanceCast(cast, events, fighters, tick, opponent, yielding);
      if (!before && cast && style === 'a') streakA.forEach((s, i) => { s.mesh.geometry.dispose(); s.mesh.geometry = streakGeometry(i, cast!.start); });
      const target = cast ? feet[1 - cast.actor] : null, caster = cast ? feet[cast.actor] : null;
      if (target) { foot.copy(target); haveFoot = true; }
      if (target && caster) { dir.set(target.x - caster.x, 0, target.z - caster.z); if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.set(1, 0, 0); }
      root.visible = !!cast && haveFoot;
      if (!cast || !haveFoot) { hide(); return; }
      const p = castPhase(cast, clock);
      const shown = p.phase === 'dissolve' ? castPhase({ ...cast, fizzled: null }, cast.fizzled!) : p, settle = p.phase === 'dissolve' ? smooth(p.k) : 0;
      const ra = p.phase === 'recover' ? p.age : -1;   // ticks since the release
      const wp = ra >= 0 ? 1 : clamp01(shown.age / LAND_AT), t = clock / 60, fade = 1 - settle;
      root.position.copy(foot); root.rotation.y = Math.atan2(-dir.z, dir.x);   // local +x points from the caster at the target
      const rel = ra >= 0 ? ra : -1;

      if (style === 'a') {
        const burst = rel >= 0 ? smooth(rel / 22) : 0, life = rel >= 0 ? 1 - smooth((rel - 18) / 30) : 1;   // the snap in 0.37 s, gone by ~0.8 s
        const gather = smooth(shown.age / GATHER_TICKS);   // the streaks snap onto the sand in ~0.5 s and hold there (Dom: the build-up was 1-2 s, too slow)
        streakA.forEach((s, i) => {
          const wind = lerp(0.2, 0.45, gather) + (rel >= 0 ? 0 : 0.04 * Math.sin(t * 3 + i)), ext = rel >= 0 ? lerp(0.5, 1.15, burst) : wind;
          setPiece(s, streakGap(i, cast!.start) ? 0 : (rel >= 0 ? lerp(0.5, 0.95, burst) * life : lerp(0.15, 0.5, gather)) * fade, ext, 1, ext);
        });
        sheetA.forEach((s, j) => {
          const rise = rel >= 0 ? smooth((rel - j * 1.5) / 16) : 0, scale = 0.5 + 0.5 * rise;
          setPiece(s, rise * life * fade * (0.75 + 0.25 * hash(j, 81)), scale, 0.15 + 0.85 * rise, scale);
          s.mesh.rotation.y = hash(j, 82) * 0.3 * rise;
        });
        setGrit((i, o) => {
          const th = hash(i, 91) * Math.PI * 2, r = (0.25 + 1.6 * hash(i, 92)) * (rel >= 0 ? 0.4 + burst : 0.3 + 0.2 * wp), fall = rel >= 0 ? Math.max(0, rel - 6) / 60 : 0;
          o[0] = Math.cos(th) * r; o[1] = 0.05 + (rel >= 0 ? burst * (0.2 + 1.1 * hash(i, 93)) - 7 * fall * fall * (0.5 + hash(i, 94)) : 0.08 * hash(i, 93)); o[2] = Math.sin(th) * r; if (o[1] < 0.02) o[1] = 0.02;
        }, (rel >= 0 ? life : 0.35 * wp) * fade);
      } else if (style === 'b') {
        const grow = rel >= 0 ? 1 : smooth(wp * 1.25), speed = rel >= 0 ? 4.2 : lerp(0.9, 2.4, wp), away = rel >= 0 ? smooth(rel / 36) : 0, life = rel >= 0 ? 1 - smooth((rel - 10) / 34) : 1;
        ribbonB.forEach((r, j) => {
          r.p.mesh.rotation.y = t * speed * r.speed * 1.4 + j; r.p.mesh.rotation.x = 0; r.p.mesh.rotation.z = 0.05 * (j - 1.5);
          const g = grow * (0.35 + 0.65 * smooth((wp * 1.4 - j * 0.14))) * (1 + 0.25 * away);
          setPiece(r.p, (0.2 + 0.7 * wp) * life * fade * (j === 3 ? 0.8 : 1), (1 + 0.3 * away) * (0.7 + 0.3 * g), Math.max(0.05, g), (1 + 0.3 * away) * (0.7 + 0.3 * g));
        });
        ringB.forEach((r, k) => { r.mesh.rotation.y = t * speed * (0.5 + 0.1 * k); setPiece(r, (0.25 + 0.6 * wp) * life * fade, 1 + 0.35 * away, 1, 1 + 0.35 * away); });
        setGrit((i, o) => {
          const th = hash(i, 91) * Math.PI * 2 + t * speed * (0.8 + 0.5 * hash(i, 95)), r = 0.5 + 0.7 * hash(i, 92), h = ((hash(i, 93) + t * 0.5 * speed * 0.3) % 1) * (0.5 + 1.8 * wp) * (1 + away);
          o[0] = Math.cos(th) * r; o[1] = 0.05 + h; o[2] = Math.sin(th) * r;
        }, (0.3 + 0.5 * wp) * life * fade);
      } else {
        const sweep = rel >= 0 ? rel : -1, build = rel >= 0 ? 1 : smooth(wp * 1.2);
        wallC.forEach((w, j) => {
          const k = sweep >= 0 ? smooth((sweep - w.delay) / 18) : 0, z = lerp(-1.6, 1.6, k) + (sweep >= 0 ? 0 : 0.06 * Math.sin(t * 2 + j) - 0.9 * build), life = sweep >= 0 ? 1 - smooth((sweep - 14 - w.delay) / 26) : 1;
          w.p.mesh.position.set(0, 0, z); w.p.mesh.rotation.y = 0.1 * (j ? -1 : 1);
          setPiece(w.p, (sweep >= 0 ? 0.9 : 0.45 * build) * life * fade, 1, 0.55 + 0.45 * build, 1 + 0.15 * k);
        });
        wispC.forEach((w, k) => {
          const a = sweep >= 0 ? smooth((sweep - 8 - k * 3) / 14) : 0, life = sweep >= 0 ? 1 - smooth((sweep - 20 - k * 3) / 30) : 1;
          w.mesh.position.set(0, 0, lerp(-1.7, -0.2, a)); setPiece(w, (sweep >= 0 ? 0.8 : 0) * a * life * fade, 1, 1, 1);
        });
        setGrit((i, o) => {
          const along = sweep >= 0 ? sweep / 60 : 0, z = -1.6 + 3.0 * hash(i, 92) + (sweep >= 0 ? 1.0 * along * (0.6 + hash(i, 96)) : 0.15 * Math.sin(t + i));
          o[0] = (hash(i, 97) - 0.5) * 1.6; o[1] = 0.04 + (sweep >= 0 ? 0.25 + 1.1 * hash(i, 93) * smooth(sweep / 14) : 0.1 * hash(i, 93)) - (sweep > 20 ? 0.8 * ((sweep - 20) / 60) ** 2 * hash(i, 94) : 0); if (o[1] < 0.02) o[1] = 0.02;
          o[2] = z;
        }, (sweep >= 0 ? 1 - smooth((sweep - 24) / 36) : 0.3 * build) * fade);
      }
    },
    clear() { cast = null; haveFoot = false; root.visible = false; hide(); },
  };
}
