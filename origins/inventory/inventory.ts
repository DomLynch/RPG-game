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
import { fail, ok, type Issue, type Result } from '../contracts/core.ts';
import { CONCORD_EXCHANGE } from '../contracts/economy.ts';
import { parseId, type AccountId, type CharacterInstanceId, type ItemId, type ItemInstanceId, type RegionId } from '../contracts/ids.ts';
import {
  BANK_SLOTS, PACK_SLOTS, checkCustody, checkInstance, checkOneOfEach, effectiveTier, equipItem, moveItem, sameData,
  type ItemDefinition, type ItemInstance, type Location,
} from '../contracts/items.ts';
import { verifiedTier, type CareerStanding } from '../contracts/world.ts';

export const GRIDS = ['pack', 'bank'] as const;
export type Grid = (typeof GRIDS)[number];
// The one place the bank opens. Taken from the contracts (the same constant a trade settles at), not redefined.
export const BANK_PLACE: RegionId = CONCORD_EXCHANGE;
// Grid sizes. The contracts fix the largest index a location may carry (PACK_SLOTS 64, BANK_SLOTS 1000), and economy.ts settleTrade
// fills a pack up to PACK_SLOTS, so the defaults are those caps; a caller may open a smaller grid (a starter pack) within them.
export const DEFAULT_PACK_SIZE = PACK_SLOTS;
export const DEFAULT_BANK_SIZE = BANK_SLOTS;

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
// One deliberate exception to checkCustody: a split stack's halves share their parent's provenance, so they share its mint key. A
// shared mint key is accepted only for a "split family": the same stackable item with byte-equal provenance. See README, "Contract gaps".
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
  const families = splitFamilies(inv.items, lookup);
  for (const issue of checkCustody(inv.items)) {
    const m = /^\[(\d+)\]\.provenance\.mintKey$/.exec(issue.path);
    if (m && issue.code === 'duplicate-id' && families.has(inv.items[Number(m[1])]!.provenance.mintKey)) continue;
    issues.push({ ...issue, path: `items${issue.path}` });
  }
  for (const issue of checkOneOfEach(inv.items, (id) => defOf(lookup, id), () => inv.account)) issues.push({ ...issue, path: `items${issue.path}` });
  return issues;
}

// Mint keys shared ONLY by the halves of split stacks: every instance under the key is the same stackable item with equal provenance.
function splitFamilies(items: readonly ItemInstance[], lookup: Lookup): Set<string> {
  const byKey = new Map<string, ItemInstance[]>();
  for (const inst of items) {
    const list = byKey.get(inst.provenance.mintKey);
    if (list) list.push(inst);
    else byKey.set(inst.provenance.mintKey, [inst]);
  }
  const out = new Set<string>();
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const first = list[0]!, def = defOf(lookup, first.item);
    if (def && def.stack > 1 && list.every((i) => i.item === first.item && sameData(i.provenance, first.provenance))) out.add(key);
  }
  return out;
}

// Open an Inventory from stored instances. Refused, with every issue, unless the invariant holds.
export function openInventory(
  input: { owner: CharacterInstanceId; account: AccountId; items: readonly ItemInstance[]; packSize?: number; bankSize?: number },
  lookup: Lookup,
): Result<Inventory> {
  const inv: Inventory = { owner: input.owner, account: input.account, packSize: input.packSize ?? DEFAULT_PACK_SIZE, bankSize: input.bankSize ?? DEFAULT_BANK_SIZE, items: [...input.items] };
  const issues = checkInventory(inv, lookup);
  return issues.length ? { ok: false, issues } : ok(inv);
}

// The plan/apply step: build the next item list from replacements (null = leaves this inventory) and additions, check the whole result,
// and only then hand it out. The input is never written to.
function commit(inv: Inventory, lookup: Lookup, changes: ReadonlyMap<string, ItemInstance | null>, added: readonly ItemInstance[] = []): Result<Inventory> {
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
  const issues = checkInventory(next, lookup);
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
  return commit(inv, lookup, new Map(), [placed]);
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
  const next = commit(inv, lookup, new Map([[inst.value.id, null]]));
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
// be a fresh `inst:` id. The new half carries the parent's provenance and history unchanged; the quantities add back to the original.
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
  const parent: ItemInstance = { ...inst.value, quantity: inst.value.quantity - count, version: inst.value.version + 1 };
  const child: ItemInstance = { ...inst.value, id: fresh.value as ItemInstanceId, quantity: count, version: 0, location: at(inv, slot.value.grid, slot.value.index) };
  return commit(inv, lookup, new Map([[parent.id, parent]]), [child]);
}

// Merge one stack into another, whole or not at all (ClaudeCraft's fit-before-move): the two must be the same stackable item with the
// same provenance, history, binding, tier and upgrade level, so nothing about either is lost; and the total must fit one stack. The
// `from` instance leaves; `into` keeps its id and slot and takes the sum.
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
  if (!sameData(a.provenance, b.provenance) || !sameData(a.history, b.history)) {
    return fail('rule-violation', 'intoId', 'these stacks came from different places; merging them would rewrite one of their provenances');
  }
  if (a.boundTo !== b.boundTo || a.tier !== b.tier || (a.upgradeLevel ?? 0) !== (b.upgradeLevel ?? 0)) return fail('rule-violation', 'intoId', 'these stacks differ in binding, tier or upgrade level');
  if (a.quantity + b.quantity > def.value.stack) return fail('out-of-range', 'intoId', `${a.quantity} + ${b.quantity} is more than one stack of ${def.value.stack}`);
  return commit(inv, lookup, new Map<string, ItemInstance | null>([[a.id, null], [b.id, { ...b, quantity: a.quantity + b.quantity, version: b.version + 1 }]]));
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
