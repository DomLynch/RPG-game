// What a VERIFIED world creature kill pays, as encounter settle's reward lines (EQEmu's pattern: the server rolls the kill's loot table on the verified
// kill event, and everything commits in ONE transaction with the token's consumption, so a retried settle pays nothing twice).
// Reused as they are: resolveFight + rollLoot + intoBackpack (origins/encounters: the EQEmu loot port and the inventory's `receive`), award() for the
// kill's CP booked with career_set (as questBatch and pitBatch book theirs), openHoldingsWith for the pack, and origins_apply's `mint` op.
// Bronze (the loot table's currency roll) is paid with origins_apply's `metal` op, versioned by the balance row origins_metal_of reads (migration 202610080004;
// without it, bronze is reported unpaid). Not paid yet, so it can never overpay: Bounty metal and weekly boss rolls (both need "wins today / rolls this week",
// which needs an events read). Those caps are passed as reached.
import { createHash } from 'node:crypto';
import { KILL_ID_HEX, LOG_TAG_CHARS, MS_PER_SECOND } from './units.ts';
import type { CharacterInstanceId, EncounterId } from '../../src/core/server.ts';
import type { ItemInstance } from '../../src/core/server.ts';
import { fightSetup, intoBackpack, lookupOf, resolveFight, rollLoot, type EncounterContent } from '../encounters/encounters.ts';
import type { Inventory } from '../../src/core/server.ts';
import { listedZone, listedZoneIds } from '../zones/listed.ts';
import { WILDLIFE_ROWS } from '../../src/core/server.ts';
import { award } from '../../src/core/server.ts';
import { worldRule, type TwistOutcome } from '../../src/fight/server.ts';
import { careerState } from '../../src/core/server.ts';
import type { Db } from './db.ts';
import { openHoldingsWith } from './holdings.ts';
import SERVER_RULES from './server-rules.json' with { type: 'json' };
import * as store from './store.ts';
import { portion, thin } from './damage-share.ts';
import { metalOf, type CareerRow, type Json, type MetalRow } from './store.ts';

export type Kill = { account: string; character: string; token: string; fight: string | null; seed: number; enemy: string; level: number; twist: string | null };
export type Paid = { batch: Json[]; summary: { cp: number; cpReason: string; drops: string[]; bronze: number; lootRefused: string | null; unpaid: string[]; clamped?: string[] } };

const CAP_REACHED = SERVER_RULES.mobPayout[0]!.capReached;   // the mobPayout row (server-rules.json): no "wins today / rolls this week" read yet, so the cap counts as reached and nothing is paid past it

// Pure: the server's own state in, the batch lines out. `at` is the server time (ISO). Nothing here reads the client's body.
// `fought` (world spawns only, world-spawns.ts): the open-world creature was fought at the server's own spawn level, so it is priced there; without it the
// fight must match its form's level exactly (the encounter-settle guard: never pay a fight the run does not describe).
// `fought.loot` (world spawns only): the spawn row's own loot table. It picks WHICH table is rolled and nothing else (who is paid, the verify path and the CP are the character's, untouched), and only where the
// character's own table already rolls (payout.lootTable set): a kill that pays no loot never gains one. A zone whose row names the character's table gets exactly the table it always had.
export function mobBatch(kill: Kill, state: { career: CareerRow | null; inventory: Inventory; metal?: MetalRow | null | 'absent' }, content: EncounterContent, at: string, fought?: { level: number; loot?: string; share?: number }): Paid {
  const share = Math.min(1, Math.max(0, fought?.share ?? 1));   // this contributor's share of the kill credit (damage-share.ts); absent = the whole kill
  const none = (why: string): Paid => ({ batch: [], summary: { cp: 0, cpReason: why, drops: [], bronze: 0, lootRefused: null, unpaid: [] } });
  if (!kill.fight) return none('no-fight-id');   // a token issued before the fight id was carried: the event only, as before
  const setup = fightSetup(kill.fight, content, fought ? { level: fought.level } : {});
  if (!setup.ok || setup.value.opponent.body !== kill.enemy || setup.value.opponent.level !== kill.level) return none('fight-mismatch');   // never pay a fight the run does not describe
  const target = setup.value.opponent.character, killRow = content.local.killRows[target] ?? null;
  const career = state.career ? careerState(state.career) : null;
  const firstWin = killRow !== null && career !== null && !career.beaten.includes(`${killRow}:${target}`);
  const res = resolveFight({ fight: kill.fight, result: 'won', twistOutcome: kill.twist as TwistOutcome | null, firstWin, bountyWinsToday: CAP_REACHED, bossRollsThisWeek: CAP_REACHED }, content);
  if (!res.ok || !res.value.kill) return none(res.ok ? 'no-kill' : 'unresolved');
  const { payout } = res.value, batch: Json[] = [], unpaid: string[] = [];
  const eventId = `enc:${kill.token}`, secs = Math.floor(Date.parse(at) / MS_PER_SECOND);

  // The kill's CP, priced by award() and booked with career_set (the row's version guards it: a stale row aborts the whole settle).
  let cp = 0, cpReason = 'no-career';
  if (state.career && career && payout.killRow) {
    const won = award(career, { kind: 'kill', id: eventId, at: secs, type: payout.killRow, target, targetLevel: kill.level });
    cpReason = won.reason;
    if (won.reason === 'ok' && portion(won.cp, share) > 0) {
      cp = portion(won.cp, share);   // the kill credit's share of the CP (damage-share.ts; 1 = the whole kill, as before)
      batch.push({
        op: 'career_set', account: kill.account, expected_version: state.career.version, world_credit: Number(state.career.world_credit) + cp, rested: won.state.rested,
        rested_at: won.state.restedAt, heat: won.state.heat, story: won.state.story, beaten: won.state.beaten,
      });
    }
  }

  // The loot: the table rolled on the SERVER's seed (the page rolls the same seed, so it shows the same drops), into the pack all or nothing.
  const drops: string[] = [], clamped: string[] = [];
  let bronze = 0, lootRefused: string | null = null;
  const lootTable = payout.lootTable && fought?.loot ? fought.loot : payout.lootTable;
  if (lootTable) {
    const rolled = rollLoot(lootTable, kill.seed, content, { foeLevel: kill.level });
    if (!rolled.ok) lootRefused = rolled.issues[0]!.message;
    else {
      const encounter = setup.value.scope === 'open-world' ? null : (kill.fight as EncounterId);
      const got = intoBackpack(state.inventory, share >= 1 ? rolled.value : { ...rolled.value, items: thin(rolled.value.items, share, kill.seed), metal: portion(rolled.value.metal, share) }, { wonBy: kill.character as CharacterInstanceId, killId: killIdOf(kill.token), encounter, at, level: setup.value.opponent.level }, content);
      if (!got.ok) lootRefused = got.issues[0]!.message;   // the pack could not take it (full, or one-of-each): nothing minted, as the page says
      else {
        const lookup = lookupOf(content);
        for (const id of got.value.received) {
          const inst = got.value.inventory.items.find((i) => i.id === id)!;
          batch.push(mintOp(inst, lookup(inst.item)?.stack === 1));
          drops.push(inst.item);
        }
        bronze += got.value.metal;
        clamped.push(...got.value.clamped);   // the receipt names a drop the beta cap lowered
      }
    }
  }
  if (payout.metal > 0) unpaid.push(`bounty bronze ${payout.metal}`);
  // The bronze, in the same batch: the first award inserts the balance row, every later one names its version (a stale one aborts the whole settle).
  const metal = state.metal === undefined ? 'absent' : state.metal;   // null = no row yet (the first award inserts it), not 'absent'
  if (bronze > 0 && metal === 'absent') unpaid.push(`bronze ${bronze}`);
  else if (bronze > 0 && metal !== 'absent') batch.push({ op: 'metal', account: kill.account, delta_bronze: bronze, reason: 'award', event_id: eventId, ...(metal ? { expected_version: metal.version } : {}) });
  return { batch, summary: { cp, cpReason, drops, bronze: bronze > 0 && metal !== 'absent' ? bronze : 0, lootRefused, unpaid, clamped } };
}

// The kill's key inside mint keys: mint keys are lowercase (/^[a-z0-9][a-z0-9:._-]{7,127}$/) and the token is base64url, so the key is a digest of
// the token, one per kill: loot:enc.<32 hex>:<n>.
export const killIdOf = (token: string): string => `enc.${createHash('sha256').update(token).digest('hex').slice(0, KILL_ID_HEX)}`;

// One placed instance as origins_apply's `mint` (202610060001): its pack place, its mint key (loot:<killIdOf(token)>:<n>, unique, so a replay cannot mint twice).
export function mintOp(inst: ItemInstance, singleCopy: boolean): Json {
  const l = inst.location as { kind: string; owner: string; index?: number };
  return {
    op: 'mint', item: {
      id: inst.id, item: inst.item, quantity: inst.quantity, tier: inst.tier, upgrade_level: inst.upgradeLevel ?? 0, loc: { kind: l.kind, owner: l.owner, index: l.index },
      bound_to: inst.boundTo, mint_key: inst.provenance.mintKey, provenance: inst.provenance, history: inst.history, single_copy: singleCopy,
    },
  };
}

// Farming bound while the server cannot yet tell WHERE a character stands in the Frontier (presence only knows the Concord's pit-yard and exchange, and the content binds
// no creature to a zone): one paid kill of the same fight per account per respawn window. The window is the creature row's `respawnSeconds` (Dom's animal rule,
// 2026-10-08: 60..90 s; Characters' field, #1787), else RESPAWN_MS. It is read from the DATABASE (origins_last_paid_kill, 202610080006: the time since this account's
// last PAID kill of the fight, from the `enc:<token>` events the settle commits with its rewards), so a writer restart forgets nothing, only committed kills count, and a
// retry of the same token is never blocked (its own event does not exist until it commits). Database missing the function: pays nothing, still recorded.
export const RESPAWN_MS = worldRule('respawnDefault') * 1000;   // the respawnDefault row (src/fight/world-rules-defs.json, 300 s)
type RespawnRow = { id: string; respawnSeconds?: number };
// Keyed (zone, id), not id alone: one creature id lives in several zones (Zone 1's starters, Zone 2's boar and wolf, ...), and a row that sets its respawn in one zone must not drag the same id in another
// (Lead, per-layer spawns, with World's Zone 1 starter respawns of 40-60 s). Wildlife rows apply in every zone, under the zone key WILD. The layer is not in the key yet: a layer copies its zone's rows;
// a per-layer respawn (the dynamic respawn of the next PR) adds it as the third part, (layer, zone, id).
const WILD = '*';
const respawnKey = (zone: string, id: string): string => `${zone}:${id}`;
export const respawnRows = (zoneRows: () => readonly { zone: string; rows: readonly RespawnRow[] }[] = () => listedZoneIds().map((zone) => ({ zone, rows: listedZone(zone).spawns.rows }))): Map<string, number> =>
  new Map([...zoneRows().flatMap(({ zone, rows }) => rows.map((r) => [zone, r] as const)), ...WILDLIFE_ROWS.map((r: RespawnRow) => [WILD, r] as const)]
    .flatMap(([zone, r]) => (r.respawnSeconds !== undefined ? [[respawnKey(zone, r.id), r.respawnSeconds * MS_PER_SECOND] as const] : [])));
const ROW_RESPAWN = respawnRows();
/** The respawn window of a fight's creature in `zone` (its own row, else a wildlife row, else RESPAWN_MS). No zone (the Pit's encounter path, which does not know one): any zone's row for the character, the last listed wins. */
export function respawnMsOf(fight: string, content: EncounterContent, rows: ReadonlyMap<string, number> = ROW_RESPAWN, zone?: string): number {
  const setup = fightSetup(fight, content);
  if (!setup.ok) return RESPAWN_MS;
  const id = setup.value.opponent.character;
  const own = zone === undefined ? [...rows].findLast(([k]) => k.endsWith(`:${id}`))?.[1] : rows.get(respawnKey(zone, id)) ?? rows.get(respawnKey(WILD, id));
  return own ?? RESPAWN_MS;
}

// The writer's `rewards` for encounterOps: the respawn window, then the character's pack and career row (one origins_open) and the bronze row, then price the kill.
export function mobRewards(content: EncounterContent, now: () => Date = () => new Date(), log: (line: string) => void = console.log) {
  const lookup = lookupOf(content);
  return async (kill: Kill, db: Db): Promise<Json[]> => {
    if (!kill.fight) { log(`encounter rewards ${kill.token.slice(-LOG_TAG_CHARS)}: no fight id (a token from before it was carried), recorded, pays nothing`); return []; }
    const since = await store.lastPaidKill(db, kill.account, kill.fight), window = respawnMsOf(kill.fight, content);
    if (since === 'absent') { log(`encounter rewards ${kill.token.slice(-LOG_TAG_CHARS)}: the respawn read (202610080006) is not applied, recorded, pays nothing`); return []; }
    if (since !== null && since < window) {
      log(`encounter rewards ${kill.token.slice(-LOG_TAG_CHARS)}: respawning (${Math.ceil((window - since) / MS_PER_SECOND)} s left), the fight is recorded and pays nothing`);
      return [];
    }
    const { inventory, snap } = await openHoldingsWith(db, kill.account, kill.character, { lookup });
    const metal = await metalOf(db, kill.account);
    const paid = mobBatch(kill, { career: snap.career, inventory, metal }, content, now().toISOString());
    log(`encounter rewards ${kill.token.slice(-LOG_TAG_CHARS)}: ${JSON.stringify(paid.summary)}`);
    return paid.batch;
  };
}
