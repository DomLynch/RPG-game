// O1 economy: direct trade (Exchange-only, one of each, provenance kept, history appended, upgrade level travels) and the blacksmith's
// upgrade service (caps never passed, no-effect refused, idempotent receipts, stale versions refused, priced from a data table).
import assert from 'node:assert/strict';
import test from 'node:test';
import { CAPS } from '../../src/gear-stats.ts';
import type { Result } from './core.ts';
import {
  CONCORD_EXCHANGE, MAX_UPGRADE_MATERIAL_INPUTS, acceptTrade, changeOffer, parseServiceDefinition, parseTrade, parseUpgradeCostTable, parseUpgradeReceipt, parseUpgradeRequest, performUpgrade, settleTrade,
  type ServiceDefinition, type Trade, type UpgradeCostTable, type UpgradeInput, type UpgradeReceipt, type UpgradeRequest,
} from './economy.ts';
import * as F from './fixtures.ts';
import type { AccountId, CharacterInstanceId, ItemId, ItemInstanceId, RegionId } from './ids.ts';
import {
  PACK_SLOTS, checkHistoryKept, parseItemDefinition, parseItemInstance, piecePoints, resolveLoadout, type ItemDefinition, type ItemInstance,
} from './items.ts';

type Raw = Record<string, unknown>;
const refused = (r: Result<unknown>, code: string, path?: string): void => {
  assert.equal(r.ok, false, `expected ${code}${path ? ` at ${path}` : ''}`);
  if (r.ok) return;
  assert.ok(r.issues.some((i) => i.code === code && (path === undefined || i.path === path)), `want ${code}${path ? ` at ${path}` : ''}; got ${JSON.stringify(r.issues)}`);
};
const must = <T>(r: Result<T>): T => { assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };
const PC = F.PC as CharacterInstanceId, OTHER = F.OTHER_PC as CharacterInstanceId;
const ACCOUNTS: Record<string, AccountId> = { [F.PC]: F.ACCOUNT as AccountId, [F.OTHER_PC]: F.OTHER_ACCOUNT as AccountId };
const accountOf = (pc: CharacterInstanceId): AccountId | undefined => ACCOUNTS[pc];
const DEFS = new Map<ItemId, ItemDefinition>([F.helmetDef(), F.graveIronDef(), F.recordDef(), F.tokenDef()].map((raw) => { const d = must(parseItemDefinition(raw)); return [d.id, d]; }));
const lookup = (id: ItemId): ItemDefinition | undefined => DEFS.get(id);
const helmetDef = DEFS.get('item:loot.veteran.Helmet' as ItemId)!;
const LATER = '2026-10-09T12:00:00Z'; // exactly FIRST_TRADE_DELAY_S (72 h) after F.AT, when a fresh piece may first trade
const packs = (): number => PACK_SLOTS;

// ---- trade ------------------------------------------------------------------------------------------------------------------------

const TRADE = 'container:trade.42';
const escrow = (from: string) => ({ kind: 'trade-escrow', container: TRADE, from });
const offeredHelmet = (patch: Raw = {}): ItemInstance => must(parseItemInstance({ ...F.helmetInstance(), id: 'inst:h', location: escrow(F.PC), upgradeLevel: 2, ...patch }));
// The other side's piece: a single-copy cosmetic (stackables never trade, Dom 2026-10-07), looted by the rival at F.AT.
const offeredToken = (patch: Raw = {}): ItemInstance => must(parseItemInstance({ ...F.ironInstance(), id: 'inst:t', item: 'item:ferry-token', quantity: 1, location: escrow(F.OTHER_PC), provenance: { ...F.ironInstance().provenance, wonBy: F.OTHER_PC }, ...patch }));
const held = (): ItemInstance[] => [offeredHelmet(), offeredToken()];
const tradeRaw = (patch: Raw = {}): Raw => ({
  kind: 'trade', schemaVersion: 1, id: TRADE, region: 'region:concord-exchange', version: 2,
  sides: [{ character: F.PC, account: F.ACCOUNT, offered: ['inst:h'], accepted: true }, { character: F.OTHER_PC, account: F.OTHER_ACCOUNT, offered: ['inst:t'], accepted: true }],
  ...patch,
});
const trade = (patch: Raw = {}): Trade => must(parseTrade(tradeRaw(patch)));

test('trade: parses, and refuses malformed trades', () => {
  trade();
  const sides = tradeRaw().sides as Raw[];
  refused(parseTrade(tradeRaw({ schemaVersion: 2 })), 'unsupported-version');
  refused(parseTrade(tradeRaw({ sides: [sides[0]] })), 'out-of-range', 'sides');
  refused(parseTrade(tradeRaw({ sides: [sides[0], { ...sides[1], account: F.ACCOUNT }] })), 'rule-violation', 'sides');
  refused(parseTrade(tradeRaw({ sides: [{ ...sides[0], offered: [] }, { ...sides[1], offered: [] }] })), 'rule-violation', 'sides');
  refused(parseTrade(tradeRaw({ sides: [sides[0], { ...sides[1], offered: ['inst:h'] }] })), 'duplicate-id', 'sides');
  refused(parseTrade(tradeRaw({ region: 'exchange' })), 'bad-id', 'region');
});

test('trade: any offer change clears both accepts and bumps the version; a stale accept is refused', () => {
  const t = trade();
  const changed = must(changeOffer(t, OTHER, [], 2, held(), lookup, LATER));
  assert.deepEqual([changed.version, changed.sides[0].accepted, changed.sides[1].accepted, changed.sides[1].offered], [3, false, false, []]);
  refused(changeOffer(t, OTHER, [], 1, held(), lookup, LATER), 'version-conflict', 'version');
  refused(changeOffer(t, 'pc:stranger' as CharacterInstanceId, [], 2, held(), lookup, LATER), 'rule-violation', 'character');
  refused(acceptTrade(changed, PC, 2), 'version-conflict', 'version'); // accepted the offer before it changed
  const accepted = must(acceptTrade(changed, PC, 3));
  assert.deepEqual([accepted.sides[0].accepted, accepted.version], [true, 3]);
});

test('trade: settles at the Exchange; provenance and upgrade level travel; history gains one trade entry', () => {
  const h = offeredHelmet(), i = offeredToken();
  const moved = must(settleTrade(trade(), [h, i], lookup, accountOf, LATER, packs));
  const newH = moved.find((m) => m.id === h.id)!, newI = moved.find((m) => m.id === i.id)!;
  assert.deepEqual(newH.location, { kind: 'pack', owner: OTHER, index: 0 });
  assert.deepEqual(newI.location, { kind: 'pack', owner: PC, index: 0 });
  assert.equal(newH.version, h.version + 1);
  assert.equal(newH.upgradeLevel, 2, 'the upgrade level travels with the piece');
  assert.deepEqual(newH.provenance, h.provenance, 'still won by the original winner, from the same legend, at the same rank');
  assert.deepEqual(newH.history.at(-1), { kind: 'trade', trade: TRADE, from: PC, to: OTHER, at: LATER });
  assert.deepEqual(checkHistoryKept(h, newH), []);
});

test('trade: a gift is a trade with one empty side', () => {
  const t = trade({ sides: [{ character: F.PC, account: F.ACCOUNT, offered: ['inst:h'], accepted: true }, { character: F.OTHER_PC, account: F.OTHER_ACCOUNT, offered: [], accepted: true }] });
  const moved = must(settleTrade(t, [offeredHelmet()], lookup, accountOf, LATER, packs));
  assert.equal(moved.length, 1);
});

test('trade: refused anywhere but the Concord Exchange, unaccepted, or with a forged side', () => {
  refused(settleTrade(trade({ region: 'region:ash-frontier' }), [offeredHelmet(), offeredToken()], lookup, accountOf, LATER, packs), 'rule-violation', 'region');
  const t = trade();
  const unaccepted: Trade = { ...t, sides: [t.sides[0], { ...t.sides[1], accepted: false }] };
  refused(settleTrade(unaccepted, [offeredHelmet(), offeredToken()], lookup, accountOf, LATER, packs), 'rule-violation', 'sides[1].accepted');
  const forged: Trade = { ...t, sides: [{ ...t.sides[0], account: 'account:11111111-2222-4333-8444-555555555555' as AccountId }, t.sides[1]] };
  refused(settleTrade(forged, [offeredHelmet(), offeredToken()], lookup, accountOf, LATER, packs), 'rule-violation', 'sides[0].account');
});

test('trade: one of each — a trade that would give a player a second copy is invalid and moves nothing', () => {
  const theirs = must(parseItemInstance({ ...F.helmetInstance(), id: 'inst:theirs', location: { kind: 'bank', owner: F.OTHER_PC, index: 3 }, provenance: { ...F.helmetInstance().provenance, mintKey: 'claim:5555', wonBy: F.OTHER_PC } }));
  const r = settleTrade(trade(), [offeredHelmet(), offeredToken(), theirs], lookup, accountOf, LATER, packs);
  refused(r, 'rule-violation');
  assert.ok(!r.ok && r.issues[0]!.message.includes('one of each'));
});

test('trade: escrow, binding and capacity rules', () => {
  // A piece in this trade's escrow that is not on the offer.
  const stray = must(parseItemInstance({ ...F.ironInstance(), id: 'inst:stray', location: escrow(F.OTHER_PC), provenance: { ...F.ironInstance().provenance, mintKey: 'loot:stray-0001' } }));
  refused(settleTrade(trade(), [offeredHelmet(), offeredToken(), stray], lookup, accountOf, LATER, packs), 'rule-violation', 'inst:stray');
  // An offered piece that is not in escrow, or not in the holdings at all.
  refused(settleTrade(trade(), [offeredHelmet({ location: { kind: 'bank', owner: F.PC, index: 0 } }), offeredToken()], lookup, accountOf, LATER, packs), 'rule-violation', 'sides[0].offered[0]');
  refused(settleTrade(trade(), [offeredToken()], lookup, accountOf, LATER, packs), 'unknown-id', 'sides[0].offered[0]');
  // A bound piece cannot change hands.
  const token = must(parseItemInstance({ ...F.ironInstance(), id: 'inst:h', item: 'item:ferry-token', quantity: 1, location: escrow(F.PC), boundTo: null }));
  refused(settleTrade(trade(), [{ ...token, boundTo: PC }, offeredToken()], lookup, accountOf, LATER, packs), 'rule-violation', 'sides[0].offered[0]');
  // A full pack refuses the trade instead of dropping the piece on the floor.
  const full: ItemInstance[] = Array.from({ length: PACK_SLOTS }, (_, k) => must(parseItemInstance({ ...F.ironInstance(), id: `inst:fill-${k}`, location: { kind: 'pack', owner: F.OTHER_PC, index: k }, provenance: { ...F.ironInstance().provenance, mintKey: `loot:fill-${String(k).padStart(4, '0')}` } })));
  refused(settleTrade(trade(), [offeredHelmet(), offeredToken(), ...full], lookup, accountOf, LATER, packs), 'rule-violation', 'sides[0].offered[0]');
  // The receiver's real pack size counts, never an assumed 64: one used slot in a 1-slot pack is full; a bad size is refused.
  refused(settleTrade(trade(), [offeredHelmet(), offeredToken(), full[0]!], lookup, accountOf, LATER, () => 1), 'rule-violation', 'sides[0].offered[0]');
  for (const bad of [0, PACK_SLOTS + 1, 1.5, Number.NaN]) refused(settleTrade(trade(), [offeredHelmet(), offeredToken()], lookup, accountOf, LATER, () => bad), 'out-of-range');
});

test('trade: a piece listed twice is refused (duplicate-id) wherever the list comes from, and never moves twice', () => {
  const t = trade();
  const ids = (...xs: string[]): ItemInstanceId[] => xs as ItemInstanceId[];
  refused(changeOffer(t, PC, ids('inst:h', 'inst:h'), 2, held(), lookup, LATER), 'duplicate-id', 'offered');
  refused(changeOffer(t, OTHER, ids('inst:t', 'inst:h'), 2, held(), lookup, LATER), 'duplicate-id', 'offered'); // already on the other side
  // A trade built without parseTrade (a server object, a bug elsewhere) is still refused at settlement.
  const doubled: Trade = { ...t, sides: [{ ...t.sides[0], offered: ids('inst:h', 'inst:h') }, t.sides[1]] };
  refused(settleTrade(doubled, [offeredHelmet(), offeredToken()], lookup, accountOf, LATER, packs), 'duplicate-id', 'sides');
  const crossed: Trade = { ...t, sides: [t.sides[0], { ...t.sides[1], offered: ids('inst:t', 'inst:h') }] };
  refused(settleTrade(crossed, [offeredHelmet(), offeredToken()], lookup, accountOf, LATER, packs), 'duplicate-id', 'sides');
  // The same holding passed twice (two rows for one id) is refused, not resolved by whichever copy wins.
  refused(settleTrade(t, [offeredHelmet(), offeredHelmet({ version: 9 }), offeredToken()], lookup, accountOf, LATER, packs), 'duplicate-id', 'holdings');
});

// ---- service, cost table, request and receipt contracts ---------------------------------------------------------------------------

test('service and cost table: fixtures parse; costs are data with a revision', () => {
  must(parseServiceDefinition(F.blacksmith()));
  const costs = must(parseUpgradeCostTable(F.forgeCosts()));
  assert.equal(costs.revision, 1);
  refused(parseServiceDefinition({ ...F.blacksmith(), service: 'craft' }), 'wrong-type', 'service'); // crafting stays out
  refused(parseServiceDefinition({ ...F.blacksmith(), accepts: 'shields' }), 'wrong-type', 'accepts');
  refused(parseServiceDefinition({ ...F.blacksmith(), npc: 'pc:dom-1' }), 'wrong-namespace', 'npc');
  const rows = F.forgeCosts().rows;
  refused(parseUpgradeCostTable({ ...F.forgeCosts(), currency: 'gold' }), 'wrong-type', 'currency');
  refused(parseUpgradeCostTable({ ...F.forgeCosts(), rows: [...rows, rows[0]] }), 'duplicate-id', 'rows[3]');
  refused(parseUpgradeCostTable({ ...F.forgeCosts(), rows: [rows[1]] }), 'rule-violation', 'rows'); // level 2 with no level 1
  refused(parseUpgradeCostTable({ ...F.forgeCosts(), rows: [{ ...rows[0], coin: -1 }] }), 'out-of-range', 'rows[0].coin');
  refused(parseUpgradeCostTable({ ...F.forgeCosts(), rows: [{ ...rows[0], level: 10 }] }), 'out-of-range', 'rows[0].level');
  refused(parseUpgradeCostTable({ ...F.forgeCosts(), rows: [{ ...rows[0], materials: [{ item: 'item:grave-iron', quantity: 1 }, { item: 'item:grave-iron', quantity: 2 }] }] }), 'duplicate-id', 'rows[0].materials');
});

const requestRaw = (patch: Raw = {}): Raw => ({
  kind: 'upgrade-request', schemaVersion: 1, idempotencyKey: 'upgrade:req-0001', character: F.PC, service: 'service:exchange-forge', instance: 'inst:5f0c2d4e-0001', expectedVersion: 3, toLevel: 1, ...patch,
});

test('upgrade request: parses, and refuses malformed requests', () => {
  must(parseUpgradeRequest(requestRaw()));
  refused(parseUpgradeRequest(requestRaw({ idempotencyKey: 'x' })), 'wrong-type', 'idempotencyKey');
  refused(parseUpgradeRequest(requestRaw({ toLevel: 0 })), 'out-of-range', 'toLevel');
  refused(parseUpgradeRequest(requestRaw({ toLevel: 10 })), 'out-of-range', 'toLevel');
  refused(parseUpgradeRequest(requestRaw({ coin: 5 })), 'unknown-field', 'coin'); // the client never names a price
});

// ---- the blacksmith -----------------------------------------------------------------------------------------------------------------

const SERVICE = (): ServiceDefinition => must(parseServiceDefinition(F.blacksmith()));
const COSTS = (): UpgradeCostTable => must(parseUpgradeCostTable(F.forgeCosts()));
const input = (patch: Partial<UpgradeInput> = {}, request: Raw = {}): UpgradeInput => ({
  request: must(parseUpgradeRequest(requestRaw(request))), service: SERVICE(), costs: COSTS(), instance: must(parseItemInstance(F.helmetInstance())), def: helmetDef,
  standing: { source: 'server', careerLevel: 16 }, balance: 1000, materials: [], materialDefs: lookup, receipts: new Map(), now: LATER, ...patch,
});

test('upgrade: one level, charged from the table, stamped with a receipt and a history entry; provenance kept', () => {
  const before = input().instance;
  const out = must(performUpgrade(input()));
  assert.ok(!out.replayed);
  assert.deepEqual([out.instance.upgradeLevel, out.instance.version, out.balance], [1, before.version + 1, 900]);
  assert.deepEqual(out.instance.provenance, before.provenance);
  assert.deepEqual(out.instance.history.at(-1), { kind: 'upgrade', smith: 'character:smith-orla', level: 1, receipt: 'upgrade:req-0001', at: LATER });
  assert.deepEqual(checkHistoryKept(before, out.instance), []);
  assert.ok(piecePoints(out.instance, helmetDef) > piecePoints(before, helmetDef));
  assert.deepEqual([out.receipt.fromLevel, out.receipt.toLevel, out.receipt.coin, out.receipt.costTable, out.receipt.costRevision, out.receipt.smith], [0, 1, 100, 'costtable:forge', 1, 'character:smith-orla']);
  assert.deepEqual(must(parseUpgradeReceipt(out.receipt)), out.receipt, 'the receipt round-trips through its own contract');
});

test('upgrade: a materials-only table (coin 0) upgrades with no coin and charges none', () => {
  const free = must(parseUpgradeCostTable({ ...F.forgeCosts(), rows: F.forgeCosts().rows.map(r => ({ ...r, coin: 0 })) }));
  const out = must(performUpgrade(input({ costs: free, balance: 0 })));
  assert.ok(!out.replayed);
  assert.deepEqual([out.instance.upgradeLevel, out.balance, out.receipt.coin], [1, 0, 0]);
  assert.deepEqual(must(parseUpgradeReceipt(out.receipt)), out.receipt);
});

test('upgrade: idempotent — a repeated request returns the same receipt and changes nothing; a reused key for another request is refused', () => {
  const first = must(performUpgrade(input()));
  assert.ok(!first.replayed);
  const receipts = new Map<string, UpgradeReceipt>([[first.receipt.idempotencyKey, first.receipt]]);
  // The retry arrives after commit, carrying the now-stale version: it still gets the original receipt, not a version conflict.
  const again = must(performUpgrade(input({ receipts, instance: first.instance })));
  assert.deepEqual(again, { replayed: true, receipt: first.receipt });
  refused(performUpgrade(input({ receipts }, { toLevel: 2 })), 'duplicate-id', 'idempotencyKey');
  // A new key with a stale version is refused.
  refused(performUpgrade(input({ receipts, instance: first.instance }, { idempotencyKey: 'upgrade:req-0002', toLevel: 2 })), 'version-conflict', 'expectedVersion');
});

test('upgrade: materials are optional cost lines, spent all-or-nothing in order', () => {
  const at1 = must(parseItemInstance({ ...F.helmetInstance(), upgradeLevel: 1 }));
  const iron = (quantity: number, id = 'inst:iron', index = 4): ItemInstance => must(parseItemInstance({ ...F.ironInstance(), id, quantity, location: { kind: 'bank', owner: F.PC, index }, provenance: { ...F.ironInstance().provenance, mintKey: `loot:${id.slice(5)}-mint` } }));
  const level2 = (materials: ItemInstance[]) => performUpgrade(input({ instance: at1, materials, standing: { source: 'server', careerLevel: 21 } }, { toLevel: 2 }));
  const partly = must(level2([iron(12)]));
  assert.ok(!partly.replayed);
  assert.deepEqual([partly.balance, partly.materials.map((m) => m.quantity), partly.consumed], [750, [7], []]);
  const split = must(level2([iron(3, 'inst:iron-a', 1), iron(4, 'inst:iron-b', 2)]));
  assert.ok(!split.replayed);
  assert.deepEqual([split.consumed, split.materials.map((m) => m.quantity), split.receipt.materials.map((m) => m.quantity)], [['inst:iron-a'], [2], [3, 2]]);
  refused(level2([iron(3)]), 'rule-violation', 'materials');
  refused(level2([{ ...iron(12), location: { kind: 'bank', owner: OTHER, index: 0 } }]), 'rule-violation', 'materials'); // not yours
  refused(level2([]), 'rule-violation', 'materials');
});

test('upgrade: the caps are never passed — a Recruit piece climbs to Origin worth and then the smith refuses', () => {
  const allLevels = { ...F.forgeCosts(), rows: Array.from({ length: 9 }, (_, k) => ({ level: k + 1, rarity: 'common', coin: 10, materials: [] })) };
  let piece = must(parseItemInstance({ ...F.helmetInstance(), tier: 'Recruit', location: { kind: 'pack', owner: F.PC, index: 0 }, provenance: { ...F.helmetInstance().provenance, atRank: 'Recruit', fromLegend: 'veteran-1' } }));
  let bought = 0;
  for (let level = 1; level <= 9; level++) {
    const r = performUpgrade(input({ instance: piece, costs: must(parseUpgradeCostTable(allLevels)), standing: { source: 'server', careerLevel: 46 } }, { idempotencyKey: `upgrade:climb-${level}`, toLevel: level, expectedVersion: piece.version }));
    if (!r.ok) break;
    assert.ok(!r.value.replayed);
    piece = r.value.instance;
    bought++;
  }
  assert.equal(bought, 9, 'Recruit + 9 levels = Origin worth');
  const loadout = must(resolveLoadout(PC, [{ ...piece, location: { kind: 'equipped', owner: PC, slot: 'head' } }], lookup));
  assert.ok(loadout.res >= CAPS.res && loadout.attack <= CAPS.attack);
  // Already at Origin worth: the next level would change nothing, so it is refused (and never charged).
  const origin = must(parseItemInstance({ ...F.helmetInstance(), tier: 'Origin', provenance: { ...F.helmetInstance().provenance, atRank: 'Origin', fromLegend: 'veteran-10' } }));
  refused(performUpgrade(input({ instance: origin, standing: { source: 'server', careerLevel: 46 } })), 'rule-violation', 'toLevel');
});

test('upgrade: a quest item has nothing to upgrade, and the smith says so in one plain line', () => {
  const recordDef = must(parseItemDefinition(F.recordDef()));
  const record = must(parseItemInstance(F.recordInstance()));
  const r = performUpgrade(input({ instance: record, def: recordDef }, { instance: record.id, expectedVersion: record.version }));
  refused(r, 'rule-violation', 'item');
  assert.ok(!r.ok && r.issues[0]!.message === "The Record of Names isn't gear the smith can work, so it can't be upgraded.");
});

test('upgrade: a zero-weight slot gains nothing, so the smith refuses it', () => {
  const crestDef = must(parseItemDefinition({ ...F.helmetDef(), id: 'item:loot.veteran.Crest', slot: 'Crest' }));
  const crest = must(parseItemInstance({ ...F.helmetInstance(), item: 'item:loot.veteran.Crest', location: { kind: 'pack', owner: F.PC, index: 0 }, provenance: { ...F.helmetInstance().provenance, lootId: 'veteran.Crest' } }));
  refused(performUpgrade(input({ instance: crest, def: crestDef })), 'rule-violation', 'toLevel');
});

test('upgrade: a piece kept in the bank is worked only at the Concord Exchange; worn or packed, anywhere the smith is', () => {
  const banked = must(parseItemInstance({ ...F.helmetInstance(), location: { kind: 'bank', owner: F.PC, index: 0 } }));
  refused(performUpgrade(input({ instance: banked })), 'rule-violation', 'place');
  refused(performUpgrade(input({ instance: banked, place: 'region:grey-ferry' as RegionId })), 'rule-violation', 'place');
  const out = must(performUpgrade(input({ instance: banked, place: CONCORD_EXCHANGE })));
  assert.ok(!out.replayed);
  assert.deepEqual([out.instance.upgradeLevel, out.instance.location], [1, banked.location], 'upgraded where it lies, in the bank');
  const packed = must(parseItemInstance({ ...F.helmetInstance(), location: { kind: 'pack', owner: F.PC, index: 0 } }));
  for (const piece of [input().instance, packed]) assert.equal(must(performUpgrade(input({ instance: piece, place: 'region:grey-ferry' as RegionId }))).replayed, false, `${piece.location.kind}: no Exchange needed`);
});

test('upgrade: every refusal path', () => {
  refused(performUpgrade(input({ standing: { source: 'server', careerLevel: 11 } })), 'rule-violation', 'toLevel'); // +1 needs Veteran; you are Gladiator
  refused(performUpgrade(input({ standing: { source: 'device', careerLevel: 46 } })), 'rule-violation', 'standing');
  refused(performUpgrade(input({ balance: 99 })), 'rule-violation', 'balance');
  refused(performUpgrade(input({}, { toLevel: 2 })), 'rule-violation', 'toLevel'); // one level at a time
  refused(performUpgrade(input({ instance: must(parseItemInstance({ ...F.helmetInstance(), upgradeLevel: 2 })) }, { toLevel: 3 })), 'rule-violation', 'toLevel'); // no level-3 common price
  refused(performUpgrade(input({ def: { ...helmetDef, rarity: 'fine' } })), 'rule-violation', 'toLevel'); // no fine prices at all
  refused(performUpgrade(input({}, { expectedVersion: 2 })), 'version-conflict', 'expectedVersion');
  refused(performUpgrade(input({ instance: must(parseItemInstance({ ...F.helmetInstance(), location: { kind: 'pack', owner: F.OTHER_PC, index: 0 } })) })), 'rule-violation', 'instance');
  refused(performUpgrade(input({ instance: must(parseItemInstance({ ...F.helmetInstance(), location: { kind: 'account-vault', account: F.ACCOUNT, index: 0 } })) })), 'rule-violation', 'instance');
  refused(performUpgrade(input({ instance: must(parseItemInstance({ ...F.helmetInstance(), location: escrow(F.PC) })) })), 'rule-violation', 'instance');
  const iron = must(parseItemInstance(F.ironInstance()));
  refused(performUpgrade(input({ instance: iron, def: lookup(iron.item)! }, { instance: iron.id, expectedVersion: 0 })), 'rule-violation', 'item');
  refused(performUpgrade(input({ service: { ...SERVICE(), accepts: 'weapons' } })), 'rule-violation', 'item');
  refused(performUpgrade(input({ service: { ...SERVICE(), costTable: 'costtable:other' as never } })), 'rule-violation', 'costTable');
  refused(performUpgrade(input({ service: { ...SERVICE(), id: 'service:other' as never } })), 'rule-violation', 'service');
  refused(performUpgrade(input({}, { instance: 'inst:someone-else' })), 'rule-violation', 'instance');
});

test('upgrade: a story-critical piece may be upgraded and keeps its story flag, binding and provenance; a story piece is never a material', () => {
  const oathDef = must(parseItemDefinition(F.oathGauntletsDef()));
  const defs = (id: ItemId): ItemDefinition | undefined => (id === oathDef.id ? oathDef : lookup(id));
  const before = must(parseItemInstance(F.gauntletsInstance()));
  const out = must(performUpgrade(input({ instance: before, def: oathDef, materialDefs: defs }, { instance: before.id, expectedVersion: before.version })));
  assert.ok(!out.replayed);
  assert.deepEqual([oathDef.story, out.instance.item, out.instance.boundTo, out.instance.location, out.instance.upgradeLevel, out.instance.version], ['story-critical', before.item, F.PC, before.location, 1, before.version + 1]);
  assert.deepEqual(out.instance.provenance, before.provenance);
  assert.deepEqual(out.instance.history, [{ kind: 'upgrade', smith: 'character:smith-orla', level: 1, receipt: 'upgrade:req-0001', at: LATER }], 'history gains only the upgrade entry');
  // Offered as a material, a story piece is refused outright (it burns only on a quest step that names it), even where no cost line names it.
  const recordInst = must(parseItemInstance(F.recordInstance()));
  refused(performUpgrade(input({ materials: [recordInst], materialDefs: defs })), 'rule-violation', 'materials');
  refused(performUpgrade(input({ materials: [before], materialDefs: defs })), 'rule-violation', 'materials');
  const recordCost = must(parseUpgradeCostTable({ ...F.forgeCosts(), rows: [{ level: 1, rarity: 'common', coin: 100, materials: [{ item: 'item:stolen-name-record', quantity: 1 }] }] }));
  refused(performUpgrade(input({ costs: recordCost, materials: [recordInst], materialDefs: defs })), 'rule-violation', 'materials');
  // The piece being worked is never its own material.
  refused(performUpgrade(input({ instance: before, def: oathDef, materials: [before], materialDefs: defs }, { instance: before.id, expectedVersion: before.version })), 'rule-violation', 'materials');
});

test('upgrade receipt: contract rejections', () => {
  const receipt = must(performUpgrade(input()));
  assert.ok(!receipt.replayed);
  const raw = { ...receipt.receipt } as Raw;
  refused(parseUpgradeReceipt({ ...raw, toLevel: 3 }), 'rule-violation', 'toLevel');
  refused(parseUpgradeReceipt({ ...raw, schemaVersion: 2 }), 'unsupported-version');
  refused(parseUpgradeReceipt({ ...raw, coin: -1 }), 'out-of-range', 'coin');
  const req: UpgradeRequest = must(parseUpgradeRequest(requestRaw()));
  assert.equal(req.kind, 'upgrade-request');
});

// ---- review fixes: duplicate material stacks, receipt size, invalid career level -------------------------------------------------

const ironStack = (quantity: number, id: string, index: number): ItemInstance =>
  must(parseItemInstance({ ...F.ironInstance(), id, quantity, location: { kind: 'bank', owner: F.PC, index }, provenance: { ...F.ironInstance().provenance, mintKey: `loot:${id.slice(5)}-mint` } }));
const ironCosts = (level1Iron: number): UpgradeCostTable =>
  must(parseUpgradeCostTable({ ...F.forgeCosts(), rows: [{ level: 1, rarity: 'common', coin: 100, materials: [{ item: 'item:grave-iron', quantity: level1Iron }] }] }));

test('upgrade: one stack offered twice is refused (duplicate-id), never spent as 5 + 3 from a stack of 5', () => {
  const five = ironStack(5, 'inst:iron-five', 1);
  const r = performUpgrade(input({ costs: ironCosts(8), materials: [five, five] }));
  refused(r, 'duplicate-id', 'materials');
  // The honest offer of the same stack once is simply short.
  refused(performUpgrade(input({ costs: ironCosts(8), materials: [five] })), 'rule-violation', 'materials');
  // Two different stacks still pay together, each spent once and listed once.
  const out = must(performUpgrade(input({ costs: ironCosts(8), materials: [five, ironStack(5, 'inst:iron-more', 2)] })));
  assert.ok(!out.replayed);
  assert.deepEqual([out.consumed, out.materials.map((m) => [m.id, m.quantity]), out.receipt.materials.map((m) => [m.instance, m.quantity])],
    [['inst:iron-five'], [['inst:iron-more', 2]], [['inst:iron-five', 5], ['inst:iron-more', 3]]]);
});

test('upgrade receipt: the emitter and the parser agree at the maximum, and an offer past it is refused up front', () => {
  const max = MAX_UPGRADE_MATERIAL_INPUTS;
  const ones = Array.from({ length: max + 1 }, (_, k) => ironStack(1, `inst:one-${String(k).padStart(4, '0')}`, k));
  const out = must(performUpgrade(input({ costs: ironCosts(max), materials: ones.slice(0, max) })));
  assert.ok(!out.replayed);
  assert.equal(out.receipt.materials.length, max);
  assert.deepEqual(must(parseUpgradeReceipt(out.receipt)), out.receipt, 'a receipt at the maximum parses through its own contract');
  // One more input than a receipt can record: refused before anything is charged.
  refused(performUpgrade(input({ costs: ironCosts(max + 1), materials: ones })), 'out-of-range', 'materials');
  // A receipt that lists one instance twice is not a receipt the smith writes.
  const line = out.receipt.materials[0]!;
  refused(parseUpgradeReceipt({ ...out.receipt, materials: [line, line] }), 'duplicate-id', 'materials');
});

test('upgrade: an out-of-range or non-integer career level is refused', () => {
  refused(performUpgrade(input({ standing: { source: 'server', careerLevel: 0 } })), 'out-of-range', 'standing.careerLevel');
  refused(performUpgrade(input({ standing: { source: 'server', careerLevel: 51 } })), 'out-of-range', 'standing.careerLevel');
  refused(performUpgrade(input({ standing: { source: 'server', careerLevel: 16.5 } })), 'wrong-type', 'standing.careerLevel');
});
