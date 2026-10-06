// Origins O1: the economy's two server-side transactions — direct trade at the Concord Exchange, and NPC services (the first is the
// blacksmith's upgrade) — with their contracts and pure settlement functions.
//
// Both are SERVER-ONLY. The browser sends a request and shows the result; it never runs these functions to decide an outcome. Each
// function takes the current state and returns the new state; the server commits that state together with its receipt in one
// transaction (blueprint §8). Every input instance carries a version, and a stale one is refused, never merged.
//
// Dom's rulings, 2026-10-06:
//   - Pit-won pieces are tradeable; trades are valid only at the Concord Exchange; a trade that would leave either player holding two of
//     one definition is invalid; provenance survives every trade and history only grows.
//   - NPC services instead of player crafting (UO-style). The blacksmith raises a piece's upgrade level on the existing per-piece score
//     scale, never past the 1.15 / 0.80 caps, for the one trade currency plus optional material lines, priced from a versioned cost table.
//     Crafting stays out.
import { SLOT_WEIGHT } from '../../src/gear-stats.ts';
import { levelOf as tierLevel } from '../../src/grades.ts';
import { isWeaponSlot } from '../../src/loot.ts';
import {
  Issues, MINT_KEY_PATTERN, fail, join, ok, readArray, readBoolean, readEnum, readInt, readKind, readObject, readSchemaVersion, readString, readText,
  readTimestamp, type Issue, type Result,
} from './core.ts';
import {
  checkId, readId,
  type AccountId, type CharacterId, type CharacterInstanceId, type ContainerId, type CostTableId, type ItemId, type ItemInstanceId, type RegionId, type ServiceId,
} from './ids.ts';
import {
  MAX_UPGRADE_LEVEL, PACK_SLOTS, RARITIES, checkOneOfEach, effectiveTier, ownerOf, piecePoints, placeWithHistory, upgradeLevelOf,
  type AccountOf, type ItemDefinition, type ItemInstance, type Rarity,
} from './items.ts';
import { verifiedTier, type CareerStanding } from './world.ts';

// The neutral plaza beside the Pit (blueprint §8). The only place a trade settles.
export const CONCORD_EXCHANGE = 'region:concord-exchange' as RegionId;

// ---- Trade ------------------------------------------------------------------------------------------------------------------------

export const TRADE_VERSION = 1;
export const MAX_OFFER = 16;
export type TradeSide = { character: CharacterInstanceId; account: AccountId; offered: ItemInstanceId[]; accepted: boolean };
export type Trade = {
  kind: 'trade';
  schemaVersion: 1;
  id: ContainerId; // the escrow container the offered pieces sit in
  region: RegionId; // where the trade was opened; it settles only at the Concord Exchange
  version: number; // bumps on every offer change; an accept names the version it accepts
  sides: [TradeSide, TradeSide];
};

export function parseTrade(raw: unknown, path = ''): Result<Trade> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, ['kind', 'schemaVersion', 'id', 'region', 'version', 'sides']);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'trade');
  readSchemaVersion(issues, obj, path, [TRADE_VERSION]);
  const id = readId(issues, obj, 'id', path, 'container');
  const region = readId(issues, obj, 'region', path, 'region');
  const version = readInt(issues, obj, 'version', path, 0, Number.MAX_SAFE_INTEGER);
  const sides = readArray(issues, obj, 'sides', path, (v, p) => {
    const s = readObject(issues, v, p, ['character', 'account', 'offered', 'accepted']);
    if (!s) return undefined;
    const character = readId(issues, s, 'character', p, 'pc'), account = readId(issues, s, 'account', p, 'account');
    const offered = readArray(issues, s, 'offered', p, (iv, ip) => checkId(issues, iv, ip, 'inst'), { max: MAX_OFFER });
    const accepted = readBoolean(issues, s, 'accepted', p);
    return character && account && offered && accepted !== undefined ? { character, account, offered, accepted } : undefined;
  }, { min: 2, max: 2 });
  if (sides && sides.length === 2) {
    const [a, b] = sides as [TradeSide, TradeSide];
    if (a.account === b.account) issues.add('rule-violation', join(path, 'sides'), 'a trade is between two players; move items between your own characters through the account vault');
    if (a.offered.length === 0 && b.offered.length === 0) issues.add('rule-violation', join(path, 'sides'), 'a trade offers something on at least one side (a gift has one empty side)');
    const all = [...a.offered, ...b.offered];
    if (new Set(all).size !== all.length) issues.add('duplicate-id', join(path, 'sides'), 'one piece is offered twice');
  }
  return issues.finish({ kind: 'trade', schemaVersion: 1, id: id!, region: region!, version: version!, sides: sides as [TradeSide, TradeSide] });
}

const sideOf = (trade: Trade, character: CharacterInstanceId): number => trade.sides.findIndex((s) => s.character === character);
// The first id that appears twice in a list, if any. Every function here that takes a list of instance ids (or instances) refuses a
// repeat outright, so one piece or one stack can never be counted, moved or spent twice.
const firstRepeat = <T>(ids: readonly T[]): T | undefined => {
  const seen = new Set<T>();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return undefined;
};

// Any offer change clears BOTH accepts and bumps the version (the secure-trade rule), so an accept can only ever mean the offer on screen.
export function changeOffer(trade: Trade, character: CharacterInstanceId, offered: ItemInstanceId[], expectedVersion: number): Result<Trade> {
  if (trade.version !== expectedVersion) return fail('version-conflict', 'version', `the trade is at version ${trade.version}`);
  const i = sideOf(trade, character);
  if (i < 0) return fail('rule-violation', 'character', `${character} is not in this trade`);
  if (offered.length > MAX_OFFER) return fail('out-of-range', 'offered', `at most ${MAX_OFFER} pieces per side`);
  const twice = firstRepeat(offered);
  if (twice !== undefined) return fail('duplicate-id', 'offered', `${twice} is offered twice`);
  const theirs = new Set(trade.sides[1 - i]!.offered);
  const both = offered.find((id) => theirs.has(id));
  if (both !== undefined) return fail('duplicate-id', 'offered', `${both} is already offered by the other side`);
  const sides = trade.sides.map((s, j) => ({ ...s, offered: j === i ? [...offered] : s.offered, accepted: false })) as [TradeSide, TradeSide];
  return ok({ ...trade, sides, version: trade.version + 1 });
}

// Accept the offer AT a version. Accepting does not bump the version; a stale accept is refused.
export function acceptTrade(trade: Trade, character: CharacterInstanceId, expectedVersion: number): Result<Trade> {
  if (trade.version !== expectedVersion) return fail('version-conflict', 'version', `the offer changed; it is at version ${trade.version}`);
  const i = sideOf(trade, character);
  if (i < 0) return fail('rule-violation', 'character', `${character} is not in this trade`);
  const sides = trade.sides.map((s, j) => (j === i ? { ...s, accepted: true } : s)) as [TradeSide, TradeSide];
  return ok({ ...trade, sides });
}

// Settle a trade both sides accepted. `holdings` is every instance either player holds (worn, pack, bank, vault, escrow), so the
// one-of-each rule and the free pack slots are checked against the whole picture. `packSizeOf` is each character's real pack size
// (1..PACK_SLOTS; a starter pack is smaller), never assumed. Returns the moved instances: each lands in the first free slot of its new
// owner's pack, at version + 1, with a trade entry appended to its history and its provenance and upgrade level untouched. Refused
// outright, with nothing moved, if any rule fails (no partial trade, no spill onto the floor).
export function settleTrade(
  trade: Trade, holdings: readonly ItemInstance[], lookup: (id: ItemId) => ItemDefinition | undefined, accountOf: AccountOf, now: string,
  packSizeOf: (pc: CharacterInstanceId) => number,
): Result<ItemInstance[]> {
  const issues = new Issues();
  if (trade.region !== CONCORD_EXCHANGE) issues.add('rule-violation', 'region', `trades settle only at the Concord Exchange, not ${trade.region}`);
  trade.sides.forEach((side, i) => {
    if (!side.accepted) issues.add('rule-violation', `sides[${i}].accepted`, `${side.character} has not accepted`);
    if (accountOf(side.character) !== side.account) issues.add('rule-violation', `sides[${i}].account`, `${side.character} does not belong to ${side.account}`);
  });
  // A trade object or a holdings list that names one piece twice is refused before anything is resolved: no copy "wins".
  const offeredTwice = firstRepeat(trade.sides.flatMap((s) => s.offered));
  if (offeredTwice !== undefined) issues.add('duplicate-id', 'sides', `${offeredTwice} is offered twice`);
  const heldTwice = firstRepeat(holdings.map((h) => h.id));
  if (heldTwice !== undefined) issues.add('duplicate-id', 'holdings', `${heldTwice} appears twice in the holdings`);
  if (!issues.empty) return issues.finish(undefined as never);
  const byId = new Map(holdings.map((inst) => [inst.id, inst]));
  const offered = new Set(trade.sides.flatMap((s) => s.offered));
  for (const inst of holdings) {
    if (inst.location.kind === 'trade-escrow' && inst.location.container === trade.id && !offered.has(inst.id)) {
      issues.add('rule-violation', inst.id, `${inst.id} sits in this trade's escrow but is not on the offer`);
    }
  }
  if (!issues.empty) return issues.finish(undefined as never);

  const moved: ItemInstance[] = [];
  trade.sides.forEach((side, i) => {
    const recipient = trade.sides[1 - i]!.character, size = packSizeOf(recipient);
    if (!Number.isInteger(size) || size < 1 || size > PACK_SLOTS) return issues.add('out-of-range', `sides[${1 - i}].character`, `${recipient}'s pack size must be 1..${PACK_SLOTS}`);
    const used = new Set(holdings.filter((h) => h.location.kind === 'pack' && h.location.owner === recipient).map((h) => (h.location as { index: number }).index));
    side.offered.forEach((id, j) => {
      const path = `sides[${i}].offered[${j}]`;
      const inst = byId.get(id);
      if (!inst) return issues.add('unknown-id', path, `${id} is not among the holdings`);
      const def = lookup(inst.item);
      if (!def) return issues.add('unknown-id', path, `${inst.item} is not defined in this content`);
      if (inst.location.kind !== 'trade-escrow' || inst.location.container !== trade.id || inst.location.from !== side.character) {
        return issues.add('rule-violation', path, `${id} is not in this trade's escrow from ${side.character}`);
      }
      if (inst.boundTo !== null || def.story === 'story-critical') return issues.add('rule-violation', path, `${id} is bound and cannot change hands`);
      let index = 0;
      while (used.has(index)) index++;
      if (index >= size) return issues.add('rule-violation', path, `${recipient}'s pack is full (${size} slots)`);
      used.add(index);
      const placed = placeWithHistory(inst, def, { kind: 'pack', owner: recipient, index }, { kind: 'trade', trade: trade.id, from: side.character, to: recipient, at: now });
      const value = issues.absorb(placed);
      if (value) moved.push(value);
    });
  });
  if (!issues.empty) return issues.finish(undefined as never);
  const after = holdings.map((h) => moved.find((m) => m.id === h.id) ?? h);
  const clash = checkOneOfEach(after, lookup, accountOf);
  if (clash.length) return { ok: false, issues: clash.map((i) => ({ ...i, message: `the trade would break one of each: ${i.message}` })) };
  return ok(moved);
}

// ---- NPC services ---------------------------------------------------------------------------------------------------------------------

// A generic NPC service: who offers it, where, what it accepts and which price list it charges from. Only 'upgrade' exists today; an
// armourer's repair or a merchant's buy/sell later adds a kind here and its own request/receipt pair, reusing the same pattern.
export const SERVICE_DEFINITION_VERSION = 1;
export const SERVICE_KINDS = ['upgrade'] as const;
export const SERVICE_ACCEPTS = ['armour', 'weapons', 'all'] as const;
export type ServiceDefinition = {
  kind: 'service-definition';
  schemaVersion: 1;
  id: ServiceId;
  name: string;
  npc: CharacterId;
  region: RegionId;
  service: (typeof SERVICE_KINDS)[number];
  costTable: CostTableId;
  accepts: (typeof SERVICE_ACCEPTS)[number];
};

export function parseServiceDefinition(raw: unknown, path = ''): Result<ServiceDefinition> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, ['kind', 'schemaVersion', 'id', 'name', 'npc', 'region', 'service', 'costTable', 'accepts']);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'service-definition');
  readSchemaVersion(issues, obj, path, [SERVICE_DEFINITION_VERSION]);
  const id = readId(issues, obj, 'id', path, 'service');
  const name = readText(issues, obj, 'name', path, { max: 60 });
  const npc = readId(issues, obj, 'npc', path, 'character');
  const region = readId(issues, obj, 'region', path, 'region');
  const service = readEnum(issues, obj, 'service', path, SERVICE_KINDS);
  const costTable = readId(issues, obj, 'costTable', path, 'costtable');
  const accepts = readEnum(issues, obj, 'accepts', path, SERVICE_ACCEPTS);
  return issues.finish({ kind: 'service-definition', schemaVersion: 1, id: id!, name: name!, npc: npc!, region: region!, service: service!, costTable: costTable!, accepts: accepts! });
}

// Upgrade prices are DATA: one row per (level, rarity). `revision` is the price list's own version, stamped on every receipt, so a
// receipt always says which prices it was charged at. The currency is the one trade currency ('coin').
export const UPGRADE_COST_TABLE_VERSION = 1;
export const MAX_COIN = 1_000_000_000;
export type CostRow = { level: number; rarity: Rarity; coin: number; materials: { item: ItemId; quantity: number }[] };
export type UpgradeCostTable = { kind: 'upgrade-cost-table'; schemaVersion: 1; id: CostTableId; revision: number; currency: 'coin'; rows: CostRow[] };

export function parseUpgradeCostTable(raw: unknown, path = ''): Result<UpgradeCostTable> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, ['kind', 'schemaVersion', 'id', 'revision', 'currency', 'rows']);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'upgrade-cost-table');
  readSchemaVersion(issues, obj, path, [UPGRADE_COST_TABLE_VERSION]);
  const id = readId(issues, obj, 'id', path, 'costtable');
  const revision = readInt(issues, obj, 'revision', path, 1, 1_000_000);
  const currency = readEnum(issues, obj, 'currency', path, ['coin'] as const);
  const rows = readArray(issues, obj, 'rows', path, (v, p) => {
    const r = readObject(issues, v, p, ['level', 'rarity', 'coin', 'materials']);
    if (!r) return undefined;
    const level = readInt(issues, r, 'level', p, 1, MAX_UPGRADE_LEVEL), rarity = readEnum(issues, r, 'rarity', p, RARITIES);
    const coin = readInt(issues, r, 'coin', p, 1, MAX_COIN);
    const materials = readArray(issues, r, 'materials', p, (mv, mp) => {
      const m = readObject(issues, mv, mp, ['item', 'quantity']);
      const item = m && readId(issues, m, 'item', mp, 'item'), quantity = m && readInt(issues, m, 'quantity', mp, 1, 999);
      return item && quantity !== undefined ? { item, quantity } : undefined;
    }, { max: MAX_MATERIAL_LINES });
    if (materials && new Set(materials.map((m) => m.item)).size !== materials.length) issues.add('duplicate-id', join(p, 'materials'), 'a material is listed twice in one row');
    return level !== undefined && rarity && coin !== undefined && materials ? { level, rarity, coin, materials } : undefined;
  }, { min: 1, max: MAX_UPGRADE_LEVEL * RARITIES.length });
  if (rows) {
    const seen = new Set<string>();
    rows.forEach((row, i) => {
      const key = `${row.level}/${row.rarity}`;
      if (seen.has(key)) issues.add('duplicate-id', join(join(path, 'rows'), i), `level ${row.level} ${row.rarity} is priced twice`);
      seen.add(key);
    });
    // Each rarity's levels run 1..N with no hole: a level you cannot buy must not be followed by one you can.
    for (const rarity of RARITIES) {
      const levels = rows.filter((r) => r.rarity === rarity).map((r) => r.level).sort((a, b) => a - b);
      if (levels.some((level, i) => level !== i + 1)) issues.add('rule-violation', join(path, 'rows'), `${rarity} levels must run 1..${levels.length} with no gap`);
    }
  }
  return issues.finish({ kind: 'upgrade-cost-table', schemaVersion: 1, id: id!, revision: revision!, currency: currency!, rows: rows! });
}

// The most material instances one upgrade may spend, and so the most lines its receipt can carry: the smith writes one line per instance
// (an instance holds one item, so it pays at most one cost line), refuses a repeated instance, and refuses an offer longer than this,
// so every receipt it writes parses under parseUpgradeReceipt. A cost line is payable from one stack (registry: quantity ≤ stack), so a
// player never needs more than MAX_MATERIAL_LINES (4) instances; the headroom is for partial stacks.
export const MAX_UPGRADE_MATERIAL_INPUTS = 64;
export const MAX_MATERIAL_LINES = 4;

export const UPGRADE_REQUEST_VERSION = 1;
export const UPGRADE_RECEIPT_VERSION = 1;
export type UpgradeRequest = {
  kind: 'upgrade-request';
  schemaVersion: 1;
  idempotencyKey: string; // a repeated request with the same key returns the same receipt and changes nothing
  character: CharacterInstanceId;
  service: ServiceId;
  instance: ItemInstanceId;
  expectedVersion: number;
  toLevel: number; // always the current level + 1: one level per paid request
};
export type UpgradeReceipt = {
  kind: 'upgrade-receipt';
  schemaVersion: 1;
  idempotencyKey: string;
  character: CharacterInstanceId;
  service: ServiceId;
  smith: CharacterId;
  costTable: CostTableId;
  costRevision: number;
  instance: ItemInstanceId;
  fromLevel: number;
  toLevel: number;
  coin: number;
  materials: { instance: ItemInstanceId; item: ItemId; quantity: number }[];
  at: string;
};

export function parseUpgradeRequest(raw: unknown, path = ''): Result<UpgradeRequest> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, ['kind', 'schemaVersion', 'idempotencyKey', 'character', 'service', 'instance', 'expectedVersion', 'toLevel']);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'upgrade-request');
  readSchemaVersion(issues, obj, path, [UPGRADE_REQUEST_VERSION]);
  const idempotencyKey = readString(issues, obj, 'idempotencyKey', path, { pattern: MINT_KEY_PATTERN });
  const character = readId(issues, obj, 'character', path, 'pc');
  const service = readId(issues, obj, 'service', path, 'service');
  const instance = readId(issues, obj, 'instance', path, 'inst');
  const expectedVersion = readInt(issues, obj, 'expectedVersion', path, 0, Number.MAX_SAFE_INTEGER);
  const toLevel = readInt(issues, obj, 'toLevel', path, 1, MAX_UPGRADE_LEVEL);
  return issues.finish({ kind: 'upgrade-request', schemaVersion: 1, idempotencyKey: idempotencyKey!, character: character!, service: service!, instance: instance!, expectedVersion: expectedVersion!, toLevel: toLevel! });
}

export function parseUpgradeReceipt(raw: unknown, path = ''): Result<UpgradeReceipt> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, ['kind', 'schemaVersion', 'idempotencyKey', 'character', 'service', 'smith', 'costTable', 'costRevision', 'instance', 'fromLevel', 'toLevel', 'coin', 'materials', 'at']);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'upgrade-receipt');
  readSchemaVersion(issues, obj, path, [UPGRADE_RECEIPT_VERSION]);
  const idempotencyKey = readString(issues, obj, 'idempotencyKey', path, { pattern: MINT_KEY_PATTERN });
  const character = readId(issues, obj, 'character', path, 'pc');
  const service = readId(issues, obj, 'service', path, 'service');
  const smith = readId(issues, obj, 'smith', path, 'character');
  const costTable = readId(issues, obj, 'costTable', path, 'costtable');
  const costRevision = readInt(issues, obj, 'costRevision', path, 1, 1_000_000);
  const instance = readId(issues, obj, 'instance', path, 'inst');
  const fromLevel = readInt(issues, obj, 'fromLevel', path, 0, MAX_UPGRADE_LEVEL - 1);
  const toLevel = readInt(issues, obj, 'toLevel', path, 1, MAX_UPGRADE_LEVEL);
  const coin = readInt(issues, obj, 'coin', path, 1, MAX_COIN);
  const materials = readArray(issues, obj, 'materials', path, (v, p) => {
    const m = readObject(issues, v, p, ['instance', 'item', 'quantity']);
    const inst = m && readId(issues, m, 'instance', p, 'inst'), item = m && readId(issues, m, 'item', p, 'item'), quantity = m && readInt(issues, m, 'quantity', p, 1, 999);
    return inst && item && quantity !== undefined ? { instance: inst, item, quantity } : undefined;
  }, { max: MAX_UPGRADE_MATERIAL_INPUTS });
  if (materials && firstRepeat(materials.map((m) => m.instance)) !== undefined) issues.add('duplicate-id', join(path, 'materials'), 'one instance is listed twice; a receipt has one line per instance spent');
  const at = readTimestamp(issues, obj, 'at', path);
  if (fromLevel !== undefined && toLevel !== undefined && toLevel !== fromLevel + 1) issues.add('rule-violation', join(path, 'toLevel'), 'a receipt records one level');
  return issues.finish({
    kind: 'upgrade-receipt', schemaVersion: 1, idempotencyKey: idempotencyKey!, character: character!, service: service!, smith: smith!, costTable: costTable!,
    costRevision: costRevision!, instance: instance!, fromLevel: fromLevel!, toLevel: toLevel!, coin: coin!, materials: materials!, at: at!,
  });
}

export type UpgradeInput = {
  request: UpgradeRequest;
  service: ServiceDefinition;
  costs: UpgradeCostTable;
  instance: ItemInstance;
  def: ItemDefinition;
  standing: CareerStanding; // the requester's server standing
  balance: number; // the requester's coin
  materials: readonly ItemInstance[]; // material instances the requester offers to spend, consumed in this order; each id once, at most MAX_UPGRADE_MATERIAL_INPUTS
  materialDefs: (id: ItemId) => ItemDefinition | undefined;
  receipts: ReadonlyMap<string, UpgradeReceipt>; // receipts already committed, by idempotency key
  now: string;
};
export type UpgradeOutcome =
  | { replayed: true; receipt: UpgradeReceipt }
  | { replayed: false; receipt: UpgradeReceipt; instance: ItemInstance; balance: number; materials: ItemInstance[]; consumed: ItemInstanceId[] };

const fails = (issues: Issue[]): Result<never> => ({ ok: false, issues });

// The blacksmith. Order: replay first (so a retry after commit returns the original receipt even though the piece has since moved on),
// then every refusal, then the charge. Nothing is charged unless the upgrade lands, and an upgrade that would change nothing is refused.
export function performUpgrade(input: UpgradeInput): Result<UpgradeOutcome> {
  const { request, service, costs, instance, def, standing } = input;
  const prior = input.receipts.get(request.idempotencyKey);
  if (prior) {
    const same = prior.character === request.character && prior.service === request.service && prior.instance === request.instance && prior.toLevel === request.toLevel;
    return same ? ok({ replayed: true, receipt: prior }) : fail('duplicate-id', 'idempotencyKey', 'this idempotency key was already used for a different request');
  }
  if (service.service !== 'upgrade' || request.service !== service.id) return fail('rule-violation', 'service', `${service.id} does not perform this upgrade`);
  if (costs.id !== service.costTable) return fail('rule-violation', 'costTable', `${service.id} charges from ${service.costTable}, not ${costs.id}`);
  if (request.instance !== instance.id || instance.item !== def.id) return fail('rule-violation', 'instance', 'request, instance and definition do not name the same piece');
  if (instance.version !== request.expectedVersion) return fail('version-conflict', 'expectedVersion', `the piece is at version ${instance.version}, not ${request.expectedVersion}`);
  if (ownerOf(instance.location) !== request.character) return fail('rule-violation', 'instance', `${instance.id} is not worn or carried by ${request.character} (bank, pack or paperdoll)`);
  if (def.category !== 'gear' || def.power !== 'slot-weight' || def.slot === null) return fail('rule-violation', 'item', `${def.id} has no power budget to upgrade`);
  const weapon = isWeaponSlot(def.slot);
  if ((service.accepts === 'armour' && weapon) || (service.accepts === 'weapons' && !weapon)) return fail('rule-violation', 'item', `${service.name} does not work ${weapon ? 'weapons' : 'armour'}`);
  const from = upgradeLevelOf(instance);
  if (request.toLevel !== from + 1) return fail('rule-violation', 'toLevel', `one level at a time: the piece is at ${from}, so the next is ${from + 1}`);
  // No effect = refused (and never charged): a 0-weight slot, or a piece already counting at Origin.
  const before = piecePoints(instance, def), afterInst = { ...instance, upgradeLevel: request.toLevel };
  if (SLOT_WEIGHT[def.slot] === 0 || piecePoints(afterInst, def) <= before) return fail('rule-violation', 'toLevel', `${instance.id} is already at its cap; another level would change nothing`);
  const row = costs.rows.find((r) => r.level === request.toLevel && r.rarity === def.rarity);
  if (!row) return fail('rule-violation', 'toLevel', `${costs.id} r${costs.revision} offers no level ${request.toLevel} for ${def.rarity} pieces`);
  // The upgraded piece must still be wearable by the one paying for it.
  const need = effectiveTier(afterInst)!;
  const payer = verifiedTier(standing); // upgrades need a valid, server-verified career level
  if (!payer.ok) return payer;
  if (tierLevel(payer.value) < tierLevel(need)) return fail('rule-violation', 'toLevel', `level ${request.toLevel} would need rank ${need}; you are ${payer.value}`);
  if (input.balance < row.coin) return fail('rule-violation', 'balance', `needs ${row.coin} coin; you have ${input.balance}`);

  // Materials: spend each line from the offered instances, in order. All or nothing. A repeated instance is refused before the loop: the
  // same stack listed twice would otherwise be spent twice (5 + 3 from a stack of 5) and land in both `consumed` and `materials`.
  const repeated = firstRepeat(input.materials.map((m) => m.id));
  if (repeated !== undefined) return fail('duplicate-id', 'materials', `${repeated} is offered twice`);
  if (input.materials.length > MAX_UPGRADE_MATERIAL_INPUTS) return fail('out-of-range', 'materials', `at most ${MAX_UPGRADE_MATERIAL_INPUTS} material instances per upgrade (merge your stacks)`);
  const issues = new Issues();
  const spent: UpgradeReceipt['materials'] = [], updated: ItemInstance[] = [], consumed: ItemInstanceId[] = [];
  for (const line of row.materials) {
    let need = line.quantity;
    for (const mat of input.materials) {
      if (need === 0) break;
      if (mat.item !== line.item || ownerOf(mat.location) !== request.character || mat.location.kind === 'equipped') continue;
      const matDef = input.materialDefs(mat.item);
      if (!matDef) { issues.add('unknown-id', mat.id, `${mat.item} is not defined in this content`); continue; }
      const take = Math.min(need, mat.quantity);
      need -= take;
      spent.push({ instance: mat.id, item: mat.item, quantity: take });
      if (take === mat.quantity) consumed.push(mat.id);
      else updated.push({ ...mat, quantity: mat.quantity - take, version: mat.version + 1 });
    }
    if (need > 0) issues.add('rule-violation', 'materials', `needs ${line.quantity} × ${line.item}; ${line.quantity - need} offered`);
  }
  if (!issues.empty) return fails(issues.list);

  const receipt: UpgradeReceipt = {
    kind: 'upgrade-receipt', schemaVersion: 1, idempotencyKey: request.idempotencyKey, character: request.character, service: service.id, smith: service.npc,
    costTable: costs.id, costRevision: costs.revision, instance: instance.id, fromLevel: from, toLevel: request.toLevel, coin: row.coin, materials: spent, at: input.now,
  };
  const placed = placeWithHistory({ ...instance, upgradeLevel: request.toLevel }, def, instance.location, { kind: 'upgrade', smith: service.npc, level: request.toLevel, receipt: request.idempotencyKey, at: input.now });
  if (!placed.ok) return placed;
  return ok({ replayed: false, receipt, instance: placed.value, balance: input.balance - row.coin, materials: updated, consumed });
}
