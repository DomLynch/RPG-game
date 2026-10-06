// O2 backpack + bank: fixed grids, atomic moves, one of each across pack + bank + worn, provenance kept, the bank only at the Exchange,
// wearing needs rank, and hostile ids.
import assert from 'node:assert/strict';
import test from 'node:test';
import { PACK_SLOTS, checkHistoryKept, sameData, type ItemInstance } from '../contracts/items.ts';
import {
  canWear, checkConservation, checkInventory, deposit, equip, find, gridView, merge, mintRoot, mintTotals, move, openInventory, receive, remove, settle, split, unequip,
  withdraw, type Inventory,
} from './inventory.ts';
import {
  ACCOUNT, EXCHANGE, FRONTIER, LATER, PC, RIVAL, RIVAL_ACCOUNT, body, deepFreeze, empty, escrowed, gift, helm, helmCopy, hood, ironStack, lookup, record, refused, server, value,
} from './testkit.ts';

const snap = (inv: Inventory): string => JSON.stringify(inv);
// Run a refused operation on a frozen state and prove it changed nothing, byte for byte.
function unchanged(inv: Inventory, op: (inv: Inventory) => { ok: boolean }, code: string, path?: string): void {
  const frozen = deepFreeze(inv), before = snap(frozen);
  const r = op(frozen);
  refused(r as never, code, path);
  assert.equal(snap(frozen), before);
}
const withItems = (...items: ItemInstance[]): Inventory => items.reduce((inv, item) => value(receive(inv, item, lookup)), empty());
const slotOf = (inv: Inventory, id: string): string => {
  const loc = find(inv, id)!.location;
  return loc.kind === 'equipped' ? `equipped:${loc.slot}` : `${loc.kind}:${(loc as { index: number }).index}`;
};

test('receive places a piece in the first free pack slot, binds on acquire, and the result passes the invariant', () => {
  const inv = value(receive(empty(), helm(), lookup));
  assert.equal(slotOf(inv, 'inst:helm-0001'), 'pack:0');
  assert.equal(find(inv, 'inst:helm-0001')!.version, 1);
  const withRecord = value(receive(inv, record(), lookup, 3));
  assert.equal(slotOf(withRecord, 'inst:5f0c2d4e-0003'), 'pack:3');
  assert.equal(find(withRecord, 'inst:5f0c2d4e-0003')!.boundTo, PC);
  assert.deepEqual(checkInventory(withRecord, lookup), []);
});

test('openInventory refuses a state that breaks the invariant (outside the grid, another owner, two in one slot)', () => {
  const placed = find(withItems(helm()), 'inst:helm-0001')!;
  refused(openInventory({ owner: PC, account: ACCOUNT, items: [{ ...placed, location: { kind: 'pack', owner: PC, index: 9 } }], packSize: 4 }, lookup), 'out-of-range', 'items[0].location.index');
  refused(openInventory({ owner: PC, account: ACCOUNT, items: [{ ...placed, location: { kind: 'pack', owner: 'pc:rival-1' as never, index: 0 } }] }, lookup), 'rule-violation', 'items[0].location.owner');
  const other = { ...find(withItems(body()), 'inst:body-0001')!, location: placed.location };
  refused(openInventory({ owner: PC, account: ACCOUNT, items: [placed, other] }, lookup), 'rule-violation', 'items[1].location');
  refused(openInventory({ owner: PC, account: ACCOUNT, items: [placed, placed] }, lookup), 'duplicate-id', 'items[1].id');
  refused(openInventory({ owner: PC, account: ACCOUNT, items: [], packSize: 0 }, lookup), 'out-of-range', 'packSize');
  refused(openInventory({ owner: PC, account: ACCOUNT, items: [], bankSize: 1001 }, lookup), 'out-of-range', 'bankSize');
});

test('a full backpack refuses a new piece and a full bank refuses a deposit, leaving the state byte-identical', () => {
  const full = [helm(), body(), hood(), ironStack('inst:iron-a', 10, 'a')].reduce((inv, item) => value(receive(inv, item, lookup)), empty(4, 1));
  unchanged(full, (inv) => receive(inv, ironStack('inst:iron-b', 5, 'b'), lookup), 'out-of-range', 'pack');
  const banked = value(deposit(full, 'inst:helm-0001', lookup, EXCHANGE));
  assert.equal(slotOf(banked, 'inst:helm-0001'), 'bank:0');
  unchanged(banked, (inv) => deposit(inv, 'inst:body-0001', lookup, EXCHANGE), 'out-of-range', 'bank');
  // Withdraw into a full pack: refused, the piece stays in the bank.
  const packFull = value(receive(banked, ironStack('inst:iron-b', 5, 'b'), lookup));
  unchanged(packFull, (inv) => withdraw(inv, 'inst:helm-0001', lookup, EXCHANGE), 'out-of-range', 'pack');
  // Asking for a taken slot is refused too, never overwritten.
  unchanged(packFull, (inv) => receive(inv, record(), lookup, 0), 'rule-violation', 'index');
});

test('one of each: a second copy of a piece is refused whether the first is in the pack, the bank or worn', () => {
  const inPack = withItems(helm());
  unchanged(inPack, (inv) => receive(inv, helmCopy(), lookup), 'rule-violation', 'incoming.item');
  const inBank = value(deposit(inPack, 'inst:helm-0001', lookup, EXCHANGE));
  unchanged(inBank, (inv) => receive(inv, helmCopy(), lookup), 'rule-violation', 'incoming.item');
  const worn = value(equip(inPack, 'inst:helm-0001', lookup, server(11)));
  assert.equal(slotOf(worn, 'inst:helm-0001'), 'equipped:head');
  unchanged(worn, (inv) => receive(inv, helmCopy(), lookup), 'rule-violation', 'incoming.item');
  // A different piece for the same slot is not a copy.
  value(receive(worn, hood(), lookup));
  // The same instance twice is a duplicate, not a second copy: an instance lives in one place.
  unchanged(inPack, (inv) => receive(inv, find(inv, 'inst:helm-0001')!, lookup), 'duplicate-id', 'incoming.id');
  // Stackables are exempt: two stacks of iron with different provenance may both be held.
  value(receive(withItems(ironStack('inst:iron-a', 10, 'a')), ironStack('inst:iron-b', 10, 'b'), lookup));
});

test('the bank opens only at the Concord Exchange: deposit, withdraw, bank moves, splits, merges, removal and viewing', () => {
  const inv = withItems(helm(), ironStack('inst:iron-a', 30, 'a'));
  for (const away of [FRONTIER, undefined, '__proto__', 'constructor', 42]) {
    unchanged(inv, (s) => deposit(s, 'inst:helm-0001', lookup, away), 'rule-violation', 'at');
    unchanged(inv, (s) => move(s, 'inst:helm-0001', { grid: 'bank', index: 0 }, lookup, away), 'rule-violation', 'at');
    unchanged(inv, (s) => split(s, 'inst:iron-a', 5, 'inst:iron-a2', lookup, { grid: 'bank' }, away), 'rule-violation', 'at');
    refused(gridView(inv, 'bank', away), 'rule-violation', 'at');
  }
  const banked = value(deposit(value(deposit(inv, 'inst:helm-0001', lookup, EXCHANGE)), 'inst:iron-a', lookup, EXCHANGE, 2));
  unchanged(banked, (s) => withdraw(s, 'inst:helm-0001', lookup, FRONTIER), 'rule-violation', 'at');
  unchanged(banked, (s) => move(s, 'inst:helm-0001', { grid: 'bank', index: 3 }, lookup, FRONTIER), 'rule-violation', 'at');
  unchanged(banked, (s) => split(s, 'inst:iron-a', 5, 'inst:iron-a2', lookup, undefined, FRONTIER), 'rule-violation', 'at');
  unchanged(banked, (s) => remove(s, 'inst:iron-a', lookup, FRONTIER), 'rule-violation', 'at');
  const view = value(gridView(banked, 'bank', EXCHANGE));
  assert.deepEqual(view.map((c) => c?.id ?? null), ['inst:helm-0001', null, 'inst:iron-a', null]);
  // The pack is always visible, anywhere.
  assert.equal(value(gridView(banked, 'pack')).every((c) => c === null), true);
  const back = value(withdraw(banked, 'inst:helm-0001', lookup, EXCHANGE));
  assert.equal(slotOf(back, 'inst:helm-0001'), 'pack:0');
});

test('moves within a grid go to an empty slot or swap with the occupant, both or neither', () => {
  const inv = withItems(helm(), body());
  const moved = value(move(inv, 'inst:helm-0001', { grid: 'pack', index: 3 }, lookup));
  assert.equal(slotOf(moved, 'inst:helm-0001'), 'pack:3');
  const swapped = value(move(moved, 'inst:body-0001', { grid: 'pack', index: 3 }, lookup));
  assert.equal(slotOf(swapped, 'inst:body-0001'), 'pack:3');
  assert.equal(slotOf(swapped, 'inst:helm-0001'), 'pack:1');
  // A swap across pack and bank at the Exchange.
  const banked = value(deposit(swapped, 'inst:helm-0001', lookup, EXCHANGE, 0));
  const crossed = value(move(banked, 'inst:body-0001', { grid: 'bank', index: 0 }, lookup, EXCHANGE));
  assert.equal(slotOf(crossed, 'inst:body-0001'), 'bank:0');
  assert.equal(slotOf(crossed, 'inst:helm-0001'), 'pack:3');
  unchanged(crossed, (s) => move(s, 'inst:helm-0001', { grid: 'pack', index: 3 }, lookup), 'rule-violation', 'to');
});

test('armour never stacks; stackables split and merge to their max, all or nothing', () => {
  const inv = withItems(helm(), ironStack('inst:iron-a', 30, 'a'), ironStack('inst:iron-b', 30, 'b'));
  unchanged(inv, (s) => split(s, 'inst:helm-0001', 1, 'inst:helm-half', lookup), 'rule-violation', 'id');
  for (const bad of [0, 30, 31, -1, 1.5, Number.NaN, Infinity, '5']) unchanged(inv, (s) => split(s, 'inst:iron-a', bad, 'inst:iron-a2', lookup), 'out-of-range', 'count');
  const parts = value(split(inv, 'inst:iron-a', 12, 'inst:iron-a2', lookup));
  assert.equal(find(parts, 'inst:iron-a')!.quantity, 18);
  assert.equal(find(parts, 'inst:iron-a2')!.quantity, 12);
  // The half keeps its parent's provenance except for a derived child mint key (checkCustody: one key, one row).
  const half = find(parts, 'inst:iron-a2')!.provenance, whole0 = find(parts, 'inst:iron-a')!.provenance;
  assert.equal(half.mintKey, `${whole0.mintKey}::s1`);
  assert.ok(sameData({ ...half, mintKey: mintRoot(half.mintKey) }, whole0));
  unchanged(parts, (s) => split(s, 'inst:iron-a', 1, 'inst:iron-a2', lookup), 'duplicate-id', 'newId');
  // Merge back: the same provenance, the sum fits one stack.
  const whole = value(merge(parts, 'inst:iron-a2', 'inst:iron-a', lookup));
  assert.equal(find(whole, 'inst:iron-a')!.quantity, 30);
  assert.equal(find(whole, 'inst:iron-a2'), undefined);
  // Different provenance never merges (no laundering), and a sum over the stack size is refused whole, never topped up partly.
  unchanged(whole, (s) => merge(s, 'inst:iron-b', 'inst:iron-a', lookup), 'rule-violation', 'intoId');
  const big = value(split(whole, 'inst:iron-a', 5, 'inst:iron-a3', lookup));
  const bigger = value(receive(value(remove(big, 'inst:iron-a3', lookup)).inventory, { ...find(big, 'inst:iron-a3')!, quantity: 26 }, lookup));
  unchanged(bigger, (s) => merge(s, 'inst:iron-a3', 'inst:iron-a', lookup), 'out-of-range', 'intoId');
  unchanged(inv, (s) => merge(s, 'inst:iron-a', 'inst:iron-a', lookup), 'duplicate-id', 'intoId');
});

test('provenance and history ride every move unchanged', () => {
  const start = withItems(helm(), ironStack('inst:iron-a', 30, 'a'));
  const original = find(start, 'inst:helm-0001')!;
  let inv = value(deposit(start, 'inst:helm-0001', lookup, EXCHANGE));
  inv = value(move(inv, 'inst:helm-0001', { grid: 'bank', index: 2 }, lookup, EXCHANGE));
  inv = value(withdraw(inv, 'inst:helm-0001', lookup, EXCHANGE, 3));
  inv = value(equip(inv, 'inst:helm-0001', lookup, server(11)));
  inv = value(unequip(inv, 'inst:helm-0001', lookup));
  const after = find(inv, 'inst:helm-0001')!;
  assert.deepEqual(checkHistoryKept(original, after), []);
  assert.deepEqual(after.provenance, original.provenance);
  assert.equal(after.provenance.kind === 'arena-award' && `${after.provenance.wonBy} ${after.provenance.fromLegend} ${after.provenance.atRank} ${after.provenance.at}`, `${PC} veteran-3 Gladiator 2026-10-06T12:00:00Z`);
  assert.equal(after.version, original.version + 5);
  const iron = find(start, 'inst:iron-a')!;
  const parts = value(split(inv, 'inst:iron-a', 10, 'inst:iron-a2', lookup, { grid: 'bank' }, EXCHANGE));
  const half = find(parts, 'inst:iron-a2')!;
  assert.deepEqual([{ ...half.provenance, mintKey: mintRoot(half.provenance.mintKey) }, half.history], [iron.provenance, iron.history]);
  assert.deepEqual(checkHistoryKept(iron, find(value(merge(parts, 'inst:iron-a2', 'inst:iron-a', lookup, EXCHANGE)), 'inst:iron-a')!), []);
});

test('remove hands out the instance unchanged, never from the paperdoll, never a bound or story-critical piece', () => {
  const inv = withItems(helm(), body(), record());
  const out = value(remove(inv, 'inst:body-0001', lookup));
  assert.equal(find(out.inventory, 'inst:body-0001'), undefined);
  assert.deepEqual(out.removed, find(inv, 'inst:body-0001'));
  unchanged(inv, (s) => remove(s, 'inst:5f0c2d4e-0003', lookup), 'rule-violation', 'id');
  const worn = value(equip(inv, 'inst:helm-0001', lookup, server(11)));
  unchanged(worn, (s) => remove(s, 'inst:helm-0001', lookup), 'rule-violation', 'id');
  unchanged(worn, (s) => move(s, 'inst:helm-0001', { grid: 'pack', index: 3 }, lookup), 'rule-violation', 'id');
});

test('wearing needs the rank: a server-verified career level at or above the piece\'s effective tier', () => {
  const inv = withItems(helm(), hood(), body());
  assert.equal(value(canWear(inv, 'inst:helm-0001', lookup, server(11))), 'Gladiator');
  refused(canWear(inv, 'inst:helm-0001', lookup, server(10)), 'rule-violation', 'tier');
  refused(canWear(inv, 'inst:helm-0001', lookup, { source: 'device', careerLevel: 46 }), 'rule-violation', 'standing');
  refused(canWear(inv, 'inst:helm-0001', lookup, server(Number.NaN)), 'wrong-type', 'standing.careerLevel');
  unchanged(inv, (s) => equip(s, 'inst:hood-0001', lookup, server(45)), 'rule-violation', 'tier');
  const origin = value(equip(inv, 'inst:hood-0001', lookup, server(46)));
  // The head slot is taken: no silent swap.
  unchanged(origin, (s) => equip(s, 'inst:helm-0001', lookup, server(46)), 'rule-violation', 'id');
  // Taking off into a full pack is refused; the piece stays worn.
  const full = [ironStack('inst:iron-a', 1, 'a'), ironStack('inst:iron-b', 1, 'b')].reduce((s, i) => value(receive(s, i, lookup)), origin);
  unchanged(full, (s) => unequip(s, 'inst:hood-0001', lookup), 'out-of-range', 'pack');
  refused(canWear(inv, 'inst:nothing', lookup, server(46)), 'unknown-id', 'id');
});

test('hostile ids are plain keys or refusals: never a crash, never a prototype member, never NaN', () => {
  const inv = deepFreeze(withItems(helm(), ironStack('inst:iron-a', 30, 'a')));
  const before = snap(inv);
  const HOSTILE: unknown[] = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'inst:constructor', 'inst:__proto__', '', null, undefined, 0, NaN, {}, [], { id: 'inst:helm-0001' }];
  for (const id of HOSTILE) {
    refused(remove(inv, id, lookup), 'unknown-id', 'id');
    refused(move(inv, id, { grid: 'pack', index: 1 }, lookup), 'unknown-id', 'id');
    refused(deposit(inv, id, lookup, EXCHANGE), 'unknown-id', 'id');
    refused(split(inv, id, 1, 'inst:x-1', lookup), 'unknown-id', 'id');
    refused(merge(inv, id, 'inst:iron-a', lookup), 'unknown-id', 'fromId');
    refused(equip(inv, id, lookup, server(46)), 'unknown-id', 'id');
    refused(canWear(inv, id, lookup, server(46)), 'unknown-id', 'id');
    assert.equal(find(inv, id), undefined);
  }
  for (const grid of ['constructor', '__proto__', 'toString', 'Pack', null]) refused(move(inv, 'inst:helm-0001', { grid, index: 1 }, lookup), 'wrong-type', 'to.grid');
  for (const index of [NaN, Infinity, -1, 1.5, '1', null, 4, 2 ** 53]) {
    const r = move(inv, 'inst:helm-0001', { grid: 'pack', index }, lookup);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.issues.every((i) => i.path === 'to.index'), JSON.stringify(r.issues));
  }
  refused(move(inv, 'inst:helm-0001', 'constructor', lookup), 'wrong-type', 'to');
  for (const newId of ['__proto__', 'constructor', 'inst:__proto__', 'item:iron', 7]) refused(split(inv, 'inst:iron-a', 1, newId, lookup), newId === 'item:iron' ? 'wrong-namespace' : 'bad-id', 'newId');
  assert.equal(snap(inv), before);
  // 'inst:constructor' and 'inst:tostring' are well-formed ids, and work as ordinary keys.
  const parts = value(split(inv, 'inst:iron-a', 10, 'inst:constructor', lookup));
  const more = value(split(parts, 'inst:iron-a', 5, 'inst:tostring', lookup));
  assert.deepEqual([find(more, 'inst:constructor')!.quantity, find(more, 'inst:tostring')!.quantity, find(more, 'inst:iron-a')!.quantity], [10, 5, 15]);
  const merged = value(merge(more, 'inst:constructor', 'inst:tostring', lookup));
  assert.equal(find(merged, 'inst:tostring')!.quantity, 15);
  assert.deepEqual(checkInventory(merged, lookup), []);
  // An item id that only a plain-object lookup would "find" (Object.prototype.constructor) is unknown.
  const objectLookup = ((id: string) => (({}) as Record<string, never>)[id.slice('item:'.length)]) as never;
  const ghost = { ...helm(), id: 'inst:ghost-1', item: 'item:constructor', provenance: { ...helm().provenance, mintKey: 'claim:9999' } } as unknown as ItemInstance;
  refused(receive(inv, ghost, objectLookup), 'unknown-id', 'incoming.item');
  refused(receive(inv, ghost, lookup), 'unknown-id', 'incoming.item');
  refused(receive(inv, null as never, lookup), 'wrong-type', 'incoming');
});

test('conservation: across every row of one mint the units equal the minted quantity; split -> double merge is refused', () => {
  const inv = withItems(ironStack('inst:iron-a', 30, 'a'));
  const minted = mintTotals(inv.items);
  const parts = value(split(inv, 'inst:iron-a', 12, 'inst:iron-a2', lookup));
  const merged = value(merge(parts, 'inst:iron-a2', 'inst:iron-a', lookup));
  for (const s of [parts, merged]) assert.deepEqual(checkConservation(s.items, minted), []);
  // Merging the same half a second time would mint 12 units from nothing: refused, nothing changes.
  unchanged(merged, (s) => merge(s, 'inst:iron-a2', 'inst:iron-a', lookup), 'unknown-id', 'fromId');
  // A replayed stale half (the row the merge consumed) breaks the ledger, and the server's check names the mint.
  const replay = value(receive(merged, find(parts, 'inst:iron-a2')!, lookup));
  assert.deepEqual(checkConservation(replay.items, minted).map((i) => i.message), [`mint ${find(merged, 'inst:iron-a')!.provenance.mintKey} holds 42 units across its rows; 30 were minted`]);
  // A forged row sharing a child key is two rows for one key: custody refuses it.
  const forged = { ...find(parts, 'inst:iron-a2')!, id: 'inst:iron-a9' as never, location: { kind: 'pack' as const, owner: PC, index: 3 } };
  refused(openInventory({ owner: PC, account: ACCOUNT, items: [...parts.items, forged], packSize: 4 }, lookup), 'duplicate-id', 'items[2].provenance.mintKey');
});

test('trade reads the receiver\'s real free slots: a nearly-full pack refuses with both states unchanged; an exact fit settles', () => {
  const offer = gift(['inst:helm-0001', 'inst:body-0001']), pieces = [escrowed(helm()), escrowed(body())];
  const rival = empty(PACK_SLOTS, 4, RIVAL, RIVAL_ACCOUNT);
  // PC's 4-slot pack has 3 used: one free slot, two pieces offered.
  const mine = withItems(ironStack('inst:iron-a', 1, 'a'), ironStack('inst:iron-b', 1, 'b'), hood());
  const frozen = deepFreeze([rival, mine] as const), before = JSON.stringify(frozen);
  refused(settle(offer, frozen, pieces, lookup, LATER), 'rule-violation', 'sides[0].offered[1]');
  assert.equal(JSON.stringify(frozen), before);
  // Two free slots: both pieces land, the rows conserve, and both inventories still pass the invariant.
  const roomy = value(remove(mine, 'inst:iron-b', lookup)).inventory;
  const [r2, m2] = value(settle(offer, [rival, roomy], pieces, lookup, LATER));
  assert.deepEqual(m2.items.map((i) => i.location.kind === 'pack' && i.location.index).sort(), [0, 1, 2, 3]);
  assert.deepEqual(checkConservation([...r2.items, ...m2.items], mintTotals([...roomy.items, ...pieces])), []);
  for (const s of [r2, m2]) assert.deepEqual(checkInventory(s, lookup), []);
});
