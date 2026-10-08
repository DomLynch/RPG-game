// POST /origins/spawn_state, /engage, /touch, /kill_report: Zone 1 DETACHED from the Pit (Strategy, Dom's direction 2026-10-08). The world fight is played on the page in real
// time with no duel record; the SERVER owns each creature's life (migration 202610080014; EverQuest's spawn2 pattern: the server holds the spawn point's alive/respawn timer).
//   spawn_state {zone?}            the server's alive/respawn state of every Zone 1 spawn (instance ids = mobSpecs ids, the same pure list the page draws)
//   engage {character, instance}   a single-use token for a LIVE spawn (one per instance per account, at most 4 open per account); 409 'dead', 429 'too-many'
//   touch {token, hits?}           keeps the token alive 120 s past this touch (fights last 30 s .. 20 min); 409 once used or expired
//   kill_report {token, hits}      consumes the token, marks the spawn dead with the server's respawn clock and pays CP + loot + bronze rolled HERE (mobBatch, the server's seed) in ONE
//                                  transaction. Second lines before anything is written: the hit floor (hits >= ceil(HP / max hit)), the time-to-kill floor (the database checks
//                                  now - issued_at >= minMs), reach (presence's pose, when presence has one in the Frontier frame), kills per minute and per hour (the database).
// No death op: a death costs nothing. Kill switch: ORIGINS_SPAWNS=0 (every op 503 'off'). Nothing in a body names a reward, a level, a seed or an account.
import { randomBytes, randomInt } from 'node:crypto';
import { fightSetup, lookupOf, type EncounterContent } from '../encounters/encounters.ts';
import { mobSpecs, type MobSpec } from '../preview/mobs.ts';
import { frontierBuild, frontierPlan } from '../preview/frontier-plan.ts';
import { MOVES, OPPONENTS } from '../../src/moves.ts';
import { DbError } from './db.ts';
import { BadRequest, Refused } from './errors.ts';
import type { Handler } from './handlers.ts';
import { openHoldingsWith } from './holdings.ts';
import { mobBatch, respawnMsOf } from './mob-rewards.ts';
import * as store from './store.ts';

// ---- the second lines (pure) ------------------------------------------------------------------------------------------------------------
// The player's fastest damage in the detached loop (Combat's origins/combat/zone1.ts): the light cut, chained (16 + 8 + 18 ticks at 60 Hz), at most ATTACK_CAP times its row damage
// (headroom for gear Attack; zone1 applies none today). SLACK forgives clock and network jitter. A report faster or with fewer hits than this cannot be a real kill.
export const ATTACK_CAP = 1.5, SLACK = 0.5;
const LIGHT = MOVES.light_right, CYCLE_MS = ((LIGHT.chained?.windup ?? LIGHT.windup) + LIGHT.active + (LIGHT.chained?.recovery ?? LIGHT.recovery)) * 1000 / 60;
export const maxHit = (): number => Math.ceil(LIGHT.damage * ATTACK_CAP);
export const healthOf = (body: string): number | null => (OPPONENTS as Record<string, { health: number } | undefined>)[body]?.health ?? null;
export const minHits = (hp: number): number => Math.ceil(hp / maxHit());
export const minKillMs = (hp: number): number => Math.floor((minHits(hp) - 1) * CYCLE_MS * SLACK);   // the first cut lands at once; every later one waits a chained cycle
// Reach: the creature roams `roam` m from home; the cut reaches LIGHT.reach; REACH_SLACK m for presence's pose lag (a pose is at most POSE_AGE_MS old).
export const REACH_SLACK = 4, POSE_AGE_MS = 5000;
export const withinReach = (spec: Pick<MobSpec, 'home' | 'roam'>, at: { x: number; z: number }): boolean =>
  Math.hypot(at.x - spec.home.x, at.z - spec.home.z) <= spec.roam + LIGHT.reach + REACH_SLACK;

// ---- the spawn list ---------------------------------------------------------------------------------------------------------------------
export type Spawn = { spec: MobSpec; fight: string; hp: number; respawnS: number };
export function zone1Spawns(content: EncounterContent): Map<string, Spawn> {
  const f = frontierPlan(), out = new Map<string, Spawn>();
  for (const spec of mobSpecs(f, frontierBuild(f))) {
    const fight = spec.encounter ?? spec.character, hp = healthOf(spec.body);
    if (hp === null || !fightSetup(fight, content).ok) continue;   // a creature the server cannot price never engages (fail closed)
    out.set(spec.id, { spec, fight, hp, respawnS: Math.round(respawnMsOf(fight, content) / 1000) });
  }
  return out;
}

const TOKEN = /^[A-Za-z0-9_-]{16,128}$/, CHARACTER = /^pc:[A-Za-z0-9_-]{1,64}$/, INSTANCE = /^[a-z0-9._:-]{1,96}$/;
const tokenOf = (v: unknown): string => { if (typeof v !== 'string' || !TOKEN.test(v)) throw new BadRequest('token: an engage token'); return v; };
const hitsOf = (v: unknown, need: boolean): number | undefined => {
  if (v === undefined && !need) return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 10_000) throw new BadRequest('hits: a whole count of landed hits');
  return v;
};
const GONE = (e: unknown): never => {
  if (e instanceof DbError && e.code === 'O0009') throw new Refused(409, 'engage token unknown, used or expired', 'used');
  if (e instanceof DbError && e.code === 'O0002') throw new Refused(503, 'stale: the character changed while this kill was paid; report again', 'stale');   // a reward line's version moved: nothing written, the token is still open
  throw e;
};
const REFUSAL: Record<string, [409 | 422 | 429, string]> = {
  dead: [409, 'the creature is dead'], 'too-many': [429, 'too many open engages'], cap: [429, 'kill cap reached'],
  'too-fast': [422, 'killed faster than the creature can die'], 'too-few-hits': [422, 'fewer hits than the creature can take'], away: [422, 'too far from the creature'],
};
const refuse = (why: string): never => { const [status, message] = REFUSAL[why] ?? [422, why]; throw new Refused(status, message, why); };
const off = (): never => { throw new Refused(503, 'world spawns are off', 'off'); };
const absent = (): never => { throw new Refused(503, 'world spawns are not installed yet'); };

export type SpawnDeps = { content: EncounterContent; spawns?: Map<string, Spawn>; seed?: () => number; now?: () => Date; log?: (line: string) => void };

export function worldSpawnOps(deps: SpawnDeps | null): Record<string, Handler> {
  if (!deps) return { spawn_state: off, engage: off, touch: off, kill_report: off };
  const { content } = deps, spawns = deps.spawns ?? zone1Spawns(content), lookup = lookupOf(content);
  const seed = deps.seed ?? (() => randomInt(1, 2 ** 31)), now = deps.now ?? (() => new Date()), log = deps.log ?? console.log;

  const spawnState: Handler = async ({ db }, body) => {
    const list = [...spawns.values()].filter((s) => body.zone === undefined || s.spec.zone === body.zone);
    const got = await store.spawnState(db, list.map((s) => s.spec.id));
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

  const engage: Handler = async ({ db, account }, body) => {
    const { character, instance } = body;
    if (typeof character !== 'string' || !CHARACTER.test(character)) throw new BadRequest('character: a character id');
    if (typeof instance !== 'string' || !INSTANCE.test(instance)) throw new BadRequest('instance: a spawn id');
    const spawn = spawns.get(instance);
    if (!spawn) throw new BadRequest('instance: not a Zone 1 spawn');
    const got = await store.spawnEngage(db, account, character, randomBytes(24).toString('base64url'), instance, spawn.spec.character);
    if (got === null) return absent();
    if (typeof got.refused === 'string') return refuse(got.refused);
    return { token: got.token, instance, generation: got.generation, kind: spawn.spec.character, level: spawn.spec.level, hp: spawn.hp, expiresAt: got.expiresAt };
  };

  const touch: Handler = async ({ db, account }, body) => {
    hitsOf(body.hits, false);
    const got = await store.spawnTouch(db, account, tokenOf(body.token)).catch(GONE);
    if (got === null) return absent();
    return { expiresAt: got.expiresAt };
  };

  const killReport: Handler = async ({ db, account, where }, body) => {
    const token = tokenOf(body.token), hits = hitsOf(body.hits, true)!;
    const open = await store.spawnEngageGet(db, account, token);
    if (open === null) return absent();
    if (open === 'none') throw new Refused(409, 'engage token unknown, used or expired', 'used');
    const spawn = spawns.get(open.instance);
    if (!spawn) throw new Refused(409, 'engage token names a spawn this server no longer has', 'dead');
    if (hits < minHits(spawn.hp)) return refuse('too-few-hits');
    // Reach: presence's pose when it has a fresh one inside the Frontier's zones; presence holds only the Concord square today, so an unplaced player is recorded as unchecked.
    let reach = 'unchecked';
    if (where) {
      const w = await where(account).catch(() => null);
      if (w && w.online && w.placed && w.ageMs <= POSE_AGE_MS && w.zone === spawn.spec.zone) {
        if (!withinReach(spawn.spec, { x: w.x / 100, z: w.z / 100 })) return refuse('away');
        reach = 'ok';
      }
    }
    const setup = fightSetup(spawn.fight, content);
    if (!setup.ok) throw new Refused(503, `the server cannot price ${spawn.fight}`);
    const at = now().toISOString(), { inventory, snap } = await openHoldingsWith(db, account, open.character, { lookup });
    const metal = await store.metalOf(db, account);
    const kill = { account, character: open.character, token, fight: spawn.fight, seed: seed(), enemy: setup.value.opponent.body, level: setup.value.opponent.level, twist: null };
    const paid = mobBatch(kill, { career: snap.career, inventory, metal }, content, at);
    const event: store.Json = {
      op: 'event', event_id: `enc:${token}`, kind: 'mob', account, character: open.character,
      payload: { result: 'won', world: true, instance: open.instance, generation: open.generation, fight: spawn.fight, hits, reach, paid: paid.batch.length > 0, beta: true },
    };
    const got = await store.spawnKill(db, account, token, minKillMs(spawn.hp), spawn.respawnS, [event, ...paid.batch]).catch(GONE);
    if (got === null) return absent();
    if (typeof got.refused === 'string') return refuse(got.refused);
    log(`kill_report ${token.slice(-6)} ${open.instance}: ${JSON.stringify(paid.summary)} reach=${reach}`);
    return { result: 'killed', instance: open.instance, respawnAt: got.respawnAt, loot: countLoot(paid.summary.drops), cp: paid.summary.cp, bronze: paid.summary.bronze, beta: true };
  };

  return { spawn_state: spawnState, engage, touch, kill_report: killReport };
}

const countLoot = (drops: readonly string[]): { item: string; quantity: number }[] => {
  const n = new Map<string, number>();
  for (const d of drops) n.set(d, (n.get(d) ?? 0) + 1);
  return [...n].map(([item, quantity]) => ({ item, quantity }));
};
