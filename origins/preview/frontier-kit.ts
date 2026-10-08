// The Ash Frontier's kit placements (?region=1, World lane): where the Characters lane's zone1-kit.glb nodes stand. Pure data, no three.js: the same rule as frontier-dress.ts
// (deterministic per zone id, inside the zone, off the west road, the worn roads, every landmark, the buildings and the dressing's own solids), so a rebuild is the same ground.
// Node names are the kit's contract (public/world/kit/zone1-kit.glb): trees, boulders, scrub and grass tufts.
import { toWorld } from '../world/derive.ts';
import { rng, type Dress } from './frontier-dress.ts';
import { inFirstView, inZone, onRoad, type Build, type Frontier, type Solid } from './frontier-plan.ts';

export const KIT_NODES = ['boulder_a', 'boulder_b', 'boulder_c', 'bush_scrub_a', 'bush_scrub_b', 'tree_dead_a', 'tree_dead_b', 'tree_dead_c', 'tuft_a', 'tuft_b'] as const;
export type KitNode = (typeof KIT_NODES)[number];
export type KitPlacement = { node: KitNode | (typeof LANDMARK_NODES)[number]; x: number; z: number; rotY: number; scale: number };
export const LANDMARK_NODES = ['landmark_camp', 'landmark_ruin_arch', 'landmark_stone_circle', 'landmark_grove'] as const;
export type Kit = { placements: KitPlacement[]; landmarks: KitPlacement[]; solids: Solid[] };
const LANDMARK_R = 3.5;   // footprint of a landmark, for the first-view margin and its solid

const KIND: { nodes: readonly KitNode[]; per: number; r: number; solid: number; scale: [number, number] }[] = [   // per: placements per 1000 m2 of zone
  { nodes: ['tree_dead_a', 'tree_dead_b', 'tree_dead_c'], per: 3, r: 1.2, solid: 0.6, scale: [0.9, 1.35] },
  { nodes: ['boulder_a', 'boulder_b', 'boulder_c'], per: 4, r: 1.4, solid: 1, scale: [0.8, 1.4] },
  { nodes: ['bush_scrub_a', 'bush_scrub_b'], per: 8, r: 0.9, solid: 0, scale: [0.8, 1.3] },
  { nodes: ['tuft_a', 'tuft_b'], per: 14, r: 0.4, solid: 0, scale: [0.8, 1.5] },
];

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};

export function frontierKit(f: Frontier, b: Build, d: Dress): Kit {
  const placements: KitPlacement[] = [], solids: Solid[] = [];
  for (const z of f.zones) {
    if (!z.region.includes('frontier')) continue;
    const R = rng(`kit:${z.zone}`), between = (lo: number, hi: number) => lo + (hi - lo) * R();
    const hub = toWorld({ x: 0, d: z.depth / 2 }, z.mount), marks = [...Object.values(z.landmarks), f.giver.at];
    const roads = z.links.flatMap((l) => (z.landmarks[l.here] ? [z.landmarks[l.here]!] : [])), taken: Solid[] = [];
    const free = (x: number, zz: number, r: number) => inZone(z, x, zz, r + 2) && !onRoad(f, x, zz) && !inFirstView(f, x, zz, r)
      && !roads.some((a) => segDist(x, zz, a.x, a.z, hub.x, hub.z) < r + 2.4) && Math.hypot(hub.x - x, hub.z - zz) > r + 5.4
      && !marks.some((k) => Math.hypot(k.x - x, k.z - zz) < r + 6)
      && ![...b.solids, ...d.solids, ...taken].some((s) => Math.hypot(s.x - x, s.z - zz) < s.r + r + 0.5);
    for (const kind of KIND) {
      const want = Math.round((z.width * z.depth * kind.per) / 1000);
      for (let i = 0, made = 0; i < want * 6 && made < want; i++) {
        const p = toWorld({ x: between(-z.width / 2, z.width / 2), d: between(0, z.depth) }, z.mount), scale = between(...kind.scale);
        if (!free(p.x, p.z, kind.r * scale)) continue;
        taken.push({ x: p.x, z: p.z, r: kind.r * scale }); made++;
        placements.push({ node: kind.nodes[Math.floor(R() * kind.nodes.length)]!, x: p.x, z: p.z, rotY: R() * Math.PI * 2, scale });
        if (kind.solid) solids.push({ x: p.x, z: p.z, r: kind.solid * scale });
      }
    }
  }
  // The four landmarks stand along the west road just OUTSIDE the walker's first view (frontier-plan.ts inFirstView keeps tall things 10 m + their radius off the road's line), alternating sides:
  // each takes the first free spot walking out from the road's end, at least 10 m from the one before.
  const r = f.road, ux = Math.sin(r.facing), uz = Math.cos(r.facing), side = r.width / 2 + LANDMARK_R + 11.5, landmarks: KitPlacement[] = [];
  LANDMARK_NODES.forEach((node, i) => {
    for (let k = 0; k < 80 && !landmarks.some((l) => l.node === node); k++) {
      const along = 12 + Math.floor(k / 2) * 3, sign = (k + i) % 2 ? 1 : -1, across = sign * side, x = r.from.x + ux * along - uz * across, z = r.from.z + uz * along + ux * across;
      if (inFirstView(f, x, z, LANDMARK_R) || onRoad(f, x, z) || !f.zones.some((q) => q.region.includes('frontier') && inZone(q, x, z, LANDMARK_R))
        || [...b.solids, ...d.solids, ...solids, ...landmarks.map((l) => ({ x: l.x, z: l.z, r: 10 }))].some((s) => Math.hypot(s.x - x, s.z - z) < s.r + LANDMARK_R)) continue;
      landmarks.push({ node, x, z, rotY: Math.atan2(-ux, -uz) - sign * 0.4, scale: 1 }); solids.push({ x, z, r: LANDMARK_R * 0.7 });
    }
  });
  return { placements, landmarks, solids };
}
