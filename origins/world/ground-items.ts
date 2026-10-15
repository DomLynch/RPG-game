// Ground items (Backend brief docs/specs/backend/ground-loot-brief.md, #2775; donors EQEmu ground_spawns and 2004Scape Obj respawn): a ground item is a ROW, a loot item standing at a place
// in a zone, taken once per account per respawn window. NEW GROUND ITEMS GO IN ground-items.json, not in code. "Low-value starter gear only" is data too: a groundItem may name only an item that is a row of
// starterItem (the manifest's ref), whose maxQty caps the stack. Rows only: nothing reads them yet (the take is slice 2, the writer's ground_take; the page prompt is slice 3). The loader is pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './ground-items.json' with { type: 'json' };
import MANIFEST from './ground-items.manifest.json' with { type: 'json' };

export type GroundItem = { readonly zone: string; readonly place: string; readonly item: string; readonly qty: number; readonly respawnSec: number; readonly scope: string; readonly radiusM?: number; readonly offsetX?: number; readonly offsetZ?: number };
export type GroundItems = Readonly<Record<string, GroundItem>>;
export type StarterItems = Readonly<Record<string, { readonly maxQty: number }>>;

/** The one loader: the registry's duplicate / missing / mistyped / unknown-ref checks (an item that is not a starterItem row is refused there), then the row rules the manifest cannot say. */
export function loadGroundItems(raw: { starterItems?: unknown; groundItems?: unknown }): { items: GroundItems; starters: StarterItems } {
  loadRegistry(MANIFEST.tables.map((t) => tableFromFile(t as unknown as Manifest, raw, 'ground-items.json')));
  const items = raw.groundItems as GroundItems, starters = raw.starterItems as StarterItems;
  for (const [id, r] of Object.entries(items)) {
    if (!/^ground:[a-z0-9._-]{1,80}$/.test(id)) throw Error(`ground-items "${id}": the id is ground:<zone>.<name>`);
    if (r.scope !== 'account') throw Error(`ground-items "${id}": scope is "account" (one take per account per respawn window)`);
    if (!(r.qty >= 1 && r.qty <= starters[r.item]!.maxQty)) throw Error(`ground-items "${id}": qty is 1 to the starter item's maxQty (${starters[r.item]!.maxQty})`);
    if (!(r.respawnSec >= 60 && r.respawnSec <= 86_400)) throw Error(`ground-items "${id}": respawnSec is 60 to 86400`);
    if (r.radiusM !== undefined && !(r.radiusM >= 0.25 && r.radiusM <= 5)) throw Error(`ground-items "${id}": radiusM is 0.25 to 5 m (reach.pickupRadius's range)`);
    if ((r.offsetX === undefined) !== (r.offsetZ === undefined)) throw Error(`ground-items "${id}": offsetX and offsetZ come together`);
  }
  for (const [id, s] of Object.entries(starters)) if (!(s.maxQty >= 1)) throw Error(`ground-items starter "${id}": maxQty is at least 1`);
  return { items, starters };
}
export const { items: GROUND_ITEMS, starters: STARTER_ITEMS } = loadGroundItems(DEFS);   // validated again by origins/world/ground-items.test.ts
