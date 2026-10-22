// POST /origins/spawn_state, /engage, /touch, /kill_report: Zone 1 DETACHED from the Pit (Strategy, Dom's direction 2026-10-08). The world fight is played on the page in real
// time with no duel record; the SERVER owns each creature's life (migration 202610080014; EverQuest's spawn2 pattern: the server holds the spawn point's alive/respawn timer).
//   spawn_state {zone?}            the server's alive/respawn state of every Zone 1 spawn (instance ids = mobSpecs ids, the same pure list the page draws)
//   engage {character, instance, zoneId?}   (zoneId: a loader zone, Zone 1 when absent) a single-use token for a LIVE spawn (one per instance per account, at most 4 open per account); 409 'dead', 429 'too-many'
//   touch {token, hits?}           keeps the token alive 120 s past this touch (fights last 30 s .. 20 min); 409 once used or expired
//   kill_report {token, hits}      consumes the token, marks the spawn dead with the server's respawn clock and pays CP + loot + bronze rolled HERE (mobBatch, the server's seed) in ONE
//                                  transaction. Second lines before anything is written: the hit floor (hits >= ceil(HP / max hit)), the time-to-kill floor (the database checks
//                                  now - issued_at >= minMs), reach (presence's pose, recorded as checked or unchecked; unchecked is refused only when refuseUnchecked is on), kills per minute and per hour (the database).
// No death op: a death costs nothing. Kill switch: ORIGINS_SPAWNS=0 (every op 503 'off'). Nothing in a body names a reward, a level, a seed or an account.
import { randomBytes, randomInt } from 'node:crypto';
import { fightSetup, lookupOf, type EncounterContent } from '../encounters/encounters.ts';
import { mobSpecs, type MobSpec } from '../preview/mobs.ts';
import { worldMetres } from '../presence/zones.ts';
import { reachOf, type LayerCountsFn } from '../presence/where.ts';
import { dynamicRespawnS } from './dynamic-respawn.ts';
import { frontierBuild, frontierPlan } from '../preview/frontier-plan.ts';
import { DEFAULT_ZONE, zoneKeyPrefix } from '../zones/loader.ts';
import { listedZone, listedZoneIds } from '../zones/listed.ts';
import { OPPONENTS, PLAYER_WEAPONS, RULES, worldOpponentAt, weaponOf, CAPS, GAMBIT_ODDS, decodeWorldRecord } from '../../src/fight/server.ts';
import { ROLL_BAND, DROP_REASONS } from '../../src/fight/server.ts';
import { DbError } from './db.ts';
import { BadRequest, Refused } from './errors.ts';
import type { Handler } from './handlers.ts';
import { openHoldingsWith } from './holdings.ts';
import { mobBatch, respawnMsOf } from './mob-rewards.ts';
import { shares } from './damage-share.ts';
import { qaOf } from './qa-account.ts';
import { killWearLines, settleWithWear } from './wear-settle.ts';
import { paceOf } from './pace.ts';
import { ticksFor,MAX_RECORD_CHARS, type HeroLimit, type Verdict, type VerdictTally, type VerifyJob } from './world-verify.ts';
import * as store from './store.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };
import { LOG_TAG_CHARS, MS_PER_SECOND, SEED_LIMIT, TICKS_PER_SECOND, bandMultiplier } from './units.ts';

// ---- the second lines (pure) ------------------------------------------------------------------------------------------------------------
// Zone 1 fights on the Pit's own duel (src/fight/open-fight.ts, #1894): the player is a sheeted hero with his equipped weapon, the creature the Pit's level row (opponentAt). A kill report carries no record, so
// these are BOUNDS that an honest fight can never break (Auditor, #1880): the biggest blow any player weapon's table can deal with every multiplier stacked (a charged heavy, a stop-hit, a blow on a
// downed back, the gear Attack cap, the top of the damage roll, a landed Gambit), and the fastest a first blow can land. With the Pit kit one blow can exceed a low-level creature's health, so the
// hit floor is usually 1 and the time floor is the fastest windup: they stop scripted instant reports, not skilled play. The rest of the anti-cheat is the server's spawn state, the single-use
// engage token and the per-account kill caps (migration 202610080014).
const KILL = SERVER_RULES.worldKill[0]!, SHARE = SERVER_RULES.worldShare[0]!;   // SHARE: the kill-credit rows (damage-share.ts)
export const SLACK = KILL.slack;
const MAX_HITS = KILL.maxHits, ENGAGE_TOKEN_BYTES = KILL.engageTokenBytes;   // rows of the worldKill table: the most hits a report may claim; the random bytes of a spawn-engage token
const BLOWS = PLAYER_WEAPONS.flatMap((w) => Object.values(weaponOf(w).moves));   // the envelope over every weapon a hero may carry (the world hero wields his equipped one), never the longsword alone
const STACK = RULES.charge.damage * Math.max(RULES.stopHit.damage, RULES.counter.damage) * Math.max(RULES.rear.damage, RULES.rear.downed) * Math.max(...Object.values(RULES.location)) * CAPS.attack * bandMultiplier(ROLL_BAND) * GAMBIT_ODDS.multiplier;   // a Special (20 % of max health) is below this for every blow that matters
export const maxHit = (): number => Math.ceil(Math.max(...BLOWS.map((m) => m.damage)) * STACK);
const FASTEST_WINDUP = Math.min(...BLOWS.flatMap((m) => [m.windup, ...(m.chained ? [m.chained.windup] : [])]));
const FASTEST_CYCLE = Math.min(...BLOWS.flatMap((m) => [m.windup + m.active + m.recovery, ...(m.chained ? [m.chained.windup + m.chained.active + m.chained.recovery] : [])]));
export const healthOf = (body: string, level: number): number | null => { const o = (OPPONENTS as Record<string, Parameters<typeof worldOpponentAt>[0] | undefined>)[body]; return o ? worldOpponentAt(o, level).health : null; };
export const minHits = (hp: number): number => Math.max(1, Math.ceil(hp / maxHit()));
export const minKillMs = (hp: number): number => Math.floor((FASTEST_WINDUP + (minHits(hp) - 1) * FASTEST_CYCLE) * MS_PER_SECOND / TICKS_PER_SECOND * SLACK);   // the first blow after the fastest windup, every later one a full fastest cycle on
const LIGHT_REACH = Math.max(...PLAYER_WEAPONS.map((w) => weaponOf(w).moves.light_right?.reach ?? 0));
// Reach: the creature roams `roam` m from home; the longest light cut of any weapon reaches LIGHT_REACH; REACH_SLACK m for presence's pose lag (a pose is at most POSE_AGE_MS old).
export const REACH_SLACK = KILL.reachSlack, POSE_AGE_MS = KILL.poseAgeMs;
export const withinReach = (spec: Pick<MobSpec, 'home' | 'roam'>, at: { x: number; z: number }): boolean =>
  Math.hypot(at.x - spec.home.x, at.z - spec.home.z) <= spec.roam + LIGHT_REACH + REACH_SLACK;

// ---- the spawn list ---------------------------------------------------------------------------------------------------------------------
export type Spawn = { spec: MobSpec; fight: string; hp: number; respawnS: number; loot?: string };   // loot: the spawn row's own loot table (mobBatch rolls it in place of the character's)
// One zone's spawns, priced from THAT zone's own rows (origins/zone-rows/zone<id>.row.json) on its own plan: a Zone 2 kill is checked against Zone 2's creatures and levels, never Zone 1's (Auditor).
export function zoneSpawns(content: EncounterContent, zoneId: string): Map<string, Spawn> {
  const f = frontierPlan(false, zoneId), out = new Map<string, Spawn>();
  const rows = listedZone(zoneId).spawns.rows;
  for (const spec of mobSpecs(f, frontierBuild(f), rows)) {
    const fight = spec.encounter ?? spec.character, hp = healthOf(spec.body, spec.level);
    if (hp === null || !fightSetup(fight, content).ok) continue;   // a creature the server cannot price never engages (fail closed)
    const loot = rows.find((r) => r.id === spec.character)?.loot;
    out.set(spec.id, { spec, fight, hp, respawnS: Math.round(respawnMsOf(fight, content, undefined, zoneId) / MS_PER_SECOND), ...(loot ? { loot } : {}) });
  }
  return out;
}
export const defaultZoneSpawns = (content: EncounterContent): Map<string, Spawn> => zoneSpawns(content, DEFAULT_ZONE);
// The database's spawn key is the spec id as it is: Zone 1 ids are the live rows, Zone N >= 2 ids already carry `z<N>:` (migration 202610090016's rule), so two zones never share a creature's life.
// A zone id is its folder number: one or more digits, no leading zero, no ceiling (migration 202610090017's rule). A key that starts like a zone (`z` and a digit) but does not parse is NOT Zone 1: null,
// and the caller refuses it, so a malformed zone key is never stored or priced as Zone 1.
export const zoneOfKey = (key: string): string | null => /^z[0-9]/.test(key) ? /^z(0|[1-9][0-9]*):/.exec(key)?.[1] ?? null : DEFAULT_ZONE;   // Zone 0 is the town (Dom 2026-10-22): `z0:` parses; `z01:` still does not

// The rule the database column and the writer both read, checked on every registered zone (origins/zone-rows/): ids are numbers without a leading zero, Zone 1 keys are bare, Zone N keys carry
// `z<N>:`, every key fits the table's key check, and no key is in two zones. The writer refuses to start on a problem (scripts/origins-writer.mjs), so a bad new zone row fails at install.
export function zoneKeyProblems(): string[] {
  const problems: string[] = [], seen = new Map<string, string>();
  for (const id of listedZoneIds()) {
    if (!/^(0|[1-9][0-9]*)$/.test(id)) { problems.push(`zone id ${JSON.stringify(id)} is not a number without a leading zero (0 itself is the town)`); continue; }
    const f = frontierPlan(false, id);
    problems.push(...keyProblemsOf(id, mobSpecs(f, frontierBuild(f), listedZone(id).spawns.rows).map((s) => s.id), seen));
  }
  return problems;
}
/** The key rule for ONE zone's creature ids (zoneKeyProblems runs it over every listed zone; the zone package check runs it over a package, listed or not). `seen` carries the ids of the zones already read, so a key in two zones is named. */
export function keyProblemsOf(id: string, keys: readonly string[], seen: Map<string, string> = new Map()): string[] {
  const problems: string[] = [], prefix = zoneKeyPrefix(id);
  for (const key of keys) {
    if (zoneOfKey(key) !== id) problems.push(`${key} reads as zone ${zoneOfKey(key)}, not ${id}`);
    else if (prefix === '' ? /^z[0-9]/.test(key) : !key.startsWith(prefix)) problems.push(`${key}: ${prefix === '' ? `a Zone ${id} key must be bare` : `a Zone ${id} key must start ${prefix}`}`);
    if (!/^[a-z0-9._:-]{1,96}$/.test(key)) problems.push(`${key} does not fit the table's key check`);
    if (seen.has(key)) problems.push(`${key} is in zone ${seen.get(key)} and zone ${id}`);
    seen.set(key, id);
  }
  return problems;
}

const TOKEN = /^[A-Za-z0-9_-]{16,128}$/, CHARACTER = /^pc:[A-Za-z0-9_-]{1,64}$/, INSTANCE = /^[a-z0-9._:-]{1,96}$/;
// Why the page sent a kill without a record (#3151's `drop`): a label for the readout only, never trusted for anything (a kill without a verified record is unverified whatever it says).
// Only the reasons src/fight/record-drop-defs.json lists get their own tally key; anything else the page sends is 'other' (the label is the client's, so an open set would add a key per value
// to the in-memory tally: Lead, #3155). Beside a record it is ignored; absent, the kill is plain 'no record'. Never refused, so a label can never cost an honest kill its report.
export const dropOf = (v: unknown, rec: string | undefined): string | null => (rec !== undefined || v === undefined ? null : typeof v === 'string' && DROP_REASONS.has(v) ? v : 'other');
const recordOf = (v: unknown): string | undefined => { if (v === undefined) return undefined; if (typeof v !== 'string' || v.length === 0 || v.length > MAX_RECORD_CHARS) throw new BadRequest('record: a packed world record'); return v; };
const tokenOf = (v: unknown): string => { if (typeof v !== 'string' || !TOKEN.test(v)) throw new BadRequest('token: an engage token'); return v; };
const hitsOf = (v: unknown, need: boolean): number | undefined => {
  if (v === undefined && !need) return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_HITS) throw new BadRequest('hits: a whole count of landed hits');
  return v;
};
const TOKEN_GONE = 'engage token unknown, used or expired';
const GONE = (e: unknown): never => {
  if (e instanceof DbError && e.code === 'O0009') throw new Refused(409, TOKEN_GONE, 'used');
  if (e instanceof DbError && e.code === 'O0002') throw new Refused(503, 'stale: the character changed while this kill was paid; report again', 'stale');   // a reward line's version moved: nothing written, the token is still open
  throw e;
};
const REFUSAL: Record<string, [409 | 422 | 429, string]> = {
  dead: [409, 'the creature is dead'], 'too-many': [429, 'too many open engages'], cap: [429, 'kill cap reached'],
  'too-fast': [422, 'killed faster than the creature can die'], 'too-few-hits': [422, 'fewer hits than the creature can take'], away: [422, 'too far from the creature'],
  unchecked: [422, 'position not checked'], moved: [409, 'moved to another layer since the engage'], cooldown: [422, 'already killed in another layer within the respawn window'],
};
const refuse = (why: string): never => { const [status, message] = REFUSAL[why] ?? [422, why]; throw new Refused(status, message, why); };
const off = (): never => { throw new Refused(503, 'world spawns are off', 'off'); };
const absent = (): never => { throw new Refused(503, 'world spawns are not installed yet'); };

export type SpawnDeps = { damageShare?: boolean; spawnLayers?: boolean; dynamicRespawn?: boolean; layerCounts?: LayerCountsFn; verifyRecord?: (job: VerifyJob) => Promise<Verdict>; scorecardOnlyUnverified?: boolean; tally?: Pick<VerdictTally, 'add'>; reachTally?: Pick<VerdictTally, 'add'>; heroOf?: (account: string, character: string, version?: number) => Promise<HeroLimit | null>; content: EncounterContent; spawns?: Map<string, Spawn>; zones?: Record<string, Map<string, Spawn>>; refuseUnchecked?: boolean; seed?: () => number; now?: () => Date; log?: (line: string) => void };

export function worldSpawnOps(deps: SpawnDeps | null): Record<string, Handler> {
  if (!deps) return { spawn_state: off, engage: off, touch: off, kill_report: off };
  const { content } = deps, lookup = lookupOf(content), zones = new Map<string, Map<string, Spawn>>(deps.spawns ? [[DEFAULT_ZONE, deps.spawns]] : []);
  // zoneId in a body: one of the loader's zones (Zone 1 when absent); each zone's list is built on first use and kept.
  const zoneOf = (v: unknown): string => { if (v === undefined) return DEFAULT_ZONE; if (typeof v !== 'string' || !listedZoneIds().includes(v)) throw new BadRequest('zoneId: a zone id'); return v; };
  const spawnsOf = (zoneId: string): Map<string, Spawn> => { let z = zones.get(zoneId) ?? (deps.zones?.[zoneId]); if (!z) z = zoneSpawns(content, zoneId); zones.set(zoneId, z); return z; };
  const inflight = new Map<string, number>();   // replays queued per account right now (the worldShare.replaysPerAccount cap)
  const seed = deps.seed ?? (() => randomInt(1, SEED_LIMIT)), now = deps.now ?? (() => new Date()), log = deps.log ?? console.log;

  // The layer an account stands in (presence's copy of the world; docs/specs/origins/per-layer-spawns.md, behind `spawnLayers`). Nothing in a body names a layer: it is presence's word. Off, or an account presence
  // does not hold, or presence unreachable: `undefined` for the layer-less path / layer 1, today's single pool, so an outage degrades to how it was and never stops a kill.
  const FIRST_LAYER = 1;
  const layerOf = async (where: Parameters<Handler>[0]['where'], account: string): Promise<{ layer: number | undefined; known: boolean }> => {
    if (!deps.spawnLayers) return { layer: undefined, known: false };
    if (!where) return { layer: FIRST_LAYER, known: false };
    try { const w = await where(account); return w.online ? { layer: w.layer, known: true } : { layer: FIRST_LAYER, known: false }; } catch { return { layer: FIRST_LAYER, known: false }; }
  };

  const spawnState: Handler = async ({ db, account, where }, body) => {
    const zoneId = zoneOf(body.zoneId), list = [...spawnsOf(zoneId).values()].filter((s) => body.zone === undefined || s.spec.zone === body.zone);
    const got = await store.spawnState(db, list.map((s) => s.spec.id), (await layerOf(where, account)).layer);
    if (got === null) return absent();
    const known = new Map(got.spawns.map((s) => [s.instance, s]));
    return {
      now: got.now,
      spawns: list.map(({ spec }) => {
        const s = known.get(spec.id);
        return { instance: spec.id, kind: spec.character, level: spec.level, alive: s ? s.alive : true, respawnAt: s ? s.respawnAt : null, generation: s ? s.generation : 0 };
      }),
    };
  };

  const engage: Handler = async ({ db, account, where }, body) => {
    const { character, instance } = body;
    if (typeof character !== 'string' || !CHARACTER.test(character)) throw new BadRequest('character: a character id');
    if (typeof instance !== 'string' || !INSTANCE.test(instance) || zoneOfKey(instance) === null) throw new BadRequest('instance: a spawn id');
    const zoneId = zoneOf(body.zoneId), spawn = spawnsOf(zoneId).get(instance);
    if (!spawn) throw new BadRequest(`instance: not a Zone ${zoneId} spawn`);
    const got = await store.spawnEngage(db, account, character, randomBytes(ENGAGE_TOKEN_BYTES).toString('base64url'), instance, spawn.spec.character, (await layerOf(where, account)).layer);
    if (got === null) return absent();
    if (typeof got.refused === 'string') return refuse(got.refused);
    return { token: got.token, instance, zoneId, generation: got.generation, kind: spawn.spec.character, level: spawn.spec.level, hp: spawn.hp, expiresAt: got.expiresAt };
  };

  const touch: Handler = async ({ db, account }, body) => {
    hitsOf(body.hits, false);
    const got = await store.spawnTouch(db, account, tokenOf(body.token)).catch(GONE);
    if (got === null) return absent();
    return { expiresAt: got.expiresAt };
  };

  // A kill report for a token that is not open (launch gate V5): answer from the account's own stored rows what became of it. 409 `code` stays 'used' and the message stays the old one, so a page that
  // knows nothing of `kind` behaves as before; `kind` is 'paid' (with the stored `receipt`, never recomputed), 'expired' (closed unpaid) or 'unknown' (not this account's, or never existed: nothing
  // about the token leaks). A receipt that cannot be read (migration absent, database error) is the plain old 409, never a 500, and nothing is paid on this path.
  const usedToken = async (db: Parameters<Handler>[0]['db'], account: string, token: string): Promise<never> => {
    const r = await store.spawnReceipt(db, account, token).catch(() => null);
    const kind = r === null || r === undefined ? undefined : r === 'unknown' ? 'unknown' : r.kind === 'open' ? undefined : r.kind;
    log(`kill_report ${token.slice(-LOG_TAG_CHARS)}: 409 ${kind ?? 'unread'}`);   // the IM soak counts these by kind
    const detail = kind === undefined ? undefined : r !== null && r !== 'unknown' && r.kind === 'paid' ? { kind, receipt: { instance: r.instance, killedAt: r.killedAt, cp: r.cp, bronze: r.bronze, loot: r.loot } } : { kind };
    throw new Refused(409, TOKEN_GONE, 'used', detail);
  };
  const killReport: Handler = async ({ db, account, where }, body) => {
    const arrivedMs = now().getTime();   // read once: the verifier's queue and run time must not count as the client's wall time (pace flag, Auditor on #3522)
    const token = tokenOf(body.token), hits = hitsOf(body.hits, true)!, recText = recordOf(body.record), drop = dropOf(body.drop, recText);
    const open = await store.spawnEngageGet(db, account, token);
    if (open === null) return absent();
    if (open === 'none') return usedToken(db, account, token);
    const zone0 = zoneOfKey(open.instance), spawn = zone0 !== null && listedZoneIds().includes(zone0) ? spawnsOf(zone0).get(open.instance) : undefined;   // an unparsable zone key has no spawn: refused below, never read as Zone 1   // the token's own zone, read from its database key
    if (!spawn) throw new Refused(409, 'engage token names a spawn this server no longer has', 'dead');
    if (hits < minHits(spawn.hp)) return refuse('too-few-hits');
    // The token binds its layer (migration 20261019170000). If presence now says the account stands in ANOTHER layer the kill is refused 'moved' (writes nothing, the token stays open until it expires), so a hop
    // mid-fight cannot carry a fight across copies. Presence unable to answer: the kill pays on the token's own layer, unchecked, as reach is.
    const layer = deps.spawnLayers === true ? open.layer : undefined;
    if (layer !== undefined) {
      const stands = await layerOf(where, account);
      if (stands.known && stands.layer !== layer) { log(`kill_report ${token.slice(-LOG_TAG_CHARS)} ${open.instance}: refused moved (layer ${layer} -> ${stands.layer})`); return refuse('moved'); }
    }
    // Dynamic respawn (behind `dynamicRespawn`, rows `dynamicRespawn`): a layer holding more than the row's players respawns its creatures faster, down to a floor, so a crowded layer does not starve. It changes ONLY the spawn's
    // own clock (the SQL kill functions take the same p_respawn_s for respawn_at AND for the cross-layer hop window, so the shortened value would shrink that window too). The row window is held by the damage-share
    // pre-check below, which passes spawn.respawnS (the ROW's) to origins_spawn_check_layer before the kill; so the writer refuses ORIGINS_DYNAMIC_RESPAWN unless ORIGINS_DAMAGE_SHARE is on (spawn-flags.ts). No count
    // (flag off, presence unreachable or older): the row's respawn.
    let respawnS = spawn.respawnS;
    if (deps.dynamicRespawn && layer !== undefined && deps.layerCounts) respawnS = dynamicRespawnS(spawn.respawnS, (await deps.layerCounts().catch(() => null))?.players[layer]);
    // Reach: a fresh placed pose in the spawn's zone is checked (too far = refused). Anything else is 'unchecked', and an unchecked kill PAYS IN FULL unless `refuseUnchecked`
    // (ORIGINS_SPAWN_REFUSE_UNCHECKED=1) turns it into a 422; the ledger row only records which it was. The v2 presence client is shipped and on by default (presence-client.ts), so the flip waits on the
    // measured checked rate (Auditor 2026-10-18: 0 of the first live kills were checked), not on a client. The why is in the log line.
    const seen = await reachOf(where, account, spawn.spec.zone, POSE_AGE_MS);
    let reach: 'checked' | 'unchecked' = 'unchecked';
    if (seen.pose) {
      if (!withinReach(spawn.spec, worldMetres(seen.pose.x, seen.pose.z))) return refuse('away');
      reach = 'checked';
    }
    const qaState = await qaOf(db, account), qa = qaState === 'yes', cohort = qa ? 'qa' : 'organic';   // the QA account (fighter_profiles.is_test): it counts (checks, tallies, split by cohort) but persists nothing
    deps.reachTally?.add(reach === 'checked' ? 'checked' : seen.why.split(':')[0]!, cohort);   // the flip readout's reach count (flipReadiness): checked, or the why's kind (offline, other-zone, ...)
    if (reach === 'unchecked' && deps.refuseUnchecked) { log(`kill_report ${token.slice(-LOG_TAG_CHARS)} ${open.instance}: refused unchecked (${seen.why})`); return refuse('unchecked'); }
    // Kill credit by damage (Dom 2026-10-19; damage-share.ts, migration 20261019113226), behind `damageShare`. Winner-first: the database says whether this report would be refused (dead, too fast, over a
    // cap) BEFORE any replay is queued, so a report that cannot pay never costs a replay; and whether it is the creature's first kill or a join to a kill made while this token was open.
    let sharing: { joined: boolean; generation: number } | null = null;
    if (deps.damageShare) {
      const chk = await store.spawnCheck(db, account, token, minKillMs(spawn.hp), SHARE.joinWindowS, layer === undefined ? undefined : spawn.respawnS).catch((e: unknown) => (e instanceof DbError && e.code === 'O0009' ? usedToken(db, account, token) : GONE(e)));
      if (chk !== null) {   // null = the migration is not applied: the old way (first valid report wins)
        if (typeof chk.refused === 'string') return refuse(chk.refused);
        sharing = { joined: chk.mode === 'join', generation: chk.generation ?? open.generation };
      }
    }
    const setup = fightSetup(spawn.fight, content, { level: spawn.spec.level });   // the spawn's own level (mobSpecs, by distance), never the form's: a level-1 wolf pays level-1 CP and loot
    if (!setup.ok) throw new Refused(503, `the server cannot price ${spawn.fight}`);
    const at = now().toISOString(), { inventory, snap } = await openHoldingsWith(db, account, open.character, { lookup });
    const metal = await store.metalOf(db, account);
    const kill = { account, character: open.character, token, fight: spawn.fight, seed: seed(), enemy: setup.value.opponent.body, level: setup.value.opponent.level, twist: null };
    // The record (BASE): replayed on the server. During the soak every kill pays as before whatever the record says (verdict logged, with its reason); with scorecardOnlyUnverified
    // (ORIGINS_WORLD_RECORD_SCORECARD_ONLY=1) a kill without a verified record books the scorecard event only (no CP, loot or bronze).
    let record = recText === undefined ? 'none' : 'unverified', verdict: Verdict | null = null;
    if (recText === undefined) deps.tally?.add(drop ? `dropped: ${drop}` : 'no record', cohort);   // the readout tells "the page dropped its window (and why)" apart from "no record at all"
    if (recText !== undefined) {
      const tag = `kill_report ${token.slice(-LOG_TAG_CHARS)} ${open.instance}`;
      const run = async (): Promise<Verdict> => {
        if (!deps.verifyRecord) return { ok: false, reason: 'no verifier' };
        const rv = deps.heroOf ? (await decodeWorldRecord(recText).catch(() => null))?.rv : undefined;   // the claim's own record version: the worn set is held to the rules of the era the page recorded under, not this build's
        const limit = deps.heroOf ? await deps.heroOf(account, open.character, rv).catch(() => null) : null;
        const v = await deps.verifyRecord({ text: recText, spawn: { spec: spawn.spec }, kind: setup.value.opponent.body, limit, token, maxTicks: ticksFor((arrivedMs - Date.parse(open.issuedAt)) / MS_PER_SECOND) });
        deps.tally?.add(v.ok ? 'verified' : v.reason, cohort);
        log(v.ok ? `${tag}: world record verified (${v.ticks} ticks)` : `${tag}: world record not verified (${v.reason})`);
        return v;
      };
      if (deps.scorecardOnlyUnverified || sharing) {   // strict, or kill credit by damage (which needs the replay's damage before it pays): the verdict is awaited
        const n = inflight.get(account) ?? 0;
        if (sharing && n >= SHARE.replaysPerAccount) { deps.tally?.add('replay-capped', cohort); record = 'replay-capped'; }   // a per-account cap on queued replays, ONLY with damageShare on (flag off is the old path, strict included): the rest answer without one (an unreplayed kill pays as before unless strict; a join without a verified record is refused)
        else {
          inflight.set(account, n + 1);
          try { verdict = await run(); } finally { const m = (inflight.get(account) ?? 1) - 1; if (m <= 0) inflight.delete(account); else inflight.set(account, m); }
          record = verdict.ok ? 'verified' : `refused: ${verdict.reason}`;
        }
      }
      else { record = 'queued'; void run().catch(() => {}); }   // flag off: the kill pays now, the worker's verdict is only logged
    }
    // The share of the kill's credit. Only a record that VERIFIED speaks for the damage: its replayed damage to this creature, set against what earlier reports on this incarnation dealt (damage-share.ts: a
    // full bar alone is a solo kill at 100%, otherwise qualifiers split by damage). No verified damage is 0 damage, never the creature's health (Auditor, #3303 F1): the FIRST kill of a creature without a
    // verified record pays as before (the old path paid every first report; share 1, nothing recorded in the ledger), but a JOIN has no old path to match (it used to answer 'dead'), so a join without a
    // verified record is refused 'dead' and pays nothing.
    let share = 1, damage = 0;
    if (sharing) {
      if (verdict?.ok) {
        damage = verdict.damage ?? 0;
        const prior = await store.spawnDamage(db, open.instance, sharing.generation, layer).catch(() => null) ?? [];
        share = shares([...prior.map((p) => ({ id: p.token, damage: p.damage })), { id: token, damage }], spawn.hp, SHARE).get(token) ?? 0;
      } else if (sharing.joined) return refuse('dead');
    }
    const pays = (record === 'verified' || deps.scorecardOnlyUnverified !== true) && !qa && share > 0;
    const paid = pays ? mobBatch(kill, { career: snap.career, inventory, metal }, content, at, { level: spawn.spec.level, loot: spawn.loot, share })
      : { batch: [] as store.Json[], summary: { cp: 0, cpReason: qa ? 'qa' : 'unverified', drops: [] as string[], bronze: 0, lootRefused: null, unpaid: [] as string[] } };
    const event: store.Json = {
      op: 'event', event_id: `enc:${token}`, kind: 'mob', account, character: open.character,
      payload: { result: 'won', world: true, instance: open.instance, generation: open.generation, fight: spawn.fight, hits, reach, ...(recText !== undefined || deps.scorecardOnlyUnverified ? { record } : {}), cp: paid.summary.cp, cpReason: paid.summary.cpReason, paid: paid.batch.length > 0, beta: true, ...(qa ? { qa: true } : {}) },
    };
    const pace = verdict?.ok ? paceOf((arrivedMs - Date.parse(open.issuedAt)) / MS_PER_SECOND, verdict.ticks) : null;   // flag only (Lead + Strategy 2026-10-21): the wall/sim ratio rides the event, nothing is refused
    if (pace) Object.assign(event.payload as object, { pace });
    if (sharing) Object.assign(event.payload as object, { share, damage, joined: sharing.joined });   // the kill credit's own receipt in the event (only with damageShare)
    const commit = (wear: store.Json[]) => (sharing
      ? store.spawnKillShared(db, account, token, minKillMs(spawn.hp), respawnS, [event, ...paid.batch, ...wear], { reach }, damage, SHARE.joinWindowS)
      : store.spawnKill(db, account, token, minKillMs(spawn.hp), respawnS, [event, ...paid.batch, ...wear], { reach })).catch((e: unknown) => (e instanceof DbError && e.code === 'O0009' ? usedToken(db, account, token) : GONE(e)));   // a duplicate that raced the first report reads its receipt too
    const got = pays
      ? await settleWithWear({ db, account, ownEventId: `enc:${token}`, wear: () => killWearLines(db, { account, character: open.character, token }, inventory), commit })
      : await commit([]);
    if (got === null) return absent();
    if (typeof got.refused === 'string') return refuse(got.refused);
    log(`kill_report ${token.slice(-LOG_TAG_CHARS)} ${open.instance}: ${JSON.stringify(paid.summary)} reach=${reach}${reach === 'unchecked' ? ` (${seen.why})` : ''} record=${record}${drop ? ` (dropped: ${drop})` : ''} qa=${qaState}${layer === undefined ? '' : ` layer=${layer}${respawnS === spawn.respawnS ? '' : ` respawn=${respawnS}s(row ${spawn.respawnS}s)`}`}${sharing ? ` share=${share} damage=${damage}${sharing.joined ? ' joined' : ''}` : ''}`);
    return { result: 'killed', instance: open.instance, zoneId: zone0, respawnAt: got.respawnAt, loot: countLoot(paid.summary.drops), cp: paid.summary.cp, bronze: paid.summary.bronze, beta: true, ...(sharing ? { share, joined: sharing.joined } : {}) };
  };

  return { spawn_state: spawnState, engage, touch, kill_report: killReport };
}

const countLoot = (drops: readonly string[]): { item: string; quantity: number }[] => {
  const n = new Map<string, number>();
  for (const d of drops) n.set(d, (n.get(d) ?? 0) + 1);
  return [...n].map(([item, quantity]) => ({ item, quantity }));
};
