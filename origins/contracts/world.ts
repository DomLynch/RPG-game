// Origins O1: who and where — CharacterDefinition, CharacterInstance (and access from the one career), FactionDefinition with its
// standing model, RegionDefinition and EncounterDefinition.
//
// Rank is NOT defined here. It is src/career.ts `rankFor(marks)` over the account's server-verified marks, exactly as the HUD, the
// journal and the loot verifier read it. A CharacterInstance stores no marks, no rank and no stats (ruling 7: one career, one rank, one
// stat set, server-verified); access is derived at the moment it is asked for from a CareerStanding the caller reads from the server.
import { MAX_LEVEL, rankFor, type Rank } from '../../src/career.ts';
import { levelOf as tierLevel, type Tier } from '../../src/grades.ts';
import { isOpponentId, type OpponentId } from '../../src/roster.ts';
import {
  Issues, LOCAL_KEY, checkString, join, readArray, readBoolean, readEnum, readInt, readKind, readObject, readSchemaVersion,
  readString, readText, readTimestamp, type Issue, type Obj, type Result,
} from './core.ts';
import {
  checkId, readId, readOptionalId,
  type AccountId, type CharacterId, type CharacterInstanceId, type EncounterId, type FactionId, type LootTableId, type QuestId, type RegionId,
} from './ids.ts';

// ---- gates and the one career -----------------------------------------------------------------------------------------------------

// Ruling 2: Gladiator opens the outer gate (the Exchange, the first region, chapter one), Champion the next realm, Origin the endgame.
// The Pit is open from level 1. These are TIERS (rank titles, 1..10), not career levels (1..46): Gladiator I is level 11, 10 wins.
export const GATES = ['pit', 'outer', 'second-realm', 'endgame'] as const;
export type Gate = (typeof GATES)[number];
export const GATE_TIER: Readonly<Record<Gate, Tier>> = { pit: 'Recruit', outer: 'Gladiator', 'second-realm': 'Champion', endgame: 'Origin' };
// Ruling 3: the Exchange, the first region and chapter one are free; every realm after that needs membership. Derived from the gate, not
// stored on content, so no region can be authored free past the outer gate by mistake.
export const membershipRequired = (gate: Gate): boolean => gate === 'second-realm' || gate === 'endgame';

// What the server says about the account's career: the marks from standing_of()/my_standing (src/career.ts shownMarks with a server
// figure). `device` marks are a guest's or an offline count: the HUD may show them, but they never open a gate (blueprint §4: the
// browser "does not validate its own campaign unlock").
export type CareerStanding = { source: 'server' | 'device'; victoryMarks: number };
export const rankOf = (standing: CareerStanding): Rank => rankFor(standing.victoryMarks);
export const tierOf = (standing: CareerStanding): Tier => rankOf(standing).title;

export type Denial = 'unverified' | 'rank' | 'membership';
export type Access = { ok: true } | { ok: false; reason: Denial; needs: Tier | 'membership' | 'server-verified marks' };

export function gateAccess(gate: Gate, standing: CareerStanding, hasMembership: boolean): Access {
  if (gate === 'pit') return { ok: true };
  if (standing.source !== 'server') return { ok: false, reason: 'unverified', needs: 'server-verified marks' };
  const need = GATE_TIER[gate];
  if (tierLevel(tierOf(standing)) < tierLevel(need)) return { ok: false, reason: 'rank', needs: need };
  if (membershipRequired(gate) && !hasMembership) return { ok: false, reason: 'membership', needs: 'membership' };
  return { ok: true };
}

// ---- CharacterInstance (a player character) ---------------------------------------------------------------------------------------

export const CHARACTER_INSTANCE_VERSION = 1;
export type CharacterInstance = {
  kind: 'character-instance';
  schemaVersion: 1;
  id: CharacterInstanceId;
  // The career link: the account. Its marks (standing_of) are the character's career; there is one career per account today, and a
  // second character on one account shares it rather than forking a second ladder.
  account: AccountId;
  name: string;
  createdAt: string;
};
// Deliberately absent, and refused as unknown fields: marks, rank, level, stats, inventory, equipped, bank. Each already has exactly one
// authority (the server standing, rankFor, the ItemInstance location) and a copy here would be a second one.
const CHARACTER_INSTANCE_KEYS = ['kind', 'schemaVersion', 'id', 'account', 'name', 'createdAt'] as const;

export function parseCharacterInstance(raw: unknown, path = ''): Result<CharacterInstance> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, CHARACTER_INSTANCE_KEYS);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'character-instance');
  readSchemaVersion(issues, obj, path, [CHARACTER_INSTANCE_VERSION]);
  const id = readId(issues, obj, 'id', path, 'pc');
  const account = readId(issues, obj, 'account', path, 'account');
  const name = readText(issues, obj, 'name', path, { max: 32 });
  const createdAt = readTimestamp(issues, obj, 'createdAt', path);
  return issues.finish({ kind: 'character-instance', schemaVersion: 1, id: id!, account: account!, name: name!, createdAt: createdAt! });
}

// ---- CharacterDefinition (a named figure) -----------------------------------------------------------------------------------------

export const CHARACTER_DEFINITION_VERSION = 1;
export const RELATIONS = ['ally', 'rival', 'enemy', 'kin', 'patron', 'servant'] as const;
export const QUEST_ROLES = ['giver', 'witness', 'target', 'ally', 'boss'] as const;
export type Routine = { start: string; end: string; activity: string; region: RegionId; waypoint: string };
export type CharacterDefinition = {
  kind: 'character-definition';
  schemaVersion: 1;
  id: CharacterId;
  name: string;
  lore: { source: string; summary: string };
  faction: FactionId | null;
  // An essential figure cannot be removed from the shared world by one player's private campaign (blueprint §9).
  essential: boolean;
  relationships: { character: CharacterId; relation: (typeof RELATIONS)[number] }[];
  questRoles: { quest: QuestId; role: (typeof QUEST_ROLES)[number] }[];
  presentations: { id: string; asset: string }[];
  // How the figure fights. `opponent` routes the fight through today's duel (src/duel.ts opponentFighter) at `level` (1..46).
  encounterForms: { id: string; opponent: OpponentId | null; level: number | null; encounter: EncounterId | null }[];
  routine: Routine[];
};

// Ruling 4: figures central to a major living religion are out. This is a tripwire on the WHOLE name (case-insensitive), not a review:
// it catches the obvious slip, and the legends-rule skill and Strategy remain the authority.
export const BARRED_NAMES: readonly string[] = [
  'god', 'allah', 'jesus', 'jesus christ', 'christ', 'muhammad', 'mohammed', 'mary', 'the virgin mary', 'joseph', 'satan', 'lucifer', 'the devil',
  'buddha', 'the buddha', 'gautama buddha', 'brahma', 'vishnu', 'shiva', 'krishna', 'rama', 'ganesha', 'lakshmi', 'parvati', 'durga', 'kali', 'hanuman', 'saraswati',
];
const BARRED = new Set(BARRED_NAMES);

const CHARACTER_KEYS = ['kind', 'schemaVersion', 'id', 'name', 'lore', 'faction', 'essential', 'relationships', 'questRoles', 'presentations', 'encounterForms', 'routine'] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ASSET = /^[a-z0-9][a-z0-9._/-]{0,159}$/i;
const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function readRoutine(issues: Issues, raw: unknown, path: string): Routine | undefined {
  const obj = readObject(issues, raw, path, ['start', 'end', 'activity', 'region', 'waypoint']);
  if (!obj) return undefined;
  const start = readString(issues, obj, 'start', path, { pattern: HHMM }), end = readString(issues, obj, 'end', path, { pattern: HHMM });
  const activity = readString(issues, obj, 'activity', path, { pattern: LOCAL_KEY });
  const region = readId(issues, obj, 'region', path, 'region');
  const waypoint = readString(issues, obj, 'waypoint', path, { pattern: LOCAL_KEY });
  if (start !== undefined && start === end) issues.add('rule-violation', path, 'a routine entry with start == end covers nothing');
  return start && end && activity && region && waypoint && start !== end ? { start, end, activity, region, waypoint } : undefined;
}

// A schedule covers the whole day exactly once: every minute belongs to one entry. Entries may wrap midnight.
function checkRoutine(issues: Issues, routine: Routine[], path: string): void {
  if (routine.length === 0) return; // no schedule: the figure stands where content places it
  const owner = new Array<number>(1440).fill(-1);
  routine.forEach((entry, i) => {
    const s = minutes(entry.start), e = minutes(entry.end);
    for (let m = s; m !== e; m = (m + 1) % 1440) {
      if (owner[m] !== -1) {
        issues.add('rule-violation', join(path, i), `overlaps entry ${owner[m]} at ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
        return;
      }
      owner[m] = i;
    }
  });
  const gap = owner.indexOf(-1);
  if (gap !== -1) issues.add('rule-violation', path, `the schedule leaves ${String(Math.floor(gap / 60)).padStart(2, '0')}:${String(gap % 60).padStart(2, '0')} uncovered`);
}

const uniqueIds = (issues: Issues, items: { id: string }[] | undefined, path: string): void => {
  const seen = new Set<string>();
  items?.forEach((item, i) => {
    if (seen.has(item.id)) issues.add('duplicate-id', join(join(path, i), 'id'), `"${item.id}" is used twice`);
    seen.add(item.id);
  });
};

export function parseCharacterDefinition(raw: unknown, path = ''): Result<CharacterDefinition> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, CHARACTER_KEYS);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'character-definition');
  readSchemaVersion(issues, obj, path, [CHARACTER_DEFINITION_VERSION]);
  const id = readId(issues, obj, 'id', path, 'character');
  const name = readText(issues, obj, 'name', path, { max: 60 });
  if (name !== undefined && BARRED.has(name.trim().toLowerCase())) issues.add('content-rule', join(path, 'name'), `"${name}" is a figure central to a living religion (ruling 4)`);
  let lore: CharacterDefinition['lore'] | undefined;
  const l = Object.hasOwn(obj, 'lore') ? readObject(issues, obj.lore, join(path, 'lore'), ['source', 'summary']) : (issues.add('missing-field', join(path, 'lore'), 'required field "lore" is missing'), undefined);
  if (l) {
    const source = readText(issues, l, 'source', join(path, 'lore'), { max: 120 }), summary = readText(issues, l, 'summary', join(path, 'lore'), { max: 600 });
    if (source !== undefined && summary !== undefined) lore = { source, summary };
  }
  if (!Object.hasOwn(obj, 'faction')) issues.add('missing-field', join(path, 'faction'), 'required field "faction" is missing (null for none)');
  const faction = readOptionalId(issues, obj, 'faction', path, 'faction');
  const essential = readBoolean(issues, obj, 'essential', path);
  const relationships = readArray(issues, obj, 'relationships', path, (v, p) => {
    const r = readObject(issues, v, p, ['character', 'relation']);
    const character = r && readId(issues, r, 'character', p, 'character'), relation = r && readEnum(issues, r, 'relation', p, RELATIONS);
    if (character && id && character === id) issues.add('rule-violation', p, 'a figure has no relationship with itself');
    return character && relation && character !== id ? { character, relation } : undefined;
  }, { max: 64 });
  const questRoles = readArray(issues, obj, 'questRoles', path, (v, p) => {
    const r = readObject(issues, v, p, ['quest', 'role']);
    const quest = r && readId(issues, r, 'quest', p, 'quest'), role = r && readEnum(issues, r, 'role', p, QUEST_ROLES);
    return quest && role ? { quest, role } : undefined;
  }, { max: 64 });
  const presentations = readArray(issues, obj, 'presentations', path, (v, p) => {
    const r = readObject(issues, v, p, ['id', 'asset']);
    const pid = r && readString(issues, r, 'id', p, { pattern: LOCAL_KEY }), asset = r && readString(issues, r, 'asset', p, { min: 1, max: 160, pattern: ASSET });
    return pid && asset ? { id: pid, asset } : undefined;
  }, { min: 1, max: 16 });
  uniqueIds(issues, presentations, join(path, 'presentations'));
  const encounterForms = readArray(issues, obj, 'encounterForms', path, (v, p) => {
    const r = readObject(issues, v, p, ['id', 'opponent', 'level', 'encounter']);
    if (!r) return undefined;
    const fid = readString(issues, r, 'id', p, { pattern: LOCAL_KEY });
    let opponent: OpponentId | null | undefined = null;
    if (r.opponent !== null && r.opponent !== undefined) {
      if (isOpponentId(r.opponent)) opponent = r.opponent;
      else { issues.add('legacy-unknown', join(p, 'opponent'), `${JSON.stringify(r.opponent)} is not a roster opponent`); opponent = undefined; }
    }
    const level = r.level === null || r.level === undefined ? null : readInt(issues, r, 'level', p, 1, MAX_LEVEL);
    const encounter = readOptionalId(issues, r, 'encounter', p, 'encounter');
    if (opponent === null && encounter === null) issues.add('rule-violation', p, 'an encounter form fights as a roster opponent or inside an encounter (or both)');
    if (opponent !== null && level === null) issues.add('rule-violation', join(p, 'level'), 'a duel form names the level (1..46) it is fought at');
    return fid && opponent !== undefined && level !== undefined && encounter !== undefined && (opponent !== null || encounter !== null) && !(opponent !== null && level === null) ? { id: fid, opponent, level, encounter } : undefined;
  }, { max: 16 });
  uniqueIds(issues, encounterForms, join(path, 'encounterForms'));
  const routine = readArray(issues, obj, 'routine', path, (v, p) => readRoutine(issues, v, p), { max: 24 });
  if (routine) checkRoutine(issues, routine, join(path, 'routine'));
  return issues.finish({
    kind: 'character-definition', schemaVersion: 1, id: id!, name: name!, lore: lore!, faction: faction ?? null, essential: essential!,
    relationships: relationships!, questRoles: questRoles!, presentations: presentations!, encounterForms: encounterForms!, routine: routine!,
  });
}

// ---- FactionDefinition and standing -----------------------------------------------------------------------------------------------

export const FACTION_DEFINITION_VERSION = 1;
export const FACTION_STANDING_VERSION = 1;
// Four attitudes (the Gothic set): only hostile is "enemy"; angry fights when provoked.
export const ATTITUDES = ['hostile', 'angry', 'neutral', 'friendly'] as const;
export type Attitude = (typeof ATTITUDES)[number];
// Standing is a bounded integer. Bounded on purpose: repeated safe actions must not buy unlimited favour (blueprint §7).
export const STANDING_MIN = -1000;
export const STANDING_MAX = 1000;
export const ATTITUDE_BANDS = { hostileAtOrBelow: -500, angryAtOrBelow: -100, friendlyAtOrAbove: 250 } as const;
export const MAX_RANKS = 10;

export type FactionRank = { id: string; title: string; minStanding: number };
export type FactionDefinition = {
  kind: 'faction-definition';
  schemaVersion: 1;
  id: FactionId;
  name: string;
  joinable: boolean;
  hidden: boolean;
  ranks: FactionRank[]; // dense, ascending; empty for a faction that cannot be joined
  reactions: { faction: FactionId; attitude: Attitude }[]; // this faction's view of others; directional, not symmetric
};
export type FactionStanding = {
  kind: 'faction-standing';
  schemaVersion: 1;
  character: CharacterInstanceId;
  faction: FactionId;
  standing: number;
  rank: number | null; // index into ranks; null = not a member
  expelled: boolean; // an expelled member keeps the rank entry (it is history) but gains nothing from it
};

const FACTION_KEYS = ['kind', 'schemaVersion', 'id', 'name', 'joinable', 'hidden', 'ranks', 'reactions'] as const;

export function parseFactionDefinition(raw: unknown, path = ''): Result<FactionDefinition> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, FACTION_KEYS);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'faction-definition');
  readSchemaVersion(issues, obj, path, [FACTION_DEFINITION_VERSION]);
  const id = readId(issues, obj, 'id', path, 'faction');
  const name = readText(issues, obj, 'name', path, { max: 60 });
  const joinable = readBoolean(issues, obj, 'joinable', path);
  const hidden = readBoolean(issues, obj, 'hidden', path);
  const ranks = readArray(issues, obj, 'ranks', path, (v, p) => {
    const r = readObject(issues, v, p, ['id', 'title', 'minStanding']);
    const rid = r && readString(issues, r, 'id', p, { pattern: LOCAL_KEY }), title = r && readText(issues, r, 'title', p, { max: 40 });
    const minStanding = r && readInt(issues, r, 'minStanding', p, STANDING_MIN, STANDING_MAX);
    return rid && title && minStanding !== undefined ? { id: rid, title, minStanding } : undefined;
  }, { max: MAX_RANKS });
  uniqueIds(issues, ranks, join(path, 'ranks'));
  ranks?.forEach((rank, i) => {
    if (i > 0 && rank.minStanding <= ranks[i - 1]!.minStanding) issues.add('rule-violation', join(join(path, 'ranks'), i), 'ranks ascend: each needs more standing than the one below');
  });
  if (joinable === true && ranks?.length === 0) issues.add('rule-violation', join(path, 'ranks'), 'a joinable faction has at least one rank');
  if (joinable === false && ranks !== undefined && ranks.length > 0) issues.add('rule-violation', join(path, 'ranks'), 'a faction that cannot be joined has no ranks');
  const reactions = readArray(issues, obj, 'reactions', path, (v, p) => {
    const r = readObject(issues, v, p, ['faction', 'attitude']);
    const faction = r && readId(issues, r, 'faction', p, 'faction'), attitude = r && readEnum(issues, r, 'attitude', p, ATTITUDES);
    return faction && attitude ? { faction, attitude } : undefined;
  }, { max: 128 });
  const seen = new Set<string>();
  reactions?.forEach((reaction, i) => {
    if (seen.has(reaction.faction)) issues.add('duplicate-id', join(join(path, 'reactions'), i), `${reaction.faction} has two reactions`);
    seen.add(reaction.faction);
  });
  return issues.finish({ kind: 'faction-definition', schemaVersion: 1, id: id!, name: name!, joinable: joinable!, hidden: hidden!, ranks: ranks!, reactions: reactions! });
}

const STANDING_KEYS = ['kind', 'schemaVersion', 'character', 'faction', 'standing', 'rank', 'expelled'] as const;

export function parseFactionStanding(raw: unknown, path = ''): Result<FactionStanding> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, STANDING_KEYS);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'faction-standing');
  readSchemaVersion(issues, obj, path, [FACTION_STANDING_VERSION]);
  const character = readId(issues, obj, 'character', path, 'pc');
  const faction = readId(issues, obj, 'faction', path, 'faction');
  const standing = readInt(issues, obj, 'standing', path, STANDING_MIN, STANDING_MAX);
  if (!Object.hasOwn(obj, 'rank')) issues.add('missing-field', join(path, 'rank'), 'required field "rank" is missing (null when not a member)');
  const rank = obj.rank === null || obj.rank === undefined ? null : readInt(issues, obj, 'rank', path, 0, MAX_RANKS - 1);
  const expelled = readBoolean(issues, obj, 'expelled', path);
  if (expelled === true && rank === null) issues.add('rule-violation', join(path, 'expelled'), 'only a member can be expelled');
  return issues.finish({ kind: 'faction-standing', schemaVersion: 1, character: character!, faction: faction!, standing: standing!, rank: rank!, expelled: expelled! });
}

export function checkStanding(standing: FactionStanding, def: FactionDefinition, path = ''): Issue[] {
  const issues = new Issues();
  if (standing.faction !== def.id) issues.add('rule-violation', join(path, 'faction'), `standing is for ${standing.faction}, checked against ${def.id}`);
  if (standing.rank !== null && standing.rank >= def.ranks.length) issues.add('out-of-range', join(path, 'rank'), `${def.id} has ${def.ranks.length} ranks`);
  if (standing.rank !== null && !def.joinable) issues.add('rule-violation', join(path, 'rank'), `${def.id} cannot be joined`);
  return issues.list;
}

export const clampStanding = (value: number): number => Math.min(STANDING_MAX, Math.max(STANDING_MIN, Math.trunc(value)));
export const adjustStanding = (standing: FactionStanding, delta: number): FactionStanding => ({ ...standing, standing: clampStanding(standing.standing + delta) });

export function attitudeFor(standing: number): Attitude {
  if (standing <= ATTITUDE_BANDS.hostileAtOrBelow) return 'hostile';
  if (standing <= ATTITUDE_BANDS.angryAtOrBelow) return 'angry';
  if (standing >= ATTITUDE_BANDS.friendlyAtOrAbove) return 'friendly';
  return 'neutral';
}
// An expelled member is at best angry, whatever the number says.
export const attitudeOf = (standing: FactionStanding): Attitude => {
  const band = attitudeFor(standing.standing);
  return standing.expelled && (band === 'neutral' || band === 'friendly') ? 'angry' : band;
};
// Promotion is offered, never automatic: content (a quest stage, a mentor's line) acts on this answer.
export const canPromote = (standing: FactionStanding, def: FactionDefinition): boolean => {
  if (standing.expelled || !def.joinable) return false;
  const next = standing.rank === null ? 0 : standing.rank + 1;
  return next < def.ranks.length && standing.standing >= def.ranks[next]!.minStanding;
};
// A faction's attitude to another (directional); a faction with no entry for the other is neutral toward it.
export const reactionOf = (from: FactionDefinition, to: FactionId): Attitude => from.reactions.find((r) => r.faction === to)?.attitude ?? 'neutral';

// ---- RegionDefinition -------------------------------------------------------------------------------------------------------------

export const REGION_DEFINITION_VERSION = 1;
export type RegionDefinition = {
  kind: 'region-definition';
  schemaVersion: 1;
  id: RegionId;
  name: string;
  gate: Gate;
  waypoints: string[];
  portals: { id: string; at: string; to: RegionId; toPortal: string }[];
  landmarks: { id: string; name: string; at: string }[];
  spawns: { id: string; at: string; encounter: EncounterId | null; characters: CharacterId[] }[];
  triggers: { id: string; at: string; quest: QuestId; stage: string }[];
  assetManifest: string;
};
const REGION_KEYS = ['kind', 'schemaVersion', 'id', 'name', 'gate', 'waypoints', 'portals', 'landmarks', 'spawns', 'triggers', 'assetManifest'] as const;

export function parseRegionDefinition(raw: unknown, path = ''): Result<RegionDefinition> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, REGION_KEYS);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'region-definition');
  readSchemaVersion(issues, obj, path, [REGION_DEFINITION_VERSION]);
  const id = readId(issues, obj, 'id', path, 'region');
  const name = readText(issues, obj, 'name', path, { max: 60 });
  const gate = readEnum(issues, obj, 'gate', path, GATES);
  const waypoints = readArray(issues, obj, 'waypoints', path, (v, p) => checkString(issues, v, p, { pattern: LOCAL_KEY }), { min: 1, max: 2000 });
  const known = new Set(waypoints ?? []);
  if (waypoints && known.size !== waypoints.length) issues.add('duplicate-id', join(path, 'waypoints'), 'a waypoint is listed twice');
  const at = (r: Obj, p: string): string | undefined => {
    const w = readString(issues, r, 'at', p, { pattern: LOCAL_KEY });
    if (w !== undefined && waypoints && !known.has(w)) {
      issues.add('unknown-id', join(p, 'at'), `waypoint "${w}" is not in this region`);
      return undefined;
    }
    return w;
  };
  const portals = readArray(issues, obj, 'portals', path, (v, p) => {
    const r = readObject(issues, v, p, ['id', 'at', 'to', 'toPortal']);
    if (!r) return undefined;
    const pid = readString(issues, r, 'id', p, { pattern: LOCAL_KEY }), w = at(r, p), to = readId(issues, r, 'to', p, 'region');
    const toPortal = readString(issues, r, 'toPortal', p, { pattern: LOCAL_KEY });
    if (to && id && to === id) issues.add('rule-violation', join(p, 'to'), 'a portal leads to another region');
    return pid && w && to && toPortal && to !== id ? { id: pid, at: w, to, toPortal } : undefined;
  }, { max: 64 });
  uniqueIds(issues, portals, join(path, 'portals'));
  const landmarks = readArray(issues, obj, 'landmarks', path, (v, p) => {
    const r = readObject(issues, v, p, ['id', 'name', 'at']);
    if (!r) return undefined;
    const lid = readString(issues, r, 'id', p, { pattern: LOCAL_KEY }), lname = readText(issues, r, 'name', p, { max: 60 }), w = at(r, p);
    return lid && lname && w ? { id: lid, name: lname, at: w } : undefined;
  }, { max: 256 });
  uniqueIds(issues, landmarks, join(path, 'landmarks'));
  const spawns = readArray(issues, obj, 'spawns', path, (v, p) => {
    const r = readObject(issues, v, p, ['id', 'at', 'encounter', 'characters']);
    if (!r) return undefined;
    const sid = readString(issues, r, 'id', p, { pattern: LOCAL_KEY }), w = at(r, p);
    const encounter = readOptionalId(issues, r, 'encounter', p, 'encounter');
    const characters = readArray(issues, r, 'characters', p, (cv, cp) => checkId(issues, cv, cp, 'character'), { max: 64 });
    if (encounter === null && characters?.length === 0) issues.add('rule-violation', p, 'a spawn places an encounter or at least one character');
    return sid && w && encounter !== undefined && characters && !(encounter === null && characters.length === 0) ? { id: sid, at: w, encounter, characters } : undefined;
  }, { max: 512 });
  uniqueIds(issues, spawns, join(path, 'spawns'));
  const triggers = readArray(issues, obj, 'triggers', path, (v, p) => {
    const r = readObject(issues, v, p, ['id', 'at', 'quest', 'stage']);
    if (!r) return undefined;
    const tid = readString(issues, r, 'id', p, { pattern: LOCAL_KEY }), w = at(r, p), quest = readId(issues, r, 'quest', p, 'quest');
    const stage = readString(issues, r, 'stage', p, { pattern: LOCAL_KEY });
    return tid && w && quest && stage ? { id: tid, at: w, quest, stage } : undefined;
  }, { max: 512 });
  uniqueIds(issues, triggers, join(path, 'triggers'));
  const assetManifest = readString(issues, obj, 'assetManifest', path, { min: 1, max: 160, pattern: ASSET });
  return issues.finish({
    kind: 'region-definition', schemaVersion: 1, id: id!, name: name!, gate: gate!, waypoints: waypoints!, portals: portals!, landmarks: landmarks!,
    spawns: spawns!, triggers: triggers!, assetManifest: assetManifest!,
  });
}

export const regionAccess = (region: RegionDefinition, standing: CareerStanding, hasMembership: boolean): Access => gateAccess(region.gate, standing, hasMembership);

// ---- EncounterDefinition (a staged boss / public event) --------------------------------------------------------------------------

export const ENCOUNTER_DEFINITION_VERSION = 1;
export const ENCOUNTER_SCOPES = ['solo', 'party', 'public'] as const;
export type EncounterStage = { id: string; killsToAdvance: number; population: number; roster: { character: CharacterId; weight: number }[]; loot: LootTableId | null };
export type EncounterDefinition = {
  kind: 'encounter-definition';
  schemaVersion: 1;
  id: EncounterId;
  name: string;
  region: RegionId;
  scope: (typeof ENCOUNTER_SCOPES)[number];
  stages: EncounterStage[]; // fought in order; the boss appears after the last
  boss: { character: CharacterId; loot: LootTableId };
  // Decay: with no stage completed inside the window, progress below `keepProgressPercent` drops a stage; at or above it only the
  // partial progress is lost. null = no decay (a solo or party instance).
  decay: { windowSeconds: number; keepProgressPercent: number } | null;
  restartSeconds: number;
  // Personal reward eligibility: a contributor qualifies with at least this share of the top contributor's credit.
  rewards: { minContributionPercent: number };
};
const ENCOUNTER_KEYS = ['kind', 'schemaVersion', 'id', 'name', 'region', 'scope', 'stages', 'boss', 'decay', 'restartSeconds', 'rewards'] as const;

export function parseEncounterDefinition(raw: unknown, path = ''): Result<EncounterDefinition> {
  const issues = new Issues();
  const obj = readObject(issues, raw, path, ENCOUNTER_KEYS);
  if (!obj) return issues.finish(undefined as never);
  readKind(issues, obj, path, 'encounter-definition');
  readSchemaVersion(issues, obj, path, [ENCOUNTER_DEFINITION_VERSION]);
  const id = readId(issues, obj, 'id', path, 'encounter');
  const name = readText(issues, obj, 'name', path, { max: 60 });
  const region = readId(issues, obj, 'region', path, 'region');
  const scope = readEnum(issues, obj, 'scope', path, ENCOUNTER_SCOPES);
  const stages = readArray(issues, obj, 'stages', path, (v, p) => {
    const r = readObject(issues, v, p, ['id', 'killsToAdvance', 'population', 'roster', 'loot']);
    if (!r) return undefined;
    const sid = readString(issues, r, 'id', p, { pattern: LOCAL_KEY });
    const killsToAdvance = readInt(issues, r, 'killsToAdvance', p, 1, 10_000), population = readInt(issues, r, 'population', p, 1, 250);
    const roster = readArray(issues, r, 'roster', p, (rv, rp) => {
      const e = readObject(issues, rv, rp, ['character', 'weight']);
      const character = e && readId(issues, e, 'character', rp, 'character'), weight = e && readInt(issues, e, 'weight', rp, 1, 100);
      return character && weight !== undefined ? { character, weight } : undefined;
    }, { min: 1, max: 16 });
    const loot = readOptionalId(issues, r, 'loot', p, 'loottable');
    return sid && killsToAdvance !== undefined && population !== undefined && roster && loot !== undefined ? { id: sid, killsToAdvance, population, roster, loot } : undefined;
  }, { min: 1, max: 32 });
  uniqueIds(issues, stages, join(path, 'stages'));
  let boss: EncounterDefinition['boss'] | undefined;
  const b = Object.hasOwn(obj, 'boss') ? readObject(issues, obj.boss, join(path, 'boss'), ['character', 'loot']) : (issues.add('missing-field', join(path, 'boss'), 'required field "boss" is missing'), undefined);
  if (b) {
    const character = readId(issues, b, 'character', join(path, 'boss'), 'character'), loot = readId(issues, b, 'loot', join(path, 'boss'), 'loottable');
    if (character && loot) boss = { character, loot };
  }
  let decay: EncounterDefinition['decay'] | undefined = null;
  if (!Object.hasOwn(obj, 'decay')) issues.add('missing-field', join(path, 'decay'), 'required field "decay" is missing (null for none)');
  else if (obj.decay !== null) {
    const d = readObject(issues, obj.decay, join(path, 'decay'), ['windowSeconds', 'keepProgressPercent']);
    const windowSeconds = d && readInt(issues, d, 'windowSeconds', join(path, 'decay'), 60, 86_400);
    const keepProgressPercent = d && readInt(issues, d, 'keepProgressPercent', join(path, 'decay'), 0, 100);
    decay = windowSeconds !== undefined && keepProgressPercent !== undefined ? { windowSeconds, keepProgressPercent } : undefined;
  }
  if (scope === 'public' && decay === null) issues.add('rule-violation', join(path, 'decay'), 'a public event decays when abandoned, so it cannot hold the world forever');
  const restartSeconds = readInt(issues, obj, 'restartSeconds', path, 0, 604_800);
  let rewards: EncounterDefinition['rewards'] | undefined;
  const rw = Object.hasOwn(obj, 'rewards') ? readObject(issues, obj.rewards, join(path, 'rewards'), ['minContributionPercent']) : (issues.add('missing-field', join(path, 'rewards'), 'required field "rewards" is missing'), undefined);
  if (rw) {
    const minContributionPercent = readInt(issues, rw, 'minContributionPercent', join(path, 'rewards'), 0, 100);
    if (minContributionPercent !== undefined) rewards = { minContributionPercent };
  }
  return issues.finish({
    kind: 'encounter-definition', schemaVersion: 1, id: id!, name: name!, region: region!, scope: scope!, stages: stages!, boss: boss!, decay: decay!,
    restartSeconds: restartSeconds!, rewards: rewards!,
  });
}
