// The Ash Frontier plan's numbers that decide what a player can bump into or sees as data (Web, Dom's data-layer rule 2026-10-13; Lead's split 2026-10-18): where the west road is
// walkable, the first view's reach, the keeper's stand-off, every solid's radius and offset, the town's ring of houses, and each building kind's footprint (width x depth). `rules` rows (id, value,
// unit) and `blocks` rows (kind, w, d) through the shared loader (src/core/registry.ts); every default equals the literal it replaced (tests/frontier-plan-rules.test.ts pins each). A building's solid radius
// stays a formula of its footprint (frontier-plan.ts: max(w, d) / 2 + blockPad), never a second row. Heights, thicknesses and tints are drawing, not collision, and stay with the drawing. Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/neutral.ts';   // the neutral door (the page and the box's node services both load this file), as preview-rules.ts
import DEFS from './frontier-plan-defs.json' with { type: 'json' };
import MANIFEST from './frontier-plan-defs.manifest.json' with { type: 'json' };

export type FrontierRule = { readonly id: string; readonly value: number; readonly unit: string };
export type FrontierBlock = { readonly kind: string; readonly w: number; readonly d: number };
const NAMED = ['giverStand', 'roadInset', 'roadEnd', 'roadBody', 'viewBehind', 'viewAhead', 'viewSide', 'viewRing', 'gatePostBack', 'gatePostSide', 'gatePostR', 'ruinPostSide', 'ruinPostR', 'centreR', 'milestoneR', 'shrineR', 'cairnR', 'blockPad', 'ringHouses', 'ringRadius', 'ringPhase', 'ringKeepClear', 'ringMargin'] as const;
/** The one loader: rows keyed by id / kind (a duplicate or a missing or mistyped field is refused), every rule the plan reads by name must exist with a value > 0, every block a footprint > 0. */
export function loadFrontierPlanRules(raw: { rules?: readonly unknown[]; blocks?: readonly unknown[] }): { rules: readonly FrontierRule[]; blocks: readonly FrontierBlock[] } {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, { rules: raw.rules }, 'frontier-plan-defs.json'), tableFromFile(MANIFEST.tables[1] as unknown as Manifest, { blocks: raw.blocks }, 'frontier-plan-defs.json')]);
  const rules = (raw.rules ?? []) as readonly FrontierRule[], blocks = (raw.blocks ?? []) as readonly FrontierBlock[];
  for (const r of rules) if (!(Number.isFinite(r.value) && r.value > 0)) throw Error(`frontier-plan "${r.id}": value is a number > 0`);
  for (const b of blocks) if (!(Number.isFinite(b.w) && b.w > 0 && Number.isFinite(b.d) && b.d > 0)) throw Error(`frontier-plan block "${b.kind}": w and d are numbers > 0`);
  for (const must of NAMED) if (!rules.some((r) => r.id === must)) throw Error(`frontier-plan: the plan reads the "${must}" rule by name, so it needs a row`);
  return { rules, blocks };
}
export const FRONTIER_PLAN = loadFrontierPlanRules(DEFS);
export const frontierRule = (id: (typeof NAMED)[number]): number => FRONTIER_PLAN.rules.find((r) => r.id === id)!.value;
/** A building kind's footprint (width across its front, depth behind it), or undefined for a landmark kind that is not a block. */
export const frontierBlock = (kind: string): { w: number; d: number } | undefined => FRONTIER_PLAN.blocks.find((b) => b.kind === kind);
