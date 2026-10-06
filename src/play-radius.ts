// The play circle's size, keyed on the fight (Dom 2026-10-06: Arena 1 comes inward to 0.36 (first 0.6, then 0.6 of that), "more intimate and impactful"). Arena 1 is the
// ladder's first band (arena-themes.ts ARENA_PICK; tests/play-radius.test.ts pins this list against LADDER). A record's version picks the
// circle it was fought in: below FIRST_SCALED_VERSION every fight is the old 8.55 m, so no shared link replays a different fight (detmath.ts
// underRecord, match.ts). A leaf of the simulation (no imports): the live value is set when a fight begins and read by the sim, the
// camera clamp and the scene.
export const BASE_RADIUS = 8.55, ARENA_ONE_SCALE = 0.36, FIRST_SCALED_VERSION = 23;
export const ARENA_ONE: readonly string[] = ['veteran', 'pitborn'];   // the ladder's first band only; any other or unknown id keeps the old circle (fails closed)
export const playScaleFor = (opponent: string, version: number): number => version >= FIRST_SCALED_VERSION && ARENA_ONE.includes(opponent) ? ARENA_ONE_SCALE : 1;
// Where the fighters start, in the same fractions of the circle: the old 4 m / -2.5 m at full size, shrunk with the circle but never closer than half (a sword's reach and the draw beat need room).
export const spawnScale = (): number => Math.max(PLAY_SCALE, 0.5);
export let PLAY_SCALE = 1;
export let RADIUS = BASE_RADIUS;
export function setPlayScale(k: number): void { PLAY_SCALE = k; RADIUS = BASE_RADIUS * k; }
// A record's fight: its circle for the run, the live one put back after (detmath.ts underRecord).
export function underPlayScale<T>(opponent: string, version: number, run: () => T): T {
  const outer = PLAY_SCALE; setPlayScale(playScaleFor(opponent, version));
  try { return run(); } finally { setPlayScale(outer); }
}
