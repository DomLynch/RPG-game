// Which creatures the Zone 1 page DRAWS (Dom 2026-10-20, the MMO rule): the cap is draw-only and never hides a creature that matters. A creature that is fighting the hero, hunting him (aggro), or standing at another visible player
// (a party's or a bystander's fight) is always drawn, above the cap if need be; the rest of the cap is filled with the nearest idle creatures within range. The world sim and the server still run every creature whatever is drawn.
// Pure (indexes into the creatures' positions), so the rule is tested without a renderer.
export type Pos = { x: number; z: number };

/** The drawn indexes, nearest first within each group: every `must` creature, then the nearest in-range others until `cap` are drawn in all (a `must` group already at or over the cap leaves no idle fill). */
export function pickDrawn(at: readonly Pos[], hero: Pos, cap: number, range: number, must: ReadonlySet<number>): number[] {
  const rows = at.map((p, i) => ({ i, d: Math.hypot(p.x - hero.x, p.z - hero.z) })), byNear = (a: { i: number; d: number }, b: { i: number; d: number }) => a.d - b.d || a.i - b.i;
  const always = rows.filter((r) => must.has(r.i)).sort(byNear);
  const fill = rows.filter((r) => !must.has(r.i) && r.d <= range).sort(byNear).slice(0, Math.max(0, cap - always.length));
  return [...always, ...fill].map((r) => r.i);
}
