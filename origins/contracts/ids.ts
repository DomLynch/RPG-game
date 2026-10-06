// Origins O1: the stable ID scheme.
//
// Every id is `<namespace>:<local>`, typed as a branded string so an item id can never be passed where a faction id is expected, and
// parsed from text by `parseId` (never cast). The namespace is part of the stored text, so an id read out of a database column or a
// content file says what it is without the column's help.
//
// Local part: lowercase `a-z 0-9 . _ -`, starting with a letter or digit, at most 96 characters. The ONE exception is the legacy loot
// embedding below, which keeps today's mixed-case `<opponent>.<Slot>` text byte for byte.
//
// Legacy ids are EMBEDDED, not re-minted (O0 baseline §5 item 9: "reuse it rather than mint a new one"):
//   - a loot piece `veteran.Helmet` (src/loot.ts LootId, the server CHECK regex `^[a-z]{1,32}\.[A-Za-z]{1,32}$`) is the item DEFINITION
//     `item:loot.veteran.Helmet`. It is a definition, never an instance: today's `owned` list is a set of collection unlocks.
//   - a legend face key `veteran-3` (src/legends.ts PORTRAIT_KEYS, the skull wall, fight_results.opponent_key, the nginx og whitelist)
//     is the character `character:legend.veteran-3`.
//   - a roster opponent `veteran` (src/roster.ts OpponentId) is the character `character:opponent.veteran`.
// Each mapping is a pure prefix, so it is reversible by stripping the prefix, and each reverse is checked against the live table it came
// from (isLootId, PORTRAIT_KEYS, isOpponentId). Nothing persisted today changes; see README "Proposal: legacy loot ids → item instances".
import { isLootId, type LootId } from '../../src/loot.ts';
import { PORTRAIT_KEYS } from '../../src/legends.ts';
import { isOpponentId, type OpponentId } from '../../src/roster.ts';
import { Issues, fail, join, ok, type Obj, type Result } from './core.ts';

export const NAMESPACES = [
  'account', // a Supabase auth user (auth.users.id), the one identity every durable row keys on
  'pc', // a player character (CharacterInstance)
  'character', // a named figure or opponent class (CharacterDefinition)
  'faction',
  'quest',
  'region',
  'encounter',
  'item', // an item definition
  'inst', // an item instance (one physical copy)
  'loottable',
  'container', // a custodian that is not a character: a guild vault, a trade escrow
  'service', // an NPC service (the blacksmith's upgrades; later the armourer, the merchant)
  'costtable', // a versioned table of service prices
] as const;
export type Namespace = (typeof NAMESPACES)[number];

declare const brand: unique symbol;
export type Id<N extends Namespace> = `${N}:${string}` & { readonly [brand]: N };
export type AccountId = Id<'account'>;
export type CharacterInstanceId = Id<'pc'>;
export type CharacterId = Id<'character'>;
export type FactionId = Id<'faction'>;
export type QuestId = Id<'quest'>;
export type RegionId = Id<'region'>;
export type EncounterId = Id<'encounter'>;
export type ItemId = Id<'item'>;
export type ItemInstanceId = Id<'inst'>;
export type LootTableId = Id<'loottable'>;
export type ContainerId = Id<'container'>;
export type ServiceId = Id<'service'>;
export type CostTableId = Id<'costtable'>;

const LOCAL = /^[a-z0-9][a-z0-9._-]{0,95}$/;
const LEGACY_LOOT_LOCAL = /^loot\.[a-z]{1,32}\.[A-Za-z]{1,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const LEGACY_LOOT_PREFIX = 'item:loot.';
export const LEGEND_PREFIX = 'character:legend.';
export const OPPONENT_PREFIX = 'character:opponent.';

const PORTRAIT_KEY_SET: ReadonlySet<string> = new Set(PORTRAIT_KEYS);

// Parse one id of an expected namespace. Unknown or mismatched namespace, a malformed local part, and a reserved legacy form that names
// nothing in today's tables are all explicit failures.
export function parseId<N extends Namespace>(value: unknown, namespace: N, path = ''): Result<Id<N>> {
  const where = path || '(id)';
  if (typeof value !== 'string') return fail('bad-id', where, `expected a ${namespace}: id string`);
  const colon = value.indexOf(':');
  if (colon <= 0) return fail('bad-id', where, `"${value}" has no namespace (expected "${namespace}:…")`);
  const ns = value.slice(0, colon), local = value.slice(colon + 1);
  if (!(NAMESPACES as readonly string[]).includes(ns)) return fail('bad-id', where, `unknown namespace "${ns}"`);
  if (ns !== namespace) return fail('wrong-namespace', where, `expected a ${namespace}: id, got ${ns}:`);
  if (ns === 'item' && local.startsWith('loot.')) {
    if (!LEGACY_LOOT_LOCAL.test(local)) return fail('bad-id', where, `"${value}" is not a legacy loot id of the form item:loot.<opponent>.<Slot>`);
    if (!isLootId(local.slice('loot.'.length))) return fail('legacy-unknown', where, `"${value}" names no current or retired loot piece`);
    return ok(value as Id<N>);
  }
  if (!LOCAL.test(local)) return fail('bad-id', where, `"${value}": the local part must be lowercase a-z 0-9 . _ - (1..96 chars)`);
  if (ns === 'character' && local.startsWith('legend.') && !PORTRAIT_KEY_SET.has(local.slice('legend.'.length))) {
    return fail('legacy-unknown', where, `"${value}" names no legend (expected <opponent>-<rung 1..10>)`);
  }
  if (ns === 'character' && local.startsWith('opponent.') && !isOpponentId(local.slice('opponent.'.length))) {
    return fail('legacy-unknown', where, `"${value}" names no roster opponent`);
  }
  if (ns === 'account' && !UUID.test(local)) return fail('bad-id', where, `"${value}": an account id is account:<lowercase uuid>`);
  return ok(value as Id<N>);
}

export const isId = <N extends Namespace>(value: unknown, namespace: N): value is Id<N> => parseId(value, namespace).ok;

// Reader helpers for the schema modules.
export function checkId<N extends Namespace>(issues: Issues, value: unknown, path: string, namespace: N): Id<N> | undefined {
  return issues.absorb(parseId(value, namespace, path));
}
export function readId<N extends Namespace>(issues: Issues, obj: Obj, key: string, path: string, namespace: N): Id<N> | undefined {
  if (!Object.hasOwn(obj, key) || obj[key] === undefined) {
    issues.add('missing-field', join(path, key), `required field "${key}" is missing`);
    return undefined;
  }
  return checkId(issues, obj[key], join(path, key), namespace);
}
export function readOptionalId<N extends Namespace>(issues: Issues, obj: Obj, key: string, path: string, namespace: N): Id<N> | null | undefined {
  if (!Object.hasOwn(obj, key) || obj[key] === undefined || obj[key] === null) return null;
  return checkId(issues, obj[key], join(path, key), namespace);
}

// ---- legacy mappings (pure; nothing persisted changes) ---------------------------------------------------------------------------

// `veteran.Helmet` → `item:loot.veteran.Helmet`. Retired pieces (src/loot.ts RETIRED_LOOT) map too: a roster change never deletes an item.
export function itemIdFromLegacyLoot(lootId: unknown): Result<ItemId> {
  if (!isLootId(lootId)) return fail('legacy-unknown', '(lootId)', `${JSON.stringify(lootId)} is not a current or retired loot id`);
  return ok(`${LEGACY_LOOT_PREFIX}${lootId}` as ItemId);
}
// The reverse; null for any item id that is not a legacy embedding (new Origins items have no LootId and never will).
export function legacyLootOfItemId(id: ItemId): LootId | null {
  if (!id.startsWith(LEGACY_LOOT_PREFIX)) return null;
  const lootId = id.slice(LEGACY_LOOT_PREFIX.length);
  return isLootId(lootId) ? lootId : null;
}

// `veteran-3` → `character:legend.veteran-3`. The key is today's persisted portrait key, unchanged.
export function characterIdFromLegendKey(key: unknown): Result<CharacterId> {
  if (typeof key !== 'string' || !PORTRAIT_KEY_SET.has(key)) return fail('legacy-unknown', '(legendKey)', `${JSON.stringify(key)} is not a legend key <opponent>-<rung 1..10>`);
  return ok(`${LEGEND_PREFIX}${key}` as CharacterId);
}
export function legendKeyOfCharacterId(id: CharacterId): string | null {
  if (!id.startsWith(LEGEND_PREFIX)) return null;
  const key = id.slice(LEGEND_PREFIX.length);
  return PORTRAIT_KEY_SET.has(key) ? key : null;
}

// `veteran` → `character:opponent.veteran`.
export function characterIdFromOpponent(opponent: unknown): Result<CharacterId> {
  if (!isOpponentId(opponent)) return fail('legacy-unknown', '(opponent)', `${JSON.stringify(opponent)} is not a roster opponent`);
  return ok(`${OPPONENT_PREFIX}${opponent}` as CharacterId);
}
export function opponentOfCharacterId(id: CharacterId): OpponentId | null {
  if (!id.startsWith(OPPONENT_PREFIX)) return null;
  const opponent = id.slice(OPPONENT_PREFIX.length);
  return isOpponentId(opponent) ? opponent : null;
}

// A Supabase auth uid (uuid text) → `account:<uuid>`. Upper-case input is refused rather than folded: the uid is stored lower-case by
// Supabase, and two spellings of one account must not exist.
export function accountIdFromAuthUid(uid: unknown): Result<AccountId> {
  if (typeof uid !== 'string' || !UUID.test(uid)) return fail('bad-id', '(uid)', `${JSON.stringify(uid)} is not a lowercase uuid`);
  return ok(`account:${uid}` as AccountId);
}
