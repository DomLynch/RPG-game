// Test-only builders for the inventory tests: definitions, instances and an empty inventory, all parsed through the O1 contracts so a
// fixture can never be a shape the contracts would refuse. Example content only; none of it ships.
import assert from 'node:assert/strict';
import type { Result } from '../contracts/core.ts';
import { parseTrade, type Trade } from '../contracts/economy.ts';
import * as F from '../contracts/fixtures.ts';
import type { AccountId, CharacterInstanceId, ItemId } from '../contracts/ids.ts';
import { parseItemDefinition, parseItemInstance, type ItemDefinition, type ItemInstance } from '../contracts/items.ts';
import type { CareerStanding } from '../contracts/world.ts';
import { BANK_PLACE, openInventory, type Inventory, type Lookup } from './inventory.ts';

export const PC = F.PC as CharacterInstanceId;
export const ACCOUNT = F.ACCOUNT as AccountId;
export const RIVAL = F.OTHER_PC as CharacterInstanceId;
export const RIVAL_ACCOUNT = F.OTHER_ACCOUNT as AccountId;
export const EXCHANGE = BANK_PLACE;
export const FRONTIER = 'region:ash-frontier';

type Raw = Record<string, unknown>;
const mustDef = (raw: Raw): ItemDefinition => { const r = parseItemDefinition(raw); assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };
const mustInst = (raw: Raw): ItemInstance => { const r = parseItemInstance(raw); assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };

const gear = (lootId: string, slot: string, name: string): ItemDefinition => mustDef({ ...F.helmetDef(), id: `item:loot.${lootId}`, slot, name, appearance: { asset: `loot.glb/${lootId}` } });
export const DEFS: readonly ItemDefinition[] = [
  gear('veteran.Helmet', 'Helmet', "The Centurion's helmet"),
  gear('veteran.Body', 'Body', "The Centurion's cuirass"),
  gear('witch.Helmet', 'Helmet', "The Witch's hood"),
  mustDef(F.graveIronDef()), // stackable material, stack 50
  mustDef(F.recordDef()), // story-critical quest item, binds on acquire
];
const DEF_MAP: ReadonlyMap<string, ItemDefinition> = new Map(DEFS.map((d) => [d.id, d]));
export const lookup: Lookup = (id: ItemId) => DEF_MAP.get(id);

// Where a fresh piece sits before it arrives: a mint escrow. `receive` gives it its pack location.
const MINT = { kind: 'trade-escrow', container: 'container:mint', from: F.PC };

// A Pit-won piece: arena-award provenance naming who won it, from which legend, at which rank, when.
export function pitPiece(id: string, lootId: string, claimId: number, rung: number, tier: string): ItemInstance {
  return mustInst({
    kind: 'item-instance', schemaVersion: 1, id, item: `item:loot.${lootId}`, version: 0, quantity: 1, tier, location: MINT, boundTo: null,
    provenance: { kind: 'arena-award', mintKey: `claim:${claimId}`, at: F.AT, claimId, lootId, wonBy: F.PC, fromLegend: `${lootId.split('.')[0]}-${rung}`, atRank: tier },
    history: [],
  });
}
export function ironStack(id: string, quantity: number, mint: string): ItemInstance {
  return mustInst({ ...F.ironInstance(), id, quantity, location: MINT, provenance: { ...F.ironInstance().provenance, mintKey: `loot:ruin-vigil:${mint}` } });
}
export const record = (): ItemInstance => mustInst({ ...F.recordInstance(), location: MINT, boundTo: null });

export const helm = (): ItemInstance => pitPiece('inst:helm-0001', 'veteran.Helmet', 1001, 3, 'Gladiator');
export const helmCopy = (): ItemInstance => pitPiece('inst:helm-0002', 'veteran.Helmet', 1002, 1, 'Recruit');
export const body = (): ItemInstance => pitPiece('inst:body-0001', 'veteran.Body', 1003, 1, 'Recruit');
export const hood = (): ItemInstance => pitPiece('inst:hood-0001', 'witch.Helmet', 1004, 10, 'Origin');

// The rival gives PC the `offered` pieces at the Exchange (both accepted), from escrow `container:trade.7`, where `escrowed` puts them.
export const gift = (offered: string[]): Trade => value(parseTrade({
  kind: 'trade', schemaVersion: 1, id: 'container:trade.7', region: EXCHANGE, version: 1,
  sides: [{ character: RIVAL, account: RIVAL_ACCOUNT, offered, accepted: true }, { character: PC, account: ACCOUNT, offered: [], accepted: true }],
}));
export const escrowed = (inst: ItemInstance): ItemInstance => ({ ...inst, location: { kind: 'trade-escrow', container: 'container:trade.7' as never, from: RIVAL } });
export const LATER = '2026-10-07T09:30:00Z';

export function empty(packSize = 4, bankSize = 4, owner = PC, account = ACCOUNT): Inventory {
  const r = openInventory({ owner, account, items: [], packSize, bankSize }, lookup);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.issues));
  return r.value;
}
export function value<T>(r: Result<T>): T {
  assert.ok(r.ok, `expected ok; got ${JSON.stringify(!r.ok && r.issues)}`);
  return r.value;
}
export function refused(r: Result<unknown>, code: string, path?: string): void {
  assert.equal(r.ok, false, `expected refusal ${code}${path ? ` at ${path}` : ''}`);
  if (r.ok) return;
  assert.ok(r.issues.some((i) => i.code === code && (path === undefined || i.path === path)), `want ${code}${path ? ` at ${path}` : ''}; got ${JSON.stringify(r.issues)}`);
}
// A server standing at a career level (Gladiator is levels 11..15, Origin 46).
export const server = (careerLevel: number): CareerStanding => ({ source: 'server', careerLevel });

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
