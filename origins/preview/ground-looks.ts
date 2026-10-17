import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import MANIFEST from './ground-looks.manifest.json' with { type: 'json' };
import LOOKS from './ground-looks.json' with { type: 'json' };

// How a ground item lies (ground loot slice 3; donors 2004Scape ObjType, where each object type is one row carrying its model's recolour pairs, angles and offsets, and Ultima Online's item Hue over the same art):
// one row per item id, nothing literal in the view. `asset` is the model's equip-file stem (src/assets/weapons/player/<asset>.glb: this item has no appearance.asset of its own yet), or `loot` (src/assets/loot.glb) with `piece` naming the armour piece's node in it (a skinned mesh: the view bakes its bind pose into a plain mesh to lay it down), `yawDeg` turns it about the vertical, `rollDeg` rolls it about its long axis (0 = as the model's own face-up side lies), `tiltDeg` lifts the long axis off the ground (so it reads from the walk camera and clears the grass), `scale` multiplies the model,
// `liftM` is the clearance between its underside and the ground, `ring` an optional pale pickup ring on the ground under it (colour, radius in metres, opacity: the glint that makes it read at a glance at 375), `beam` an optional thin light column rising from it (colour, height and radius in metres, opacity; fades to nothing at the top: it clears the grass and reads from across the road), `finish` an optional finish row (src/core/finish-rows.json, e.g. `rust`) written onto its metal and trim by rank-tint's finishedAs.
// `bands` are [inner, outer, strength] as fractions of `radiusM` (outer <= 1; strength scales `opacity`), `liftM` the ring's height over the ground.
export type GroundRing = { readonly color: string; readonly radiusM: number; readonly opacity: number; readonly bands: readonly (readonly [number, number, number])[]; readonly segments: number; readonly liftM: number };
// `topRatio` is the cone's top radius over its foot radius.
export type GroundBeam = { readonly color: string; readonly heightM: number; readonly radiusM: number; readonly opacity: number; readonly topRatio: number; readonly segments: number };
export type GroundLook = { readonly asset: string; readonly piece?: string; readonly yawDeg: number; readonly rollDeg: number; readonly tiltDeg: number; readonly scale: number; readonly liftM: number; readonly finish?: string; readonly ring?: GroundRing; readonly beam?: GroundBeam };

const num = (id: string, what: string, v: unknown, ok: (n: number) => boolean, rule: string): number => { if (typeof v !== 'number' || !Number.isFinite(v) || !ok(v)) throw new Error(`ground-looks "${id}": ${what} is ${rule} (got ${JSON.stringify(v)})`); return v; };
const hex = (id: string, what: string, v: unknown) => { if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`ground-looks "${id}": ${what} is a #rrggbb colour (got ${JSON.stringify(v)})`); };
const opacity = (id: string, what: string, v: unknown) => num(id, what, v, (n) => n > 0 && n <= 1, 'in (0, 1]');

/** The one loader: the registry's duplicate / missing / mistyped checks, then the row rules the manifest cannot say (a bad colour, a radius or height at or below 0, an opacity outside (0, 1], a missing tilt are refused, not drawn). */
export function loadGroundLooks(raw: unknown): ReadonlyMap<string, GroundLook> {
  const table = tableFromFile(MANIFEST.tables[0] as Manifest, raw, 'ground-looks.json');
  loadRegistry([table]);
  const out = new Map<string, GroundLook>();
  for (const r of table.rows as unknown as { id: string; fields: GroundLook }[]) {
    const f = r.fields as unknown as Record<string, unknown>, id = r.id;
    if (typeof f.asset !== 'string' || !f.asset) throw new Error(`ground-looks "${id}": asset is the equip-file stem`);
    for (const k of ['yawDeg', 'rollDeg', 'tiltDeg']) num(id, k, f[k], () => true, 'a number');
    num(id, 'scale', f.scale, (n) => n > 0, 'above 0'); num(id, 'liftM', f.liftM, (n) => n >= 0, 'at least 0');
    if (f.piece !== undefined && (typeof f.piece !== 'string' || !f.piece || f.asset !== 'loot')) throw new Error(`ground-looks "${id}": piece is a node name in loot.glb and goes with asset "loot"`);
    if (f.finish !== undefined && typeof f.finish !== 'string') throw new Error(`ground-looks "${id}": finish is a finish row id`);
    const ring = f.ring as Record<string, unknown> | undefined, beam = f.beam as Record<string, unknown> | undefined;
    if (ring) {
      hex(id, 'ring.color', ring.color); num(id, 'ring.radiusM', ring.radiusM, (n) => n > 0, 'above 0'); opacity(id, 'ring.opacity', ring.opacity);
      num(id, 'ring.segments', ring.segments, (n) => Number.isInteger(n) && n >= 3 && n <= 256, 'an integer 3..256'); num(id, 'ring.liftM', ring.liftM, (n) => n >= 0, 'at least 0');
      if (!Array.isArray(ring.bands) || !ring.bands.length) throw new Error(`ground-looks "${id}": ring.bands is a non-empty list of [inner, outer, strength]`);
      for (const band of ring.bands as unknown[]) { if (!Array.isArray(band) || band.length !== 3) throw new Error(`ground-looks "${id}": a ring band is [inner, outer, strength]`); num(id, 'ring band inner', band[0], (n) => n >= 0, 'at least 0'); num(id, 'ring band outer', band[1], (n) => n > (band[0] as number) && n <= 1, 'above its inner and at most 1'); opacity(id, 'ring band strength', band[2]); }
    }
    if (beam) {
      hex(id, 'beam.color', beam.color); num(id, 'beam.heightM', beam.heightM, (n) => n > 0, 'above 0'); num(id, 'beam.radiusM', beam.radiusM, (n) => n > 0, 'above 0'); opacity(id, 'beam.opacity', beam.opacity);
      num(id, 'beam.topRatio', beam.topRatio, (n) => n > 0 && n <= 1, 'in (0, 1]'); num(id, 'beam.segments', beam.segments, (n) => Number.isInteger(n) && n >= 3 && n <= 128, 'an integer 3..128');
    }
    out.set(id, r.fields);
  }
  return out;
}
const BY_ITEM = loadGroundLooks(LOOKS);

/** The look of an item; an item with no row throws rather than drawing at a guessed pose. */
export function groundLook(itemId: string): GroundLook {
  const look = BY_ITEM.get(itemId);
  if (!look) throw new Error(`ground-looks.json has no row for "${itemId}"`);
  return look;
}
