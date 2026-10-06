// One character's stored items -> the pure inventory module's Holdings. Rows come from origins_open (the token's account only), so a character
// of another account is simply not there. A row the contracts refuse is a server fault (500), never repaired here.
import { accountIdFromAuthUid, type CharacterInstanceId } from '../contracts/ids.ts';
import { parseItemInstance, type ItemInstance } from '../contracts/items.ts';
import { openInventory, type Inventory, type Lookup } from '../inventory/inventory.ts';
import { BadRequest } from './handlers.ts';
import type { Db } from './db.ts';
import * as store from './store.ts';

export type Content = { lookup: Lookup };
type Row = store.Json & { id: string; loc_kind: string | null; loc_owner: string | null; mint_key: string; provenance: store.Json };

// The stored row as an ItemInstance. A split child keeps its parent's provenance in the database but carries its own mint key (parent::s<v>),
// which is the key the pure module counts by.
export function instanceOf(row: Row): ItemInstance {
  const location = row.loc_kind === 'equipped' ? { kind: 'equipped', owner: row.loc_owner, slot: row.loc_slot } : { kind: row.loc_kind, owner: row.loc_owner, index: row.loc_index };
  const parsed = parseItemInstance({
    kind: 'item-instance', schemaVersion: 1, id: row.id, item: row.item, version: row.version, quantity: row.quantity, tier: row.tier,
    ...(row.upgrade_level ? { upgradeLevel: row.upgrade_level } : {}), location, boundTo: row.bound_to, provenance: { ...row.provenance, mintKey: row.mint_key }, history: row.history,
  });
  if (!parsed.ok) throw Error(`stored item ${row.id} does not parse: ${parsed.issues.map(i => `${i.path} ${i.code}`).join(', ')}`);
  return parsed.value;
}

export async function openHoldings(db: Db, account: string, character: unknown, content: Content): Promise<Inventory> {
  const snap = await store.open(db, account);
  const pc = snap.characters.find(c => c.id === character);
  if (!pc || typeof character !== 'string') throw new BadRequest('character: not one of this account\'s characters');
  const rows = (snap.items as Row[]).filter(r => r.loc_owner === character && (r.loc_kind === 'pack' || r.loc_kind === 'bank' || r.loc_kind === 'equipped'));
  const owner = accountIdFromAuthUid(account.toLowerCase());
  if (!owner.ok) throw Error('the verified account is not a uuid');
  const inv = openInventory({
    owner: character as CharacterInstanceId, account: owner.value, items: rows.map(instanceOf), packSize: Number(pc.pack_slots), bankSize: Number(pc.bank_slots),
  }, content.lookup);
  if (!inv.ok) throw Error(`stored holdings of ${character} do not hold: ${inv.issues.map(i => `${i.path} ${i.code}`).join(', ')}`);
  return inv.value;
}
