// The Ash Frontier's dressing (?region=1, World lane): what turns the greybox's flat plane into ground you can read. Worn roads between each zone's ways on,
// scorched and ash-pale patches, rock clusters, broken ruins, burnt posts and fences, dead trees, a charred cart or barrel. Pure data (Piece[] + Solid[], no three.js);
// frontier.ts meshes it through exchange.ts meshPieces. Deterministic: every zone seeds its own PRNG from its id, so a rebuild is the same ground and the test can pin it.
// Presentation only: it adds pieces and walk-blocking circles to a Build, never touches the layout or the world data. Placement keeps clear of every landmark, the
// west road, the way-on roads it lays itself and the buildings frontierBuild already stands.
import { toWorld } from '../world/derive.ts';
import type { Piece, Shape, Tint } from './exchange-plan.ts';
import { inFirstView, inZone, onRoad, roadFrame, type Build, type Frontier, type Solid } from './frontier-plan.ts';

// A prop's footprint on the ground: a circle that holds it at any turn (box: half its diagonal; cylinder and cone: the wider radius). frontier-camp.ts keeps its pieces off the dressing's with this.
export const footprintOf = (p: Piece): Solid => {
  const sh = p.shape, r = sh[0] === 'box' ? Math.hypot(sh[1], sh[3]) / 2 : sh[0] === 'cylinder' ? Math.max(sh[1], sh[2]) : sh[0] === 'cone' ? sh[1] : sh[1];
  return { x: p.x, z: p.z, r };
};

export type Dress = { ground: Piece[]; pieces: Piece[]; solids: Solid[] };   // ground: the slabs, patches and roads on frontier.ts's own dirt material; pieces: props on the arena's stone

export const rng = (seed: string) => {   // mulberry32 over a string hash
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

// Ground decals sit at fixed heights per kind so overlapping ones never fight: ash pale, then the worn road, its ruts, the scorch.
const SLAB = 0.04, TOP = { ash: 0.06, road: 0.075, rut: 0.085, scorch: 0.1 };
const ASHPALE: Tint = [1.45, 1.42, 1.38], SCORCH: Tint = [0.38, 0.34, 0.32], ROAD: Tint = [1.2, 1.12, 1.02], RUT: Tint = [0.7, 0.64, 0.58];
const BURNT: Tint = [0.16, 0.14, 0.13], ROCK: Tint[] = [[0.78, 0.72, 0.66], [0.66, 0.62, 0.6], [0.88, 0.8, 0.7], [0.56, 0.54, 0.54]], WALL: Tint = [0.95, 0.84, 0.7];

export function frontierDress(f: Frontier, b: Build): Dress {
  const pieces: Piece[] = [], ground: Piece[] = [], solids: Solid[] = [];
  const put = (shape: Shape, x: number, y: number, z: number, tint: Tint, rotY = 0, foot = 0) => { pieces.push({ layer: 'stone', shape, x, y, z, tint, rotY, foot }); };
  const lay = (shape: Shape, x: number, y: number, z: number, tint: Tint, rotY = 0) => { ground.push({ layer: 'stone', shape, x, y, z, tint, rotY, foot: -1 }); };
  const decal = (r: number, top: number, x: number, z: number, tint: Tint, rotY = 0) => lay(['cylinder', r, r, top, 14], x, top / 2, z, tint, rotY);

  for (const z of f.zones) {
    if (!z.region.includes('frontier')) continue;
    const R = rng(z.zone), between = (lo: number, hi: number) => lo + (hi - lo) * R();
    const world = (x: number, d: number) => toWorld({ x, d }, z.mount);
    const mid = world(0, z.depth / 2);   // the zone's dirt: one slab over its footprint, on frontier.ts's own ground material
    lay(['box', z.width, SLAB, z.depth], mid.x, SLAB / 2, mid.z, [1, 1, 1], z.mount.heading);
    const lm = Object.values(z.landmarks), keep = [...lm, f.giver.at];
    // The ways on, laid as worn roads: from each link's landmark to the zone's middle, in short wobbling strips with two ruts.
    const hub = world(0, z.depth / 2), strips: { x: number; z: number }[] = [];
    for (const l of z.links) {
      const a = z.landmarks[l.here]; if (!a) continue;
      const dx = hub.x - a.x, dz = hub.z - a.z, len = Math.hypot(dx, dz), n = Math.max(1, Math.round(len / 4)), ux = dx / len, uz = dz / len, rot = Math.atan2(ux, uz);
      for (let i = 0; i <= n; i++) {
        const t = i / n, wob = Math.sin(t * 9 + z.zone.length) * 0.6, x = a.x + dx * t - uz * wob, zz = a.z + dz * t + ux * wob;
        lay(['box', 3.4, TOP.road, len / n + 0.8], x, TOP.road / 2, zz, ROAD, rot); strips.push({ x, z: zz });
        for (const side of [-0.75, 0.75]) lay(['box', 0.2, TOP.rut, len / n + 0.8], x - uz * side, TOP.rut / 2, zz + ux * side, RUT, rot);
      }
    }
    lay(['cylinder', 4.6, 4.6, TOP.road, 18], hub.x, TOP.road / 2, hub.z, ROAD, 0); strips.push(hub);
    // Is this spot free for a prop of radius r: inside the zone, off the road and every landmark, clear of the buildings and each other.
    const placed: Solid[] = [];
    const rd = f.road;
    const free = (x: number, zz: number, r: number, low = false) => inZone(z, x, zz, r + 2)
      && !onRoad(f, x, zz) && (low || !inFirstView(f, x, zz, r)) && !strips.some((s) => Math.hypot(s.x - x, s.z - zz) < r + 3.2)
      && !keep.some((k) => Math.hypot(k.x - x, k.z - zz) < r + 6) && !b.solids.some((s) => Math.hypot(s.x - x, s.z - zz) < s.r + r + 1.5)
      && !placed.some((s) => Math.hypot(s.x - x, s.z - zz) < s.r + r + 0.6);
    const spot = (r: number, want?: (x: number, z: number) => boolean, low = false) => { for (let i = 0; i < 24; i++) { const p = world(between(-z.width / 2, z.width / 2), between(0, z.depth)); if (free(p.x, p.z, r, low) && (!want || want(p.x, p.z))) return p; } return null; };
    const solid = (x: number, zz: number, r: number) => { const s = { x, z: zz, r }; solids.push(s); placed.push(s); };
    const area = z.width * z.depth, nearTown = (x: number, zz: number) => { const c = z.town && z.landmarks[z.town.centre]; return !!c && Math.hypot(c.x - x, c.z - zz) < 24; };

    // Ground: scorched and ash-pale patches (anywhere, over the road too: they sit under it / are not solid).
    for (let i = 0; i < Math.round(area / 90); i++) { const p = world(between(-z.width / 2, z.width / 2), between(0, z.depth)); if (inZone(z, p.x, p.z, 1) && !onRoad(f, p.x, p.z)) decal(between(1.6, 5.5), TOP.ash, p.x, p.z, ASHPALE, between(0, 6)); }
    for (let i = 0; i < Math.round(area / 150); i++) { const p = world(between(-z.width / 2, z.width / 2), between(0, z.depth)); if (inZone(z, p.x, p.z, 1) && !onRoad(f, p.x, p.z) && !strips.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < 2.6)) decal(between(0.8, 3.4), TOP.scorch, p.x, p.z, SCORCH, between(0, 6)); }

    // Rock clusters: tapered five- to seven-sided boulders in a heap, with a basalt shard or two.
    for (let c = 0; c < Math.round(area / 500); c++) {
      const o = spot(3.4); if (!o || nearTown(o.x, o.z)) continue;
      const n = 3 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const ang = R() * 6.28, d = R() * 2.2, r = between(0.45, 1.15), h = r * between(0.9, 1.7), x = o.x + Math.sin(ang) * d, zz = o.z + Math.cos(ang) * d;
        put(['cylinder', r * between(0.35, 0.6), r, h, 5 + Math.floor(R() * 3)], x, h / 2, zz, ROCK[Math.floor(R() * ROCK.length)]!, R() * 6, 0);
        if (r > 0.8) solid(x, zz, r * 0.95);
      }
      if (R() < 0.6) { const x = o.x + between(-1.2, 1.2), zz = o.z + between(-1.2, 1.2), h = between(2.2, 4.2); put(['cone', between(0.5, 0.9), h, 5], x, h / 2, zz, ROCK[3]!, R() * 6, 0); solid(x, zz, 0.7); }
    }

    // Broken ruins: a corner of wall with gaps and different heights, a column stump and rubble.
    for (let c = 0; c < Math.max(1, Math.round(area / 3600)); c++) {
      const o = spot(7); if (!o || nearTown(o.x, o.z)) continue;
      const rot = R() * 3.14, ux = Math.sin(rot), uz = Math.cos(rot);
      for (const base of [rot, rot + Math.PI / 2]) {
        const dx = Math.sin(base), dz = Math.cos(base);
        for (let i = 0; i < 4; i++) {
          if (R() < 0.25) continue;   // a gap in the wall
          const len = between(1.8, 3.2), h = between(0.7, 3.4) * (i === 3 ? 0.5 : 1), t = (i + 0.5) * 3.1, x = o.x + dx * t, zz = o.z + dz * t;
          put(['box', len, h, 0.7], x, h / 2, zz, WALL, base, 0); solid(x, zz, len / 2);
          if (R() < 0.5) put(['box', len * 0.8, 0.12, 0.74], x, h * 0.55, zz, BURNT, base, 0);   // a soot band
        }
      }
      for (let i = 0; i < 2; i++) { const x = o.x + ux * between(-4, 5) - uz * between(1, 5), zz = o.z + uz * between(-4, 5) + ux * between(1, 5), h = between(1.2, 3.6); put(['cylinder', 0.42, 0.5, h, 10], x, h / 2, zz, WALL, 0, 0); solid(x, zz, 0.55); }
      for (let i = 0; i < 12; i++) put(['box', between(0.3, 0.9), between(0.2, 0.6), between(0.3, 0.9)], o.x + between(-5, 5), 0.2, o.z + between(-5, 5), ROCK[Math.floor(R() * 3)]!, R() * 6, 0);
    }

    // Mid-distance fill, 6 to 45 m off the road's line (the bulk 8 to 40): rubble heaps, wall stubs, spires and dead scrub sized to read at phone width. Same free()/sight rule; low pieces (rubble, scrub: knee height) may lie
    // in the first view but never within 6 m of the line, where the camera and the walker stand; tall ones keep to 18 m and beyond.
    const lateral = (x: number, zz: number) => roadFrame(f, x, zz).across, farOff = (x: number, zz: number) => lateral(x, zz) > 18 && lateral(x, zz) < 45, nearOff = (x: number, zz: number) => lateral(x, zz) > 6 && lateral(x, zz) < 40 && Math.hypot(rd.to.x - x, rd.to.z - zz) > 22;
    for (let c = 0; c < Math.round(area / 70); c++) {
      const kind = R(), rot = R() * 3.14, low = kind < 0.5 || kind > 0.85, o = low ? spot(1.6, nearOff, true) : spot(2, farOff);
      if (!o) continue;
      if (kind < 0.5) { for (let i = 0; i < 5 + Math.floor(R() * 4); i++) { const r = between(0.4, 1.0); put(['cylinder', r * 0.6, r, r * between(0.7, 1.3), 5], o.x + between(-2, 2), r * 0.35, o.z + between(-2, 2), ROCK[Math.floor(R() * ROCK.length)]!, R() * 6, 0); } }
      else if (kind < 0.7) { const len = between(3, 6), h = between(0.8, 2.2); put(['box', len, h, 0.7], o.x, h / 2, o.z, WALL, rot, 0); solid(o.x, o.z, len / 2); }
      else if (kind < 0.85) { const h = between(4, 8); put(['cone', between(0.9, 1.6), h, 5], o.x, h / 2, o.z, ROCK[3]!, R() * 6, 0); solid(o.x, o.z, 1.1); }
      else { for (let i = 0; i < 6; i++) { const h = between(0.7, 1.4); put(['box', 0.09, h, 0.09], o.x + between(-0.8, 0.8), h / 2, o.z + between(-0.8, 0.8), BURNT, R() * 6, 0); } }
    }

    // Burnt posts, broken fence runs, dead trees, a charred cart or barrels.
    for (let c = 0; c < Math.round(area / 700); c++) {
      const o = spot(2.5); if (!o) continue;
      const kind = R(), rot = R() * 3.14, dx = Math.sin(rot), dz = Math.cos(rot);
      if (kind < 0.4) { for (let i = 0; i < 3 + Math.floor(R() * 4); i++) { const x = o.x + dx * i * 2.1, zz = o.z + dz * i * 2.1, h = between(0.8, 2.4); put(['box', 0.2, h, 0.2], x, h / 2, zz, BURNT, rot, 0); if (i && R() < 0.6) put(['box', 0.1, 0.1, 2.1], x - dx * 1.05, 0.9 + R() * 0.4, zz - dz * 1.05, BURNT, rot, 0); } solid(o.x, o.z, 0.5); }
      else if (kind < 0.7) { const h = between(3.2, 5.2); put(['cylinder', 0.1, 0.26, h, 6], o.x, h / 2, o.z, BURNT, 0, 0); for (let i = 0; i < 3; i++) put(['box', between(1.2, 2.4), 0.09, 0.09], o.x, h * (0.5 + i * 0.16), o.z, BURNT, R() * 6, 0); solid(o.x, o.z, 0.4); }
      else if (kind < 0.85) { put(['box', 2.4, 0.3, 1.3], o.x, 0.7, o.z, BURNT, rot, 0); for (const s of [-1, 1]) put(['box', 0.1, 1.2, 0.1], o.x + dx * s * 1.0, 0.6, o.z + dz * s * 1.0, BURNT, rot, 0); solid(o.x, o.z, 1.3); }
      else { for (let i = 0; i < 3; i++) { const x = o.x + between(-0.9, 0.9), zz = o.z + between(-0.9, 0.9); put(['cylinder', 0.38, 0.4, 0.9, 8], x, 0.45, zz, BURNT, 0, 0); } solid(o.x, o.z, 1.1); }
    }
  }
  return { ground, pieces, solids };
}
