// The camp kit (?region=1, World lane): what a camp of 2 or 3 looks like, as DATA the mob generator can drop at a point (Expansion asks placeCamp(f, b, at, n, seed)).
// A camp is a fire pit (ring of stones, coals, logs), a seat per member (a log to sit on, or a standing spot facing out), bedrolls, a crate and a barrel, and a soft ground glow
// for the night (an additive disc: no light object, so no shader cost on a phone). Pure: Piece[] + Solid[] + the spots the members take; frontier.ts meshes it through meshPieces.
// Placement is the dressing's own rule (frontier-plan.ts onRoad / inZone / inFirstView / the buildings' solids): placeCamp nudges the point outward until the whole camp fits, or
// returns null. Deterministic per seed; no hand-placed camps.
import { toWorld } from '../world/derive.ts';
import type { Piece, Shape, Tint } from './exchange-plan.ts';
import { footprintOf, rng } from './frontier-dress.ts';
import { frontierZoneAt, inFirstView, onRoad, type Build, type Frontier, type Solid } from './frontier-plan.ts';

export type Spot = { x: number; z: number; facing: number; pose: 'sit' | 'stand' };   // where a member of the camp is; facing in radians (0 = +z), toward the fire for a sitter, out for a lookout
export type Camp = { at: { x: number; z: number }; pieces: Piece[]; solids: Solid[]; spots: Spot[]; glow: { x: number; z: number; radius: number; color: string; opacity: number } };

// The kit as data: every dimension and count the camp is built from.
export const CAMP_KIT = {
  radius: 6,                                          // the clear circle the whole camp needs (metres)
  fire: { stones: 9, ring: 1.0, stone: [0.32, 0.3, 0.42], coal: [0.8, 0.16], logs: 4 },   // stone [w, h, d]; coal [radius, height]
  seat: { ring: 2.9, log: [1.9, 0.5, 0.55], standOut: 4.6 },
  bedroll: [1.0, 0.2, 2.3], crate: [1.0, 0.9, 1.0], barrel: [0.48, 1.1],
  glow: { radius: 6.5, color: '#ff8a3a', opacity: 0.65 },
} as const;
// Warmer and lighter than the ruin rubble (cool grey-brown, 0.55-0.9), so a camp's seats, bedrolls and crate read as a camp at 375.
const WOOD: Tint = [1.15, 0.78, 0.48], BURNT: Tint = [0.16, 0.14, 0.13], CLOTH: Tint[] = [[1.0, 0.32, 0.22], [0.42, 0.62, 0.95], [0.95, 0.8, 0.4]], ROCK: Tint = [1.25, 1.1, 0.95];

// The kit at a point: n members (2 or 3) around the fire. `heading` turns the whole camp; nothing here checks the ground (placeCamp does).
export function campKit(at: { x: number; z: number }, n: 2 | 3, seed: string, heading = 0): Camp {
  const K = CAMP_KIT, R = rng(seed), pieces: Piece[] = [], solids: Solid[] = [], spots: Spot[] = [];
  const at2 = (r: number, a: number) => ({ x: at.x + Math.sin(a + heading) * r, z: at.z + Math.cos(a + heading) * r });
  const put = (layer: Piece['layer'], shape: Shape, x: number, y: number, z: number, tint: Tint, rotY = 0) => { pieces.push({ layer, shape, x, y, z, tint, rotY, foot: 0 }); };
  // The fire: a ring of stones round a bed of coals (the arena's glowing coal layer), a few charred logs across it.
  for (let i = 0; i < K.fire.stones; i++) { const a = (i / K.fire.stones) * Math.PI * 2, p = at2(K.fire.ring, a); put('stone', ['box', ...K.fire.stone], p.x, K.fire.stone[1] / 2, p.z, ROCK, a + heading); }
  put('coal', ['cylinder', K.fire.coal[0], K.fire.coal[0], K.fire.coal[1], 10], at.x, K.fire.coal[1] / 2, at.z, [1, 1, 1]);
  for (let i = 0; i < K.fire.logs; i++) put('soot', ['cylinder', 0.07, 0.07, 1.1, 6], at.x, 0.28 + i * 0.05, at.z, BURNT, (i / K.fire.logs) * Math.PI + R());
  solids.push({ x: at.x, z: at.z, r: K.fire.ring + 0.3 });
  // Members: each sits on a log set tangent to the fire (facing it); a third, if any, stands out as the lookout beside a post.
  const sitters = n === 3 ? 2 : n, start = R() * Math.PI * 2;
  for (let i = 0; i < sitters; i++) {
    const a = start + (i / sitters) * Math.PI * 2 * (sitters === 2 ? 0.55 : 1), p = at2(K.seat.ring, a);
    put('stone', ['box', ...K.seat.log], p.x, K.seat.log[1] / 2, p.z, WOOD, a + heading + Math.PI / 2);
    spots.push({ x: p.x, z: p.z, facing: Math.atan2(at.x - p.x, at.z - p.z), pose: 'sit' });
    solids.push({ x: p.x, z: p.z, r: 0.7 });
  }
  if (n === 3) { const a = start + Math.PI * 1.25, p = at2(K.seat.standOut, a); put('stone', ['box', 0.16, 1.9, 0.16], p.x, 0.95, p.z, BURNT); spots.push({ x: p.x, z: p.z, facing: a + heading, pose: 'stand' }); solids.push({ x: p.x, z: p.z, r: 0.5 }); }
  // Dressing: a bedroll behind each sitter's log, a crate and a barrel by the fire's far side.
  for (let i = 0; i < n; i++) { const s = spots[i]!, back = at2(Math.hypot(s.x - at.x, s.z - at.z) + 1.9, Math.atan2(s.x - at.x, s.z - at.z) - heading); put('stone', ['box', ...K.bedroll], back.x, K.bedroll[1] / 2, back.z, CLOTH[i % CLOTH.length]!, Math.atan2(s.x - at.x, s.z - at.z) + Math.PI / 2); }
  const c = at2(3.6, Math.PI * 0.85 + R() * 0.4); put('stone', ['box', ...K.crate], c.x, K.crate[1] / 2, c.z, WOOD, R() * 3); solids.push({ x: c.x, z: c.z, r: 0.6 });
  const b = at2(3.9, Math.PI * 0.85 + 0.9 + R() * 0.3); put('stone', ['cylinder', K.barrel[0], K.barrel[0], K.barrel[1], 8], b.x, K.barrel[1] / 2, b.z, WOOD); solids.push({ x: b.x, z: b.z, r: 0.45 });
  return { at, pieces, solids, spots, glow: { x: at.x, z: at.z, ...K.glow } };
}

// Drop a camp of n at (or as near as fits to) a point: the point first, then rings of nudges outward. null = no room inside a Frontier zone, off the road, clear of the first view and the buildings.
export function placeCamp(f: Frontier, b: Build, at: { x: number; z: number }, n: 2 | 3, seed: string, others: readonly Camp[] = [], litter: readonly Piece[] = []): Camp | null {
  const r = CAMP_KIT.radius, fits = (x: number, z: number) => !!frontierZoneAt(f, x, z) && [0, 1, 2, 3].every((k) => { const a = k * Math.PI / 2; return !!frontierZoneAt(f, x + Math.sin(a) * r, z + Math.cos(a) * r); })
    && !onRoad(f, x, z) && !inFirstView(f, x, z, r) && !b.solids.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + r) && !others.some((o) => Math.hypot(o.at.x - x, o.at.z - z) < r * 2);
  // The dressing's non-solid rubble (heaps, scrub, low blocks): a camp piece may not stand on one. Only the dressing near the camp is looked at.
  const rubble = (x: number, z: number) => litter.filter((p) => Math.hypot(p.x - x, p.z - z) < r + 4).map(footprintOf);
  const onRubble = (c: Camp, near: readonly Solid[]) => c.pieces.some((p) => { const q = footprintOf(p); return near.some((l) => Math.hypot(l.x - q.x, l.z - q.z) < l.r + q.r); });
  for (let ring = 0; ring <= 8; ring++) for (let k = 0; k < (ring ? 12 : 1); k++) {
    const a = (k / 12) * Math.PI * 2, p = { x: at.x + Math.sin(a) * ring * 3, z: at.z + Math.cos(a) * ring * 3 };
    if (!fits(p.x, p.z)) continue;
    const camp = campKit(p, n, seed, rng(seed + 'h')() * Math.PI * 2);
    if (!onRubble(camp, rubble(p.x, p.z))) return camp;
  }
  return null;
}

// The preview's stand-in for Expansion's generator (?camps): one camp per Frontier zone, a little off its middle, alternating 2 and 3 members.
export function demoCamps(f: Frontier, b: Build, litter: readonly Piece[] = []): Camp[] {
  const camps: Camp[] = [];
  f.zones.filter((z) => z.region.includes('frontier')).forEach((z, i) => {
    const camp = placeCamp(f, b, toWorld({ x: z.width * 0.22, d: z.depth * 0.4 }, z.mount), i % 2 ? 3 : 2, `camp-${z.zone}`, camps, litter); if (camp) camps.push(camp);
  });
  return camps;
}
