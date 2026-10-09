// Zone 2's kit (zone-runtime step 4, slice 1): Zone 1's kit (zone1-kit.glb) and density table until Characters ship a zone2 kit; the node names are that kit's contract. Read through loadZone only.
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
