// POST /origins/encounter_start, /encounter_touch, /encounter_settle: server-authoritative world creature fights (docs/specs/origins/server-save-schema.md ruling 6; migration 202610080002).
//   start  {character, encounter, tick?, pose?}   the WRITER resolves the fight (foe, level, pool, twist flags, mob layer, shared creature) from `encounter` and picks the seed; it issues the token and
//                                          answers with everything the client needs to play the same fight. Nothing in the body names a foe, a level, a seed, a reward or an account.
//   touch  {token, tick}                   inside the reconnect grace: the SAME token and seed continue (the grace restarts); refused once settled, used or expired.
//   settle {token, record, swaps?}         the posted duel record is re-simulated with the SERVER's parameters (verifyEncounter, the Pit's verifier pattern). Only a verified record writes
//                                          anything: the event `enc:<token>` (kind 'mob') and the reward lines `rewards` returns, in one transaction with the token's consumption. An unverified record is
//                                          a normal loss (the token is consumed, nothing is paid), never a reward and never a harsher penalty. An open fight whose grace runs out is settled by the sweep
//                                          (store.encounterExpire) as a loss by abandonment.
// Fail closed: with no deps (the flag off, or no verifier installed) every op answers 503 "encounter verify not installed"; an unknown mob layer or a non-empty `swaps` (Combat's swap hook is not
// shipped) is refused rather than guessed; a database without the migration answers 503.
import { randomBytes, randomInt } from 'node:crypto';
import { wornGearOf } from './worn-gear.ts';
import { practiceLines } from './practice.ts';
import { settleWithWear, type KillWear } from './wear-settle.ts';
import { spellLines } from './grimoire.ts';
import { expectedSpell, type SpellClaim } from './spell-check.ts';
import { careerState, levelOfCredit } from '../../src/core/server.ts';
import { decodeRecord, type TwistFlag, type DuelPose, expectedSheet } from '../../src/fight/server.ts';
import { DbError, type Db } from './db.ts';
import { BadRequest, Conflict, Refused } from './errors.ts';
import type { Handler } from './handlers.ts';
import * as store from './store.ts';
import { knownLayer, type VerifyEncounter } from './encounter-verify.ts';
import { issuePose, packPose, unpackPose } from './encounter-pose.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };

// What `resolve` returns for a fight the character may start (Expansion's FightSetup, reduced to what the server holds and re-simulates).
export type Resolved = { enemy: string; level: number; bar: number | null; flags: readonly TwistFlag[]; layer: string | null; instance: string | null };
export type EncounterDeps = {
  resolve(who: { account: string; character: string }, encounter: string): Resolved | null;   // null: unknown fight, or not open to this character
  verify: VerifyEncounter;
  // Extra batch lines for a VERIFIED fight (CP/loot/metal ops built from the server's own result); none by default. Never called for a loss. `fight` is the
  // fight id the server resolved at start (fightOfToken), null for a token issued before it carried one; `seed` is the server's; `db` is read-only here
  // (the lines commit in settle's one transaction, so a stale read aborts the whole settle and the token stays open for a retry).
  rewards?(fight: { account: string; character: string; token: string; fight: string | null; seed: number; enemy: string; level: number; twist: string | null }, db: Db): store.Json[] | Promise<store.Json[]>;
  // The wear a PAID kill leaves on one equipped piece (wear-settle.ts); committed in the same transaction, retried once on a wear-seq clash and then dropped, never a failed payment.
  wear?: KillWear;
  now?: () => number;   // the clock the expiry pre-check reads (tests); the database's now() decides at settle regardless
};

const TOKEN = /^[A-Za-z0-9_-]{16,128}$/, CHARACTER = /^pc:[A-Za-z0-9_-]{1,64}$/, FIGHT = /^[a-z0-9._:-]{1,64}$/;
// The token carries the fight id the server resolved at start: base64url(fight) + '_' + 32 random characters (24 bytes). The run row keeps only the foe and level,
// and two fights can share both (Region 1: two goblin L11 creatures with different loot tables), so settle must not guess the fight back, nor take it from the client.
// Only a token the database holds is ever settled, so the prefix is the server's own choice. A token without one (issued before this) reads as null.
const TOKEN_RULE = SERVER_RULES.encounterToken[0]!;
const RANDOM = Math.ceil(TOKEN_RULE.randomBytes * 4 / 3);   // base64url: 4 characters per 3 bytes
// A POSED fight (seamless step 3, encounter-pose.ts) carries the server's issued pose the same way: the prefix is base64url(fight, a 0 byte, the five float32 of the pose), so settle
// re-simulates from the pose the server issued and the record must name exactly it. A fight id is never longer than 50 characters in a posed token (the 128-character token cap).
export const POSED_FIGHT_MAX = TOKEN_RULE.posedFightMax;
export const tokenFor = (fight: string, pose?: DuelPose): string =>
  `${(pose ? Buffer.concat([Buffer.from(fight), Buffer.of(0), packPose(pose)]) : Buffer.from(fight)).toString('base64url')}_${randomBytes(TOKEN_RULE.randomBytes).toString('base64url')}`;
const prefixOf = (token: string): { fight: string; pose: DuelPose | null } | null => {
  if (token.length <= RANDOM + 1 || token[token.length - RANDOM - 1] !== '_') return null;
  const raw = Buffer.from(token.slice(0, -RANDOM - 1), 'base64url'), cut = raw.indexOf(0);
  const fight = (cut < 0 ? raw : raw.subarray(0, cut)).toString();
  if (!FIGHT.test(fight)) return null;
  if (cut < 0) return { fight, pose: null };
  const pose = unpackPose(raw.subarray(cut + 1));
  return pose ? { fight, pose } : null;
};
export const fightOfToken = (token: string): string | null => prefixOf(token)?.fight ?? null;
export const poseOfToken = (token: string): DuelPose | null => prefixOf(token)?.pose ?? null;
const GONE = (e: unknown): never => {
  if (e instanceof DbError && e.code === 'O0009') throw new Conflict('encounter token unknown, used or expired');
  if (e instanceof DbError && e.code === 'O0002') throw new Refused(503, 'stale: the character changed while this fight was settled; settle again', 'stale');   // a reward line's expected_version moved: nothing was written and the token is still open. A 503, not a 409: the page treats a settle 409 as "already settled" and would drop the win; it retries a 5xx
  throw e;
};
const notInstalled = (): never => { throw new Refused(503, 'encounter verify not installed'); };
const tick = (v: unknown, name: string): number => {
  if (v === undefined) return 0;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 1e9) throw new BadRequest(`${name}: a whole tick count`);
  return v;
};
const tokenOf = (v: unknown): string => { if (typeof v !== 'string' || !TOKEN.test(v)) throw new BadRequest('token: an encounter token'); return v; };
const view = (r: store.EncounterRun) => ({ ...withPose(r.token), token: r.token, seed: r.seed, enemy: r.enemy, level: r.level, bar: r.bar, flags: r.flags, layer: r.layer, startTick: r.start_tick, lastTick: r.last_tick, graceS: r.grace_s, expiresAt: r.expires_at });

const withPose = (token: string): { pose?: DuelPose } => { const pose = poseOfToken(token); return pose ? { pose } : {}; };   // the client plays with match.startPose = exactly this (a touch hands it back for a reconnect)

export function encounterOps(deps: EncounterDeps | null): Record<string, Handler> {
  if (!deps) return { encounter_start: notInstalled, encounter_touch: notInstalled, encounter_settle: notInstalled };
  const { resolve, verify } = deps;

  const start: Handler = async ({ db, account }, body) => {
    const { character, encounter } = body;
    if (typeof character !== 'string' || !CHARACTER.test(character)) throw new BadRequest('character: a character id');
    if (typeof encounter !== 'string' || !FIGHT.test(encounter)) throw new BadRequest('encounter: a fight id');
    const startTick = tick(body.tick, 'tick');
    const fight = resolve({ account, character }, encounter);
    if (!fight) throw new BadRequest('encounter: unknown, or not open to this character');
    if (fight.layer !== null && !knownLayer(fight.layer)) throw new Refused(503, `encounter verify does not know the mob layer ${fight.layer}`);   // fail closed: it could never verify
    const pose = issuePose(fight.enemy, body.pose);   // undefined: no pose asked, the pit-mark fight as before
    if (pose && encounter.length > POSED_FIGHT_MAX) throw new BadRequest(`encounter: a posed fight id is at most ${POSED_FIGHT_MAX} characters`);
    const token = tokenFor(encounter, pose), seed = randomInt(1, 2 ** 31);
    let run: store.EncounterRun | null;
    try { run = await store.encounterStart(db, account, character, { token, seed, enemy: fight.enemy, level: fight.level, tick: startTick, bar: fight.bar, flags: fight.flags, layer: fight.layer, instance: fight.instance }); }
    catch (e) { if (e instanceof DbError && e.code === 'O0014') throw new Conflict(e.message); throw e; }
    if (!run) throw new Refused(503, 'encounters are not installed yet');
    return view(run);
  };

  const touch: Handler = async ({ db, account }, body) => {
    const run = await store.encounterTouch(db, account, tokenOf(body.token), tick(body.tick, 'tick')).catch(GONE);
    if (!run) throw new Refused(503, 'encounters are not installed yet');
    return view(run);
  };

  const settle: Handler = async ({ db, account }, body) => {
    const token = tokenOf(body.token);
    if (typeof body.record !== 'string' || body.record.length < 8 || body.record.length > 60_000) throw new BadRequest('record: a packed duel record');
    if (body.swaps !== undefined && !(Array.isArray(body.swaps) && body.swaps.length === 0)) throw new Refused(501, 'camp swaps are not installed yet', 'not-implemented');   // validated, never applied (Combat ships the hook)
    const run = await store.encounterGet(db, account, token);
    if (run === null) throw new Refused(503, 'encounters are not installed yet');
    if (run === 'none') throw new BadRequest('token: unknown encounter');
    if (run.used || run.settled || Date.parse(run.expires_at) <= (deps.now ?? Date.now)()) throw new Conflict('encounter token unknown, used or expired');
    let verdict: ReturnType<VerifyEncounter>, weapon = '';
    try {
      const record = await decodeRecord(body.record);
      weapon = record.weapon;
      // A record's sheet is the client's claim: the build version it names (this character's, from the writer's own store) is the only thing that can vouch for it.
      const want = record.sheet && record.characterId !== undefined && `pc:${record.characterId}` !== run.character ? { ok: false as const, reason: 'the record names another character\'s build' }
        : await expectedSheet(record, async (character, version) => { const b = await store.buildGet(db, account, character, version); return b === null || b === 'absent' ? null : { level: b.level, placed: b.placed }; }, record.sheet ? await wornGearOf(db, account, run.character) : {});
      const spell = (record as { spell?: SpellClaim }).spell, held = want.ok && spell ? await expectedSpell(db, account, run.character, spell) : null;   // the spell block is a claim too: owned, and no more skill than is stored
      verdict = held && !held.ok ? { ok: false, reason: held.reason } : want.ok ? verify(record, { seed: run.seed, enemy: run.enemy, level: run.level, bar: run.bar, flags: run.flags as unknown as TwistFlag[], layer: run.layer, pose: poseOfToken(token), ...(want.sheet ? { sheet: want.sheet } : {}) }) : { ok: false, reason: want.reason };
    }
    catch (e) { verdict = { ok: false, reason: `unreadable record: ${e instanceof Error ? e.message : String(e)}` }; }   // never a throw: a refusal
    if (!verdict.ok && verdict.kitMismatch) throw new Refused(422, verdict.reason, 'kit-mismatch');   // not a loss and not consumed: the token is left to the sweep ('abandoned', nothing paid)
    const result = verdict.ok ? verdict.result : 'lost', ticks = verdict.ok ? verdict.ticks : 0, twist = verdict.ok ? verdict.twist : null;
    const eventId = `enc:${token}`;
    const fight = fightOfToken(token);
    const rewards = verdict.ok && result === 'won' && deps.rewards ? await deps.rewards({ account, character: run.character, token, fight, seed: run.seed, enemy: run.enemy, level: run.level, twist }, db) : [];
    // `fight` and `paid` are what origins_last_paid_kill (202610080006) reads back: the respawn window is the time since this account's last PAID kill of this fight,
    // and it commits in this same transaction, so a settle that aborts leaves no window behind.
    const batch: store.Json[] = [{ op: 'event', event_id: eventId, kind: 'mob', account, character: run.character, payload: { result, ticks, enemy: run.enemy, level: run.level, twist, verified: verdict.ok, fight, paid: rewards.length > 0, ...(verdict.ok ? {} : { reason: verdict.reason.slice(0, 200) }) } }, ...rewards];
    // Practice (migration 0026): only a VERIFIED win practises the weapon's skill; the lines ride this one settle, so a retry pays once (key practice:enc:<token>:<skill>).
    let practice: store.Json[] = [];
    if (verdict.ok && result === 'won') {
      const build = await store.buildGet(db, account, run.character), snap = await store.open(db, account);
      if (build !== null && build !== 'absent') practice = practiceLines({ token, weapon, enemyLevel: run.level, youLevel: snap.career ? levelOfCredit(careerState(snap.career).credit) : 0, placed: build.placed });
    }
    // Grimoire (migration 0027): a VERIFIED win against a boss legend takes its spell, once per account and legend, in this same transaction.
    const spells = verdict.ok && result === 'won' ? spellLines(fight) : [];
    const commit = (wear: store.Json[]) => store.encounterSettle(db, account, token, result, ticks, [...batch, ...wear], practice, spells).catch(GONE);
    const out = rewards.length > 0 && deps.wear
      ? await settleWithWear({ db, account, ownEventId: eventId, wear: () => deps.wear!({ account, character: run.character, token }, db), commit })
      : await commit([]);
    if (out === null) throw new Refused(503, 'encounters are not installed yet');
    return { result, verified: verdict.ok, twist, ticks, event: eventId, ...(verdict.ok ? {} : { reason: verdict.reason.slice(0, 200) }) };
  };

  return { encounter_start: start, encounter_touch: touch, encounter_settle: settle };
}
