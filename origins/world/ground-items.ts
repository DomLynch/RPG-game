// Ground items (Backend brief docs/specs/backend/ground-loot-brief.md, #2775; donors EQEmu ground_spawns and 2004Scape Obj respawn): a ground item is a ROW, a loot item standing at a place
// in a zone, taken once per account per respawn window. NEW GROUND ITEMS GO IN ground-items.json, not in code. "Low-value starter gear only" is data too: a groundItem may name only an item that is a row of
// starterItem (the manifest's ref), whose maxQty caps the stack. Rows only: nothing reads them yet (the take is slice 2, the writer's ground_take; the page prompt is slice 3). The loader is pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DEFS from './ground-items.json' with { type: 'json' };
import MANIFEST from './ground-items.manifest.json' with { type: 'json' };
import { STARTER_QTY } from '../region1/starter-wield.ts';

export type GroundItem = { readonly zone: string; readonly place: string; readonly item: string; readonly qty: number; readonly respawnSec: number; readonly scope: string; readonly hiddenWhileTaken: boolean; readonly radiusM?: number; readonly offsetX?: number; readonly offsetZ?: number };
export type GroundItems = Readonly<Record<string, GroundItem>>;
export type StarterItems = Readonly<Record<string, { readonly maxQty: number }>>;
export type GroundLimits = { readonly minRespawnSec: number; readonly maxRespawnSec: number; readonly defaultRespawnSec: number; readonly minRadiusM: number; readonly maxRadiusM: number; readonly defaultRadiusM: number };

/** The one loader: the registry's duplicate / missing / mistyped / unknown-ref checks (an item that is not a starterItem row is refused there), then the row rules the manifest cannot say. */
export function loadGroundItems(raw: { starterItems?: unknown; groundLimits?: unknown; groundItems?: unknown }): { items: GroundItems; starters: StarterItems; limits: GroundLimits } {
  loadRegistry(MANIFEST.tables.map((t) => tableFromFile(t as unknown as Manifest, raw, 'ground-items.json')));
  const rows = raw.groundItems as Record<string, Omit<GroundItem, 'respawnSec'> & { respawnSec?: number }>, starters = raw.starterItems as StarterItems, limits = (raw.groundLimits as Record<string, GroundLimits>).ground!;   // the bounds are the groundLimit row (ground-items.json), not literals here
  if (!(limits.minRespawnSec >= 1 && limits.maxRespawnSec >= limits.minRespawnSec && limits.minRadiusM > 0 && limits.maxRadiusM >= limits.minRadiusM && limits.defaultRadiusM >= limits.minRadiusM && limits.defaultRadiusM <= limits.maxRadiusM)) throw Error('ground-items limits: 1 <= minRespawnSec <= maxRespawnSec and 0 < minRadiusM <= defaultRadiusM <= maxRadiusM');
  if (!(limits.defaultRespawnSec >= limits.minRespawnSec && limits.defaultRespawnSec <= limits.maxRespawnSec)) throw Error('ground-items limits: defaultRespawnSec is within minRespawnSec..maxRespawnSec');
  // A row that names no respawnSec reads the one default row, so every ground item shares one number until a row says otherwise.
  const items: GroundItems = Object.fromEntries(Object.entries(rows).map(([id, r]) => [id, { ...r, respawnSec: r.respawnSec ?? limits.defaultRespawnSec }]));
  for (const [id, r] of Object.entries(items)) {
    if (!/^ground:[a-z0-9._-]{1,60}$/.test(id)) throw Error(`ground-items "${id}": the id is ground:<zone>.<name>`);
    if (r.scope !== 'account') throw Error(`ground-items "${id}": scope is "account" (one take per account per respawn window)`);
    if (!(r.qty >= 1 && r.qty <= starters[r.item]!.maxQty)) throw Error(`ground-items "${id}": qty is 1 to the starter item's maxQty (${starters[r.item]!.maxQty})`);
    if (!(r.respawnSec >= limits.minRespawnSec && r.respawnSec <= limits.maxRespawnSec)) throw Error(`ground-items "${id}": respawnSec is ${limits.minRespawnSec} to ${limits.maxRespawnSec}`);
    if (r.radiusM !== undefined && !(r.radiusM >= limits.minRadiusM && r.radiusM <= limits.maxRadiusM)) throw Error(`ground-items "${id}": radiusM is ${limits.minRadiusM} to ${limits.maxRadiusM} m (reach.pickupRadius's range)`);
    if ((r.offsetX === undefined) !== (r.offsetZ === undefined)) throw Error(`ground-items "${id}": offsetX and offsetZ come together`);
  }
  for (const [id, s] of Object.entries(starters)) if (!(s.maxQty >= 1)) throw Error(`ground-items starter "${id}": maxQty is at least 1`);
  return { items, starters, limits };
}
// The starter set is declared once, in starter-wield.json (item -> LootId + maxQty); the `starterItem` table is built from those rows, so ground-items.json carries only limits and placements.
export const { items: GROUND_ITEMS, starters: STARTER_ITEMS, limits: GROUND_LIMITS } = loadGroundItems({ ...DEFS, starterItems: STARTER_QTY });   // validated again by origins/world/ground-items.test.ts
