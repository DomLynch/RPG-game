// The open world (Zone 1) has no wall: it runs the Pit's own sim (src/duel.ts, ai.ts, sim.ts) with the circle pushed out of reach for the span of a step, and the Pit's own circle put back after.
// The sim reads RADIUS live (sim.ts advance, duel.ts walled / loiter / retreat / knockback), so nothing is copied or threaded. This lives outside src/ on purpose: play-radius.ts is in the record
// version guard's SIM_FILES, and the Pit's sim is not edited for it. RADIUS is a function of the scale (play-radius.ts setPlayScale), so a scale that puts it at OPEN_RADIUS exists, and restoring the old scale restores the old circle exactly.
import { BODY_RADIUS, PLAY_SCALE, WALL_INNER, setPlayScale } from '../../src/play-radius.ts';

export const OPEN_RADIUS = 1e9, OPEN_SCALE = (OPEN_RADIUS + BODY_RADIUS) / WALL_INNER;
export function underOpenWorld<T>(run: () => T): T { const outer = PLAY_SCALE; setPlayScale(OPEN_SCALE); try { return run(); } finally { setPlayScale(outer); } }
