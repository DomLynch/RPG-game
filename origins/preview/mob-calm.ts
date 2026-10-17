// Calmer drawn movement for a creature in a fight (zone sandbox, Dom 2026-10-17: "way too fast, a twitch FPS; the salamander is on the right then the left in under a second"). The fight engine's creature circles its
// foe and flips the side every 0.6-1.3 s (src/fight/ai.ts decision / side) and snaps its facing: right for the Pit's tight duel, too jumpy on a phone. Only what is DRAWN is smoothed (the sim, hits and the
// digest are untouched): sideways motion around the hero eases over `lateralTau` s, motion toward or away from him (a lunge, a knockback) stays snappy (`radialTau`), and the body turns at most `turnDps` degrees a
// second (donor: EQEmu's per-mob turn rate, mob_movement_manager.cpp RotateToCommand). Pure: no three.js, no DOM.
export type Calm = { x: number; z: number; facing: number };
export type CalmRows = { readonly lateralTau: number; readonly radialTau: number; readonly turnDps: number; readonly snapM: number };

/** One frame: where the creature is DRAWN, easing from `s` toward the engine's pose `d` as seen from the hero. Returns the new drawn pose (a new object). */
export function calmStep(s: Calm, d: Calm, hero: { x: number; z: number }, dt: number, rows: CalmRows): Calm {
  if (dt <= 0 || Math.hypot(d.x - s.x, d.z - s.z) > rows.snapM) return { x: d.x, z: d.z, facing: d.facing };   // a teleport or a respawn: no gliding across the field
  const ex = d.x - s.x, ez = d.z - s.z; let ux = d.x - hero.x, uz = d.z - hero.z; const len = Math.hypot(ux, uz) || 1; ux /= len; uz /= len;
  const rad = ex * ux + ez * uz, lat = -ex * uz + ez * ux, kr = 1 - Math.exp(-dt / rows.radialTau), kl = 1 - Math.exp(-dt / rows.lateralTau);
  let df = d.facing - s.facing; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
  const turn = rows.turnDps * Math.PI / 180 * dt;
  return { x: s.x + ux * rad * kr - uz * lat * kl, z: s.z + uz * rad * kr + ux * lat * kl, facing: s.facing + Math.max(-turn, Math.min(turn, df)) };
}
