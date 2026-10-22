// The parts of the HUD that are drawn INSIDE the WebGL scene (the rest of the HUD is DOM over the canvas, which a canvas post-pass cannot touch): a creature's or a player's name tag, a creature's "!" and its
// notice ring, the ground-item ring. Each carries `userData.hud = <kind>` so a full-screen look pass (the ink look) can leave them out: hide them for its own render, put them back after. No look, no rule, no
// behaviour here; the tag is data on the object (Web 2026-10-23, Inkverse HUD exclusion).
import type * as THREE from 'three';

export type HudKind = 'tag' | 'bang' | 'ring' | 'ground-ring';
/** Mark an object (and its children) as a scene-space HUD piece. Returns it. */
export function markHud<T extends THREE.Object3D>(o: T, kind: HudKind): T { o.traverse((c) => { c.userData.hud = kind; }); return o; }
/** Every HUD piece under a root (a mesh or a sprite carrying `userData.hud`). */
export function hudPieces(root: THREE.Object3D): THREE.Object3D[] { const out: THREE.Object3D[] = []; root.traverse((o) => { if (o.userData.hud) out.push(o); }); return out; }
/** Run `draw` with every HUD piece hidden, then give each back the visibility it had (a piece the game hides, like a calm creature's "!", stays hidden). */
export function withoutHud<R>(root: THREE.Object3D, draw: () => R): R {
  const pieces = hudPieces(root), was = pieces.map((o) => o.visible);
  for (const o of pieces) o.visible = false;
  try { return draw(); } finally { pieces.forEach((o, i) => { o.visible = was[i]!; }); }
}
