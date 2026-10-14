// Creature variants as rows (World, top-30 row 22; donors: EQEmu's spawn-time stat variance and named-variant spawns, WoW's rare/elite tiers; shape only, nothing copied). A variant is a ROW in
// variants.json: how likely it is (weight), its health / damage / size multipliers (the stat tilt), its tint, the weakness glyph the info card shows, a prefix its drops wear, and which catalogue
// creatures may roll it (`eligible`, catalogue ids; empty = every creature). The `plain` row (weight 80, all multipliers 1) is what a spawn is today, so a creature with no other eligible row
// rolls exactly as before. `variantFor` is a seeded draw per spawn: the same spawn id and seed always roll the same variant. Rows only; applying the multipliers to a fight and the tint to the
// model are separate wiring steps, and no sim file reads this yet. Pure: no DOM, no clock, no storage.
import { loadRegistry, mixSeed, nextRandom, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './variants.json' with { type: 'json' };
import MANIFEST from './variants.manifest.json' with { type: 'json' };

export type VariantRow = { readonly order: number; readonly weight: number; readonly health: number; readonly damage: number; readonly scale: number; readonly tint?: string | null; readonly glyph?: string | null; readonly dropPrefix?: string | null; readonly eligible: readonly string[] };
export type VariantTable = Readonly<Record<string, VariantRow>>;
export type Rolled = { readonly id: string } & VariantRow;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** The one loader: the registry's duplicate/missing/mistyped checks, then the row rules (a positive weight and multipliers in (0, 4], a #rrggbb tint, an eligible id that is a real catalogue creature, and a `plain` row that changes nothing). */
export function loadVariants(raw: { variants?: unknown }, catalogueIds: Iterable<string>): VariantTable {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'variants.json')]);
  const rows = raw.variants as VariantTable, known = new Set(catalogueIds);
  for (const [id, r] of Object.entries(rows)) {
    if (!(Number.isFinite(r.weight) && r.weight > 0)) throw Error(`variants "${id}": weight is a number > 0`);
    for (const k of ['health', 'damage', 'scale'] as const) if (!(Number.isFinite(r[k]) && r[k] > 0 && r[k] <= 4)) throw Error(`variants "${id}": ${k} is a multiplier in (0, 4]`);
    if (r.tint != null && !HEX.test(r.tint)) throw Error(`variants "${id}": tint is #rrggbb or null`);
    for (const e of r.eligible) if (!known.has(e)) throw Error(`variants "${id}": ${e} is not a catalogue creature`);
  }
  const plain = rows.plain;
  if (!plain || plain.health !== 1 || plain.damage !== 1 || plain.scale !== 1 || plain.tint != null || plain.eligible.length) throw Error('variants: a `plain` row (all multipliers 1, no tint, every creature) must exist: it is a spawn as it is today');
  return rows;
}
export const VARIANTS: VariantTable = DEFS.variants as unknown as VariantTable;   // validated against the real catalogue by origins/mobs/variants.test.ts

const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
/** The variants a creature (a catalogue id) may roll, in table order: its own eligible rows plus every row open to all. */
export const eligibleFor = (creature: string, table: VariantTable = VARIANTS): Rolled[] => Object.entries(table).sort((a, b) => a[1].order - b[1].order).filter(([, r]) => !r.eligible.length || r.eligible.includes(creature)).map(([id, r]) => ({ id, ...r }));
/** The variant one spawn rolls: a seeded weighted draw over its eligible rows (same creature, spawn id and seed = same variant). */
export function variantFor(creature: string, spawnId: string, seed: number, table: VariantTable = VARIANTS): Rolled {
  const rows = eligibleFor(creature, table), total = rows.reduce((n, r) => n + r.weight, 0);
  let roll = nextRandom(mixSeed(seed, hash(spawnId)))[0] * total;
  for (const r of rows) { if (roll < r.weight) return r; roll -= r.weight; }
  return rows[rows.length - 1]!;
}
/** What a variant does to a creature's numbers: health and damage are scaled (rounded to a whole point, never below 1), size is the draw scale. */
export const tilt = (v: Pick<VariantRow, 'health' | 'damage' | 'scale'>, base: { health: number; damage: number; scale: number }): { health: number; damage: number; scale: number } =>
  ({ health: Math.max(1, Math.round(base.health * v.health)), damage: Math.max(1, Math.round(base.damage * v.damage)), scale: base.scale * v.scale });
/** The name of a drop wearing the variant's prefix ('Scarred Iron Sword'); a plain variant leaves it alone. */
export const dropName = (v: Pick<VariantRow, 'dropPrefix'>, name: string): string => (v.dropPrefix ? `${v.dropPrefix} ${name}` : name);
