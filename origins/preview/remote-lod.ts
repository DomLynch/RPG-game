// Which LOD a remote hero is drawn in (pure, no THREE): the NEAR figure (the merged hero-near, 2 draws, 20.5k triangles) only for the nearest `nearCap` figures AND only inside `farRange` metres; every
// other figure is the FAR one (hero-far, 2 draws, 4.9k triangles). A figure on the range boundary keeps its LOD until it is `slack` metres past it (so it does not flip every frame). The cap is the
// remote-tiers.ts selection (nearest first, ties by id) applied to the near figure: with the range alone the near count grows with the crowd (6 at 16 players, 14 at 40 in the T4 run of #3005 @4f0b84625),
// and each near figure costs about twice a far one. `rank` is the figure's place by distance (0 = nearest), as remote-track.ts hands them out. Numbers are rows (preview-rules-defs.json).
export type Lod = 'near' | 'far';
export function chooseLod(o: { dist: number; rank: number; current: Lod; farRange: number; slack: number; nearCap: number }): Lod {
  if (o.rank >= o.nearCap) return 'far';   // past the cap: never near, whatever the distance
  if (o.current === 'near') return o.dist > o.farRange + o.slack ? 'far' : 'near';
  return o.dist < o.farRange - o.slack ? 'near' : 'far';
}
