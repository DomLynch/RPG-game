// Building skins as data (zone sandbox, 2026-10-16; Dom: scalable, 700 zones, no per-zone modelling). A SKIN is a culture's look for a town's buildings (donor: Morrowind's Hlaalu / Redoran / Telvanni kits, one
// culture = one set of parts every town reuses; Veloren's site generator for the shape "building kind = a parts list"): one row per part, in the SAME vocabulary the props use (shape, size, at, tint, yaw, layer),
// but every number is a FRACTION of the building's footprint (x, z) and height (y), so one list fits a 3 m fence and a 10 m hall alike. A zone or biome row asks for a skin by id (look.buildings); a kind with no
// parts of its own takes the skin's `default`. Empty = today's brick blocks, so Zones 1-4 and the live game are unchanged. Pure, page-safe, read by no sim (a building's footprint and door never depend on its look).
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './building-skins.json' with { type: 'json' };
import MANIFEST from './building-skins.manifest.json' with { type: 'json' };
import { propTint } from './props-rules.ts';

export type SkinShape = 'box' | 'cylinder' | 'cone' | 'sphere';
export type SkinPart = { readonly id: string; readonly skin: string; readonly kind: string; readonly shape: SkinShape; readonly size: readonly number[]; readonly at: readonly [number, number, number]; readonly tint: string; readonly yaw: number; readonly layer?: 'stone' | 'plain' };
export type SkinModel = { readonly id: string; readonly url: string; readonly nodes: readonly string[] };   // a model file (served by URL, one material) and the nodes it holds
export type SkinFit = { readonly id: string; readonly skin: string; readonly kind: string; readonly model: string; readonly node: string; readonly w: number; readonly d: number };   // a building kind stands as this node, scaled so its natural w x d (m) fills the block's footprint
type Raw = { skins?: readonly unknown[]; parts?: readonly unknown[]; models?: readonly unknown[]; fits?: readonly unknown[] };
const SHAPE_ARGS: Record<SkinShape, number> = { box: 3, cylinder: 4, cone: 3, sphere: 3 };   // numbers after the shape name (exchange-plan.ts Shape)

/** The one loader: the shared registry checks ids, required fields and the skin ref; this adds what a type cannot say (shapes, their argument counts, tints named, a skin has a `default`). */
export function loadSkins(raw: Raw) {
  loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((m) => tableFromFile(m, raw, 'building-skins.json')));
  const skins = (raw.skins ?? []) as readonly { id: string }[], parts = (raw.parts ?? []) as readonly SkinPart[], models = (raw.models ?? []) as readonly SkinModel[], fits = (raw.fits ?? []) as readonly SkinFit[];
  for (const m of models) if (!/^world\/[\w/.-]+\.glb$/.test(m.url) || !m.nodes.length || !m.nodes.every((n) => /^[a-z][a-z0-9_]*$/.test(n))) throw Error(`building skin model "${m.id}": url is world/....glb and nodes are lower-case names`);
  for (const f of fits) {
    if (!models.find((m) => m.id === f.model)!.nodes.includes(f.node)) throw Error(`building skin fit "${f.id}": node "${f.node}" is not in model ${f.model}`);
    if (!(f.w > 0 && f.d > 0)) throw Error(`building skin fit "${f.id}": w and d are natural metres > 0`);
  }
  for (const p of parts) {
    if (!(p.shape in SHAPE_ARGS)) throw Error(`building skin part "${p.id}": shape is box, cylinder, cone or sphere`);
    if (p.size.length !== SHAPE_ARGS[p.shape] || !p.size.every((n) => typeof n === 'number' && n > 0)) throw Error(`building skin part "${p.id}": a ${p.shape} has ${SHAPE_ARGS[p.shape]} sizes, all > 0`);
    if (p.at.length !== 3 || !p.at.every((n) => typeof n === 'number' && Number.isFinite(n))) throw Error(`building skin part "${p.id}": at is three numbers`);
    if (p.layer !== undefined && p.layer !== 'stone' && p.layer !== 'plain') throw Error(`building skin part "${p.id}": layer is stone or plain`);
    try { propTint(p.tint); } catch { throw Error(`building skin part "${p.id}": tint "${p.tint}" is not a props tint row`); }
  }
  for (const s of skins) if (!parts.some((p) => p.skin === s.id && p.kind === 'default')) throw Error(`building skin "${s.id}": it needs parts for kind "default" (every building kind falls back to it)`);
  return { skins, parts, models, fits };
}
const LOADED = loadSkins(DEFS);
export const skinIds = (): readonly string[] => LOADED.skins.map((s) => s.id);
/** The model a building kind of this skin stands as (its own kind, else the skin's default), or null: then the kind is drawn from its parts. */
export const skinFit = (skin: string, kind: string): SkinFit | null => LOADED.fits.find((f) => f.skin === skin && f.kind === kind) ?? null;
/** The scale that fits a node's natural footprint into a w x d block, kept sane (a hall is not a giant hut). */
export const fitScale = (f: SkinFit, w: number, d: number): number => Math.min(2.5, Math.max(0.6, Math.min(w / f.w, d / f.d)));
/** The model file(s) every node name belongs to (a prop row's `glb` name or a fit's node): null = no model holds it. */
export const modelOfNode = (node: string): SkinModel | null => LOADED.models.find((m) => m.nodes.includes(node)) ?? null;
export const skinModels = (): readonly SkinModel[] => LOADED.models;
/** A skin's parts for exactly this kind (no fallback): `gate` and `marker` are landmark kinds a skin may dress or leave bare. null = none. */
export const skinKind = (skin: string, kind: string): readonly SkinPart[] | null => { const own = LOADED.parts.filter((p) => p.skin === skin && p.kind === kind); return own.length ? own : null; };
/** A skin's parts for one building kind (hall, house, watchtower...), else its default; null = no such skin. */
export const skinParts = (skin: string, kind: string): readonly SkinPart[] | null => {
  if (!skinIds().includes(skin)) return null;
  const own = LOADED.parts.filter((p) => p.skin === skin && p.kind === kind);
  return own.length ? own : LOADED.parts.filter((p) => p.skin === skin && p.kind === 'default');
};
