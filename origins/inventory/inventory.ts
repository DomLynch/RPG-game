// Origins O2 (stage 1 of the item plan): the backpack and the bank, as one pure slot-grid module.
//
// Adapted from World of ClaudeCraft, pinned at f46f30f (f46f30f5849989e44d7aa1bf62b3b14e435bc2fe), MIT licence,
// Copyright (c) 2026 Levy Street. Source files and what was taken from each:
//   - src/sim/bank.ts `moveBetweenContainers`: a move is ALL-OR-NOTHING. The fit is decided before anything is written, an instanced
//     (provenance-bearing) slot moves as one indivisible unit, and the merge predicate carries the provenance marker in both the fit check
//     and the grant, so a move can never launder one item's provenance into another's. `nearBanker`: the bank's place gate sits at the ONE
//     entry point of every bank command, never per call site.
//   - src/sim/bags.ts `countFit` / `addStacked`: room for a stackable is room in a compatible stack (same item, same provenance) up to the
//     stack size, and a stack never passes it.
//   - src/sim/vault_slot_ops.ts: the plan/apply idiom. Every operation decides on a copy and commits in one assignment, so a refusal can
//     never half-apply.
//   - server/bank_vault_ledger_guard.ts was read for its "reserve the worst case before mutation, settle or refund after" rule. Its rate
//     budget is a server/session concern and is NOT carried here; this module's equivalent is "check the whole result before returning it".
// The code below is a rewrite for Frankendom's contracts (fixed slot grid, one location per instance), not a copy.
//
// Rules from docs/specs/origins/item-loot-storage-summary.md (Dom's decisions, 2026-10-06), via the merged O1 contracts:
//   - The ItemInstance's own `location` is the only inventory authority (contracts README, "One inventory authority"). An Inventory is a
//     list of one character's instances; the grid is a VIEW over their `pack`/`bank` locations. Nothing else lists items.
//   - Fixed slots, not weight. Armour (any stack-1 definition) never stacks. Stackables stack up to their definition's `stack`.
//   - The bank is the same grid, opened only at the Concord Exchange (economy.ts CONCORD_EXCHANGE).
//   - One of each piece per player across backpack + bank + worn (items.ts checkOneOfEach): a second copy is refused.
//   - Provenance and history ride every move unchanged (items.ts checkHistoryKept).
//   - Wearing needs the piece's rank (items.ts equipItem / effectiveTier, world.ts verifiedTier). No combat here.
//
// Pure: no DOM, network, timers or randomness. Every function takes an Inventory and returns a new one (or a refusal, with the input
// untouched). Ids from the wire are compared with ===, kept in Maps and never used to index a plain object, so 'constructor',
// '__proto__' or 'toString' are just strings that name nothing.
import { levelOf as tierLevel, type Tier } from '../../src/grades.ts';
import { paperdollOf, type Paperdoll } from '../../src/loot.ts';
import { MINT_KEY_PATTERN, fail, ok, type Issue, type Result } from '../contracts/core.ts';
import { CONCORD_EXCHANGE, settleTrade, type Trade, type UpgradeOutcome, type UpgradeReceipt } from '../contracts/economy.ts';
import { parseId, type AccountId, type CharacterInstanceId, type ItemId, type ItemInstanceId, type RegionId } from '../contracts/ids.ts';
import {
  BANK_SLOTS, PACK_SLOTS, checkCustody, checkHistoryKept, checkInstance, checkOneOfEach, effectiveTier, equipItem, moveItem, sameData,
  type ItemDefinition, type ItemInstance, type Location,
} from '../contracts/items.ts';
import { verifiedTier, type CareerStanding } from '../contracts/world.ts';

export const GRIDS = ['pack', 'bank'] as const;
export type Grid = (typeof GRIDS)[number];
// The one place the bank opens. Taken from the contracts (the same constant a trade settles at), not redefined.
export const BANK_PLACE: RegionId = CONCORD_EXCHANGE;
// Grid sizes: the contracts' PACK_SLOTS (64) and BANK_SLOTS (1000) are the one source of the caps and the defaults; a caller may open a
// smaller grid (a starter pack) within them, and settleTrade reads the real size (`settle` below).

export type Inventory = {
  readonly owner: CharacterInstanceId;
  readonly account: AccountId;
  readonly packSize: number;
  readonly bankSize: number;
  // Every instance this character holds in its pack, its bank or on its paperdoll. Each carries its own single location.
  readonly items: readonly ItemInstance[];
};
export type Lookup = (id: ItemId) => ItemDefinition | undefined;
export type Slot = { grid: Grid; index: number };

// ---- reading the state ----------------------------------------------------------------------------------------------------------

const isGrid = (value: unknown): value is Grid => value === 'pack' || value === 'bank';
const sizeOf = (inv: Inventory, grid: Grid): number => (grid === 'pack' ? inv.packSize : inv.bankSize);
const gridOf = (inst: ItemInstance): Grid | null => (inst.location.kind === 'pack' || inst.location.kind === 'bank' ? inst.location.kind : null);
const indexOf = (inst: ItemInstance): number => (inst.location.kind === 'pack' || inst.location.kind === 'bank' ? inst.location.index : -1);
const at = (inv: Inventory, grid: Grid, index: number): Location => ({ kind: grid, owner: inv.owner, index });

// The instance with this id, or undefined. A non-string id (a number, null, an object off the wire) names nothing.
export const find = (inv: Inventory, id: unknown): ItemInstance | undefined => (typeof id === 'string' ? inv.items.find((i) => i.id === id) : undefined);
export const occupant = (inv: Inventory, grid: Grid, index: number): ItemInstance | undefined =>
  inv.items.find((i) => i.location.kind === grid && i.location.index === index);
export function firstFree(inv: Inventory, grid: Grid): number {
  const used = new Set(inv.items.filter((i) => i.location.kind === grid).map(indexOf));
  for (let index = 0; index < sizeOf(inv, grid); index++) if (!used.has(index)) return index;
  return -1;
}

// A definition the lookup really returns for this id. A lookup backed by a plain object would hand back Object.prototype members for
// 'constructor' and friends; anything whose own id is not the id asked for is treated as unknown.
function defOf(lookup: Lookup, id: ItemId): ItemDefinition | undefined {
  const def = lookup(id);
  return def !== null && typeof def === 'object' && def.id === id ? def : undefined;
}

// ---- the invariant ----------------------------------------------------------------------------------------------------------------

// Everything that must hold of an Inventory. Every operation runs it on its result before returning it (belt and braces on top of the
// per-operation checks), and the property test runs it after every step.
//   - sizes are whole numbers within the contracts' caps; the owner and account are well-formed ids;
//   - every instance is this character's, in its pack, bank or paperdoll, inside the grid, and valid against its definition;
//   - custody (items.ts checkCustody): one id is one copy, one slot holds one instance;
//   - one of each across pack + bank + worn (items.ts checkOneOfEach).
// A split half gets a derived child mint key (see `split`), so checkCustody's "one mint key = one instance" holds with no exception.
export function checkInventory(inv: Inventory, lookup: Lookup): Issue[] {
  const issues: Issue[] = [];
  const add = (code: Issue['code'], path: string, message: string): void => void issues.push({ code, path, message });
  if (!Number.isInteger(inv.packSize) || inv.packSize < 1 || inv.packSize > PACK_SLOTS) add('out-of-range', 'packSize', `a pack has 1..${PACK_SLOTS} slots`);
  if (!Number.isInteger(inv.bankSize) || inv.bankSize < 1 || inv.bankSize > BANK_SLOTS) add('out-of-range', 'bankSize', `a bank has 1..${BANK_SLOTS} slots`);
  const owner = parseId(inv.owner, 'pc', 'owner'), account = parseId(inv.account, 'account', 'account');
  if (!owner.ok) issues.push(...owner.issues);
  if (!account.ok) issues.push(...account.issues);
  if (!Array.isArray(inv.items)) {
    add('wrong-type', 'items', 'expected an array of item instances');
    return issues;
  }
  inv.items.forEach((inst, i) => {
    const path = `items[${i}]`;
    const loc = inst.location;
    if (loc.kind !== 'pack' && loc.kind !== 'bank' && loc.kind !== 'equipped') add('rule-violation', `${path}.location`, `a ${loc.kind} is not part of a character's pack, bank or paperdoll`);
    else if (loc.owner !== inv.owner) add('rule-violation', `${path}.location.owner`, `${inst.id} is ${loc.owner}'s, not ${inv.owner}'s`);
    if ((loc.kind === 'pack' || loc.kind === 'bank') && (loc.index < 0 || loc.index >= sizeOf(inv, loc.kind))) add('out-of-range', `${path}.location.index`, `slot ${loc.index} is outside the ${sizeOf(inv, loc.kind)}-slot ${loc.kind}`);
    const def = defOf(lookup, inst.item);
    if (!def) add('unknown-id', `${path}.item`, `${inst.item} is not defined in this content`);
    else for (const issue of checkInstance(inst, def, path)) issues.push(issue);
  });
  for (const issue of checkCustody(inv.items)) issues.push({ ...issue, path: `items${issue.path}` });
  for (const issue of checkOneOfEach(inv.items, (id) => defOf(lookup, id), () => inv.account)) issues.push({ ...issue, path: `items${issue.path}` });
  return issues;
}

// ---- mint-key conservation (Strategy, 2026-10-06) ---------------------------------------------------------------------------------

// A split half's mint key is its parent's key + SPLIT_MARK + the parent's version at the split. The contracts keep mint keys unique
// (checkCustody; the server's unique index), and a key's one row bumps its version on every split, so a derived key is never reused.
// Every key in one split family shares its ROOT, the key the server minted. Server-minted keys must not contain SPLIT_MARK.
export const SPLIT_MARK = '::s';
export const mintRoot = (key: string): string => key.split(SPLIT_MARK, 1)[0]!;
const addTo = (totals: Map<string, number>, key: string, quantity: number): void => void totals.set(mintRoot(key), (totals.get(mintRoot(key)) ?? 0) + quantity);
// Quantity per root mint key over some rows (an inventory, an escrow, a whole table).
export function mintTotals(rows: readonly ItemInstance[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) addTo(out, r.provenance.mintKey, r.quantity);
  return out;
}
// Conservation: per root mint key, the units held across ALL rows plus the units burned (the ledger, `consume` below) equal exactly what
// was minted. `minted` is the server's ledger (root key → quantity minted). Split, merge, bank moves and trades keep the held total; a
// burn moves units from held to burned; only a mint changes `minted`.
export function checkConservation(rows: readonly ItemInstance[], minted: ReadonlyMap<string, number>, burned: readonly Burn[] = []): Issue[] {
  const held = mintTotals(rows), gone = new Map<string, number>(), issues: Issue[] = [];
  for (const line of burned.flatMap((b) => b.lines)) addTo(gone, line.mintKey, line.quantity);
  for (const key of new Set([...held.keys(), ...minted.keys(), ...gone.keys()])) {
    const have = held.get(key) ?? 0, spent = gone.get(key) ?? 0, want = minted.get(key) ?? 0;
    if (have + spent !== want) issues.push({ code: 'rule-violation', path: key, message: `mint ${key} holds ${have} units across its rows${spent ? ` and ${spent} burned` : ''}; ${want} were minted` });
  }
  return issues;
}

// Open an Inventory from stored instances. Refused, with every issue, unless the invariant holds.
export function openInventory(
  input: { owner: CharacterInstanceId; account: AccountId; items: readonly ItemInstance[]; packSize?: number; bankSize?: number },
  lookup: Lookup,
): Result<Inventory> {
  const inv: Inventory = { owner: input.owner, account: input.account, packSize: input.packSize ?? PACK_SLOTS, bankSize: input.bankSize ?? BANK_SLOTS, items: [...input.items] };
  const issues = checkInventory(inv, lookup);
  return issues.length ? { ok: false, issues } : ok(inv);
}

// The plan/apply step: build the next item list from replacements (null = leaves this inventory) and additions, check the whole result,
// and only then hand it out. The input is never written to. Every operation except a crossing of the border (receive, remove, settle)
// must also conserve each mint's units inside this inventory, counting what it `burned` (consume, applyUpgrade).
function commit(
  inv: Inventory, lookup: Lookup, changes: ReadonlyMap<string, ItemInstance | null>, added: readonly ItemInstance[] = [], conserve = true, burned: readonly Burn[] = [],
): Result<Inventory> {
  const items: ItemInstance[] = [];
  for (const inst of inv.items) {
    if (!changes.has(inst.id)) items.push(inst);
    else {
      const next = changes.get(inst.id);
      if (next) items.push(next);
    }
  }
  items.push(...added);
  const next: Inventory = { ...inv, items };
  const issues = [...checkInventory(next, lookup), ...(conserve ? checkConservation(items, mintTotals(inv.items), burned) : [])];
  return issues.length ? { ok: false, issues } : ok(next);
}

// ---- gates and argument checks --------------------------------------------------------------------------------------------------

const BANK_CLOSED = 'the bank opens only at the Concord Exchange';
// The bank's one gate (ClaudeCraft's nearBanker idiom): every bank command calls this first. `place` is where the character stands.
const bankGate = (place: unknown): Result<true> => (place === BANK_PLACE ? ok(true) : fail('rule-violation', 'at', `${BANK_CLOSED}; this character is at ${typeof place === 'string' ? place : 'no known place'}`));

function readSlot(inv: Inventory, slot: unknown, path: string): Result<Slot> {
  if (slot === null || typeof slot !== 'object') return fail('wrong-type', path, 'expected { grid, index }');
  const { grid, index } = slot as { grid?: unknown; index?: unknown };
  if (!isGrid(grid)) return fail('wrong-type', `${path}.grid`, 'expected "pack" or "bank"');
  if (typeof index !== 'number' || !Number.isInteger(index)) return fail('wrong-type', `${path}.index`, 'a slot index is a whole number');
  if (index < 0 || index >= sizeOf(inv, grid)) return fail('out-of-range', `${path}.index`, `slot ${index} is outside the ${sizeOf(inv, grid)}-slot ${grid}`);
  return ok({ grid, index });
}

// A free slot in `grid`: the one asked for (it must be empty) or the first free one. A full grid is refused with its own path.
function freeSlot(inv: Inventory, grid: Grid, index: unknown, path: string): Result<Slot> {
  if (index === undefined) {
    const first = firstFree(inv, grid);
    return first < 0 ? fail('out-of-range', grid, `the ${grid === 'pack' ? 'backpack' : 'bank'} is full (${sizeOf(inv, grid)} slots)`) : ok({ grid, index: first });
  }
  const slot = readSlot(inv, { grid, index }, path);
  if (!slot.ok) return slot;
  const taken = occupant(inv, grid, slot.value.index);
  return taken ? fail('rule-violation', path, `${grid} slot ${slot.value.index} holds ${taken.id}`) : slot;
}

function held(inv: Inventory, id: unknown, path = 'id'): Result<ItemInstance> {
  const inst = find(inv, id);
  return inst ? ok(inst) : fail('unknown-id', path, `${typeof id === 'string' ? JSON.stringify(id) : 'that id'} is not in this character's pack, bank or paperdoll`);
}

function known(lookup: Lookup, inst: ItemInstance, path = 'item'): Result<ItemDefinition> {
  const def = defOf(lookup, inst.item);
  return def ? ok(def) : fail('unknown-id', path, `${inst.item} is not defined in this content`);
}

// ---- views ------------------------------------------------------------------------------------------------------------------------

// One grid as its fixed slots (null = empty). The bank can only be looked into at the Exchange.
export function gridView(inv: Inventory, grid: Grid, place?: unknown): Result<(ItemInstance | null)[]> {
  if (!isGrid(grid)) return fail('wrong-type', 'grid', 'expected "pack" or "bank"');
  if (grid === 'bank') {
    const gate = bankGate(place);
    if (!gate.ok) return gate;
  }
  const cells: (ItemInstance | null)[] = Array.from({ length: sizeOf(inv, grid) }, () => null);
  for (const inst of inv.items) if (inst.location.kind === grid) cells[inst.location.index] = inst;
  return ok(cells);
}
export const worn = (inv: Inventory): ItemInstance[] => inv.items.filter((i) => i.location.kind === 'equipped');

// ---- arrive and leave -------------------------------------------------------------------------------------------------------------

// A new piece arrives in the backpack (a Pit award, a loot drop, a quest reward, a settled trade). It keeps its id, provenance and
// history; its location becomes this pack, its version bumps, and an on-acquire item binds. Refused: an id already held, an unknown
// definition, a second copy of a single-copy piece anywhere in pack, bank or paperdoll (one of each), and a full or taken slot.
export function receive(inv: Inventory, incoming: ItemInstance, lookup: Lookup, index?: number): Result<Inventory> {
  if (incoming === null || typeof incoming !== 'object' || typeof incoming.id !== 'string') return fail('wrong-type', 'incoming', 'expected an item instance');
  if (find(inv, incoming.id)) return fail('duplicate-id', 'incoming.id', `${incoming.id} is already held here: an instance lives in exactly one place`);
  const def = known(lookup, incoming, 'incoming.item');
  if (!def.ok) return def;
  if (def.value.stack === 1) {
    const copy = inv.items.find((i) => i.item === incoming.item);
    if (copy) return fail('rule-violation', 'incoming.item', `one of each: ${inv.owner} already holds ${incoming.item} (${copy.id}, ${copy.location.kind})`);
  }
  const slot = freeSlot(inv, 'pack', index, 'index');
  if (!slot.ok) return slot;
  const boundTo = incoming.boundTo ?? (def.value.binding === 'on-acquire' ? inv.owner : null);
  const placed: ItemInstance = { ...incoming, location: at(inv, 'pack', slot.value.index), boundTo, version: incoming.version + 1 };
  return commit(inv, lookup, new Map(), [placed], false);
}

// A piece leaves this character (to a trade escrow, to the smith, used up). Only from the pack, or from the bank at the Exchange. A
// worn piece must be taken off first; a bound or story-critical piece never leaves its character (items.ts checkInstance). The removed
// instance is returned unchanged: the caller gives it its next location in the same server transaction.
export function remove(inv: Inventory, id: unknown, lookup: Lookup, place?: unknown): Result<{ inventory: Inventory; removed: ItemInstance }> {
  const inst = held(inv, id);
  if (!inst.ok) return inst;
  const def = known(lookup, inst.value);
  if (!def.ok) return def;
  if (inst.value.location.kind === 'equipped') return fail('rule-violation', 'id', `${inst.value.id} is worn; take it off first`);
  if (inst.value.location.kind === 'bank') {
    const gate = bankGate(place);
    if (!gate.ok) return gate;
  }
  if (inst.value.boundTo !== null || def.value.story === 'story-critical') return fail('rule-violation', 'id', `${inst.value.id} is bound to ${inst.value.boundTo ?? inv.owner} and never leaves them`);
  const next = commit(inv, lookup, new Map([[inst.value.id, null]]), [], false);
  return next.ok ? ok({ inventory: next.value, removed: inst.value }) : next;
}

// ---- moves inside the two grids ---------------------------------------------------------------------------------------------------

// Move a piece to a slot of the pack or the bank. An empty slot takes it; an occupied slot swaps the two pieces (both move or neither
// does). Anything touching the bank, on either end, needs the Exchange. Worn pieces go through unequip. Each moved piece goes through
// items.ts moveItem: compare-and-bump version, same holder, every instance rule re-checked; provenance and history ride along untouched.
export function move(inv: Inventory, id: unknown, to: unknown, lookup: Lookup, place?: unknown): Result<Inventory> {
  const inst = held(inv, id);
  if (!inst.ok) return inst;
  const from = gridOf(inst.value);
  if (from === null) return fail('rule-violation', 'id', `${inst.value.id} is worn; take it off with unequip`);
  const slot = readSlot(inv, to, 'to');
  if (!slot.ok) return slot;
  if (from === 'bank' || slot.value.grid === 'bank') {
    const gate = bankGate(place);
    if (!gate.ok) return gate;
  }
  if (from === slot.value.grid && indexOf(inst.value) === slot.value.index) return fail('rule-violation', 'to', `${inst.value.id} is already in ${from} slot ${slot.value.index}`);
  const def = known(lookup, inst.value);
  if (!def.ok) return def;
  const moved = moveItem(inst.value, def.value, inst.value.version, at(inv, slot.value.grid, slot.value.index), () => inv.account);
  if (!moved.ok) return moved;
  const changes = new Map<string, ItemInstance | null>([[inst.value.id, moved.value]]);
  const other = occupant(inv, slot.value.grid, slot.value.index);
  if (other) {
    const otherDef = known(lookup, other, 'to');
    if (!otherDef.ok) return otherDef;
    const back = moveItem(other, otherDef.value, other.version, inst.value.location, () => inv.account);
    if (!back.ok) return back;
    changes.set(other.id, back.value);
  }
  return commit(inv, lookup, changes);
}

// Deposit: pack → bank, at the Exchange, into the slot asked for or the first free one. All or nothing: a full bank refuses.
export function deposit(inv: Inventory, id: unknown, lookup: Lookup, place: unknown, index?: number): Result<Inventory> {
  return between(inv, id, 'pack', 'bank', lookup, place, index);
}
// Withdraw: bank → pack, at the Exchange. A full pack refuses and the piece stays in the bank.
export function withdraw(inv: Inventory, id: unknown, lookup: Lookup, place: unknown, index?: number): Result<Inventory> {
  return between(inv, id, 'bank', 'pack', lookup, place, index);
}
function between(inv: Inventory, id: unknown, from: Grid, to: Grid, lookup: Lookup, place: unknown, index: number | undefined): Result<Inventory> {
  const gate = bankGate(place);
  if (!gate.ok) return gate;
  const inst = held(inv, id);
  if (!inst.ok) return inst;
  if (inst.value.location.kind !== from) return fail('rule-violation', 'id', `${inst.value.id} is not in the ${from === 'pack' ? 'backpack' : 'bank'}`);
  const slot = freeSlot(inv, to, index, 'index');
  if (!slot.ok) return slot;
  return move(inv, inst.value.id, slot.value, lookup, place);
}

// ---- stacks -----------------------------------------------------------------------------------------------------------------------

const BANK_TOUCH = (a: ItemInstance, b?: Slot | ItemInstance): boolean =>
  a.location.kind === 'bank' || (b !== undefined && ('grid' in b ? b.grid === 'bank' : b.location.kind === 'bank'));

// Split `count` off a stack into a new instance in an empty slot (default: the first free slot of the same grid). Armour and every
// other single-copy piece never stacks, so never splits. `newId` is minted by the server (this module draws no randomness) and must
// be a fresh `inst:` id. The new half carries the parent's provenance and history unchanged except for its derived child mint key
// (SPLIT_MARK above); the quantities add back to the original.
export function split(inv: Inventory, id: unknown, count: unknown, newId: unknown, lookup: Lookup, to?: { grid: Grid; index?: number }, place?: unknown): Result<Inventory> {
  const inst = held(inv, id);
  if (!inst.ok) return inst;
  const def = known(lookup, inst.value);
  if (!def.ok) return def;
  const from = gridOf(inst.value);
  if (from === null) return fail('rule-violation', 'id', `${inst.value.id} is worn`);
  if (def.value.stack === 1) return fail('rule-violation', 'id', `${inst.value.item} never stacks, so it cannot be split`);
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count >= inst.value.quantity) {
    return fail('out-of-range', 'count', `split 1..${inst.value.quantity - 1} off a stack of ${inst.value.quantity}`);
  }
  const fresh = parseId(newId, 'inst', 'newId');
  if (!fresh.ok) return fresh;
  if (find(inv, fresh.value)) return fail('duplicate-id', 'newId', `${fresh.value} is already held here`);
  const grid = to?.grid ?? from;
  if (!isGrid(grid)) return fail('wrong-type', 'to.grid', 'expected "pack" or "bank"');
  const slot = freeSlot(inv, grid, to?.index, 'to.index');
  if (!slot.ok) return slot;
  if (BANK_TOUCH(inst.value, slot.value)) {
    const gate = bankGate(place);
    if (!gate.ok) return gate;
  }
  const mintKey = `${inst.value.provenance.mintKey}${SPLIT_MARK}${inst.value.version}`;
  if (!MINT_KEY_PATTERN.test(mintKey)) return fail('out-of-range', 'id', `${inst.value.id} has been split too many times; merge it first`);
  const parent: ItemInstance = { ...inst.value, quantity: inst.value.quantity - count, version: inst.value.version + 1 };
  const child: ItemInstance = {
    ...inst.value, id: fresh.value as ItemInstanceId, quantity: count, version: 0, location: at(inv, slot.value.grid, slot.value.index), provenance: { ...inst.value.provenance, mintKey },
  };
  return commit(inv, lookup, new Map([[parent.id, parent]]), [child]);
}

// Merge one stack into another, whole or not at all (ClaudeCraft's fit-before-move): the two must be the same stackable item with the
// same provenance (the same root mint key: one split family), history, binding, tier and upgrade level, so nothing about either is lost;
// and the total must fit one stack. The `from` instance leaves; `into` keeps its id, slot and mint key and takes the sum.
export function merge(inv: Inventory, fromId: unknown, intoId: unknown, lookup: Lookup, place?: unknown): Result<Inventory> {
  const from = held(inv, fromId, 'fromId');
  if (!from.ok) return from;
  const into = held(inv, intoId, 'intoId');
  if (!into.ok) return into;
  if (from.value.id === into.value.id) return fail('duplicate-id', 'intoId', 'a stack cannot merge into itself');
  if (gridOf(from.value) === null || gridOf(into.value) === null) return fail('rule-violation', 'fromId', 'worn pieces do not stack');
  if (BANK_TOUCH(from.value, into.value)) {
    const gate = bankGate(place);
    if (!gate.ok) return gate;
  }
  const def = known(lookup, from.value);
  if (!def.ok) return def;
  if (def.value.stack === 1) return fail('rule-violation', 'fromId', `${from.value.item} never stacks`);
  const a = from.value, b = into.value;
  if (a.item !== b.item) return fail('rule-violation', 'intoId', `${a.item} does not stack with ${b.item}`);
  const origin = (i: ItemInstance): unknown => ({ ...i.provenance, mintKey: mintRoot(i.provenance.mintKey) });
  if (!sameData(origin(a), origin(b)) || !sameData(a.history, b.history)) {
    return fail('rule-violation', 'intoId', 'these stacks came from different places; merging them would rewrite one of their provenances');
  }
  if (a.boundTo !== b.boundTo || a.tier !== b.tier || (a.upgradeLevel ?? 0) !== (b.upgradeLevel ?? 0)) return fail('rule-violation', 'intoId', 'these stacks differ in binding, tier or upgrade level');
  if (a.quantity + b.quantity > def.value.stack) return fail('out-of-range', 'intoId', `${a.quantity} + ${b.quantity} is more than one stack of ${def.value.stack}`);
  return commit(inv, lookup, new Map<string, ItemInstance | null>([[a.id, null], [b.id, { ...b, quantity: a.quantity + b.quantity, version: b.version + 1 }]]));
}

// ---- burns: units spent for good (a quest hand-in, the smith's material cost) ----------------------------------------------------

// Every burn is one ledger entry naming the rows it took from, by their own mint key, so conservation reads minted = held + burned. The
// ledger is the server's append-only table; `op` is the operation's idempotency key (Strategy, 2026-10-06): the same key with the same
// request returns the ORIGINAL burn and changes nothing (a retry after a client timeout), the same key with a different request is
// refused. Either way a key spends once.
export const BURN_REASONS = ['quest-handin', 'upgrade-cost'] as const;
export type BurnReason = (typeof BURN_REASONS)[number];
export type BurnLine = { readonly instance: ItemInstanceId; readonly item: ItemId; readonly mintKey: string; readonly quantity: number };
// What was asked for, compared on a retry: a hand-in's selector and count, or the smith's whole receipt.
export type ConsumeAsk = { readonly qty: number; readonly itemId?: ItemId; readonly mintKey?: string; readonly consumesStoryItem?: ItemId };
export type Burn = {
  readonly op: string; readonly owner: CharacterInstanceId; readonly reason: BurnReason; readonly asked: ConsumeAsk | UpgradeReceipt; readonly lines: readonly BurnLine[];
};
export type Holdings = { readonly inventory: Inventory; readonly ledger: readonly Burn[] };
// The new holdings, the burn that op id stands for, and whether this call was a retry that changed nothing.
export type Burned = Holdings & { readonly burn: Burn; readonly replayed: boolean };
// Name the units by definition (`itemId`: any stack of that item) or by mint (`mintKey`: the root key, so a whole split family). One of
// the two, never both. A story-critical piece burns only on a quest step that names it in `consumesStoryItem` (no wildcard).
export type ConsumeOp = ConsumeAsk & { op: string; owner: CharacterInstanceId; reason: BurnReason };

// Check the op id, owner and reason; then, if the ledger already has this op id, answer the retry: the original burn when the request is
// the same, a refusal when it is not. `ok(null)` means a fresh op.
function burnHeader(state: Holdings, op: unknown, owner: unknown, reason: unknown, asked: ConsumeAsk | UpgradeReceipt): Result<Burned | null> {
  if (typeof op !== 'string' || !MINT_KEY_PATTERN.test(op)) return fail('wrong-type', 'op', 'an operation id is an idempotency key (8..128 of a-z 0-9 : . _ -)');
  if (owner !== state.inventory.owner) return fail('rule-violation', 'owner', `this inventory is ${state.inventory.owner}'s`);
  if (!BURN_REASONS.includes(reason as BurnReason)) return fail('wrong-type', 'reason', `expected one of ${BURN_REASONS.join(', ')}`);
  const prior = state.ledger.find((b) => b.op === op);
  if (!prior) return ok(null);
  if (prior.reason !== reason || !sameData(prior.asked, asked)) return fail('duplicate-id', 'op', `${op} was already used for a different burn; an op id names one request`);
  return ok({ ...state, burn: prior, replayed: true });
}
// Take `take` units from each row: an emptied row leaves, a partial one keeps its id, slot and key at version + 1.
function burnFrom(picks: readonly { row: ItemInstance; take: number }[]): { changes: Map<string, ItemInstance | null>; lines: BurnLine[] } {
  const changes = new Map<string, ItemInstance | null>(), lines: BurnLine[] = [];
  for (const { row, take } of picks) {
    changes.set(row.id, take === row.quantity ? null : { ...row, quantity: row.quantity - take, version: row.version + 1 });
    lines.push({ instance: row.id, item: row.item, mintKey: row.provenance.mintKey, quantity: take });
  }
  return { changes, lines };
}
function burn(state: Holdings, entry: Burn, changes: ReadonlyMap<string, ItemInstance | null>, lookup: Lookup): Result<Burned> {
  const next = commit(state.inventory, lookup, changes, [], true, [entry]);
  return next.ok ? ok({ inventory: next.value, ledger: [...state.ledger, entry], burn: entry, replayed: false }) : next;
}
const isStory = (lookup: Lookup, inst: ItemInstance): boolean => defOf(lookup, inst.item)?.story === 'story-critical';

// Burn `qty` units from the BACKPACK only (what the character hands over is what they carry; the bank stays shut away from the
// Exchange, and worn pieces are never spent), lowest slot first. All or nothing: too few units, an unknown item, a story-critical piece
// not named by its quest step, or an op id reused for a different request is refused with the state untouched.
export function consume(state: Holdings, op: ConsumeOp, lookup: Lookup): Result<Burned> {
  if (op === null || typeof op !== 'object') return fail('wrong-type', 'op', 'expected a consume operation');
  const { qty, itemId, mintKey, consumesStoryItem } = op, inv = state.inventory;
  // Only the fields given, so a stored request compares (and serialises) the same on a retry.
  const asked = Object.fromEntries(Object.entries({ qty, itemId, mintKey, consumesStoryItem }).filter(([, v]) => v !== undefined)) as ConsumeAsk;
  const header = burnHeader(state, op.op, op.owner, op.reason, asked);
  if (!header.ok || header.value) return header as Result<Burned>;
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) return fail('out-of-range', 'qty', 'burn a whole number of units, at least 1');
  if ((itemId === undefined) === (mintKey === undefined)) return fail('wrong-type', 'itemId', 'name either an itemId or a mintKey');
  const byItem = itemId !== undefined, key = byItem ? itemId : mintKey;
  const named = (i: ItemInstance): boolean => (byItem ? i.item === key : mintRoot(i.provenance.mintKey) === key);
  if (typeof key !== 'string' || (byItem ? !defOf(lookup, key as ItemId) : !inv.items.some(named))) {
    return fail('unknown-id', byItem ? 'itemId' : 'mintKey', `${typeof key === 'string' ? JSON.stringify(key) : 'that'} names nothing ${byItem ? 'defined in this content' : 'this character holds'}`);
  }
  const rows = inv.items.filter((i) => i.location.kind === 'pack' && named(i)).sort((a, b) => indexOf(a) - indexOf(b));
  // Story pieces (Strategy, 2026-10-06): only a quest step that names the very item it burns; naming any other item is refused too.
  if (consumesStoryItem !== undefined && (op.reason !== 'quest-handin' || rows.some((r) => r.item !== consumesStoryItem))) {
    return fail('rule-violation', 'consumesStoryItem', `${String(consumesStoryItem)} is not the item this quest step burns`);
  }
  if (rows.some((r) => isStory(lookup, r) && r.item !== consumesStoryItem)) return fail('rule-violation', 'itemId', `${key} is story-critical; only a quest step that names it may spend it`);
  const have = rows.reduce((n, r) => n + r.quantity, 0);
  if (have < qty) return fail('rule-violation', 'qty', `needs ${qty} of ${key}; the backpack holds ${have}`);
  let need = qty;
  const picks = rows.flatMap((row) => {
    const take = Math.min(need, row.quantity);
    need -= take;
    return take ? [{ row, take }] : [];
  });
  const { changes, lines } = burnFrom(picks);
  return burn(state, { op: op.op, owner: inv.owner, reason: op.reason, asked, lines }, changes, lookup);
}

// Apply the blacksmith's result (economy.ts performUpgrade) in one step: the upgraded piece replaces its row in place (same id and slot,
// version + 1, history grown, provenance kept), and the receipt's material lines burn under its idempotency key, reason 'upgrade-cost'.
// The smith may take materials from the bank (the forge stands at the Exchange), so a bank line needs `place` to be the Exchange. The
// outcome must match these rows exactly (a stale piece, a stale stack or a disagreeing outcome is refused). A retry carrying the same
// receipt (the outcome again, or the smith's replay of it) returns the original burn; a different receipt under that key is refused.
export function applyUpgrade(state: Holdings, outcome: UpgradeOutcome, lookup: Lookup, place?: unknown): Result<Burned> {
  const { receipt } = outcome, inv = state.inventory;
  const header = burnHeader(state, receipt.idempotencyKey, receipt.character, 'upgrade-cost', receipt);
  if (!header.ok || header.value) return header as Result<Burned>;
  if (outcome.replayed) return fail('rule-violation', 'outcome', `${receipt.idempotencyKey} is the smith's replay of an upgrade this inventory never applied`);
  const after = outcome.instance;
  const piece = held(inv, after.id, 'outcome.instance');
  if (!piece.ok) return piece;
  if (receipt.instance !== after.id || after.version !== piece.value.version + 1 || !sameData(after.location, piece.value.location) || checkHistoryKept(piece.value, after).length) {
    return fail('version-conflict', 'outcome.instance', `the upgrade was worked on a different copy of ${after.id} (held at version ${piece.value.version})`);
  }
  const picks: { row: ItemInstance; take: number }[] = [];
  for (const [i, line] of receipt.materials.entries()) {
    const row = held(inv, line.instance, `receipt.materials[${i}]`);
    if (!row.ok) return row;
    if (row.value.item !== line.item || row.value.location.kind === 'equipped' || line.quantity > row.value.quantity) {
      return fail('version-conflict', `receipt.materials[${i}]`, `${line.instance} does not hold ${line.quantity} × ${line.item} to spend`);
    }
    if (isStory(lookup, row.value)) return fail('rule-violation', `receipt.materials[${i}]`, `${line.item} is story-critical; the smith never takes it`);
    if (row.value.location.kind === 'bank') {
      const gate = bankGate(place);
      if (!gate.ok) return gate;
    }
    picks.push({ row: row.value, take: line.quantity });
  }
  const { changes, lines } = burnFrom(picks);
  const emptied = [...changes].filter(([, v]) => v === null).map(([id]) => id);
  const kept = [...changes.values()].filter((v) => v !== null);
  if (!sameData(emptied.sort(), [...outcome.consumed].sort()) || !sameData(kept, outcome.materials)) {
    return fail('version-conflict', 'outcome.materials', 'the outcome and its receipt disagree about what the smith took');
  }
  changes.set(after.id, after);
  return burn(state, { op: receipt.idempotencyKey, owner: inv.owner, reason: 'upgrade-cost', asked: receipt, lines }, changes, lookup);
}

// ---- wearing ----------------------------------------------------------------------------------------------------------------------

// Can this character wear this piece? Owning and wearing are separate checks (Dom, 2026-10-06): the wearer's server-verified rank
// must reach the piece's effective tier (won rank + upgrade levels). Returns the rank the piece needs (null for an unranked cosmetic).
export function canWear(inv: Inventory, id: unknown, lookup: Lookup, standing: CareerStanding): Result<Tier | null> {
  const inst = held(inv, id);
  if (!inst.ok) return inst;
  const def = known(lookup, inst.value);
  if (!def.ok) return def;
  if (def.value.slot === null) return fail('rule-violation', 'id', `${inst.value.item} is not worn`);
  const need = effectiveTier(inst.value);
  if (need === null) return ok(null);
  const rank = verifiedTier(standing);
  if (!rank.ok) return rank;
  return tierLevel(rank.value) >= tierLevel(need) ? ok(need) : fail('rule-violation', 'tier', `${inst.value.id} needs rank ${need}; the wearer is ${rank.value}`);
}

// Put on a piece from the backpack (items.ts equipItem does the rank check and the on-equip binding). The paperdoll slot must be
// empty: there is no silent swap, so a full pack can never strand the piece taken off.
export function equip(inv: Inventory, id: unknown, lookup: Lookup, standing: CareerStanding): Result<Inventory> {
  const inst = held(inv, id);
  if (!inst.ok) return inst;
  if (inst.value.location.kind !== 'pack') return fail('rule-violation', 'id', `${inst.value.id} is not in the backpack`);
  const def = known(lookup, inst.value);
  if (!def.ok) return def;
  const wear = canWear(inv, id, lookup, standing);
  if (!wear.ok) return wear;
  const doll: Paperdoll = paperdollOf(def.value.slot!);
  const on = inv.items.find((i) => i.location.kind === 'equipped' && i.location.slot === doll);
  if (on) return fail('rule-violation', 'id', `the ${doll} slot holds ${on.id}; take it off first`);
  const placed = equipItem(inst.value, def.value, inst.value.version, inv.owner, standing);
  if (!placed.ok) return placed;
  return commit(inv, lookup, new Map([[inst.value.id, placed.value]]));
}

// Take a piece off into the backpack (the slot asked for, or the first free one). A full pack refuses and the piece stays worn.
export function unequip(inv: Inventory, id: unknown, lookup: Lookup, index?: number): Result<Inventory> {
  const inst = held(inv, id);
  if (!inst.ok) return inst;
  if (inst.value.location.kind !== 'equipped') return fail('rule-violation', 'id', `${inst.value.id} is not worn`);
  const def = known(lookup, inst.value);
  if (!def.ok) return def;
  const slot = freeSlot(inv, 'pack', index, 'index');
  if (!slot.ok) return slot;
  const moved = moveItem(inst.value, def.value, inst.value.version, at(inv, 'pack', slot.value.index), () => inv.account);
  if (!moved.ok) return moved;
  return commit(inv, lookup, new Map([[inst.value.id, moved.value]]));
}

// ---- trade ------------------------------------------------------------------------------------------------------------------------

// Settle a trade between two characters' inventories (economy.ts settleTrade, the one trade rule set). `escrow` holds the offered
// pieces, already `remove`d into this trade's escrow. Each receiver's pack size and free slots come from its real Inventory, never an
// assumed 64. Returns both inventories with the moved pieces placed, or a refusal with both untouched.
export function settle(trade: Trade, sides: readonly [Inventory, Inventory], escrow: readonly ItemInstance[], lookup: Lookup, now: string): Result<[Inventory, Inventory]> {
  const byOwner = new Map<string, Inventory>(sides.map((inv) => [inv.owner, inv]));
  const moved = settleTrade(trade, [...sides[0].items, ...sides[1].items, ...escrow], (id) => defOf(lookup, id), (pc) => byOwner.get(pc)?.account, now, (pc) => byOwner.get(pc)?.packSize ?? 0);
  if (!moved.ok) return moved;
  const [a, b] = sides.map((inv) => commit(inv, lookup, new Map(), moved.value.filter((m) => m.location.kind === 'pack' && m.location.owner === inv.owner), false));
  if (!a!.ok) return a!;
  if (!b!.ok) return b!;
  return ok([a!.value, b!.value]);
}
