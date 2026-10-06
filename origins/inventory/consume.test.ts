// O2 burns: consume (quest hand-in) and applyUpgrade (the smith's material cost) spend units for good, all or nothing, once per op id
// (a same-request retry returns the original burn), each into the ledger, so conservation reads minted = held + burned per root mint key.
// Story-critical pieces burn only on a quest step that names them.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Result } from '../contracts/core.ts';
import { parseServiceDefinition, parseUpgradeCostTable, parseUpgradeRequest, performUpgrade, type UpgradeOutcome } from '../contracts/economy.ts';
import * as F from '../contracts/fixtures.ts';
import type { ItemId } from '../contracts/ids.ts';
import { checkHistoryKept, type ItemInstance } from '../contracts/items.ts';
import {
  applyUpgrade, checkConservation, consume, deposit, find, merge, mintTotals, move, receive, split, type Burn, type ConsumeOp, type Holdings, type Inventory,
} from './inventory.ts';
import { EXCHANGE, FRONTIER, LATER, PC, RIVAL, deepFreeze, empty, helm, ironStack, lookup, oreStack, record, refused, value } from './testkit.ts';

const ORE = 'item:exchange-ore' as ItemId;
const holdings = (inv: Inventory, ledger: readonly Burn[] = []): Holdings => ({ inventory: inv, ledger });
const withItems = (...items: ItemInstance[]): Inventory => items.reduce((inv, item) => value(receive(inv, item, lookup)), empty());
const handIn = (patch: Partial<ConsumeOp> = {}): ConsumeOp => ({ op: 'quest:ore-handin:0001', owner: PC, reason: 'quest-handin', qty: 5, itemId: ORE, ...patch });
const RECORD = 'item:stolen-name-record' as ItemId;
// A refused burn leaves the frozen state byte-identical.
function unchanged(state: Holdings, op: (s: Holdings) => Result<unknown>, code: string, path?: string): void {
  const frozen = deepFreeze(state), before = JSON.stringify(frozen);
  refused(op(frozen), code, path);
  assert.equal(JSON.stringify(frozen), before);
}

test('consume burns from the backpack, lowest slot first, across stacks; the ledger records each row and conservation holds', () => {
  const inv = withItems(oreStack('inst:ore-a', 3, 'a'), oreStack('inst:ore-b', 10, 'b'));
  const minted = mintTotals(inv.items);
  const out = value(consume(holdings(inv), handIn(), lookup));
  assert.equal(find(out.inventory, 'inst:ore-a'), undefined, 'an emptied stack leaves');
  const b = find(out.inventory, 'inst:ore-b')!;
  assert.deepEqual([b.quantity, b.version, b.location], [8, find(inv, 'inst:ore-b')!.version + 1, find(inv, 'inst:ore-b')!.location]);
  assert.deepEqual(out.ledger, [{
    op: 'quest:ore-handin:0001', owner: PC, reason: 'quest-handin', asked: { qty: 5, itemId: ORE },
    lines: [{ instance: 'inst:ore-a', item: ORE, mintKey: 'loot:ruin-vigil:a', quantity: 3 }, { instance: 'inst:ore-b', item: ORE, mintKey: 'loot:ruin-vigil:b', quantity: 2 }],
  }]);
  assert.deepEqual(checkConservation(out.inventory.items, minted, out.ledger), []);
  // Without the ledger the burned units are missing, and the check names both mints.
  assert.equal(checkConservation(out.inventory.items, minted).length, 2);
  // Burning the rest exactly empties the pack of ore.
  const rest = value(consume(out, handIn({ op: 'quest:ore-handin:0002', qty: 8 }), lookup));
  assert.deepEqual(rest.inventory.items, []);
  assert.deepEqual(checkConservation(rest.inventory.items, minted, rest.ledger), []);
});

test('consume refuses, state untouched: too few, a repeated op id, unknown items, bad qty, wrong owner or reason, bank and story pieces', () => {
  const inv = value(deposit(withItems(oreStack('inst:ore-a', 4, 'a'), oreStack('inst:ore-b', 10, 'b'), record()), 'inst:ore-b', lookup, EXCHANGE));
  const s = holdings(inv);
  unchanged(s, (x) => consume(x, handIn(), lookup), 'rule-violation', 'qty'); // 4 in the pack; the 10 in the bank never count
  unchanged(s, (x) => consume(x, handIn({ qty: 5, itemId: undefined, mintKey: 'loot:ruin-vigil:b' }), lookup), 'rule-violation', 'qty');
  const once = value(consume(s, handIn({ qty: 2 }), lookup));
  // The same op id with a different request is refused (an op id names one request).
  unchanged(once, (x) => consume(x, handIn({ qty: 1 }), lookup), 'duplicate-id', 'op');
  unchanged(once, (x) => consume(x, handIn({ qty: 2, itemId: undefined, mintKey: 'loot:ruin-vigil:a' }), lookup), 'duplicate-id', 'op');
  for (const itemId of ['item:nothing', 'constructor', '__proto__', 42]) unchanged(s, (x) => consume(x, handIn({ itemId: itemId as ItemId }), lookup), 'unknown-id', 'itemId');
  unchanged(s, (x) => consume(x, handIn({ itemId: undefined, mintKey: 'loot:ruin-vigil:zzz' }), lookup), 'unknown-id', 'mintKey');
  for (const qty of [0, -1, 1.5, Number.NaN, '2' as never, Infinity]) unchanged(s, (x) => consume(x, handIn({ qty }), lookup), 'out-of-range', 'qty');
  unchanged(s, (x) => consume(x, handIn({ mintKey: 'loot:ruin-vigil:a' }), lookup), 'wrong-type', 'itemId'); // both selectors
  unchanged(s, (x) => consume(x, handIn({ itemId: undefined }), lookup), 'wrong-type', 'itemId'); // neither
  unchanged(s, (x) => consume(x, handIn({ owner: RIVAL }), lookup), 'rule-violation', 'owner');
  unchanged(s, (x) => consume(x, handIn({ reason: 'sell' as never }), lookup), 'wrong-type', 'reason');
  unchanged(s, (x) => consume(x, handIn({ op: 'x' }), lookup), 'wrong-type', 'op');
  unchanged(s, (x) => consume(x, null as never, lookup), 'wrong-type', 'op');
  unchanged(s, (x) => consume(x, handIn({ qty: 1, itemId: RECORD }), lookup), 'rule-violation', 'itemId');
});

test('a retry with the same op id and the same request returns the original burn and changes nothing', () => {
  const s = holdings(withItems(oreStack('inst:ore-a', 10, 'a')));
  const first = value(consume(s, handIn(), lookup));
  assert.equal(first.replayed, false);
  const frozen = deepFreeze(first), before = JSON.stringify([frozen.inventory, frozen.ledger]);
  const again = value(consume(frozen, handIn(), lookup));
  assert.equal(again.replayed, true);
  assert.equal(again.burn, first.burn, 'the original ledger entry, not a new one');
  assert.equal(JSON.stringify([again.inventory, again.ledger]), before);
  assert.equal(find(again.inventory, 'inst:ore-a')!.quantity, 5, 'spent once');
});

test('story-critical pieces: never by a generic burn; a quest step that names the item may burn it; naming another item is refused', () => {
  const s = holdings(withItems(record(), oreStack('inst:ore-a', 10, 'a')));
  unchanged(s, (x) => consume(x, handIn({ qty: 1, itemId: RECORD }), lookup), 'rule-violation', 'itemId');
  unchanged(s, (x) => consume(x, handIn({ qty: 1, itemId: undefined, mintKey: 'quest:stolen-name:ruin:dom-1' }), lookup), 'rule-violation', 'itemId');
  unchanged(s, (x) => consume(x, handIn({ qty: 1, itemId: RECORD, consumesStoryItem: ORE }), lookup), 'rule-violation', 'consumesStoryItem');
  unchanged(s, (x) => consume(x, handIn({ qty: 1, itemId: ORE, consumesStoryItem: RECORD }), lookup), 'rule-violation', 'consumesStoryItem');
  unchanged(s, (x) => consume(x, handIn({ qty: 1, itemId: RECORD, consumesStoryItem: RECORD, reason: 'upgrade-cost' }), lookup), 'rule-violation', 'consumesStoryItem');
  const minted = mintTotals(s.inventory.items);
  const done = value(consume(s, handIn({ op: 'quest:stolen-name:returned', qty: 1, itemId: RECORD, consumesStoryItem: RECORD }), lookup));
  assert.equal(find(done.inventory, 'inst:5f0c2d4e-0003'), undefined);
  assert.deepEqual(done.burn.lines, [{ instance: 'inst:5f0c2d4e-0003', item: RECORD, mintKey: 'quest:stolen-name:ruin:dom-1', quantity: 1 }]);
  assert.deepEqual(checkConservation(done.inventory.items, minted, done.ledger), []);
});

test('split, merge and consume keep conservation: minted = held + burned per root mint key, by item or by mint family', () => {
  const inv = withItems(ironStack('inst:iron-a', 30, 'a'), oreStack('inst:ore-a', 20, 'o'));
  const minted = mintTotals(inv.items);
  let s = holdings(inv);
  const conserved = (label: string): void => assert.deepEqual(checkConservation(s.inventory.items, minted, s.ledger), [], label);
  s = holdings(value(split(s.inventory, 'inst:iron-a', 12, 'inst:iron-a2', lookup)), s.ledger);
  conserved('split');
  s = holdings(value(split(s.inventory, 'inst:iron-a', 5, 'inst:iron-a3', lookup)), s.ledger);
  conserved('second split');
  // By mint family: the root key reaches every split half, lowest slot first.
  s = value(consume(s, handIn({ op: 'quest:iron:0001', itemId: undefined, mintKey: 'loot:ruin-vigil:a', qty: 15 }), lookup));
  conserved('burn by mint');
  assert.deepEqual(s.ledger[0]!.lines.map((l) => [l.mintKey, l.quantity]), [['loot:ruin-vigil:a', 13], ['loot:ruin-vigil:a::s1', 2]]);
  s = holdings(value(merge(s.inventory, 'inst:iron-a3', 'inst:iron-a2', lookup)), s.ledger);
  conserved('merge after burn');
  assert.equal(find(s.inventory, 'inst:iron-a2')!.quantity, 15);
  s = value(consume(s, handIn({ op: 'quest:ore:0002', qty: 20 }), lookup));
  conserved('burn by item');
  assert.deepEqual([...mintTotals(s.inventory.items)], [['loot:ruin-vigil:a', 15]]);
  // A replayed ledger entry (the same burn counted twice) breaks the books, and the check names the mint.
  assert.deepEqual(checkConservation(s.inventory.items, minted, [...s.ledger, s.ledger[0]!]).map((i) => i.path), ['loot:ruin-vigil:a']);
});

// ---- the smith -------------------------------------------------------------------------------------------------------------------

// The PC's helm at upgrade level 1, three grave iron in the pack, ten in the bank; level 2 costs 250 coin + 5 grave iron.
type Worked = Extract<UpgradeOutcome, { replayed: false }>;
function atTheForge(): { s: Holdings; out: Worked } {
  const inv = value(deposit(withItems({ ...helm(), upgradeLevel: 1 }, ironStack('inst:iron-a', 3, 'a'), ironStack('inst:iron-b', 10, 'b')), 'inst:iron-b', lookup, EXCHANGE));
  const piece = find(inv, 'inst:helm-0001')!;
  const out = value(performUpgrade({
    request: value(parseUpgradeRequest({ kind: 'upgrade-request', schemaVersion: 1, idempotencyKey: 'upgrade:req-0002', character: PC, service: 'service:exchange-forge', instance: piece.id, expectedVersion: piece.version, toLevel: 2 })),
    service: value(parseServiceDefinition(F.blacksmith())), costs: value(parseUpgradeCostTable(F.forgeCosts())), instance: piece, def: lookup(piece.item)!,
    standing: { source: 'server', careerLevel: 46 }, balance: 1000, materials: [find(inv, 'inst:iron-a')!, find(inv, 'inst:iron-b')!], materialDefs: lookup,
    receipts: new Map(), now: LATER,
  }));
  assert.ok(!out.replayed);
  return { s: holdings(inv), out };
}

test('applyUpgrade replaces the piece in place and burns the cost lines in the same step, under the receipt key', () => {
  const { s, out } = atTheForge();
  const minted = mintTotals(s.inventory.items);
  const next = value(applyUpgrade(s, out, lookup, EXCHANGE));
  const before = find(s.inventory, 'inst:helm-0001')!, after = find(next.inventory, 'inst:helm-0001')!;
  assert.deepEqual([after.upgradeLevel, after.version, after.location], [2, before.version + 1, before.location]);
  assert.deepEqual(checkHistoryKept(before, after), []);
  assert.equal(find(next.inventory, 'inst:iron-a'), undefined);
  assert.equal(find(next.inventory, 'inst:iron-b')!.quantity, 8);
  assert.deepEqual(next.ledger.map((b) => [b.op, b.reason, b.lines.map((l) => [l.instance, l.quantity])]), [['upgrade:req-0002', 'upgrade-cost', [['inst:iron-a', 3], ['inst:iron-b', 2]]]]);
  assert.deepEqual(checkConservation(next.inventory.items, minted, next.ledger), []);
  // Applied once: the same outcome again, or the smith's replay of it, returns the original burn and changes nothing.
  const frozen = deepFreeze(next), books = JSON.stringify([frozen.inventory, frozen.ledger]);
  for (const retry of [out, { replayed: true as const, receipt: out.receipt }]) {
    const r = value(applyUpgrade(frozen, retry, lookup, EXCHANGE));
    assert.deepEqual([r.replayed, r.burn === next.burn, JSON.stringify([r.inventory, r.ledger])], [true, true, books]);
  }
  // A different receipt under the same key is refused.
  unchanged(next, (x) => applyUpgrade(x, { ...out, receipt: { ...out.receipt, coin: 1 } }, lookup, EXCHANGE), 'duplicate-id', 'op');
});

test('applyUpgrade refuses, state untouched: bank lines away from the Exchange, a stale piece or stack, a disagreeing outcome', () => {
  const { s, out } = atTheForge();
  unchanged(s, (x) => applyUpgrade(x, out, lookup, FRONTIER), 'rule-violation', 'at');
  // The helm moved after the smith worked it: stale.
  const moved = holdings(value(move(s.inventory, 'inst:helm-0001', { grid: 'pack', index: 3 }, lookup)));
  unchanged(moved, (x) => applyUpgrade(x, out, lookup, EXCHANGE), 'version-conflict', 'outcome.instance');
  // The iron in the pack was partly spent since: the receipt's 3 are no longer there.
  const spent = value(consume(s, handIn({ op: 'quest:iron:0003', itemId: 'item:grave-iron' as ItemId, qty: 1 }), lookup));
  unchanged(spent, (x) => applyUpgrade(x, out, lookup, EXCHANGE), 'version-conflict', 'receipt.materials[0]');
  // An outcome whose rows disagree with its receipt.
  const forged: Worked = { ...out, materials: out.materials.map((m) => ({ ...m, quantity: m.quantity + 1 })) };
  unchanged(s, (x) => applyUpgrade(x, forged, lookup, EXCHANGE), 'version-conflict', 'outcome.materials');
  // The smith's replay of an upgrade this inventory never applied carries no rows to apply.
  unchanged(s, (x) => applyUpgrade(x, { replayed: true, receipt: out.receipt }, lookup, EXCHANGE), 'rule-violation', 'outcome');
  // Another character's receipt.
  unchanged(s, (x) => applyUpgrade(x, { ...out, receipt: { ...out.receipt, character: RIVAL } }, lookup, EXCHANGE), 'rule-violation', 'owner');
});
