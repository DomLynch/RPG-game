// Dom 2026-10-06 (via Lead): the combat-feel burst reads "thick and square, cartoony". Two PREVIEW options behind a flag, nothing changes by default:
//   ?blood=a  STREAKS: thin droplets stretched along their flight (length 3-5x width), random sizes, fewer, darker red fading to near-black.
//   ?blood=b  SPRAY + DROPS: a fine mist of many tiny specks plus a few heavier drops that arc down; sizes, speeds and lives random per particle.
//   ?blood=b3 b2, 35% thinner, 20% longer strands (stretch x1.85 on the thinner width), 15% darker red (Dom 2026-10-06: "more thin, longer strands.. still oval shaped"); counts, timing and speeds as b2.
//   ?blood=b4 b3 revised (Dom 2026-10-06): spray x0.9 (counts), width x0.9, strand length x1.2, colours x0.9; timing and speeds exactly b3.
//   ?blood=b2 the same spray, 30% less thick (Dom 2026-10-06: "a bit thick"): 0.7x the particles, 0.7x the size, same colour, timing and speeds.
// Presentation only (nothing here is read by the simulation) and allocation-free per hit: it fills the same pooled slots armfeel-fx.ts already owns,
// with a seeded generator, so the same fight draws the same blood on every run (the preview clips compare like with like).
import type { Feel, Particle } from './armfeel.ts';

export type Blood = 'a' | 'b' | 'b2' | 'b3' | 'b4';
export const bloodFrom = (search: string): Blood | undefined => { const v = new URLSearchParams(search).get('blood'); return v === 'a' || v === 'b' || v === 'b2' || v === 'b3' || v === 'b4' ? v : undefined; };

// slots: the pool's size; hit/kill: how many particles a hit/kill takes (Low takes a third, at least 2); start/end: the blood's colour over a life.
export const BLOOD = {
  a: { slots: 48, hit: 6, kill: 10, start: '#74100f', end: '#120303' },
  b: { slots: 112, hit: 24, kill: 40, start: '#8a1411', end: '#2a0706' },
  b2: { slots: 112, hit: 17, kill: 28, start: '#8a1411', end: '#2a0706' },   // 0.7x of b's particles; drops 3/4 -> 2/3, sizes x0.7 (THIN)
  b3: { slots: 112, hit: 17, kill: 28, start: '#75110e', end: '#240605' },   // b2's colours x0.85 (15% darker)
  b4: { slots: 112, hit: 15, kill: 25, start: '#690f0d', end: '#200504' },   // b3 revised (Dom): 10% less spray (counts x0.9), width x0.9, length x1.2, colours x0.9
} as const;
// THIN: width. LONG: the stretch multiplier, so b3's strands are 20% longer than b2's on a 35% narrower width (0.7 x 0.65 of b; 1.2 / 0.65 = 1.85).
const THIN = { b: 1, b2: 0.7, b3: 0.7 * 0.65, b4: 0.7 * 0.65 * 0.9 } as const, LONG = { b: 1, b2: 1, b3: 1.2 / 0.65, b4: 1.2 * 1.2 / (0.65 * 0.9) } as const;   // b4: width x0.9 and LENGTH (width x stretch) x1.2 over b3, so the stretch grows by 1.2/0.9
const DROPS = { b: { hit: 3, kill: 4 }, b2: { hit: 2, kill: 3 }, b3: { hit: 2, kill: 3 }, b4: { hit: 2, kill: 3 } } as const;
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
  const thin = THIN[style], drop = i < DROPS[style][kill ? 'kill' : 'hit'];   // the first few are the heavy drops, the rest the mist
  if (drop) {
    p.life = p.total = between(rnd, 0.5, 0.72); p.size = between(rnd, 0.07, 0.12) * low * thin; p.stretch = between(rnd, 1.1, 1.5) * LONG[style];
    p.vx = Math.cos(a) * between(rnd, 0.3, 1.1) + dx * between(rnd, 0.3, 1.0); p.vz = Math.sin(a) * between(rnd, 0.3, 1.1) + dz * between(rnd, 0.3, 1.0); p.vy = between(rnd, 1.6, 3.0);
  } else {
    p.life = p.total = between(rnd, 0.14, 0.4); p.size = between(rnd, 0.018, 0.05) * low * thin; p.stretch = between(rnd, 1.3, 2.4) * LONG[style];
    const speed = between(rnd, 1.2, 3.6);
    p.vx = Math.cos(a) * speed * 0.6 + dx * between(rnd, 0.5, 2.4); p.vz = Math.sin(a) * speed * 0.6 + dz * between(rnd, 0.5, 2.4); p.vy = between(rnd, 0.2, 2.6);
  }
}
