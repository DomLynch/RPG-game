import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/registry.ts';
import MANIFEST from './ground-looks.manifest.json' with { type: 'json' };
import LOOKS from './ground-looks.json' with { type: 'json' };

// How a ground item lies (ground loot slice 3; donors 2004Scape ObjType, where each object type is one row carrying its model's recolour pairs, angles and offsets, and Ultima Online's item Hue over the same art):
// one row per item id, nothing literal in the view. `yawDeg` turns it about the vertical, `rollDeg` rolls it about its long axis (0 = as the model's own face-up side lies), `scale` multiplies the model,
// `liftM` is the clearance between its underside and the ground, `finish` an optional finish row (src/core/finish-rows.json, e.g. `rust`) written onto its metal and trim by rank-tint's finishedAs.
export type GroundLook = { readonly yawDeg: number; readonly rollDeg: number; readonly scale: number; readonly liftM: number; readonly finish?: string };

const TABLE = tableFromFile(MANIFEST.tables[0] as Manifest, LOOKS, 'ground-looks.json');
loadRegistry([TABLE]);
const BY_ITEM = new Map((TABLE.rows as unknown as { id: string; fields: GroundLook }[]).map((r) => [r.id, r.fields]));

/** The look of an item; an item with no row throws rather than drawing at a guessed pose. */
export function groundLook(itemId: string): GroundLook {
  const look = BY_ITEM.get(itemId);
  if (!look) throw new Error(`ground-looks.json has no row for "${itemId}"`);
  return look;
}
