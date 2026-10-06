// The Goblin's stab (AiProfile.stab, COMBAT-001 3/3, 2026-10-06) is a rule of this build's fights: a record older than FIRST_STAB_VERSION was
// fought without it and must replay without it (detmath.ts underRecord sets this for the run it wraps, as play-radius.ts does for the circle).
// A leaf of the simulation (no imports). Live fights and new records have the stab on.
export const FIRST_STAB_VERSION = 25;
export let STAB_ON = true;
export function underStab<T>(version: number, run: () => T): T {
  const outer = STAB_ON; STAB_ON = version >= FIRST_STAB_VERSION;
  try { return run(); } finally { STAB_ON = outer; }
}
