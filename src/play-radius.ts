// The play circle's size, keyed on the fight (Dom 2026-10-06: Arena 1 comes inward to 0.36 (first 0.6, then 0.6 of that), "more intimate and impactful"). Arena 1 is the
// ladder's first band (arena-themes.ts ARENA_PICK; tests/play-radius.test.ts pins this list against LADDER). A record's version picks the
// circle it was fought in: below FIRST_SCALED_VERSION every fight is the old 8.55 m, so no shared link replays a different fight (detmath.ts
// underRecord, match.ts). A leaf of the simulation (no imports): the live value is set when a fight begins and read by the sim, the
// camera clamp and the scene.
export const WALL_INNER = 11.7, BODY_RADIUS = 0.425;   // the wall's inner face (arena.ts LAYOUT.wall.inner, pinned by tests/play-radius.test.ts) and half the fighters' 0.85 m spacing (sim.ts)
export const BASE_RADIUS = 8.55, ARENA_ONE_SCALE = 0.36, FIRST_SCALED_VERSION = 23;
export const ARENA_ONE: readonly string[] = ['veteran', 'pitborn'];   // the ladder's first band only; any other or unknown id keeps the old circle (fails closed)
export const playScaleFor = (opponent: string, version: number): number => version >= FIRST_SCALED_VERSION && ARENA_ONE.includes(opponent) ? ARENA_ONE_SCALE : 1;
// Where the fighters start, in the same fractions of the circle: the old 4 m / -2.5 m at full size, shrunk with the circle but never closer than half (a sword's reach and the draw beat need room).
export const spawnScale = (): number => Math.max(PLAY_SCALE, 0.5);
export let PLAY_SCALE = 1;
export let RADIUS = BASE_RADIUS;
// `k` is the arena's drawn size. In the full arena the circle is the old 8.55 m; in a smaller one the wall is the boundary: fighters stop AT its inner face (Dom 2026-10-06), so the floor out to the wall is fought on.
export function setPlayScale(k: number): void { PLAY_SCALE = k; RADIUS = OPEN_ARENA ? OPEN_RADIUS : k === 1 ? BASE_RADIUS : WALL_INNER * k - BODY_RADIUS; }
// OPEN ARENA (RV41, Dom via Strategy 2026-10-08: the wild has no wall around a fight; "no hiding"): a world fight's record carries the bit (record.ts flags2 bit 0). While it is set the play
// circle is 1e6 m, so every `r > RADIUS` clamp, the wall band (walled, the lorarii loiter, the wall-only retreat) and the pose wall check never fire, and a creature's sprint is capped
// (opponentFighter reads OPEN_ARENA: sim.ts advance runCap). Off by default and set per fight (Match.begin) or per record (detmath.ts underRecord), exactly like the circle and the stab.
export const FIRST_OPEN_VERSION = 41, OPEN_RADIUS = 1e6;
export let OPEN_ARENA = false;
export function setOpenArena(on: boolean): void { OPEN_ARENA = on; setPlayScale(PLAY_SCALE); }
export function underOpenArena<T>(open: boolean, run: () => T): T {
  const outer = OPEN_ARENA; setOpenArena(open);
  try { return run(); } finally { setOpenArena(outer); }
}
// A record's fight: its circle for the run, the live one put back after (detmath.ts underRecord).
export function underPlayScale<T>(opponent: string, version: number, run: () => T): T {
  const outer = PLAY_SCALE, outerNotice = LATE_NOTICE; setPlayScale(playScaleFor(opponent, version)); LATE_NOTICE = version >= FIRST_LATE_NOTICE_VERSION;
  try { return run(); } finally { setPlayScale(outer); LATE_NOTICE = outerNotice; }
}
// Late notice (COMBAT-001, ai.ts READ.lateNotice, moves.ts softNotice) is part of the same era as the circle: a record's version says whether the fight it recorded had
// the ramp (version >= FIRST_LATE_NOTICE_VERSION), so an older link replays without it. Off until a live fight (or a replay at a new version) turns it on, exactly like
// the circle's default of the old size, so a headless run that never set it is a pre-ramp fight and stamps the pre-ramp version (record.ts stampedVersion).
export const FIRST_LATE_NOTICE_VERSION = 24;
export let LATE_NOTICE = false;
export function setLateNotice(on: boolean): void { LATE_NOTICE = on; }
