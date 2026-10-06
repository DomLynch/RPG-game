// Dom 2026-10-06 (via Lead): the combat-feel burst reads "thick and square, cartoony". Two PREVIEW options behind a flag, nothing changes by default:
//   ?blood=a  STREAKS: thin droplets stretched along their flight (length 3-5x width), random sizes, fewer, darker red fading to near-black.
//   ?blood=b  SPRAY + DROPS: a fine mist of many tiny specks plus a few heavier drops that arc down; sizes, speeds and lives random per particle.
// Presentation only (nothing here is read by the simulation) and allocation-free per hit: it fills the same pooled slots armfeel-fx.ts already owns,
// with a seeded generator, so the same fight draws the same blood on every run (the preview clips compare like with like).
import type { Feel, Particle } from './armfeel.ts';

export type Blood = 'a' | 'b';
export const bloodFrom = (search: string): Blood | undefined => { const v = new URLSearchParams(search).get('blood'); return v === 'a' || v === 'b' ? v : undefined; };

// slots: the pool's size; hit/kill: how many particles a hit/kill takes (Low takes a third, at least 2); start/end: the blood's colour over a life.
export const BLOOD = {
  a: { slots: 48, hit: 6, kill: 10, start: '#74100f', end: '#120303' },
  b: { slots: 112, hit: 24, kill: 40, start: '#8a1411', end: '#2a0706' },
} as const;
export const bloodCount = (style: Blood, feel: Feel, kill: boolean): number =>
  feel === 'off' ? 0 : Math.max(feel === 'low' ? 2 : 0, Math.round(BLOOD[style][kill ? 'kill' : 'hit'] * (feel === 'low' ? 0.35 : 1)));

// mulberry32: one tiny seeded stream per pool (state is a number, nothing allocated per draw).
export const makeRng = (seed: number) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const between = (rnd: () => number, lo: number, hi: number) => lo + (hi - lo) * rnd();

// Fills slot `p`; (x, y, z) the contact, (dx, dz) the blow's unit direction. Size is the DIAMETER of the unit sphere the pool scales: width = size, length = size x stretch.
export function spawnBlood(style: Blood, p: Particle, i: number, x: number, y: number, z: number, dx: number, dz: number, kill: boolean, feel: Feel, rnd: () => number): void {
  p.x = x; p.y = y; p.z = z;
  const low = feel === 'low' ? 0.7 : 1, a = rnd() * Math.PI * 2;   // no ring: a random bearing each, never evenly spaced
  if (style === 'a') {
    const speed = between(rnd, 0.9, 2.6), size = 0.12 * between(rnd, 0.4, 1.2) * 0.42 * low;   // 0.4-1.2x of the old droplet, then thin
    p.life = p.total = between(rnd, 0.2, 0.46) * (kill ? 1.2 : 1);
    p.vx = Math.cos(a) * speed * 0.7 + dx * between(rnd, 0.6, 1.8); p.vz = Math.sin(a) * speed * 0.7 + dz * between(rnd, 0.6, 1.8); p.vy = between(rnd, 0.7, 2.4);
    p.size = size; p.stretch = between(rnd, 3, 5);
    return;
  }
  const drop = i < (kill ? 4 : 3);   // the first few are the heavy drops, the rest the mist
  if (drop) {
    p.life = p.total = between(rnd, 0.5, 0.72); p.size = between(rnd, 0.07, 0.12) * low; p.stretch = between(rnd, 1.1, 1.5);
    p.vx = Math.cos(a) * between(rnd, 0.3, 1.1) + dx * between(rnd, 0.3, 1.0); p.vz = Math.sin(a) * between(rnd, 0.3, 1.1) + dz * between(rnd, 0.3, 1.0); p.vy = between(rnd, 1.6, 3.0);
  } else {
    p.life = p.total = between(rnd, 0.14, 0.4); p.size = between(rnd, 0.018, 0.05) * low; p.stretch = between(rnd, 1.3, 2.4);
    const speed = between(rnd, 1.2, 3.6);
    p.vx = Math.cos(a) * speed * 0.6 + dx * between(rnd, 0.5, 2.4); p.vz = Math.sin(a) * speed * 0.6 + dz * between(rnd, 0.5, 2.4); p.vy = between(rnd, 0.2, 2.6);
  }
}
