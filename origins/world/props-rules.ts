// The props as data (zone sandbox, 2026-10-15; donors: Ultima Online statics and EQEmu objects for the one-table-of-props shape, World of Claudecraft CampDef + camp_scatter for the seeded recipes, Veloren scatter for
// density sets): a PROP is one row (parts, clearance, scale range), a KIT groups props and says how a camp is laid out, a RECIPE says how many of which props go where (scatter, ring, cluster), a DRESS set scales
// the base zone's clutter, an AMBIENCE row is a zone's wind and fire bed. A zone row asks for a kit by id (look.props.kit); nothing else per zone. Pure, page- and server-safe, read by no sim, so NOT in the world digest.
// A missing or mistyped named row is refused at load, a duplicate id too (the shared loader, src/core/registry.ts).
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './props-defs.json' with { type: 'json' };
import MANIFEST from './props-defs.manifest.json' with { type: 'json' };

export type PartShape = 'box' | 'cylinder' | 'cone' | 'sphere';
export type Part = { readonly shape: PartShape; readonly size: readonly number[]; readonly at: readonly [number, number, number]; readonly tint: string; readonly yaw: number; readonly layer?: 'stone' | 'coal' | 'plain'; readonly ring?: { readonly n: number; readonly radius: number } };
export type Prop = { readonly id: string; readonly kit: string; readonly r: number; readonly scaleMin: number; readonly scaleMax: number; readonly emits?: 'fire'; readonly glb?: string; readonly parts: readonly Part[] };   // glb: the node name a Characters & Art model of this prop will carry (names only today: nothing draws it; `parts` is what is drawn, and stays the fallback when the model is absent)
export type Kit = { readonly id: string; readonly centreDepth: number; readonly radius: number; readonly tries: number; readonly clearRoad: number; readonly clearLandmark: number; readonly clearProp: number; readonly edge: number; readonly mouth?: number };   // mouth: metres of dirt carried out behind the zone's gate end (a rim zone only), so the gate does not open onto bare haze
export type RecipeKind = 'scatter' | 'ring' | 'cluster' | 'rim';
export type Recipe = { readonly id: string; readonly kit: string; readonly kind: RecipeKind; readonly props: readonly { readonly prop: string; readonly weight: number }[]; readonly count: number; readonly near?: number; readonly first?: 'centre'; readonly ringRadius?: number; readonly per?: number; readonly spread?: number; readonly chance?: number; readonly every?: number; readonly inset?: number; readonly gap?: number };   // rim: a piece every `every` m along the zone's edge, `inset` m inside it, a share `gap` of the spots left empty
export type Dress = { readonly id: string; readonly drifts: number; readonly rings: number; readonly cracks: number; readonly scrub: number; readonly trees: number; readonly skyline: number; readonly rocks: number; readonly ruins: number; readonly fill: number; readonly posts: number; readonly reach: number; readonly walls: number };
export type Ambience = { readonly id: string; readonly windGain: number; readonly windFreq: number; readonly windQ: number; readonly windSweepHz: number; readonly windSweepDepth: number; readonly crackleGain: number; readonly crackleRate: number; readonly crackleFreq: number; readonly fireRange: number; readonly crackleMs: number };
type Raw = { tints?: readonly unknown[]; props?: readonly unknown[]; kits?: readonly unknown[]; recipes?: readonly unknown[]; dress?: readonly unknown[]; ambience?: readonly unknown[] };
const SHAPE_ARGS: Record<PartShape, number> = { box: 3, cylinder: 4, cone: 3, sphere: 3 };   // numbers after the shape name (exchange-plan.ts Shape)
const KINDS = ['scatter', 'ring', 'cluster', 'rim'];

/** The one loader: the shared registry checks ids, required fields and refs; this adds what a type cannot say (part shapes, tints named, weights, kinds, a kit's recipes name its own props). */
export function loadProps(raw: Raw) {
  loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((m) => tableFromFile(m, raw, 'props-defs.json')));
  const tints = (raw.tints ?? []) as readonly { id: string; r: number; g: number; b: number }[], props = (raw.props ?? []) as readonly Prop[], kits = (raw.kits ?? []) as readonly Kit[], recipes = (raw.recipes ?? []) as readonly Recipe[];
  const dress = (raw.dress ?? []) as readonly Dress[], ambience = (raw.ambience ?? []) as readonly Ambience[];
  for (const k of kits) for (const [f, v] of Object.entries(k)) if (typeof v === 'number' && !(Number.isFinite(v) && v > 0)) throw Error(`props kit "${k.id}" ${f}: a number > 0`);
  for (const p of props) {
    if (!(p.r > 0 && p.scaleMin > 0 && p.scaleMax >= p.scaleMin)) throw Error(`props prop "${p.id}": r > 0 and 0 < scaleMin <= scaleMax`);
    if (!p.parts.length) throw Error(`props prop "${p.id}": a prop has at least one part`);
    if (p.glb !== undefined && !/^[a-z][a-z0-9_]*$/.test(p.glb)) throw Error(`props prop "${p.id}": glb is a node name (lower-case letters, digits, underscore)`);
    for (const [i, q] of p.parts.entries()) {
      if (!(q.shape in SHAPE_ARGS)) throw Error(`props prop "${p.id}" part ${i}: shape is box, cylinder, cone or sphere`);
      if (q.size.length !== SHAPE_ARGS[q.shape] || !q.size.every((n) => Number.isFinite(n) && n > 0)) throw Error(`props prop "${p.id}" part ${i}: a ${q.shape} takes ${SHAPE_ARGS[q.shape]} sizes, all > 0`);
      if (q.at.length !== 3 || !q.at.every(Number.isFinite)) throw Error(`props prop "${p.id}" part ${i}: at is x, y, z`);
      if (q.layer !== undefined && !['stone', 'coal', 'plain'].includes(q.layer)) throw Error(`props prop "${p.id}" part ${i}: layer is stone, coal or plain`);
      if (!tints.some((t) => t.id === q.tint)) throw Error(`props prop "${p.id}" part ${i}: tint "${q.tint}" has no row`);
      if (q.ring && !(Number.isInteger(q.ring.n) && q.ring.n >= 2 && q.ring.radius > 0)) throw Error(`props prop "${p.id}" part ${i}: ring is n >= 2 (whole) and radius > 0`);
    }
  }
  const glbs = props.flatMap((p) => (p.glb ? [p.glb] : [])); if (new Set(glbs).size !== glbs.length) throw Error('props: two props name the same glb node');
  for (const r of recipes) {
    if (!KINDS.includes(r.kind)) throw Error(`props recipe "${r.id}": kind is ${KINDS.join(', ')}`);
    if (r.kind === 'rim' && !(r.every! > 0 && r.inset! >= 0 && r.gap! >= 0 && r.gap! < 1)) throw Error(`props recipe "${r.id}": a rim needs every > 0, inset >= 0 and gap in [0, 1)`);
    if (!(r.kind === 'rim' || (Number.isInteger(r.count) && r.count >= 1)) || !r.props.length) throw Error(`props recipe "${r.id}": count is a whole number >= 1 and it lists props`);
    for (const w of r.props) { const p = props.find((x) => x.id === w.prop); if (!p || p.kit !== r.kit) throw Error(`props recipe "${r.id}": prop "${w.prop}" is not in kit ${r.kit}`); if (!(w.weight > 0)) throw Error(`props recipe "${r.id}": weights are > 0`); }
    if (r.kind === 'ring' && !(r.ringRadius! > 0)) throw Error(`props recipe "${r.id}": a ring needs ringRadius > 0`);
    if (r.kind === 'cluster' && !(r.per! >= 1 && r.spread! > 0)) throw Error(`props recipe "${r.id}": a cluster needs per >= 1 and spread > 0`);
    if (r.chance !== undefined && !(r.chance > 0 && r.chance <= 1)) throw Error(`props recipe "${r.id}": chance is in (0, 1]`);
    if (r.near !== undefined && !(r.near > 0 && r.near <= 1)) throw Error(`props recipe "${r.id}": near is in (0, 1]`);
  }
  for (const d of dress) for (const [f, v] of Object.entries(d)) if (typeof v === 'number' && !(v >= 0 && v <= 8)) throw Error(`props dress "${d.id}" ${f}: a multiplier from 0 to 8`);
  if (!dress.some((d) => d.id === 'default' && Object.entries(d).every(([f, v]) => f === 'id' || v === 1))) throw Error('props: the "default" dress set is all 1s (the base clutter as it was)');
  for (const a of ambience) for (const [f, v] of Object.entries(a)) if (typeof v === 'number' && !(Number.isFinite(v) && v > 0)) throw Error(`props ambience "${a.id}" ${f}: a number > 0`);
  return { tints, props, kits, recipes, dress, ambience };
}
const LOADED = loadProps(DEFS);
export const propTint = (id: string): [number, number, number] => { const t = LOADED.tints.find((x) => x.id === id)!; return [t.r, t.g, t.b]; };
export const propKitRow = (id: string): Kit | null => LOADED.kits.find((k) => k.id === id) ?? null;
export const propRow = (id: string): Prop => LOADED.props.find((p) => p.id === id)!;
export const recipesOf = (kit: string): readonly Recipe[] => LOADED.recipes.filter((r) => r.kit === kit);
export const kitIds = (): readonly string[] => LOADED.kits.map((k) => k.id);
/** The clutter multipliers a look asks for (an unknown or empty id is the "default" set: the base dressing as it was). */
export const dressSet = (id?: string | null): Dress => LOADED.dress.find((d) => d.id === id) ?? LOADED.dress.find((d) => d.id === 'default')!;
/** A zone's ambience row by id, or null (an id with no row, like the biomes' old "wind", stays silent). */
export const ambienceRow = (id?: string | null): Ambience | null => LOADED.ambience.find((a) => a.id === id) ?? null;
