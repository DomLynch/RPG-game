// The moving cluster of the S1 load test's run R2c (docs/specs/origins/s1-load-test.md): a share of the bots gathers in one small square (the Exchange: bank, smith, trade) that
// jumps to a new place every couple of minutes while the rest wander. Pure, so the placement rules are pinned by a test and the script only drives sockets.
export type Square = { x: number; z: number; sizeCm: number };   // centre and side, centimetres

// How many of `bots` join the cluster: the share rounded to the nearest bot, never more than all of them and never negative.
export const clusterCount = (bots: number, share: number): number => Math.min(bots, Math.max(0, Math.round(bots * share)));

// A square of `sizeCm` that lies wholly inside the zone, its centre chosen by `rand` (0..1).
export function newSquare(rand: () => number, zoneCm: number, sizeCm: number): Square {
  const half = sizeCm / 2, span = Math.max(0, zoneCm - sizeCm);
  return { x: half + rand() * span, z: half + rand() * span, sizeCm };
}

// A point inside the square, chosen by `rand`.
export const pointIn = (s: Square, rand: () => number): { x: number; z: number } => ({ x: s.x - s.sizeCm / 2 + rand() * s.sizeCm, z: s.z - s.sizeCm / 2 + rand() * s.sizeCm });
export const inSquare = (s: Square, x: number, z: number): boolean => Math.abs(x - s.x) <= s.sizeCm / 2 && Math.abs(z - s.z) <= s.sizeCm / 2;
