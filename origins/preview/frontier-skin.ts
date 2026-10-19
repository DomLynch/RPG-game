// The seam between the Frontier plan and a BUILDING SKIN (a culture's look for a town's buildings: the Test Zone's building-skins rows, promoted by World as slice B). Types only, no code and no import of the
// skin table: frontier-plan.ts takes a `BuildingSkin | null` and frontier-greybox.ts draws through it, so the plan and the greybox never depend on how the skin rows are stored. World's building-skin.ts exports
// `buildingSkin(skinId): BuildingSkin | null` (null for '' or an unknown id = the brick blocks as they were). Every method answers null when the skin has nothing for the case; the greybox then draws what it always drew.
// Collision is NOT here: a building's solid, the gate posts' and the marker's stay computed in frontier-plan.ts from its rows whatever the skin. Agreed with World 2026-10-18 (Lead's ruling).
import type { Piece } from './exchange-plan.ts';

/** A node of a skin's model file stood on the ground (drawn by frontier-kit-view.ts loadKit). */
export type ModelPlacement = { node: string; x: number; z: number; rotY: number; scale: number; y?: number };   // y: metres the model is lifted off the ground (a node whose origin is a mount point hangs below it)
export type BuildingSkin = {
  /** The kind stood as a model node scaled to the (w, d) footprint: the skin's fit row for this kind, else its `default` fit unless `strict` (then only this kind's own). null = no model: draw from parts. */
  model(kind: string, x: number, z: number, facing: number, w: number, d: number, strict?: boolean): ModelPlacement | null;
  /** The pieces of a building kind drawn from the skin's parts on a w x h x d footprint (the kind's own parts, else the skin's default). null = no such skin. */
  parts(kind: string, x: number, z: number, facing: number, w: number, h: number, d: number): Piece[] | null;
  /** The pieces of exactly this landmark kind (no fallback: 'gate', 'marker'). null = the skin leaves that landmark bare. */
  landmark(kind: string, x: number, z: number, facing: number, w: number, h: number, d: number): Piece[] | null;
};
