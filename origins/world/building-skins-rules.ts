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
type Raw = { skins?: readonly unknown[]; parts?: readonly unknown[] };
const SHAPE_ARGS: Record<SkinShape, number> = { box: 3, cylinder: 4, cone: 3, sphere: 3 };   // numbers after the shape name (exchange-plan.ts Shape)

/** The one loader: the shared registry checks ids, required fields and the skin ref; this adds what a type cannot say (shapes, their argument counts, tints named, a skin has a `default`). */
export function loadSkins(raw: Raw) {
  loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((m) => tableFromFile(m, raw, 'building-skins.json')));
  const skins = (raw.skins ?? []) as readonly { id: string }[], parts = (raw.parts ?? []) as readonly SkinPart[];
  for (const p of parts) {
    if (!(p.shape in SHAPE_ARGS)) throw Error(`building skin part "${p.id}": shape is box, cylinder, cone or sphere`);
    if (p.size.length !== SHAPE_ARGS[p.shape] || !p.size.every((n) => typeof n === 'number' && n > 0)) throw Error(`building skin part "${p.id}": a ${p.shape} has ${SHAPE_ARGS[p.shape]} sizes, all > 0`);
    if (p.at.length !== 3 || !p.at.every((n) => typeof n === 'number' && Number.isFinite(n))) throw Error(`building skin part "${p.id}": at is three numbers`);
    if (p.layer !== undefined && p.layer !== 'stone' && p.layer !== 'plain') throw Error(`building skin part "${p.id}": layer is stone or plain`);
    try { propTint(p.tint); } catch { throw Error(`building skin part "${p.id}": tint "${p.tint}" is not a props tint row`); }
  }
  for (const s of skins) if (!parts.some((p) => p.skin === s.id && p.kind === 'default')) throw Error(`building skin "${s.id}": it needs parts for kind "default" (every building kind falls back to it)`);
  return { skins, parts };
}
const LOADED = loadSkins(DEFS);
export const skinIds = (): readonly string[] => LOADED.skins.map((s) => s.id);
/** A skin's parts for one building kind (hall, house, watchtower...), else its default; null = no such skin. */
export const skinParts = (skin: string, kind: string): readonly SkinPart[] | null => {
  if (!skinIds().includes(skin)) return null;
  const own = LOADED.parts.filter((p) => p.skin === skin && p.kind === kind);
  return own.length ? own : LOADED.parts.filter((p) => p.skin === skin && p.kind === 'default');
};
