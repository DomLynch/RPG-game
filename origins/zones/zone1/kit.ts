// Zone 1's kit (zone-runtime step 1): the Characters lane's zone1-kit.glb contract and how many of each node the Frontier gets. Node names are the kit's contract (public/world/kit/zone1-kit.glb); `kinds` is the
// density table (per: placements per 1000 m2 of zone; r: footprint; solid: collision radius per scale, 0 = walk-through; scale: min/max). The placement rule itself (deterministic per zone id, off the roads) stays in
// origins/preview/frontier-kit.ts, which reads this through loadZone.
type Kind = { nodes: string[]; per: number; r: number; solid: number; scale: [number, number] };
const kit: { url: string; nodes: string[]; landmarks: string[]; kinds: Kind[] } = {
  url: '/world/kit/zone1-kit.glb',
  nodes: ['boulder_a', 'boulder_b', 'boulder_c', 'bush_scrub_a', 'bush_scrub_b', 'tree_dead_a', 'tree_dead_b', 'tree_dead_c', 'tuft_a', 'tuft_b'],
  landmarks: ['landmark_camp', 'landmark_ruin_arch', 'landmark_stone_circle', 'landmark_grove'],
  kinds: [
    { nodes: ['tree_dead_a', 'tree_dead_b', 'tree_dead_c'], per: 3, r: 1.2, solid: 0.6, scale: [0.9, 1.35] },
    { nodes: ['boulder_a', 'boulder_b', 'boulder_c'], per: 4, r: 1.4, solid: 1, scale: [0.8, 1.4] },
    { nodes: ['bush_scrub_a', 'bush_scrub_b'], per: 8, r: 0.9, solid: 0, scale: [0.8, 1.3] },
    { nodes: ['tuft_a', 'tuft_b'], per: 14, r: 0.4, solid: 0, scale: [0.8, 1.5] },
  ],
};
export default kit;
