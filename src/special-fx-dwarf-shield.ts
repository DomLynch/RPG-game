import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, bossClock, type Cast } from './special-timing.ts';

// The Dwarf's and the Shieldmaiden's rank 8-10 special moves (Character lane, 2026-10-01; PREVIEW ONLY, `?special=dwarf8|dwarf9|dwarf10|shield8|shield9|shield10`).
// Presentation only: it reads the cast's clock and the two fighters' Head bones, never the sim, a rig's root or Math.random (every "random" is an index
// hash, so the same inputs give the same particles). Each move is ONE idea painted out of the arena's own sand and dust: noise-shaped soft puffs for the
// dust, hard little iron flecks for Three Blows' grit, pooled sprites, fog on, depth-tested so the ground dust sits among the legs. No props, no glow.
// Loaded lazily by special-fx.ts only on one of these pages. The cast's clock is special-timing.ts bossClock: `rel` ticks to the landing.
export type DwarfShieldKind = 'dwarf8' | 'dwarf9' | 'dwarf10' | 'shield8' | 'shield9' | 'shield10';
export const DWARF_SHIELD_OPPONENT: Record<DwarfShieldKind, OpponentId> = { dwarf8: 'dwarf', dwarf9: 'dwarf', dwarf10: 'dwarf', shield8: 'shieldmaiden', shield9: 'shieldmaiden', shield10: 'shieldmaiden' };
export const DWARF_SHIELD_KINDS = Object.keys(DWARF_SHIELD_OPPONENT) as DwarfShieldKind[];
// Which cast a boss page draws: the opponent's own special (any move: the page's fight is the boss against the player), the opponent's side only.
export const isDwarfShieldCast = (kind: DwarfShieldKind) => (opponent: OpponentId, actor: number) => opponent === DWARF_SHIELD_OPPONENT[kind] && actor === 1;
export const DUST = 72, GRIT = 48, STRIDE = 8;   // pool sizes; a particle is x, y, z, width, height, rotation, opacity, tone (0..1 along the palette)
export type Field = { dust: Float32Array; grit: Float32Array };
export const makeField = (): Field => ({ dust: new Float32Array(DUST * STRIDE), grit: new Float32Array(GRIT * STRIDE) });
// Where the two fighters stand on the sand (metres), from their Head bones: the caster, the target, the unit line caster -> target and its left-hand perpendicular.
export type Geo = { cx: number; cz: number; tx: number; tz: number; dx: number; dz: number; px: number; pz: number; dist: number; chest: number };
export const makeGeo = (): Geo => ({ cx: 0, cz: 0, tx: 0, tz: 1, dx: 0, dz: 1, px: -1, pz: 0, dist: 1, chest: 1.25 });
export function setGeo(g: Geo, caster: THREE.Vector3, target: THREE.Vector3) {
  g.cx = caster.x; g.cz = caster.z; g.tx = target.x; g.tz = target.z; g.chest = target.y * 0.78;
  const x = g.tx - g.cx, z = g.tz - g.cz; g.dist = Math.hypot(x, z);
  if (g.dist > 0.01) { g.dx = x / g.dist; g.dz = z / g.dist; } else { g.dx = 0; g.dz = 1; }
  g.px = -g.dz; g.pz = g.dx;
}

const hash = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (rel: number, a: number, b: number) => clamp((rel - a) / (b - a));
const smooth = (k: number) => k * k * (3 - 2 * k);
const out = (k: number) => 1 - (1 - k) * (1 - k);   // ease-out
const put = (b: Float32Array, i: number, x: number, y: number, z: number, w: number, h: number, rot: number, a: number, tone: number) => {
  const o = i * STRIDE; b[o] = x; b[o + 1] = y; b[o + 2] = z; b[o + 3] = w; b[o + 4] = h; b[o + 5] = rot; b[o + 6] = a; b[o + 7] = tone;
};
const TAU = Math.PI * 2;

// The moves. Each fills the field from `rel` (ticks to the landing, negative before it); an unwritten particle stays at opacity 0.
// ---- The Word (Dwarf 8): the arena goes still, sand around both lifts a hand-width and hangs; on landing it drops flat in one beat as a ring of dust pressure from him
// that runs out along the floor and settles slowly (a payoff that stays legible for ~1.2 s: BOSS_TAIL).
function theWord(f: Field, rel: number, g: Geo) {
  const lift = 0.1 * out(ramp(rel, -32, -16)), drop = ramp(rel, 0, 3), settle = ramp(rel, 3, 46);
  for (let i = 0; i < 32; i++) {
    const own = i % 2, a = hash(i, 1) * TAU, r = 0.25 + 1.15 * hash(i, 2), size = 0.2 + 0.18 * hash(i, 3);
    const x = (own ? g.tx : g.cx) + Math.cos(a) * r, z = (own ? g.tz : g.cz) + Math.sin(a) * r, spread = 1 + 1.6 * out(ramp(rel, 0, 30));
    const lifted = lift + size * 0.35, y = lifted + (0.03 - lifted) * smooth(drop);
    put(f.dust, i, x, y, z, size * spread, size * (1 - 0.45 * drop), hash(i, 4) * TAU, 0.5 * ramp(rel, -32, -18) * (1 - settle), 0.35 + 0.65 * hash(i, 5));
  }
  const ring = 1 - ramp(rel, 20, 84);
  for (let j = 0; j < 40; j++) {   // the pressure ring: flat puffs running out along the floor from the dwarf, a few metres
    const a = (j / 40) * TAU + (hash(j, 6) - 0.5) * 0.2, R = 0.6 + 3.7 * out(ramp(rel, 0, 44)) + 0.3 * hash(j, 7), w = 0.5 + 0.5 * hash(j, 8) + 0.6 * ramp(rel, 0, 40);
    put(f.dust, 32 + j, g.cx + Math.cos(a) * R, 0.05 + 0.05 * hash(j, 9), g.cz + Math.sin(a) * R, w, w * 0.55, hash(j, 10) * TAU, 0.6 * ramp(rel, 0, 2) * ring, 0.3 + 0.7 * hash(j, 11));
  }
}

// ---- Three Blows (Dwarf 9): three strikes ~0.22 s apart, each STEPPING IN (the strike point advances from the dwarf toward the player), the third on the landing tick ON the
// player: in front of him, between him and the camera, at his feet-front. Each throws a short puff and a spatter of dark iron grit; the grit of the third flies at the camera.
const BLOWS = [-26, -13, 0], BLOW_SIZE = [0.9, 1.15, 2.1], GRIT_AT = [0, 12, 26], GRIT_N = [12, 14, 22], PUFF_N = [6, 6, 12], PUFF_AT = [0, 6, 12];
function threeBlows(f: Field, rel: number, g: Geo) {
  for (let b = 0; b < 3; b++) {
    if (rel < BLOWS[b]) continue;
    const t = (rel - BLOWS[b]) / 60, S = BLOW_SIZE[b], third = b === 2;
    const step = b === 0 ? 0.55 : b === 1 ? 0.55 + 0.45 * Math.max(0, g.dist - 0.8) : g.dist + 0.85;   // metres from the dwarf along the line to the player (the third is past him, toward the camera)
    const ox = g.cx + g.dx * step, oz = g.cz + g.dz * step;
    for (let j = 0; j < PUFF_N[b]; j++) {
      const i = PUFF_AT[b] + j, k = clamp(t / 0.55), a = hash(i, 1) * TAU, sp = (0.35 + 0.5 * hash(i, 2)) * Math.sqrt(S), size = (0.2 + 0.22 * hash(i, 3)) * S * (1 + 1.5 * k);
      put(f.dust, i, ox + Math.cos(a) * sp * t * 2 + g.dx * 0.1, 0.1 + 0.16 * S * k + 0.06 * hash(i, 4), oz + Math.sin(a) * sp * t * 2 + g.dz * 0.1, size, size * 0.8, hash(i, 5) * TAU, 0.6 * ramp(t, 0, 0.04) * (1 - k) ** 1.2, 0.1 + 0.6 * hash(i, 6));
    }
    for (let j = 0; j < GRIT_N[b]; j++) {
      const i = GRIT_AT[b] + j, base = Math.atan2(g.dz, g.dx), a = base + (hash(i, 7) - 0.5) * (third ? 3.0 : 2.0), sp = (1.1 + 2.5 * hash(i, 8)) * Math.sqrt(S), up = (1.5 + 2.3 * hash(i, 9)) * Math.sqrt(S);
      const y = 0.05 + up * t - 4.9 * t * t, rest = y <= 0.015, tt = rest ? Math.sqrt(Math.max(0, 0.05 + up * up / 19.6) / 4.9) + up / 9.8 : t;   // lands and lies where it fell
      const air = Math.min(t, tt), size = (0.13 + 0.11 * hash(i, 10)) * (third ? 1.5 : 1.1);
      put(f.grit, i, ox + Math.cos(a) * sp * air, rest ? 0.02 : y, oz + Math.sin(a) * sp * air, size, size * (0.7 + 0.5 * hash(i, 11)), hash(i, 12) * TAU, 0.95 * (1 - ramp(t, 0.45, 0.95)), hash(i, 13));
    }
  }
}

// ---- Rim Shake (Dwarf 10): his uneven stamps each throw a shock ring of dust along the floor from his feet, each wider than the last; sand jumps up around the arena rim
// through the build; on the landing tick one big stamp runs a ring out from him and puffs at the target. The arena is centred on the origin; its wall stands at 11.7 m.
function rimShake(f: Field, rel: number, g: Geo) {
  const STAMPS = [-38, -25, -10], REACH = [1.5, 2.2, 3.0];
  for (let s = 0; s < 3; s++) {
    if (rel < STAMPS[s]) continue;
    const k = ramp(rel, STAMPS[s], STAMPS[s] + 26);
    for (let j = 0; j < 12; j++) {
      const i = s * 12 + j, a = (j / 12) * TAU + (hash(i, 1) - 0.5) * 0.4, R = 0.3 + REACH[s] * out(k) + 0.2 * hash(i, 2), w = (0.34 + 0.3 * hash(i, 3)) * (1 + 0.8 * k);
      put(f.dust, i, g.cx + Math.cos(a) * R, 0.05 + 0.04 * hash(i, 4), g.cz + Math.sin(a) * R, w, w * 0.55, hash(i, 5) * TAU, 0.5 * ramp(rel, STAMPS[s], STAMPS[s] + 2) * (1 - k) ** 1.1, 0.25 + 0.75 * hash(i, 6));
    }
  }
  const fade = 1 - ramp(rel, 20, 74);
  for (let j = 0; j < 16; j++) {   // the landing stamp: a ring running out from the dwarf, a few metres, flat and slow to settle
    const i = 36 + j, a = (j / 16) * TAU + (hash(i, 7) - 0.5) * 0.3, R = 0.6 + 3.8 * out(ramp(rel, 0, 40)) + 0.3 * hash(i, 8), w = 0.55 + 0.5 * hash(i, 9) + 0.5 * ramp(rel, 0, 36);
    if (rel >= 0) put(f.dust, i, g.cx + Math.cos(a) * R, 0.06, g.cz + Math.sin(a) * R, w, w * 0.55, hash(i, 10) * TAU, 0.55 * ramp(rel, 0, 2) * fade, 0.3 + 0.7 * hash(i, 11));
  }
  if (rel >= 0) for (let j = 0; j < 8; j++) {   // ...and the stamp's puff at the target
    const i = 52 + j, k = ramp(rel, 0, 34), a = (j / 8) * TAU + hash(i, 12) * 0.6, r = 0.2 + 0.9 * out(k), size = 0.3 + 0.3 * hash(i, 13);
    put(f.dust, i, g.tx + Math.cos(a) * r, 0.08 + 0.2 * k, g.tz + Math.sin(a) * r, size * (1 + k), size * 0.85, hash(i, 14) * TAU, 0.55 * ramp(rel, 0, 1.5) * (1 - k) ** 1.2, 0.3 + 0.7 * hash(i, 15));
  }
  for (let i = 0; i < 12; i++) {   // sand jumping off the rim: a big soft puff leaps and falls back, staggered through the build and on through the stamp
    const a = hash(i, 16) * TAU, rho = 8.4 + 2.4 * hash(i, 17), start = -44 + 60 * hash(i, 18), k = ramp(rel, start, start + 34), size = 0.9 + 0.9 * hash(i, 19);
    put(f.dust, 60 + i, Math.cos(a) * rho, 0.3 + 1.7 * Math.sin(k * Math.PI) + size * 0.2, Math.sin(a) * rho, size * (0.8 + 0.6 * k), size, hash(i, 20) * TAU, 0.5 * Math.sin(Math.min(1, k) * Math.PI) ** 0.8, 0.3 + 0.7 * hash(i, 21));
  }
  for (let i = 0; i < 40; i++) {   // ...and grit thrown up from the same rim
    const a = hash(i, 22) * TAU, rho = 8.2 + 2.8 * hash(i, 23), start = -44 + 62 * hash(i, 24), t = Math.max(0, (rel - start) / 60), up = 2.4 + 2.4 * hash(i, 25), y = 0.1 + up * t - 4.9 * t * t, size = 0.1 + 0.09 * hash(i, 26);
    if (rel >= start && y > 0.02) put(f.grit, i, Math.cos(a) * rho * (1 - 0.1 * t), y, Math.sin(a) * rho * (1 - 0.1 * t), size, size * 1.4, hash(i, 27) * TAU, 0.9, hash(i, 28));
  }
}

// ---- Bared Face (Shieldmaiden 8): the arena goes still, dust hangs low and motionless around both; on the landing tick one fast ragged cut of dust flies across the
// target at chest height (a thin, slanted streak, thicker at its head than its tail) and hangs, fraying, for a second while the held dust drifts off.
function baredFace(f: Field, rel: number, g: Geo) {
  const clear = ramp(rel, 8, 86);   // the held dust, low and dark now, carries the 72-tick payoff once the cut is gone (<0.4 s)
  for (let i = 0; i < 40; i++) {
    const own = i % 2, a = hash(i, 1) * TAU, r = 0.2 + 1.1 * hash(i, 2), size = 0.2 + 0.22 * hash(i, 3), cut = rel > 0 ? 0.9 * out(ramp(rel, 0, 60)) * (hash(i, 4) < 0.5 ? -1 : 1) : 0;
    put(f.dust, i, (own ? g.tx : g.cx) + Math.cos(a) * r + g.px * cut, 0.2 + 1.2 * hash(i, 5), (own ? g.tz : g.cz) + Math.sin(a) * r + g.pz * cut, size, size * 0.9, hash(i, 6) * TAU, 0.34 * ramp(rel, -32, -12) * (1 - clear), 0.3 + 0.7 * hash(i, 7));
  }
  const head = -1.25 + 2.5 * ramp(rel, 0, 5);
  for (let j = 0; j < 24; j++) {
    const s = -1 + (2 * (j + 0.5 + (hash(j, 8) - 0.5) * 0.6)) / 24, born = 5 * (s + 1) / 2.5;
    if (s > head) continue;
    const age = rel - born, taper = 0.4 + 0.6 * (j / 23), w = (0.24 + 0.18 * hash(j, 9)) * taper * (1 + 0.8 * ramp(age, 0, 40)), drift = 0.5 * out(ramp(age, 0, 70)) * (hash(j, 15) - 0.5);
    put(f.dust, 40 + j, g.tx + g.px * s * 1.05 + g.dx * ((hash(j, 10) - 0.5) * 0.12 + drift), g.chest - 0.24 * s + (hash(j, 11) - 0.5) * 0.12 - 0.15 * ramp(age, 20, 70), g.tz + g.pz * s * 1.05 + g.dz * ((hash(j, 12) - 0.5) * 0.12 + drift), w * 1.5, w * 0.7, 0.2 + 0.2 * hash(j, 13), 0.9 * (1 - ramp(age, 2, 18)), 0.85 + 0.15 * hash(j, 14));
  }
}

// ---- The Ring (Shieldmaiden 9): a ring is drawn on the FLOOR round the pair, in front of them: a thin dark line of ground dust all the way round (it passes at the player's feet-front,
// between him and the camera) with a low pale dust rising off it; on landing it tightens quickly inward and a strike puff lands on the target, then it falls apart. Low and thin,
// so both fighters stay readable.
function theRing(f: Field, rel: number, g: Geo) {
  const mx = (g.cx + g.tx) / 2, mz = (g.cz + g.tz) / 2, R0 = Math.max(g.dist / 2 + 0.95, 1.55), draw = out(ramp(rel, -32, -6)), tight = smooth(ramp(rel, 0, 7)), fall = ramp(rel, 8, 76);
  const a0 = Math.atan2(g.dz, g.dx);   // the line starts behind the pair and runs round to the front
  for (let i = 0; i < 44; i++) {   // the dark line
    const u = i / 44, a = a0 + Math.PI + u * TAU, R = R0 * (1 - 0.28 * tight) * (1 + 0.03 * (hash(i, 1) - 0.5)) + fall * 0.35 * hash(i, 2), on = ramp(draw, u * 0.9, u * 0.9 + 0.1);
    put(f.dust, i, mx + Math.cos(a) * R, 0.04, mz + Math.sin(a) * R, 1.0 + 0.5 * hash(i, 3), 0.42 + 0.16 * hash(i, 4), a + Math.PI / 2, 0.4 * on * (1 - fall) ** 1.1, 0);
  }
  for (let i = 0; i < 16; i++) {   // the dust rising off it
    const u = (i + hash(i, 5)) / 16, a = a0 + Math.PI + u * TAU, R = R0 * (1 - 0.28 * tight) + fall * 0.4 * hash(i, 6), on = ramp(draw, u * 0.9, u * 0.9 + 0.1), w = 0.5 + 0.45 * hash(i, 7);
    put(f.dust, 44 + i, mx + Math.cos(a) * R, (0.12 + 0.3 * hash(i, 8)) * on * (1 - 0.8 * fall) + 0.03, mz + Math.sin(a) * R, w * (1 + 0.3 * fall), w * 0.7, hash(i, 9) * TAU, 0.3 * on * (1 + 0.3 * ramp(rel, -2, 0) * (1 - ramp(rel, 0, 6))) * (1 - fall) ** 1.2, 0.3 + 0.7 * hash(i, 10));
  }
  if (rel >= 0) for (let j = 0; j < 12; j++) {
    const i = 60 + j, k = ramp(rel, 0, 30), a = (j / 12) * TAU + hash(i, 11) * 0.5, r = 0.2 + 0.8 * out(k), size = 0.28 + 0.3 * hash(i, 12);
    put(f.dust, i, g.tx + Math.cos(a) * r, 0.1 + 0.3 * k, g.tz + Math.sin(a) * r, size * (1 + k), size, hash(i, 13) * TAU, 0.55 * ramp(rel, 0, 1.5) * (1 - k) ** 1.2, 0.35 + 0.65 * hash(i, 14));
  }
}

// ---- Aegis Sweep (Shieldmaiden 10): sand lifts at her feet in the build; the shield face snaps forward and a broad ~70 degree fan, up to ~4 m long, is thrown low across the ground
// toward the target like a shaken cloth, sweeping side to side, through him on the landing tick.
function aegisSweep(f: Field, rel: number, g: Geo) {
  for (let i = 0; i < 24; i++) {
    const a = hash(i, 1) * TAU, r = 0.15 + 0.55 * hash(i, 2), size = 0.16 + 0.16 * hash(i, 3), k = out(ramp(rel, -32, -14));
    put(f.dust, i, g.cx + Math.cos(a) * r + g.dx * 0.3, 0.05 + (0.1 + 0.4 * hash(i, 4)) * k, g.cz + Math.sin(a) * r + g.dz * 0.3, size * (0.5 + 0.5 * k), size * (0.5 + 0.5 * k), hash(i, 5) * TAU, 0.42 * ramp(rel, -32, -18) * (1 - ramp(rel, -10, -2)), 0.3 + 0.7 * hash(i, 6));
  }
  const half = (35 * Math.PI) / 180;
  for (let i = 0; i < 48; i++) {
    const u = (i + 0.5 + (hash(i, 7) - 0.5) * 0.8) / 48, phi = -half + 2 * half * u, start = -11 + 6 * u, p = ramp(rel, start, start + 15), R = 1.3 + 2.8 * hash(i, 8);
    const r = R * out(p) + 0.2, size = (0.28 + 0.3 * hash(i, 9)) * (1 + 1.3 * p);
    put(f.dust, 24 + i, g.cx + (Math.cos(phi) * g.dx + Math.sin(phi) * g.px) * r, 0.1 + 0.5 * hash(i, 10) * p + 0.08 * Math.sin(p * 9 + i), g.cz + (Math.cos(phi) * g.dz + Math.sin(phi) * g.pz) * r, size, size * 0.7, hash(i, 11) * TAU, 0.5 * ramp(rel, start, start + 3) * (1 - ramp(rel, start + 9, 32)), 0.35 + 0.65 * hash(i, 12));
  }
}

const EFFECTS: Record<DwarfShieldKind, (f: Field, rel: number, g: Geo) => void> = { dwarf8: theWord, dwarf9: threeBlows, dwarf10: rimShake, shield8: baredFace, shield9: theRing, shield10: aegisSweep };
// Pure: the same kind, `rel` and geometry fill the same particles. `fade` (a fizzle dissolving) scales every opacity.
// What the phone camera needs on top of the painted numbers: how much bigger and how much denser the dust reads. The ceiling is the rule (Dom: cover is the wrong lever, mist must never hide a fighter): 0.7, and The Ring a thin wall at 0.4. Contrast does the reading instead: dark warm puffs and a dark underside (below).
// Strategy's day verdicts (25c1a1e1): a pale wash over the hero fails. `tone` darkens the dust to a grey-brown below the floor's value; `top` (m) keeps a puff under that height, so it never reaches his torso.
const GAIN: Record<DwarfShieldKind, [size: number, alpha: number, cap: number, tone?: number, top?: number]> = { dwarf8: [2.1, 1.7, 0.7], dwarf9: [2.2, 1.8, 0.7, 0.3, 0.6], dwarf10: [2.0, 1.8, 0.7], shield8: [2.0, 1.7, 0.4, 0.3, 0.5], shield9: [2.0, 1.6, 0.4], shield10: [2.0, 1.7, 0.7, 0.3, 0.45] };
export function fillBoss(kind: DwarfShieldKind, f: Field, rel: number, g: Geo, fade = 1) {
  f.dust.fill(0); f.grit.fill(0);
  EFFECTS[kind](f, rel, g);
  const [size, alpha, cap, tone = 1, top = Infinity] = GAIN[kind];
  for (let o = 0; o < f.dust.length; o += STRIDE) {
    f.dust[o + 3] *= size; f.dust[o + 4] = Math.min(f.dust[o + 4] * size, top / 0.9); f.dust[o + 6] = Math.min(cap, f.dust[o + 6] * alpha); f.dust[o + 7] *= tone;
    if (f.dust[o + 6] > 0) f.dust[o + 1] = Math.min(top - f.dust[o + 4] / 2, Math.max(f.dust[o + 1], f.dust[o + 4] * 0.4));   // never sinks into the floor (the sand would slice it flat), never rises past `top`
  }   // a puff never sinks into the floor: the sand would slice it flat along a straight line
  if (fade < 1) for (const b of [f.dust, f.grit]) for (let o = 6; o < b.length; o += STRIDE) b[o] *= fade;
}

// Palettes: warm sand and dust for the puffs, dark iron grey for the grit. Textures are painted once per effect, irregular by hash.
const lerp3 = (stops: string[], n: number) => Array.from({ length: n }, (_, i) => {
  const k = (i / (n - 1)) * (stops.length - 1), a = Math.min(stops.length - 2, Math.floor(k)), c = new THREE.Color(stops[a]).lerp(new THREE.Color(stops[a + 1]), k - a); return c;
});
const SAND = lerp3(['#3d2f1f', '#8f7a56', '#c0a674', '#e2cf9f'], 12), IRON = lerp3(['#1c1b1a', '#363534', '#545352'], 12);
const wobble = (a: number, seed: number) => { let s = 0; for (let k = 1; k <= 4; k++) s += Math.sin(k * a + hash(k, seed) * TAU) / k; return s / 2; };
function paint(size: number, draw: (u: number, v: number, x: number, y: number) => number) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) pixels.set([255, 255, 255, 255 * clamp(draw((x - (size - 1) / 2) / ((size - 1) / 2), (y - (size - 1) / 2) / ((size - 1) / 2), x, y))], (y * size + x) * 4);
  const map = new THREE.DataTexture(pixels, size, size); map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter; return map;
}
const puffTextures = () => [11, 23, 37].map((seed) => paint(64, (u, v, x, y) => {   // an irregular, torn-edged cloud: radius bent by the angle, churned inside, speckled
  const r = Math.hypot(u, v) / (0.72 + 0.26 * wobble(Math.atan2(v, u), seed)), churn = 0.62 + 0.38 * Math.sin(x * 0.37 + seed + Math.sin(y * 0.23 + seed) * 3) * Math.cos(y * 0.29 - x * 0.11);
  return Math.max(0, 1 - r) ** 1.35 * churn * (0.82 + 0.18 * hash(x * 64 + y, seed)) * (1 - smooth(clamp((Math.hypot(u, v) - 0.7) / 0.28)));   // and nothing at the quad's own edge
}));
const fleckTextures = () => [5, 9].map((seed) => paint(16, (u, v) => { const r = Math.hypot(u, v) / (0.55 + 0.4 * wobble(Math.atan2(v, u) * 1.5, seed)); return clamp((1 - r) * 5); }));   // a hard-edged chip, no glow

export type BossFx = ReturnType<typeof createBossFx>;
export function createBossFx(scene: THREE.Scene, opponent: OpponentId, kind: DwarfShieldKind) {
  const is = isDwarfShieldCast(kind);
  let cast: Cast | null = null, clock = 0, lastTick = -1;
  const root = new THREE.Group(); root.name = 'boss special fx'; root.visible = false; scene.add(root);
  const puffs = puffTextures(), flecks = fleckTextures();
  const make = (name: string, i: number, map: THREE.Texture, order: number) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false, depthTest: true, fog: true }));
    s.name = `${name} ${i}`; s.renderOrder = order; s.visible = false; root.add(s); return s;
  };
  const dust = Array.from({ length: DUST }, (_, i) => make('dust', i, puffs[Math.floor(hash(i, 40) * 3) % 3], 5));
  // A thin dark underside under every plume (a second, lower, darker copy of the puff): the contrast that reads dust on sand, where more cover would only hide the fighters.
  const under = dust.map((d, i) => { const s = make('under', i, (d.material as THREE.SpriteMaterial).map!, 4); (s.material as THREE.SpriteMaterial).color.set('#3a2c1b'); return s; });
  const grit = Array.from({ length: GRIT }, (_, i) => make('grit', i, flecks[i % 2], 6));
  const field = makeField(), geo = makeGeo();
  const write = (sprites: THREE.Sprite[], b: Float32Array, palette: THREE.Color[]) => {
    let any = false;
    sprites.forEach((s, i) => {
      const o = i * STRIDE, a = b[o + 6];
      if (a < 0.004) { s.visible = false; return; }
      const m = s.material as THREE.SpriteMaterial;
      s.position.set(b[o], b[o + 1], b[o + 2]); s.scale.set(b[o + 3], b[o + 4], 1); m.rotation = b[o + 5]; m.opacity = Math.min(1, a);
      m.color.copy(palette[Math.min(palette.length - 1, Math.floor(b[o + 7] * palette.length))]); s.visible = any = true;
    });
    return any;
  };
  const writeUnder = (b: Float32Array) => under.forEach((s, i) => {
    const o = i * STRIDE, a = b[o + 6] * 0.55;
    if (a < 0.004) { s.visible = false; return; }
    s.position.set(b[o], b[o + 1] - b[o + 4] * 0.12, b[o + 2]); s.scale.set(b[o + 3] * 0.92, b[o + 4] * 0.8, 1);
    const m = s.material as THREE.SpriteMaterial; m.rotation = b[o + 5]; m.opacity = a; s.visible = true;
  });
  const hide = () => { root.visible = false; for (const s of under) s.visible = false; for (const s of dust) s.visible = false; for (const s of grit) s.visible = false; };
  return {
    // After the poses are final (the registry's render signature): `tick` is the sim tick of this frame, `heads` each side's Head bone (null while a rig loads: nothing is
    // drawn), `yielding` true while a finisher plays (no new cast starts; one in flight finishes).
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, heads: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean) {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;   // smooth between sim ticks, never ahead by more than one
      const next = advanceCast(cast, events, fighters, tick, opponent, yielding, is);
      // The shared timeline ends a landed cast SPECIAL_RECOVER (45) ticks after the strike; a boss payoff runs on to BOSS_TAIL (78), so a cast that has an end keeps its own copy until bossClock says done.
      cast = next ?? (cast && (cast.landed !== null || cast.fizzled !== null) ? cast : null);
      const caster = cast ? heads[cast.actor] : null, target = cast ? heads[1 - cast.actor] : null;
      if (!cast || !caster || !target) { hide(); return; }
      const state = bossClock(cast, clock);
      if (state.done) { cast = null; hide(); return; }
      setGeo(geo, caster, target);
      fillBoss(kind, field, state.struck || cast.fizzled !== null ? state.rel : Math.min(state.rel, -0.5), geo, state.fade);   // the payoff waits for the sim's own SpecialLanded
      const a = write(dust, field.dust, SAND), b = write(grit, field.grit, IRON); writeUnder(field.dust); root.visible = a || b;
    },
    clear() { cast = null; hide(); },
  };
}
