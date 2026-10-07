// Origins O1: items — ItemDefinition, ItemInstance (with its one canonical location) and LootTable.
//
// The fixed spine (docs/specs/origins/README.md, blueprint §7): gear carries Attack and RES only, resolved by src/gear-stats.ts before a
// fight, capped at 1.15 / 0.80, and no timing ever changes. This module adds NO number to that table. An item's power is "its slot's
// weight in SLOT_WEIGHT, scaled by the tier the instance was won at" or nothing; resolution delegates to `loadoutFor`, so a full Origin
// set through these contracts lands exactly on CAPS and cannot exceed it.
//
// Rarity, power budget, material, appearance and story significance are five separate fields (blueprint §7). Rarity never feeds power.
//
// Custody (blueprint §8, O1 gate "no duplicate inventory authority"): an ItemInstance carries its own single `location`. Nothing else —
// not CharacterInstance, not a bank record, not a trade — holds a list of items. "What is in my pack" is a query over instances.
//
// Dom's decisions (2026-10-06): Pit-won pieces are tradeable; every instance keeps its provenance (who won it, from which legend, at
// what rank, when) through every trade, with an append-only history; one of each per player, bank included; trades only at the Concord
// Exchange (economy.ts); wearing needs the piece's rank, a separate check from owning. A smith may add upgrade levels (economy.ts).
import { CAPS, loadoutFor, pointsFor, type Kit, type Loadout } from '../../src/gear-stats.ts';
import { TIERS, isTier, levelOf as tierLevel, type Tier } from '../../src/grades.ts';
import { PORTRAIT_KEYS } from '../../src/legends.ts';
import { LOOT_SLOTS, PAPERDOLL, isLootId, paperdollOf, slotOf, type LootId, type LootSlot, type Paperdoll } from '../../src/loot.ts';
import { MAX_LEVEL } from '../../src/career.ts';
import {
  Issues, LOCAL_KEY, MINT_KEY_PATTERN, checkArray, fail, join, ok, readArray, readEnum, readInt, readKind, readObject, readOptionalInt, readSchemaVersion, readString, readText,
  readTimestamp, type Issue, type Obj, type Result,
} from './core.ts';
import {
  legacyLootOfItemId, readId, readOptionalId,
  type AccountId, type CharacterId, type CharacterInstanceId, type ContainerId, type EncounterId, type ItemId, type ItemInstanceId, type LootTableId, type QuestId,
  type ServiceId,
} from './ids.ts';
import { verifiedTier, type CareerStanding } from './world.ts';

// ---- ItemDefinition ---------------------------------------------------------------------------------------------------------------

export const ITEM_DEFINITION_VERSION = 1;
export const CATEGORIES = ['gear', 'material', 'quest', 'cosmetic'] as const;
export type Category = (typeof CATEGORIES)[number];
// Four rarities (blueprint §7: "start with four rarity categories"). A label and a drop-rate band, never a stat.
export const RARITIES = ['common', 'fine', 'rare', 'relic'] as const;
export type Rarity = (typeof RARITIES)[number];
// The material language of the art direction (blueprint §10). Presentation and crafting input; never a stat.
export const MATERIALS = ['iron', 'steel', 'bronze', 'gold', 'leather', 'cloth', 'bone', 'wood', 'stone', 'none'] as const;
export type Material = (typeof MATERIALS)[number];
export const STORY = ['none', 'notable', 'story-critical'] as const;
export type Story = (typeof STORY)[number];
export const BINDINGS = ['none', 'on-acquire', 'on-equip'] as const;
export type Binding = (typeof BINDINGS)[number];
// The power budget. 'slot-weight': the slot's SLOT_WEIGHT × (tier level − 1), exactly as src/gear-stats.ts prices today's loot.
export const POWERS = ['slot-weight', 'none'] as const;
export type Power = (typeof POWERS)[number];
export const MAX_STACK = 9999;

export type ItemDefinition = {
  kind: 'item-definition';
  schemaVersion: 1;
  id: ItemId;
  name: string;
  category: Category;
  rarity: Rarity;
  slot: LootSlot | null;
  power: Power;
  material: Material;
  appearance: { asset: string };
  story: Story;
  binding: Binding;
  stack: number; // 1 = not stackable
};

const ITEM_DEF_KEYS = ['kind', 'schemaVersion', 'id', 'name', 'category', 'rarity', 'slot', 'power', 'material', 'appearance', 'story', 'binding', 'stack'] as const;
const ASSET = /^[a-z0-9][a-z0-9._/-]{0,159}$/i;

export function parseItemDefinition(raw: unknown, path = ''): Result<ItemDefinition> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, ITEM_DEF_KEYS);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'item-definition');
  readSchemaVersion(issues, obj, path, [ITEM_DEFINITION_VERSION]);
  const id = readId(issues, obj, 'id', path, 'item');
  const name = readText(issues, obj, 'name', path, { max: 80 });
  const category = readEnum(issues, obj, 'category', path, CATEGORIES);
  const rarity = readEnum(issues, obj, 'rarity', path, RARITIES);
  let slot: LootSlot | null | undefined = null;
  if (!Object.hasOwn(obj, 'slot')) issues.add('missing-field', join(path, 'slot'), 'required field "slot" is missing (null for none)');
  else if (obj.slot !== null) slot = readEnum(issues, obj, 'slot', path, LOOT_SLOTS);
  const power = readEnum(issues, obj, 'power', path, POWERS);
  const material = readEnum(issues, obj, 'material', path, MATERIALS);
  let appearance: { asset: string } | undefined;
  const app = Object.hasOwn(obj, 'appearance') ? readObject(issues, obj.appearance, join(path, 'appearance'), ['asset']) : (issues.add('missing-field', join(path, 'appearance'), 'required field "appearance" is missing'), undefined);
  if (app) {
    const asset = readString(issues, app, 'asset', join(path, 'appearance'), { min: 1, max: 160, pattern: ASSET });
    if (asset !== undefined) appearance = { asset };
  }
  const story = readEnum(issues, obj, 'story', path, STORY);
  const binding = readEnum(issues, obj, 'binding', path, BINDINGS);
  const stack = readInt(issues, obj, 'stack', path, 1, MAX_STACK);
  if (!issues.empty) return issues.finish(undefined as never);

  // Cross-field rules. Each is a design decision written down, not a shape check.
  const def: ItemDefinition = { kind: 'item-definition', schemaVersion: 1, id: id!, name: name!, category: category!, rarity: rarity!, slot: slot ?? null, power: power!, material: material!, appearance: appearance!, story: story!, binding: binding!, stack: stack! };
  if (def.category === 'gear' && def.slot === null) issues.add('rule-violation', join(path, 'slot'), 'gear must name its slot');
  if (def.slot !== null && def.category !== 'gear' && def.category !== 'cosmetic') issues.add('rule-violation', join(path, 'slot'), `a ${def.category} item is not worn and has no slot`);
  if (def.power === 'slot-weight' && def.category !== 'gear') issues.add('rule-violation', join(path, 'power'), 'only gear carries a power budget (cosmetics, materials and quest items are power "none")');
  if ((def.category === 'gear' || def.category === 'cosmetic' || def.story === 'story-critical') && def.stack !== 1) issues.add('rule-violation', join(path, 'stack'), 'gear, cosmetics and story-critical items are single copies (stack 1)');
  if (def.story === 'story-critical' && def.binding !== 'on-acquire') issues.add('rule-violation', join(path, 'binding'), 'a story-critical item binds on acquire so it can never be traded away or lost (blueprint §8)');
  const legacy = legacyLootOfItemId(def.id);
  if (legacy !== null) {
    // A legacy loot definition is today's piece: gear in its own slot with the slot-weight budget. Anything else would re-price a piece
    // players already own.
    // Pit-won pieces are tradeable (Dom, 2026-10-06), so they never bind.
    if (def.category !== 'gear' || def.slot !== slotOf(legacy) || def.power !== 'slot-weight' || def.binding !== 'none') {
      issues.add('rule-violation', path || '(root)', `${def.id} is today's ${legacy}: it must be category gear, slot ${slotOf(legacy)}, power slot-weight, binding none`);
    }
  }
  return issues.finish(def);
}

// ---- ItemInstance and its one location --------------------------------------------------------------------------------------------

export const ITEM_INSTANCE_VERSION = 1;
export const PACK_SLOTS = 64;
export const BANK_SLOTS = 1000;
// The upgrade level a smith can add (economy.ts UpgradeService). Optional on the record with a defined default of 0, so every instance
// written before upgrades existed validates unchanged. Each level is worth one rung of the piece's OWN slot weight, and the effective rung
// never passes Origin, so no kit can pass the 1.15 / 0.80 caps however many levels are bought.
export const MAX_UPGRADE_LEVEL = 9;
const PAPERDOLL_KEYS = Object.keys(PAPERDOLL) as Paperdoll[];
const LEGEND_KEYS: ReadonlySet<string> = new Set(PORTRAIT_KEYS);

export type Location =
  | { kind: 'equipped'; owner: CharacterInstanceId; slot: Paperdoll }
  | { kind: 'pack'; owner: CharacterInstanceId; index: number }
  | { kind: 'bank'; owner: CharacterInstanceId; index: number }
  | { kind: 'account-vault'; account: AccountId; index: number }
  | { kind: 'guild-vault'; container: ContainerId; index: number }
  | { kind: 'trade-escrow'; container: ContainerId; from: CharacterInstanceId };
export const LOCATION_KINDS = ['equipped', 'pack', 'bank', 'account-vault', 'guild-vault', 'trade-escrow'] as const;

// Where an item came from: written once at mint and never rewritten, through every trade and upgrade (Dom, 2026-10-06), and shown on
// inspect. `mintKey` is the idempotency key of the transaction that minted it; two instances never share one (checkCustody), so a
// retried reward or a double-clicked claim cannot mint twice. A Pit-won piece names who won it, which legend it was taken from
// (`<opponent>-<rung>`, today's persisted key), the rank it was won at, and when (`at`).
// Dom, 2026-10-07 (trade cooldown, economy.ts tradeCooldown): a piece bought from an NPC shop with bound metal is 'shop' (who bought it,
// at which shop service); shop GEAR trades under the same cooldown as earned gear, anything else a shop sells never trades. A piece
// bought for real money is 'cash-shop' (which account, which catalogue entry) and never trades.
type Minted = { mintKey: string; at: string };
export type PitOrigin = { wonBy: CharacterInstanceId; fromLegend: string; atRank: Tier };
export type Provenance =
  | (Minted & PitOrigin & { kind: 'arena-award'; claimId: number; lootId: LootId })
  | (Minted & { kind: 'legacy-unlock'; account: AccountId; lootId: LootId; wonBy: CharacterInstanceId; fromLegend: string | null; atRank: Tier | null })
  | (Minted & { kind: 'loot'; wonBy: CharacterInstanceId; table: LootTableId; encounter: EncounterId | null })
  | (Minted & { kind: 'quest-reward'; wonBy: CharacterInstanceId; quest: QuestId; stage: string })
  | (Minted & { kind: 'creator-mint'; creator: AccountId })
  | (Minted & { kind: 'shop'; boughtBy: CharacterInstanceId; shop: ServiceId })
  | (Minted & { kind: 'cash-shop'; account: AccountId; sku: string });
export const PROVENANCE_KINDS = ['arena-award', 'legacy-unlock', 'loot', 'quest-reward', 'creator-mint', 'shop', 'cash-shop'] as const;

// Append-only history: what happened to the piece after it was minted. A trade and an upgrade each add one entry; nothing removes or
// edits one (checkHistoryKept).
export type HistoryEntry =
  | { kind: 'trade'; trade: ContainerId; from: CharacterInstanceId; to: CharacterInstanceId; at: string }
  | { kind: 'upgrade'; smith: CharacterId; level: number; receipt: string; at: string };
export const HISTORY_KINDS = ['trade', 'upgrade'] as const;

export type ItemInstance = {
  kind: 'item-instance';
  schemaVersion: 1;
  id: ItemInstanceId;
  item: ItemId;
  version: number; // optimistic lock: every move compares and bumps it
  quantity: number;
  tier: Tier | null; // the rung a gear piece was won at (today's Provenance.tier / awards.tier); null for items with no power
  upgradeLevel?: number; // absent = 0 (see MAX_UPGRADE_LEVEL)
  location: Location;
  boundTo: CharacterInstanceId | null;
  provenance: Provenance;
  history: HistoryEntry[];
};

const INSTANCE_KEYS = ['kind', 'schemaVersion', 'id', 'item', 'version', 'quantity', 'tier', 'upgradeLevel', 'location', 'boundTo', 'provenance', 'history'] as const;
export const upgradeLevelOf = (inst: Pick<ItemInstance, 'upgradeLevel'>): number => inst.upgradeLevel ?? 0;

function readTierField(issues: Issues, obj: Obj, key: string, path: string, nullable: boolean): Tier | null | undefined {
  if (!Object.hasOwn(obj, key)) {
    issues.add('missing-field', join(path, key), `required field "${key}" is missing${nullable ? ' (null for none)' : ''}`);
    return undefined;
  }
  if (obj[key] === null && nullable) return null;
  if (isTier(obj[key])) return obj[key];
  issues.add('wrong-type', join(path, key), `expected a rank title (Recruit … Origin)${nullable ? ' or null' : ''}`);
  return undefined;
}

function readLocation(issues: Issues, raw: unknown, path: string): Location | undefined {
  if (!readObject(issues, raw, path, ['kind', 'owner', 'slot', 'index', 'account', 'container', 'from'])) return undefined;
  const obj = raw as Obj;
  const kind = readEnum(issues, obj, 'kind', path, LOCATION_KINDS);
  const only = (keys: readonly string[]): void => {
    for (const key of Object.keys(obj)) if (key !== 'kind' && !keys.includes(key)) issues.add('unknown-field', join(path, key), `a ${kind} location has no "${key}"`);
  };
  switch (kind) {
    case 'equipped': {
      only(['owner', 'slot']);
      const owner = readId(issues, obj, 'owner', path, 'pc'), slot = readEnum(issues, obj, 'slot', path, PAPERDOLL_KEYS);
      return owner && slot ? { kind, owner, slot } : undefined;
    }
    case 'pack':
    case 'bank': {
      only(['owner', 'index']);
      const owner = readId(issues, obj, 'owner', path, 'pc'), index = readInt(issues, obj, 'index', path, 0, (kind === 'pack' ? PACK_SLOTS : BANK_SLOTS) - 1);
      return owner && index !== undefined ? { kind, owner, index } : undefined;
    }
    case 'account-vault': {
      only(['account', 'index']);
      const account = readId(issues, obj, 'account', path, 'account'), index = readInt(issues, obj, 'index', path, 0, BANK_SLOTS - 1);
      return account && index !== undefined ? { kind, account, index } : undefined;
    }
    case 'guild-vault': {
      only(['container', 'index']);
      const container = readId(issues, obj, 'container', path, 'container'), index = readInt(issues, obj, 'index', path, 0, BANK_SLOTS - 1);
      return container && index !== undefined ? { kind, container, index } : undefined;
    }
    case 'trade-escrow': {
      only(['container', 'from']);
      const container = readId(issues, obj, 'container', path, 'container'), from = readId(issues, obj, 'from', path, 'pc');
      return container && from ? { kind, container, from } : undefined;
    }
    default:
      return undefined;
  }
}

function readLootId(issues: Issues, obj: Obj, path: string): LootId | undefined {
  const value = readString(issues, obj, 'lootId', path, { min: 3, max: 65 });
  if (value === undefined) return undefined;
  if (!isLootId(value)) {
    issues.add('legacy-unknown', join(path, 'lootId'), `"${value}" is not a current or retired loot id`);
    return undefined;
  }
  return value;
}

// A Pit origin is internally consistent: the legend is a real face, it is the same opponent the piece came off, and its rung is the rank.
function checkPitOrigin(issues: Issues, lootId: LootId, fromLegend: string, atRank: Tier, path: string): boolean {
  if (!LEGEND_KEYS.has(fromLegend)) {
    issues.add('legacy-unknown', join(path, 'fromLegend'), `"${fromLegend}" is not a legend key <opponent>-<rung>`);
    return false;
  }
  const dash = fromLegend.lastIndexOf('-');
  const opponent = fromLegend.slice(0, dash), rung = Number(fromLegend.slice(dash + 1));
  if (opponent !== lootId.split('.')[0]) {
    issues.add('rule-violation', join(path, 'fromLegend'), `${lootId} is not a piece of ${opponent}`);
    return false;
  }
  if (rung !== tierLevel(atRank)) {
    issues.add('rule-violation', join(path, 'atRank'), `legend rung ${rung} is not rank ${atRank} (rung ${tierLevel(atRank)})`);
    return false;
  }
  return true;
}

function readProvenance(issues: Issues, raw: unknown, path: string): Provenance | undefined {
  if (!readObject(issues, raw, path, ['kind', 'mintKey', 'at', 'claimId', 'lootId', 'wonBy', 'fromLegend', 'atRank', 'table', 'encounter', 'quest', 'stage', 'creator', 'account', 'boughtBy', 'shop', 'sku'])) return undefined;
  const obj = raw as Obj;
  const kind = readEnum(issues, obj, 'kind', path, PROVENANCE_KINDS);
  const mintKey = readString(issues, obj, 'mintKey', path, { pattern: MINT_KEY_PATTERN });
  const at = readTimestamp(issues, obj, 'at', path);
  const only = (keys: readonly string[]): void => {
    for (const key of Object.keys(obj)) if (!['kind', 'mintKey', 'at', ...keys].includes(key)) issues.add('unknown-field', join(path, key), `a ${kind} provenance has no "${key}"`);
  };
  if (mintKey === undefined || at === undefined) return undefined;
  switch (kind) {
    case 'arena-award': {
      only(['claimId', 'lootId', 'wonBy', 'fromLegend', 'atRank']);
      const claimId = readInt(issues, obj, 'claimId', path, 1, Number.MAX_SAFE_INTEGER), lootId = readLootId(issues, obj, path);
      const wonBy = readId(issues, obj, 'wonBy', path, 'pc'), fromLegend = readString(issues, obj, 'fromLegend', path, { min: 3, max: 40 });
      const atRank = readTierField(issues, obj, 'atRank', path, false);
      if (claimId === undefined || !lootId || !wonBy || !fromLegend || !atRank) return undefined;
      return checkPitOrigin(issues, lootId, fromLegend, atRank, path) ? { kind, mintKey, at, claimId, lootId, wonBy, fromLegend, atRank } : undefined;
    }
    case 'legacy-unlock': {
      only(['account', 'lootId', 'wonBy', 'fromLegend', 'atRank']);
      const account = readId(issues, obj, 'account', path, 'account'), lootId = readLootId(issues, obj, path), wonBy = readId(issues, obj, 'wonBy', path, 'pc');
      if (!Object.hasOwn(obj, 'fromLegend')) issues.add('missing-field', join(path, 'fromLegend'), 'required field "fromLegend" is missing (null when the old save never recorded a rank)');
      const fromLegend = obj.fromLegend === null || obj.fromLegend === undefined ? null : readString(issues, obj, 'fromLegend', path, { min: 3, max: 40 });
      const atRank = readTierField(issues, obj, 'atRank', path, true);
      if (!account || !lootId || !wonBy || fromLegend === undefined || atRank === undefined) return undefined;
      if ((fromLegend === null) !== (atRank === null)) {
        issues.add('rule-violation', path, 'fromLegend and atRank are both known or both null');
        return undefined;
      }
      if (fromLegend !== null && atRank !== null && !checkPitOrigin(issues, lootId, fromLegend, atRank, path)) return undefined;
      // One migrated copy per account per piece, ever: the mint key is derived, so a re-run of the migration collides instead of minting.
      const expected = legacyUnlockMintKey(account, lootId);
      if (mintKey !== expected) {
        issues.add('rule-violation', join(path, 'mintKey'), `a legacy-unlock mintKey must be "${expected}"`);
        return undefined;
      }
      return { kind, mintKey, at, account, lootId, wonBy, fromLegend, atRank };
    }
    case 'loot': {
      only(['wonBy', 'table', 'encounter']);
      const wonBy = readId(issues, obj, 'wonBy', path, 'pc'), table = readId(issues, obj, 'table', path, 'loottable');
      const encounter = readOptionalId(issues, obj, 'encounter', path, 'encounter');
      return wonBy && table && encounter !== undefined ? { kind, mintKey, at, wonBy, table, encounter } : undefined;
    }
    case 'quest-reward': {
      only(['wonBy', 'quest', 'stage']);
      const wonBy = readId(issues, obj, 'wonBy', path, 'pc'), quest = readId(issues, obj, 'quest', path, 'quest');
      const stage = readString(issues, obj, 'stage', path, { pattern: LOCAL_KEY });
      return wonBy && quest && stage ? { kind, mintKey, at, wonBy, quest, stage } : undefined;
    }
    case 'creator-mint': {
      only(['creator']);
      const creator = readId(issues, obj, 'creator', path, 'account');
      return creator ? { kind, mintKey, at, creator } : undefined;
    }
    case 'shop': {
      only(['boughtBy', 'shop']);
      const boughtBy = readId(issues, obj, 'boughtBy', path, 'pc'), shop = readId(issues, obj, 'shop', path, 'service');
      return boughtBy && shop ? { kind, mintKey, at, boughtBy, shop } : undefined;
    }
    case 'cash-shop': {
      only(['account', 'sku']);
      const account = readId(issues, obj, 'account', path, 'account'), sku = readString(issues, obj, 'sku', path, { pattern: LOCAL_KEY });
      return account && sku ? { kind, mintKey, at, account, sku } : undefined;
    }
    default:
      return undefined;
  }
}

function readHistoryEntry(issues: Issues, raw: unknown, path: string): HistoryEntry | undefined {
  if (!readObject(issues, raw, path, ['kind', 'trade', 'from', 'to', 'smith', 'level', 'receipt', 'at'])) return undefined;
  const obj = raw as Obj;
  const kind = readEnum(issues, obj, 'kind', path, HISTORY_KINDS);
  const at = readTimestamp(issues, obj, 'at', path);
  const only = (keys: readonly string[]): void => {
    for (const key of Object.keys(obj)) if (!['kind', 'at', ...keys].includes(key)) issues.add('unknown-field', join(path, key), `a ${kind} history entry has no "${key}"`);
  };
  if (kind === 'trade') {
    only(['trade', 'from', 'to']);
    const trade = readId(issues, obj, 'trade', path, 'container'), from = readId(issues, obj, 'from', path, 'pc'), to = readId(issues, obj, 'to', path, 'pc');
    if (from && to && from === to) issues.add('rule-violation', path, 'a trade moves a piece between two characters');
    return trade && from && to && at && from !== to ? { kind, trade, from, to, at } : undefined;
  }
  if (kind === 'upgrade') {
    only(['smith', 'level', 'receipt']);
    const smith = readId(issues, obj, 'smith', path, 'character'), level = readInt(issues, obj, 'level', path, 1, MAX_UPGRADE_LEVEL);
    const receipt = readString(issues, obj, 'receipt', path, { pattern: MINT_KEY_PATTERN });
    return smith && level !== undefined && receipt && at ? { kind, smith, level, receipt, at } : undefined;
  }
  return undefined;
}

// `legacy:<uuid>:<opponent>.<slot>` lowercased. Deterministic on purpose (see README proposal).
export const legacyUnlockMintKey = (account: AccountId, lootId: LootId): string => `legacy:${account.slice('account:'.length)}:${lootId.toLowerCase()}`;

export function parseItemInstance(raw: unknown, path = ''): Result<ItemInstance> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, INSTANCE_KEYS);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'item-instance');
  readSchemaVersion(issues, obj, path, [ITEM_INSTANCE_VERSION]);
  const id = readId(issues, obj, 'id', path, 'inst');
  const item = readId(issues, obj, 'item', path, 'item');
  const version = readInt(issues, obj, 'version', path, 0, Number.MAX_SAFE_INTEGER);
  const quantity = readInt(issues, obj, 'quantity', path, 1, MAX_STACK);
  const tier = readTierField(issues, obj, 'tier', path, true);
  const upgradeLevel = readOptionalInt(issues, obj, 'upgradeLevel', path, 0, MAX_UPGRADE_LEVEL);
  const location = Object.hasOwn(obj, 'location') ? readLocation(issues, obj.location, join(path, 'location')) : (issues.add('missing-field', join(path, 'location'), 'every instance has exactly one location'), undefined);
  if (!Object.hasOwn(obj, 'boundTo')) issues.add('missing-field', join(path, 'boundTo'), 'required field "boundTo" is missing (null when unbound)');
  const boundTo = readOptionalId(issues, obj, 'boundTo', path, 'pc');
  const provenance = Object.hasOwn(obj, 'provenance') ? readProvenance(issues, obj.provenance, join(path, 'provenance')) : (issues.add('missing-field', join(path, 'provenance'), 'every instance records where it came from'), undefined);
  const history = readArray(issues, obj, 'history', path, (v, p) => readHistoryEntry(issues, v, p), { max: 1000 });
  if (!issues.empty) return issues.finish(undefined as never);
  const out: ItemInstance = { kind: 'item-instance', schemaVersion: 1, id: id!, item: item!, version: version!, quantity: quantity!, tier: tier ?? null, location: location!, boundTo: boundTo ?? null, provenance: provenance!, history: history! };
  if (upgradeLevel !== undefined) out.upgradeLevel = upgradeLevel;
  return ok(out);
}

// The character a location belongs to, if any (pack, bank and paperdoll are a character's; vaults and escrow are custodians).
export const ownerOf = (location: Location): CharacterInstanceId | null =>
  location.kind === 'equipped' || location.kind === 'pack' || location.kind === 'bank' ? location.owner : null;

// Who HOLDS an item, as an account: a character's places are its account's, the account vault is the account's, and an escrowed offer is
// still its offerer's until the trade settles. A guild vault is nobody's in particular. `accountOf` resolves a character to its account.
export type AccountOf = (pc: CharacterInstanceId) => AccountId | undefined;
export function holderOf(location: Location, accountOf: AccountOf): string | null {
  switch (location.kind) {
    case 'equipped': case 'pack': case 'bank': return accountOf(location.owner) ?? `unknown:${location.owner}`;
    case 'trade-escrow': return accountOf(location.from) ?? `unknown:${location.from}`;
    case 'account-vault': return location.account;
    case 'guild-vault': return location.container;
  }
}

// The rung a piece counts at: its won rank plus its upgrade levels, never past Origin. This is both its power (via loadoutFor) and the
// rank its wearer needs (Dom, 2026-10-06: owning and equipping are separate checks).
export function effectiveTier(inst: Pick<ItemInstance, 'tier' | 'upgradeLevel'>): Tier | null {
  if (inst.tier === null) return null;
  return TIERS[Math.min(TIERS.length - 1, tierLevel(inst.tier) - 1 + upgradeLevelOf(inst))]!;
}

// The rules that need both the instance and its definition. Returned as issues so the caller can report every one.
export function checkInstance(inst: ItemInstance, def: ItemDefinition, path = ''): Issue[] {
  const issues = new Issues();
  const at = (key: string): string => join(path, key);
  if (inst.item !== def.id) issues.add('rule-violation', at('item'), `instance names ${inst.item} but was checked against ${def.id}`);
  if (inst.quantity > def.stack) issues.add('out-of-range', at('quantity'), `quantity ${inst.quantity} exceeds the definition's stack ${def.stack}`);
  if (def.power === 'slot-weight' && inst.tier === null) issues.add('rule-violation', at('tier'), 'a gear piece with a power budget records the tier it was won at');
  if (def.power === 'none' && inst.tier !== null) issues.add('rule-violation', at('tier'), 'only gear with a power budget carries a tier');
  if (upgradeLevelOf(inst) > 0 && def.power !== 'slot-weight') issues.add('rule-violation', at('upgradeLevel'), 'only gear with a power budget can be upgraded');
  const loc = inst.location;
  if (loc.kind === 'equipped') {
    if (def.slot === null) issues.add('rule-violation', at('location'), `${def.id} has no slot and cannot be equipped`);
    else if (paperdollOf(def.slot) !== loc.slot) issues.add('rule-violation', at('location.slot'), `${def.id} is worn on "${paperdollOf(def.slot)}", not "${loc.slot}"`);
  }
  const owner = ownerOf(loc);
  if (inst.boundTo !== null) {
    if (owner === null) issues.add('rule-violation', at('location'), `a bound item stays with its character; it cannot sit in a ${loc.kind}`);
    else if (owner !== inst.boundTo) issues.add('rule-violation', at('location'), `bound to ${inst.boundTo} but located with ${owner}`);
  } else if (def.binding === 'on-acquire' && owner !== null) {
    issues.add('rule-violation', at('boundTo'), `${def.id} binds on acquire; held by ${owner} it must be bound`);
  }
  if (def.story === 'story-critical' && (loc.kind === 'trade-escrow' || loc.kind === 'guild-vault' || loc.kind === 'account-vault')) {
    issues.add('rule-violation', at('location'), 'a story-critical item cannot leave its character (blueprint §8)');
  }
  const prov = inst.provenance;
  if (prov.kind === 'creator-mint' && def.category !== 'cosmetic') issues.add('rule-violation', at('provenance'), 'creator-minted items are cosmetics only (ruling 6)');
  if ((prov.kind === 'arena-award' || prov.kind === 'legacy-unlock') && legacyLootOfItemId(def.id) !== prov.lootId) {
    issues.add('rule-violation', at('provenance.lootId'), `${prov.kind} for ${prov.lootId} cannot mint ${def.id}`);
  }
  if (prov.kind === 'arena-award' && inst.tier !== prov.atRank) issues.add('rule-violation', at('tier'), `a Pit piece's tier is the rank it was won at (${prov.atRank})`);
  return issues.list;
}

// Provenance is never rewritten and history only grows: `after` must carry `before`'s provenance unchanged and its history as a prefix.
export function checkHistoryKept(before: ItemInstance, after: ItemInstance): Issue[] {
  const issues = new Issues();
  if (!sameData(before.provenance, after.provenance)) issues.add('rule-violation', 'provenance', 'provenance is written once at mint and never rewritten');
  if (after.history.length < before.history.length || !before.history.every((entry, i) => sameData(entry, after.history[i]))) {
    issues.add('rule-violation', 'history', 'history is append-only');
  }
  return issues.list;
}
// Structural equality of plain JSON data (no Map, Date or class instances appear in these contracts).
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameData(v, b[i]));
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a).filter((k) => (a as Obj)[k] !== undefined), kb = Object.keys(b).filter((k) => (b as Obj)[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => sameData((a as Obj)[k], (b as Obj)[k]));
}

// Move one instance within its holder's own places (pack ↔ bank ↔ account vault, into a trade escrow to offer it). Compare-and-bump the
// version, apply on-acquire binding, re-check every rule. A change of holder is a trade (economy.ts settleTrade) and equipping is
// equipItem (it needs the rank check); both are refused here. Pure: the caller commits the result with its receipt (blueprint §8).
export function moveItem(inst: ItemInstance, def: ItemDefinition, expectedVersion: number, to: Location, accountOf: AccountOf): Result<ItemInstance> {
  if (inst.version !== expectedVersion) return fail('version-conflict', 'version', `expected version ${expectedVersion}, the item is at ${inst.version}`);
  if (to.kind === 'equipped') return fail('rule-violation', 'location', 'equipping goes through equipItem, which checks the rank requirement');
  if (holderOf(inst.location, accountOf) !== holderOf(to, accountOf)) return fail('rule-violation', 'location', 'a move cannot change who holds the item; that is a trade at the Concord Exchange');
  return place(inst, def, to);
}

function place(inst: ItemInstance, def: ItemDefinition, to: Location, history: HistoryEntry[] = inst.history): Result<ItemInstance> {
  const owner = ownerOf(to);
  let boundTo = inst.boundTo;
  if (boundTo === null && owner !== null && (def.binding === 'on-acquire' || (def.binding === 'on-equip' && to.kind === 'equipped'))) boundTo = owner;
  const next: ItemInstance = { ...inst, location: to, boundTo, version: inst.version + 1, history };
  const issues = checkInstance(next, def);
  return issues.length ? { ok: false, issues } : ok(next);
}
// For economy.ts: place an instance with an appended history entry (a trade or an upgrade), same rules as any placement.
export const placeWithHistory = (inst: ItemInstance, def: ItemDefinition, to: Location, entry: HistoryEntry): Result<ItemInstance> => place(inst, def, to, [...inst.history, entry]);

// Equip: owning a piece and wearing it are separate checks (Dom, 2026-10-06). The wearer's server-verified rank must reach the piece's
// effective tier, so a traded Origin piece does not dress a Recruit.
export function equipItem(inst: ItemInstance, def: ItemDefinition, expectedVersion: number, owner: CharacterInstanceId, standing: CareerStanding): Result<ItemInstance> {
  if (inst.version !== expectedVersion) return fail('version-conflict', 'version', `expected version ${expectedVersion}, the item is at ${inst.version}`);
  if (def.slot === null) return fail('rule-violation', 'item', `${def.id} has no slot`);
  if (ownerOf(inst.location) !== owner) return fail('rule-violation', 'location', `${inst.id} is not in ${owner}'s pack or bank`);
  const need = effectiveTier(inst);
  if (need !== null) {
    const wearer = verifiedTier(standing); // equipping a ranked piece needs a valid, server-verified career level
    if (!wearer.ok) return wearer;
    if (tierLevel(wearer.value) < tierLevel(need)) return fail('rule-violation', 'tier', `${inst.id} needs rank ${need}; the wearer is ${wearer.value}`);
  }
  return place(inst, def, { kind: 'equipped', owner, slot: paperdollOf(def.slot) });
}

// The custody check over a set of instances (one account's, one container's, a whole table). It is the O1 gate as code: one id is one
// copy, one mint key minted one copy, and no two copies claim the same exclusive place.
export function checkCustody(instances: readonly ItemInstance[]): Issue[] {
  const issues = new Issues();
  const ids = new Set<string>(), mints = new Set<string>(), places = new Map<string, string>();
  instances.forEach((inst, i) => {
    const path = `[${i}]`;
    if (ids.has(inst.id)) issues.add('duplicate-id', join(path, 'id'), `${inst.id} appears twice: an instance has one location`);
    ids.add(inst.id);
    if (mints.has(inst.provenance.mintKey)) issues.add('duplicate-id', join(path, 'provenance.mintKey'), `mint key ${inst.provenance.mintKey} minted two instances`);
    mints.add(inst.provenance.mintKey);
    const place = placeKey(inst.location);
    if (place !== null) {
      const other = places.get(place);
      if (other !== undefined && other !== inst.id) issues.add('rule-violation', join(path, 'location'), `${inst.id} and ${other} both occupy ${place}`);
      places.set(place, inst.id);
    }
  });
  return issues.list;
}
const placeKey = (loc: Location): string | null => {
  switch (loc.kind) {
    case 'equipped': return `${loc.owner}/equipped/${loc.slot}`;
    case 'pack': return `${loc.owner}/pack/${loc.index}`;
    case 'bank': return `${loc.owner}/bank/${loc.index}`;
    case 'account-vault': return `${loc.account}/vault/${loc.index}`;
    case 'guild-vault': return `${loc.container}/vault/${loc.index}`;
    case 'trade-escrow': return null; // an escrow holds many offered items with no positions
  }
};

// One of each (Dom, 2026-10-06): no player holds two instances of the same single-copy definition (stack 1), wherever they sit — worn,
// pack, bank, account vault, or offered in an open trade. Stackable materials are exempt: they merge into one stack instead.
export function checkOneOfEach(instances: readonly ItemInstance[], lookup: (id: ItemId) => ItemDefinition | undefined, accountOf: AccountOf): Issue[] {
  const issues = new Issues();
  const held = new Map<string, string>();
  instances.forEach((inst, i) => {
    const def = lookup(inst.item);
    if (!def) {
      issues.add('unknown-id', `[${i}].item`, `${inst.item} is not defined in this content`);
      return;
    }
    if (def.stack !== 1) return;
    const holder = holderOf(inst.location, accountOf);
    if (holder === null || inst.location.kind === 'guild-vault') return;
    const key = `${holder}|${inst.item}`;
    const other = held.get(key);
    if (other !== undefined) issues.add('rule-violation', `[${i}]`, `${holder} would hold ${inst.item} twice (${other} and ${inst.id}); one of each`);
    else held.set(key, inst.id);
  });
  return issues.list;
}

// The Loadout a character's equipped instances resolve to, through src/gear-stats.ts and nothing else, at each piece's effective tier.
// `lookup` returns the definition for an id (a registry); an equipped instance whose definition is unknown is an explicit failure.
export function resolveLoadout(owner: CharacterInstanceId, instances: readonly ItemInstance[], lookup: (id: ItemId) => ItemDefinition | undefined): Result<Loadout> {
  const kit: Kit = {};
  for (const inst of instances) {
    if (inst.location.kind !== 'equipped' || inst.location.owner !== owner) continue;
    const def = lookup(inst.item);
    if (!def) return fail('unknown-id', inst.id, `equipped ${inst.id} names unknown item ${inst.item}`);
    const tier = effectiveTier(inst);
    if (def.power === 'slot-weight' && def.slot !== null && tier !== null) kit[def.slot] = tier;
  }
  const loadout = loadoutFor(kit);
  // Belt and braces: loadoutFor cannot exceed the caps for any kit, and this says so at the seam.
  if (loadout.attack > CAPS.attack || loadout.res < CAPS.res) return fail('rule-violation', '(loadout)', 'resolved loadout exceeds the fixed Attack/RES caps');
  return ok(loadout);
}

// What one piece is worth on today's per-piece score scale (src/gear-stats.ts pointsFor), at its effective tier. 0 for no power.
export function piecePoints(inst: Pick<ItemInstance, 'tier' | 'upgradeLevel'>, def: ItemDefinition): number {
  const tier = effectiveTier(inst);
  return def.power === 'slot-weight' && def.slot !== null && tier !== null ? pointsFor(tier, def.slot) : 0;
}

// ---- LootTable --------------------------------------------------------------------------------------------------------------------

export const LOOT_TABLE_VERSION = 1;
export const PRESENTATIONS = ['take-one', 'collect'] as const; // take-one: the Pit rule, kept for elites and bosses; collect: everyday drops
export const DISTRIBUTIONS = ['personal'] as const; // personal group loot first (blueprint §8); a shared mode is a later version
export const ROLL_MODES = ['independent', 'weighted'] as const;
export const MAX_CURRENCY = 1_000_000_000;

export type LootEntry = { item: ItemId; chance: number; quantity: number; levelMin: number | null; levelMax: number | null };
export type LootRoll = { probability: number; repeat: number; mode: (typeof ROLL_MODES)[number]; dropLimit: number; minDrop: number; entries: LootEntry[] };
export type LootTable = {
  kind: 'loot-table';
  schemaVersion: 1;
  id: LootTableId;
  presentation: (typeof PRESENTATIONS)[number];
  distribution: (typeof DISTRIBUTIONS)[number];
  rolls: LootRoll[];
  currency: { min: number; max: number } | null;
  // The repeat-attempt fallback for a named enemy (blueprint §8): progress toward crafting when the roll gives nothing new.
  fallback: { kind: 'craft-progress'; amount: number } | null;
};

const LOOT_KEYS = ['kind', 'schemaVersion', 'id', 'presentation', 'distribution', 'rolls', 'currency', 'fallback'] as const;

function readEntry(issues: Issues, raw: unknown, path: string): LootEntry | undefined {
  const obj = readObject(issues, raw, path, ['item', 'chance', 'quantity', 'levelMin', 'levelMax']);
  if (!obj) return undefined;
  const item = readId(issues, obj, 'item', path, 'item');
  const chance = readInt(issues, obj, 'chance', path, 1, 100);
  const quantity = readInt(issues, obj, 'quantity', path, 1, MAX_STACK);
  const levelMin = obj.levelMin === null || obj.levelMin === undefined ? null : readInt(issues, obj, 'levelMin', path, 1, MAX_LEVEL);
  const levelMax = obj.levelMax === null || obj.levelMax === undefined ? null : readInt(issues, obj, 'levelMax', path, 1, MAX_LEVEL);
  if (levelMin !== null && levelMin !== undefined && levelMax !== null && levelMax !== undefined && levelMin > levelMax) {
    issues.add('rule-violation', path, `levelMin ${levelMin} is above levelMax ${levelMax}`);
    return undefined;
  }
  return item && chance !== undefined && quantity !== undefined && levelMin !== undefined && levelMax !== undefined ? { item, chance, quantity, levelMin, levelMax } : undefined;
}

function readRoll(issues: Issues, raw: unknown, path: string): LootRoll | undefined {
  const obj = readObject(issues, raw, path, ['probability', 'repeat', 'mode', 'dropLimit', 'minDrop', 'entries']);
  if (!obj) return undefined;
  const probability = readInt(issues, obj, 'probability', path, 1, 100);
  const repeat = readInt(issues, obj, 'repeat', path, 1, 10);
  const mode = readEnum(issues, obj, 'mode', path, ROLL_MODES);
  const dropLimit = readInt(issues, obj, 'dropLimit', path, 0, 20);
  const minDrop = readInt(issues, obj, 'minDrop', path, 0, 20);
  const entries = readArray(issues, obj, 'entries', path, (v, p) => readEntry(issues, v, p), { min: 1, max: 200 });
  if (mode === 'independent' && (dropLimit !== 0 || minDrop !== 0)) issues.add('rule-violation', path, 'an independent roll has no dropLimit or minDrop (both 0)');
  if (mode === 'weighted' && dropLimit !== undefined && minDrop !== undefined) {
    if (dropLimit < 1) issues.add('rule-violation', join(path, 'dropLimit'), 'a weighted roll picks at least once (dropLimit ≥ 1)');
    if (minDrop > dropLimit) issues.add('rule-violation', join(path, 'minDrop'), `minDrop ${minDrop} is above dropLimit ${dropLimit}`);
  }
  if (entries) {
    const seen = new Set<string>();
    entries.forEach((entry, i) => {
      if (seen.has(entry.item)) issues.add('duplicate-id', join(join(path, 'entries'), i), `${entry.item} is listed twice in one roll`);
      seen.add(entry.item);
    });
  }
  return probability !== undefined && repeat !== undefined && mode && dropLimit !== undefined && minDrop !== undefined && entries ? { probability, repeat, mode, dropLimit, minDrop, entries } : undefined;
}

export function parseLootTable(raw: unknown, path = ''): Result<LootTable> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, LOOT_KEYS);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'loot-table');
  readSchemaVersion(issues, obj, path, [LOOT_TABLE_VERSION]);
  const id = readId(issues, obj, 'id', path, 'loottable');
  const presentation = readEnum(issues, obj, 'presentation', path, PRESENTATIONS);
  const distribution = readEnum(issues, obj, 'distribution', path, DISTRIBUTIONS);
  const rolls = Object.hasOwn(obj, 'rolls') ? checkArray(issues, obj.rolls, join(path, 'rolls'), (v, p) => readRoll(issues, v, p), { min: 1, max: 20 }) : (issues.add('missing-field', join(path, 'rolls'), 'required field "rolls" is missing'), undefined);
  let currency: LootTable['currency'] | undefined = null;
  if (!Object.hasOwn(obj, 'currency')) issues.add('missing-field', join(path, 'currency'), 'required field "currency" is missing (null for none)');
  else if (obj.currency !== null) {
    const c = readObject(issues, obj.currency, join(path, 'currency'), ['min', 'max']);
    const min = c && readInt(issues, c, 'min', join(path, 'currency'), 0, MAX_CURRENCY), max = c && readInt(issues, c, 'max', join(path, 'currency'), 0, MAX_CURRENCY);
    if (min !== undefined && max !== undefined && min > max) issues.add('rule-violation', join(path, 'currency'), `min ${min} is above max ${max}`);
    currency = min !== undefined && max !== undefined ? { min, max } : undefined;
  }
  let fallback: LootTable['fallback'] | undefined = null;
  if (!Object.hasOwn(obj, 'fallback')) issues.add('missing-field', join(path, 'fallback'), 'required field "fallback" is missing (null for none)');
  else if (obj.fallback !== null) {
    const f = readObject(issues, obj.fallback, join(path, 'fallback'), ['kind', 'amount']);
    const kind = f && readEnum(issues, f, 'kind', join(path, 'fallback'), ['craft-progress'] as const);
    const amount = f && readInt(issues, f, 'amount', join(path, 'fallback'), 1, 1000);
    fallback = kind && amount !== undefined ? { kind, amount } : undefined;
  }
  return issues.finish({ kind: 'loot-table', schemaVersion: 1, id: id!, presentation: presentation!, distribution: distribution!, rolls: rolls!, currency: currency!, fallback: fallback! });
}

// For readers that want the list of item ids a table can award (registry cross-checks).
export const itemsOf = (table: LootTable): ItemId[] => table.rolls.flatMap((roll) => roll.entries.map((entry) => entry.item));
