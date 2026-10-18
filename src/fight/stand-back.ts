// The clear air for a body drawn bigger than its rig was built (Dom 2026-10-18: "goblins are 1.25 scale everywhere", and the overlap he rejected when a bigger goblin stood where the small one did). PRESENTATION ONLY: the sim's
// contact distance, capsule and reach are untouched, so no record, fingerprint or fairness table moves. The drawn body stands back along the line to the hero until its MOUTH (mouthReach x scale) is `reach.gap` short of the hero's
// edge, the gap growing with how much bigger than built it is drawn (`reach.full-scale`); the shift eases (`reach.dir-tau`) so a strafe or a roll cannot swing a long lever through the screen.
// Source: the Test Zone's solution, copied read-only (branch preview/testzone-3056, origins/preview/mobs-view.ts and src/fight/fx-rows.ts; Dom's own zone), extracted here so the field (mobs-view) and the Pit (scene) share ONE function.
import { fxHas, fxNum } from './fx-rows.ts';

/** m from a creature's centre to its mouth per unit of draw scale: a row per creature (`reach.<id>`), else the default. */
export const mouthReach = (opponent: string): number => fxNum(fxHas(`reach.${opponent}`) ? `reach.${opponent}` : 'reach.default');

/** The scale a rig was built at: `reach.built.<id>` (the Goblin's 1), else what the catalogue draws it at (a body drawn as the catalogue says is as built, so nothing stands back). */
export const builtScale = (opponent: string, catalogueScale: number): number => (fxHas(`reach.built.${opponent}`) ? fxNum(`reach.built.${opponent}`) : catalogueScale);

/** How far to stand a body back (m) along the line to the hero, given its draw scale, the scale it was built at and the sim's distance to the hero. 0 for a body drawn at or under its built scale. */
export function standBack(opponent: string, drawnScale: number, built: number, distance: number): number {
  if (!(drawnScale > built)) return 0;
  return Math.max(0, mouthReach(opponent) * drawnScale + fxNum('reach.hero-edge') + fxNum('reach.gap') * Math.min(1, (drawnScale - built) / fxNum('reach.full-scale')) - distance);
}

/** One easing step of the stand-back vector toward `want` (time constant `reach.dir-tau`): mutates and returns `cur`. */
export function easeStandBack(cur: { x: number; z: number }, want: { x: number; z: number }, dt: number): { x: number; z: number } {
  const k = 1 - Math.exp(-dt / fxNum('reach.dir-tau'));
  cur.x += (want.x - cur.x) * k; cur.z += (want.z - cur.z) * k;
  return cur;
}

/** The want-vector for a creature at (cx, cz) and a hero at (hx, hz): `off` metres along the hero-to-creature line. */
export function standBackWant(cx: number, cz: number, hx: number, hz: number, opponent: string, drawnScale: number, built: number): { x: number; z: number } {
  const ux = cx - hx, uz = cz - hz, dh = Math.hypot(ux, uz) || 1, off = standBack(opponent, drawnScale, built, dh);
  return { x: (ux / dh) * off, z: (uz / dh) * off };
}
