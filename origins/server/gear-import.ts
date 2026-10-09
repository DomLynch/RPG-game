// POST /origins/gear_import {character, owned, equipped, tiers?}: the ONE-TIME migration of a player's local gear (src/loot.ts's Loot: owned / equipped / the rung each piece was taken at) into
// their server inventory, on their next signed-in load. Idempotent PER PIECE, not per call: the mint key is items.ts legacyUnlockMintKey(account, lootId) (one migrated copy per account per
// piece, ever), so a repeat adds nothing, and a stale device that signed in later (with pieces the first one never had) adds exactly the difference. Nobody loses armour: nothing is removed
// anywhere, an unknown LootId is reported (skipped), never fatal, and a refusal commits nothing (one origins_apply batch, all or nothing).
// Where the pieces land (Lead's ruling, 2026-10-09): the worn map goes on the paperdoll as it was (a mint straight onto the slot; the rank gate is a rule for NEW equips, the old ledger wore
// from Recruit), unless the slot is already taken (nothing is displaced: that piece goes to the pack); the rest go to the pack while it has room and the overflow to the BANK grid (a mint,
// no Exchange); worn pieces count toward neither grid. The whole result is checked by inventory.openInventory (custody, one of each, slots), so no placement rule is re-implemented here.
import { createHash } from 'node:crypto';
import { TITLES } from '../../src/career.ts';
import { PAPERDOLL, isLootId, paperdollOf, slotOf, type Paperdoll } from '../../src/loot.ts';
import { accountIdFromAuthUid, type CharacterInstanceId } from '../contracts/ids.ts';
import { legacyUnlockMintKey, parseItemInstance, type ItemInstance } from '../contracts/items.ts';
import { firstFree, openInventory, type Inventory } from '../inventory/inventory.ts';
import { Refused } from './errors.ts';
import { BadRequest, Conflict, type Handler } from './handlers.ts';
import { openHoldingsWith, type Content } from './holdings.ts';
import { DbError } from './db.ts';
import { mintOp } from './mob-rewards.ts';
import * as store from './store.ts';

export const MAX_OWNED = 200;   // src/loot.ts knows ~75 pieces; the cap only bounds a hostile body
export type ImportReceipt = { imported: string[]; alreadyHeld: string[]; skipped: { lootId: string; reason: string }[]; worn: string[]; bank: string[]; unworn: { lootId: string; reason: string }[]; replayed: boolean };
const DOLLS = new Set(Object.keys(PAPERDOLL));

const listOf = (v: unknown): string[] => { if (!Array.isArray(v) || v.length > MAX_OWNED || v.some((x) => typeof x !== 'string' || x.length > 40)) throw new BadRequest(`owned: up to ${MAX_OWNED} LootIds`); return v as string[]; };
const mapOf = (v: unknown, name: string): Record<string, unknown> => { if (v === undefined || v === null) return {}; if (typeof v !== 'object' || Array.isArray(v)) throw new BadRequest(`${name}: an object`); return v as Record<string, unknown>; };

// The plan: the instances to mint (with their places) and the receipt, from what the character holds now. Pure; the caller commits.
export function planImport(inv: Inventory, heldKeys: ReadonlySet<string>, input: { owned: string[]; equipped: Record<string, unknown>; tiers: Record<string, unknown> }, lookup: Parameters<typeof openInventory>[1], at: string): { mint: ItemInstance[]; receipt: ImportReceipt } {
  const receipt: ImportReceipt = { imported: [], alreadyHeld: [], skipped: [], worn: [], bank: [], unworn: [], replayed: false };
  const wornBy = new Map<string, Paperdoll>(), extra: string[] = [];   // lootId -> the paperdoll slot the old ledger had it on
  for (const [doll, id] of Object.entries(input.equipped)) {
    if (typeof id !== 'string' || !isLootId(id)) { receipt.skipped.push({ lootId: String(id), reason: 'not a LootId this game knows' }); continue; }   // nothing to mint
    // A worn piece that cannot be worn where the old ledger said is STILL OWNED: it falls back to the pack/bank (below), reported in `unworn`, never dropped.
    if (!DOLLS.has(doll) || paperdollOf(slotOf(id)) !== doll) { receipt.unworn.push({ lootId: id, reason: `not wearable on ${doll}` }); extra.push(id); continue; }
    wornBy.set(id, doll as Paperdoll);
  }
  const account = accountIdFromAuthUid(inv.account.slice('account:'.length));
  if (!account.ok) throw new BadRequest('the verified account is not a uuid');
  const sorted = [...new Set(input.owned.concat([...wornBy.keys()], extra))].sort();   // a worn piece is owned even if the list forgot it
  const taken = new Set(inv.items.map((i) => `${i.location.kind}:${(i.location as { slot?: string }).slot ?? ''}`));
  let items = [...inv.items];
  const mint: ItemInstance[] = [];
  for (const id of sorted) {
    if (!isLootId(id)) { receipt.skipped.push({ lootId: id, reason: 'not a LootId this game knows' }); continue; }
    const key = legacyUnlockMintKey(inv.account, id);
    if (heldKeys.has(key)) { receipt.alreadyHeld.push(id); continue; }
    const rung = Number(input.tiers[id]), known = Number.isInteger(rung) && rung >= 1 && rung <= TITLES.length;
    const doll = wornBy.get(id), dollKey = doll ? `equipped:${doll}` : '';
    const wear = !!doll && !taken.has(dollKey);
    if (doll && !wear) receipt.unworn.push({ lootId: id, reason: `the ${doll} slot is already worn` });   // owned, so it goes to the pack/bank
    const opponent = id.split('.')[0]!;
    // a free pack slot, else the bank (the ruling); worn pieces take neither
    const probe = openInventory({ owner: inv.owner, account: inv.account, items, packSize: inv.packSize, bankSize: inv.bankSize }, lookup);
    if (!probe.ok) throw new Refused(422, `the inventory does not hold together: ${probe.issues[0]!.message}`, 'rule');
    const pack = firstFree(probe.value, 'pack'), bank = firstFree(probe.value, 'bank');
    const places: { kind: string; owner: CharacterInstanceId; index?: number; slot?: Paperdoll }[] = [];
    if (wear) places.push({ kind: 'equipped', owner: inv.owner, slot: doll });
    if (pack >= 0) places.push({ kind: 'pack', owner: inv.owner, index: pack }); else if (bank >= 0) places.push({ kind: 'bank', owner: inv.owner, index: bank });
    let placed: { inst: ItemInstance; location: (typeof places)[number] } | undefined, why = places.length ? '' : 'pack and bank are full';
    for (const location of places) {   // the worn place first; if it is refused for ANY reason the piece still lands in the pack/bank
      const parsed = parseItemInstance({
        kind: 'item-instance', schemaVersion: 1, id: `inst:legacy-${createHash('sha256').update(`${inv.account}|${id}`).digest('hex').slice(0, 24)}`, item: `item:loot.${id}`, version: 0, quantity: 1,
        tier: TITLES[known ? rung - 1 : 0], location, boundTo: null,
        provenance: { kind: 'legacy-unlock', mintKey: key, at, account: inv.account, lootId: id, wonBy: inv.owner, fromLegend: known ? `${opponent}-${rung}` : null, atRank: known ? TITLES[rung - 1] : null }, history: [],
      }, `pieces[${id}]`);
      if (!parsed.ok) { why = parsed.issues[0]!.message; continue; }
      const next = openInventory({ owner: inv.owner, account: inv.account, items: [...items, parsed.value], packSize: inv.packSize, bankSize: inv.bankSize }, lookup);
      if (!next.ok) { why = next.issues[0]!.message; continue; }
      placed = { inst: parsed.value, location }; break;
    }
    if (!placed) { receipt.skipped.push({ lootId: id, reason: why }); continue; }
    if (wear && placed.location.kind !== 'equipped') receipt.unworn.push({ lootId: id, reason: why || 'the slot refused it' });
    const parsed = { value: placed.inst }, location = placed.location;
    items = [...items, parsed.value]; mint.push(parsed.value); receipt.imported.push(id);
    if (location.kind === 'equipped') { taken.add(dollKey); receipt.worn.push(id); } else if (location.kind === 'bank') receipt.bank.push(id);
  }
  return { mint, receipt };
}

// mintOp carries a pack/bank index only; a piece minted straight onto the paperdoll also needs its slot (origins_items: equipped = owner + slot, no index).
const mintLegacy = (inst: ItemInstance): store.Json => {
  const m = mintOp(inst, true) as { op: string; item: { loc: Record<string, unknown> } };
  if (inst.location.kind === 'equipped') m.item.loc = { kind: 'equipped', owner: inst.location.owner, slot: inst.location.slot };
  return m as unknown as store.Json;
};

export function gearImportHandler(content: Content): Handler {
  const lookup = content.lookup;
  return async ({ db, account }, body) => {
    const character = body.character;
    if (typeof character !== 'string' || character.length > 80) throw new BadRequest('character: a character id');
    const input = { owned: listOf(body.owned), equipped: mapOf(body.equipped, 'equipped'), tiers: mapOf(body.tiers, 'tiers') };
    const { inventory, snap } = await openHoldingsWith(db, account, character, content);
    // every legacy mint key this ACCOUNT holds (any of its characters): a piece is migrated once per account
    const heldKeys = new Set((snap.items as { mint_key: string }[]).map((r) => r.mint_key));
    const at = new Date().toISOString();
    const { mint, receipt } = planImport(inventory, heldKeys, input, lookup, at);
    if (!mint.length) return receipt;
    const eventId = `gear-import:${character}:${createHash('sha256').update(mint.map((m) => m.provenance.mintKey).join(',')).digest('hex').slice(0, 16)}`;
    const batch: store.Json[] = [
      { op: 'event', event_id: eventId, kind: 'mint', account, character, payload: { receipt } },
      ...mint.map(mintLegacy),
    ];
    try { await store.commit(db, account, batch); }
    catch (e) {
      if (e instanceof DbError && e.code === 'O0001') { const prior = (await store.event(db, account, eventId))?.payload as { receipt?: ImportReceipt } | undefined; if (prior?.receipt) return { ...prior.receipt, replayed: true }; }   // a racing identical import committed first
      if (e instanceof DbError && e.code === 'O0002') throw new Conflict('stale: the pack changed since it was read; open again and retry');
      throw e;
    }
    return receipt;
  };
}
export type { CharacterInstanceId };
