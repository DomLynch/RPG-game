// POST /origins/ground_state, /ground_take: ground loot (docs/specs/backend/ground-loot-brief.md, #2775; donors EQEmu ground_spawns and 2004Scape Obj respawn). A ground item is a ROW
// (origins/world/ground-items.json): a starter item standing at a place, taken ONCE per account per respawn window. Nothing in a body names an item, a quantity, a position or an account.
//   ground_state {}                      every ground item with this account's availability: { instance, item, zone, place, offsetX?, offsetZ?, radiusM, available, availableAt?, visible }
//   ground_take {character, instance}    in this order, all before anything is written: the kill switch (ORIGINS_GROUND=0 -> 503 'off'); the row; the claim read (409 'taken' inside the window);
//                                        presence reach (checked / unchecked, as kill_report does); one-of-each (409 'have-it'); pack room (409 'full'); then ONE transaction (migration 20261015120000):
//                                        claim, mint and event. The mint key is a digest of instance|account|n, so a retry after a lost response mints nothing twice.
// The limits (respawn window, radius, quantity, binding, visibility) are rows; the reach slack and pose age are the worldKill row's (server-rules.json), shared with kill_report.
import { createHash } from 'node:crypto';
import type { CharacterInstanceId, EncounterId, Inventory } from '../../src/core/server.ts';
import { intoBackpack, lookupOf, type EncounterContent } from '../encounters/encounters.ts';
import { worldMetres } from '../presence/zones.ts';
import { groundPointOf } from '../world/ground-point.ts';
import { GROUND_ITEMS, GROUND_LIMITS, type GroundItem, type GroundItems, type GroundLimits } from '../world/ground-items.ts';
import { BadRequest, Refused } from './errors.ts';
import type { Handler } from './handlers.ts';
import { openHoldingsWith } from './holdings.ts';
import { mintOp } from './mob-rewards.ts';
import * as store from './store.ts';
import { POSE_AGE_MS, REACH_SLACK } from './world-spawns.ts';

const CHARACTER = /^pc:[A-Za-z0-9_-]{1,64}$/, INSTANCE = /^ground:[a-z0-9._-]{1,60}$/;
const off = (): never => { throw new Refused(503, 'ground items are off', 'off'); };
const absent = (): never => { throw new Refused(503, 'ground items are not installed yet'); };
const REFUSAL: Record<string, [409 | 422 | 503, string]> = {
  taken: [409, 'already taken: it comes back after its respawn window'], 'have-it': [409, 'you already hold one'], full: [409, 'your pack is full'],
  away: [422, 'too far from it'], unchecked: [422, 'position not checked'], stale: [503, 'the claim moved while this take was paid; try again'],
};
const refuse = (why: string): never => { const [status, message] = REFUSAL[why] ?? [422, why]; throw new Refused(status, message, why); };

export { groundPointOf };   // moved to origins/world/ground-point.ts so the page's pickup prompt reads the same point (it cannot import this file: node:crypto)
/** The take radius: the row's own, else the default row (limits.defaultRadiusM), plus the pose-lag slack. */
export const radiusOf = (row: Pick<GroundItem, 'radiusM'>, limits: GroundLimits = GROUND_LIMITS): number => (row.radiusM ?? limits.defaultRadiusM) + REACH_SLACK;
/** The id the take's mint key and event id hang on: one per (instance, account, claim number). The database derives the same digest and refuses any other key. */
export const groundKillId = (instance: string, account: string, n: number): string => `ground.${createHash('sha256').update(`${instance}|${account}|${n}`).digest('hex').slice(0, 32)}`;

export type GroundTaken = { batch: store.Json[]; item: string; instanceId: string };
/** The pure core of a take: refuse a second copy (one-of-each) or a full pack, else the batch the transaction commits (the event, then the one mint). */
export function groundTakeBatch(a: { account: string; character: string; instance: string; n: number; row: GroundItem; inventory: Inventory; content: EncounterContent; at: string; reach: 'checked' | 'unchecked' }): GroundTaken | { refused: 'have-it' | 'full' } {
  const lookup = lookupOf(a.content);
  if (a.inventory.items.some((i) => i.item === a.row.item)) return { refused: 'have-it' };
  const killId = groundKillId(a.instance, a.account, a.n);
  const got = intoBackpack(a.inventory, { table: `loottable:${a.instance.slice('ground:'.length)}` as never, items: [{ item: a.row.item, quantity: a.row.qty }] as never, metal: 0 }, { wonBy: a.character as CharacterInstanceId, killId, encounter: null as EncounterId | null, at: a.at }, a.content);
  if (!got.ok) return { refused: 'full' };
  const inst = got.value.inventory.items.find((i) => i.id === got.value.received[0])!;
  const event: store.Json = { op: 'event', event_id: `ground:${killId}`, kind: 'mint', account: a.account, character: a.character, payload: { ground: { instance: a.instance, n: a.n, item: a.row.item, qty: a.row.qty, reach: a.reach } } };
  return { batch: [event, mintOp(inst, lookup(inst.item)?.stack === 1)], item: a.row.item, instanceId: inst.id };
}

export type GroundDeps = { content: EncounterContent; items?: GroundItems; limits?: GroundLimits; now?: () => Date; refuseUnchecked?: boolean; log?: (line: string) => void };

export function groundOps(deps: GroundDeps | null): Record<string, Handler> {
  if (!deps) return { ground_state: off, ground_take: off };
  const items = deps.items ?? GROUND_ITEMS, limits = deps.limits ?? GROUND_LIMITS, log = deps.log ?? console.log, now = deps.now ?? (() => new Date());
  const ids = Object.keys(items);
  // Availability from the database's claim and clock: never the writer's.
  const windowOf = (row: GroundItem, claim: store.GroundClaim | undefined, dbNow: string): { available: boolean; availableAt: string | null } => {
    if (!claim) return { available: true, availableAt: null };
    const end = Date.parse(claim.takenAt) + row.respawnSec * 1000;
    return end <= Date.parse(dbNow) ? { available: true, availableAt: null } : { available: false, availableAt: new Date(end).toISOString() };
  };

  const groundState: Handler = async ({ db, account }) => {
    const got = await store.groundState(db, account, ids);
    if (got === null) return absent();
    const claims = new Map(got.takes.map((t) => [t.instance, t]));
    return {
      now: got.now,
      items: ids.map((instance) => {
        const row = items[instance]!, w = windowOf(row, claims.get(instance), got.now);
        return { instance, item: row.item, zone: row.zone, place: row.place, ...(row.offsetX !== undefined ? { offsetX: row.offsetX, offsetZ: row.offsetZ } : {}), radiusM: row.radiusM ?? limits.defaultRadiusM, available: w.available, availableAt: w.availableAt, visible: !(row.hiddenWhileTaken && !w.available) };
      }),
    };
  };

  const groundTake: Handler = async ({ db, account, where }, body) => {
    const { character, instance } = body;
    if (typeof character !== 'string' || !CHARACTER.test(character)) throw new BadRequest('character: a character id');
    if (typeof instance !== 'string' || !INSTANCE.test(instance) || !Object.hasOwn(items, instance)) throw new BadRequest('instance: a ground item');
    const row = items[instance]!, point = groundPointOf(row);
    if (!point) throw new Refused(503, `the server cannot place ${instance}`);
    const state = await store.groundState(db, account, [instance]);
    if (state === null) return absent();
    const claim = state.takes[0], w = windowOf(row, claim, state.now);
    if (!w.available) throw new Refused(409, REFUSAL.taken![1], 'taken');
    // Reach: a fresh placed pose in the item's place within the radius is 'checked'; none is 'unchecked' (refused only when refuseUnchecked is on), as kill_report does.
    const pose = where ? await where(account).catch(() => null) : null;
    let reach: 'checked' | 'unchecked' = 'unchecked';
    if (pose && pose.online && pose.placed && pose.ageMs <= POSE_AGE_MS && pose.zone === row.place) {
      const at = worldMetres(pose.x, pose.z);
      if (Math.hypot(at.x - point.x, at.z - point.z) > radiusOf(row, limits)) return refuse('away');
      reach = 'checked';
    }
    if (reach === 'unchecked' && deps.refuseUnchecked) return refuse('unchecked');
    const n = (claim?.n ?? 0) + 1, lookup = lookupOf(deps.content);
    const { inventory } = await openHoldingsWith(db, account, character, { lookup });
    const taken = groundTakeBatch({ account, character, instance, n, row, inventory, content: deps.content, at: now().toISOString(), reach });
    if ('refused' in taken) return refuse(taken.refused);
    const got = await store.groundTake(db, account, instance, n, row.respawnSec, taken.batch).catch((e: unknown) => { if (e instanceof Error && 'code' in e && (e as { code?: string }).code === 'O0002') return refuse('stale'); throw e; });
    if (got === null) return absent();
    if (typeof got.refused === 'string') return refuse(got.refused);
    log(`ground_take ${instance} n=${n} reach=${reach} item=${taken.item}`);
    return { result: 'taken', instance, item: taken.item, qty: row.qty, availableAt: new Date(now().getTime() + row.respawnSec * 1000).toISOString() };
  };

  return { ground_state: groundState, ground_take: groundTake };
}
