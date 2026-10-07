// The Cinder pass (?look=cinder, World lane): what the Frontier's zones were missing at fight-camera height at 375: a ground that reads as a plane (the zone slab stops at a hard line against the sky),
// and nothing standing between the walker and the horizon. Three additions on top of frontier-dress.ts, all data and all on the stone layer, so the draw calls do not move:
// the ground carried 120 m past (far enough that the fog has taken it over, so the ground meets the sky without a line) each zone's far and side edges (no hard horizon line); ground breakup (ash drifts, big scorched rings, cracks with a pale lip and a dark core);
// and silhouettes, a skyline ring just outside each zone's far and side edges (spires, broken walls, dead trees, ridges) plus a few dead trees, spires, rubble and scrub inside.
// Pure (Piece[] + Solid[]); it reads the base dressing so nothing lands on a road, a landmark, a building or a base prop. Deterministic per zone id.
import { toWorld } from '../world/derive.ts';
import type { Piece, Shape, Tint } from './exchange-plan.ts';
import { footprintOf, rng, type Dress } from './frontier-dress.ts';
import { inFirstView, inZone, onRoad, type Build, type Frontier, type Solid } from './frontier-plan.ts';

const SLAB = 0.03, DRIFT = 0.065, RING = [0.105, 0.11], LIP = 0.112, CORE = 0.118;   // decal heights; the base uses .04 slab, .06 ash, .075 road, .085 ruts, .1 scorch (frontier-dress.ts)
const PALE: Tint[] = [[1.3, 1.26, 1.2], [1.5, 1.45, 1.38], [1.2, 1.15, 1.1]], RINGS: Tint[] = [[0.58, 0.54, 0.5], [0.36, 0.33, 0.31]], LIPT: Tint = [1.12, 1.07, 1.02], CORET: Tint = [0.2, 0.18, 0.17];
const DARK: Tint = [0.4, 0.37, 0.35], DARKER: Tint = [0.3, 0.28, 0.27], BURNT: Tint = [0.16, 0.14, 0.13], ROCK: Tint[] = [[0.78, 0.72, 0.66], [0.66, 0.62, 0.6], [0.56, 0.54, 0.54]];
export const CINDER = { beyond: 120, skylineGap: [3, 15], skylineStep: [6, 12] } as const;   // metres the ground is carried out; how far outside the edge the skyline stands; the spacing along it

export function cinderDress(f: Frontier, b: Build, base: Dress): Dress {
  const ground: Piece[] = [], pieces: Piece[] = [], solids: Solid[] = [];
  const lay = (shape: Shape, x: number, y: number, z: number, tint: Tint, rotY = 0) => { ground.push({ layer: 'stone', shape, x, y, z, tint, rotY, foot: -1 }); };
  const put = (shape: Shape, x: number, y: number, z: number, tint: Tint, rotY = 0) => { pieces.push({ layer: 'stone', shape, x, y, z, tint, rotY, foot: 0 }); };
  const decal = (r: number, top: number, x: number, z: number, tint: Tint, seg = 10) => lay(['cone', r, top, seg], x, top / 2, z, tint);   // a shallow cone: a hidden base cap and a side that is the rise to the middle, 2*seg triangles where a cylinder's disc is 4*seg
  const strips = base.ground.filter((p) => p.shape[0] === 'box' && p.shape[1] === 3.4 || p.shape[0] === 'cylinder' && p.shape[1] === 4.6);   // the base's worn roads and hubs: nothing is painted over them
  const zones = f.zones.filter((q) => q.region.includes('frontier'));

  for (const z of zones) {
    const R = rng(`cinder:${z.zone}`), between = (lo: number, hi: number) => lo + (hi - lo) * R();
    const world = (x: number, d: number) => toWorld({ x, d }, z.mount), area = z.width * z.depth;
    const inside = (m = 0) => { const p = world(between(-z.width / 2, z.width / 2), between(0, z.depth)); return inZone(z, p.x, p.z, m) ? p : null; };
    const offRoad = (x: number, zz: number, r: number) => !onRoad(f, x, zz) && !strips.some((s) => Math.hypot(s.x - x, s.z - zz) < r + 3.2);
    const marks = [...Object.values(z.landmarks), f.giver.at];

    // The ground, carried past the far and side edges (never behind the zone's mouth, where the Exchange or a neighbour's road is), a hair under the zone slab.
    const mid = world(0, (z.depth + CINDER.beyond) / 2);
    lay(['box', z.width + CINDER.beyond * 2, SLAB, z.depth + CINDER.beyond], mid.x, SLAB / 2, mid.z, [1, 1, 1], z.mount.heading);

    // Ash drifts: a pale, soft run of overlapping discs along a wobbling line, wind-laid.
    for (let i = 0; i < Math.round(area / 480); i++) {
      const o = inside(8); if (!o) continue;
      const ang = between(0, 6.28), n = 4 + Math.floor(R() * 2), step = between(1.6, 2.6);
      for (let k = 0; k < n; k++) { const t = k - n / 2, x = o.x + Math.sin(ang) * t * step + Math.cos(ang) * Math.sin(k * 1.7) * 0.7, zz = o.z + Math.cos(ang) * t * step - Math.sin(ang) * Math.sin(k * 1.7) * 0.7; if (offRoad(x, zz, 2.6)) decal(between(1.3, 2.7), DRIFT, x, zz, PALE[Math.floor(R() * PALE.length)]!, 8); }
    }
    // Scorched rings: a big dark patch with a darker heart, where something burned long.
    for (let i = 0; i < Math.round(area / 650); i++) {
      const o = inside(8); if (!o || !offRoad(o.x, o.z, 8)) continue;
      const r = between(3.5, 7.5); decal(r, RING[0]!, o.x, o.z, RINGS[0]!, 12); decal(r * between(0.35, 0.55), RING[1]!, o.x + between(-1, 1), o.z + between(-1, 1), RINGS[1]!, 10);
    }
    // Cracks with depth: a dark core on a paler lip, in short wandering runs.
    for (let i = 0; i < Math.round(area / 400); i++) {
      const o = inside(4); if (!o) continue;
      let ang = between(0, 6.28), x = o.x, zz = o.z;
      for (let k = 0; k < 3 + Math.floor(R() * 2); k++) {
        const len = between(2.4, 4.2); ang += between(-0.6, 0.6); const cx = x + Math.sin(ang) * len / 2, cz = zz + Math.cos(ang) * len / 2;
        if (offRoad(cx, cz, 1.5) && inZone(z, cx, cz, 2)) { lay(['box', 0.34, LIP, len + 0.1], cx, LIP / 2, cz, LIPT, ang); lay(['box', 0.14, CORE, len], cx, CORE / 2, cz, CORET, ang); }
        x += Math.sin(ang) * len; zz += Math.cos(ang) * len;
      }
    }

    // Is this spot free for a prop of radius r: in the zone, off every road, landmark, building, base prop and each other.
    const placed: Solid[] = [], baseFoot = base.pieces.map(footprintOf);
    const free = (x: number, zz: number, r: number, low = false) => inZone(z, x, zz, r + 2) && offRoad(x, zz, r) && (low || !inFirstView(f, x, zz, r))
      && !marks.some((k) => Math.hypot(k.x - x, k.z - zz) < r + 8) && ![...b.solids, ...base.solids, ...placed, ...baseFoot].some((s) => Math.hypot(s.x - x, s.z - zz) < s.r + r + 1.2);
    const spot = (r: number, low = false) => { for (let i = 0; i < 20; i++) { const p = inside(0); if (p && free(p.x, p.z, r, low)) return p; } return null; };
    const tree = (x: number, zz: number, h: number, rot: number, tint: Tint) => {
      put(['cylinder', 0.1, 0.27, h, 6], x, h / 2, zz, tint);
      for (let i = 0; i < 3; i++) put(['box', between(1.4, 2.8), 0.1, 0.1], x, h * (0.55 + i * 0.14), zz, tint, rot + i * 1.9);
    };

    // Inside: rubble and dead scrub (low, knee height, walked through like the base's heaps), then a few dead trees and spires that do block (small circles).
    for (let c = 0; c < Math.round(area / 380); c++) {
      const o = spot(1.4, true); if (!o) continue;
      if (R() < 0.6) for (let i = 0; i < 3 + Math.floor(R() * 2); i++) { const r = between(0.35, 0.85); put(['cylinder', r * 0.6, r, r * between(0.7, 1.2), 5], o.x + between(-1.6, 1.6), r * 0.35, o.z + between(-1.6, 1.6), ROCK[Math.floor(R() * ROCK.length)]!, R() * 6); }
      else for (let i = 0; i < 4; i++) { const h = between(0.6, 1.3); put(['box', 0.08, h, 0.08], o.x + between(-0.8, 0.8), h / 2, o.z + between(-0.8, 0.8), BURNT, R() * 6); }
    }
    for (let c = 0; c < Math.round(area / 900); c++) { const o = spot(1.5); if (!o) continue; const h = between(4, 6.5); tree(o.x, o.z, h, R() * 3, BURNT); const s = { x: o.x, z: o.z, r: 0.4 }; solids.push(s); placed.push(s); }
    for (let c = 0; c < Math.round(area / 1800); c++) { const o = spot(2); if (!o) continue; const h = between(5, 9); put(['cone', between(1, 1.7), h, 5], o.x, h / 2, o.z, DARK, R() * 6); const s = { x: o.x, z: o.z, r: 1 }; solids.push(s); placed.push(s); }

    // The skyline: tall dark shapes in a ring just outside the far and side edges, thinned wherever a neighbouring zone, the first view or a landmark is. They sit outside the zone, so they never block a step.
    const edge = (side: 'far' | 'left' | 'right') => {
      const len = side === 'far' ? z.width : z.depth;
      for (let t = between(0, CINDER.skylineStep[1]); t < len; t += between(CINDER.skylineStep[0], CINDER.skylineStep[1])) {
        const out = between(CINDER.skylineGap[0], CINDER.skylineGap[1]), p = side === 'far' ? world(t - z.width / 2, z.depth + out) : world((side === 'left' ? -1 : 1) * (z.width / 2 + out), t);
        if (zones.some((q) => q !== z && inZone(q, p.x, p.z, -8)) || inFirstView(f, p.x, p.z, 4) || marks.some((k) => Math.hypot(k.x - p.x, k.z - p.z) < 10)) continue;
        const kind = R(), rot = R() * 3.14;
        if (kind < 0.3) { const h = between(9, 17); put(['cone', between(1.8, 3.4), h, 5], p.x, h / 2, p.z, DARKER, rot); }
        else if (kind < 0.55) { const h = between(3, 7); put(['box', between(5, 10), h, 0.9], p.x, h / 2, p.z, DARK, rot); if (R() < 0.6) { const h2 = h * between(0.4, 0.7); put(['box', between(3, 6), h2, 0.9], p.x + Math.sin(rot) * 5, h2 / 2, p.z + Math.cos(rot) * 5, DARK, rot + 0.3); } }
        else if (kind < 0.8) tree(p.x, p.z, between(5.5, 9), rot, DARKER);
        else { const w = between(18, 34), h = between(2.5, 4.5); put(['box', w, h, 7], p.x, h / 2, p.z, DARKER, rot); put(['box', w * 0.45, h * 0.8, 5], p.x, h + h * 0.4, p.z, DARK, rot); }
      }
    };
    edge('far'); edge('left'); edge('right');
  }
  return { ground, pieces, solids };
}

// The base dressing and the Cinder pass as one Dress (frontier.ts meshes its ground then its pieces; solids join the build's).
export const withCinder = (f: Frontier, b: Build, base: Dress): Dress => { const c = cinderDress(f, b, base); return { ground: [...base.ground, ...c.ground], pieces: [...base.pieces, ...c.pieces], solids: [...base.solids, ...c.solids] }; };
