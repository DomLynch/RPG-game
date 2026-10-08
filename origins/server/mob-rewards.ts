// What a VERIFIED world creature kill pays, as encounter settle's reward lines (EQEmu's pattern: the server rolls the kill's loot table on the verified
// kill event, and everything commits in ONE transaction with the token's consumption, so a retried settle pays nothing twice).
// Reused as they are: resolveFight + rollLoot + intoBackpack (origins/encounters: the EQEmu loot port and the inventory's `receive`), award() for the
// kill's CP booked with career_set (as questBatch and pitBatch book theirs), openHoldingsWith for the pack, and origins_apply's `mint` op.
// Not paid yet, so it can never overpay: bronze (the writer has no read of the metal balance row the `metal` op needs), Bounty metal and weekly
// boss rolls (both need "wins today / rolls this week", which needs an events read). Those caps are passed as reached.
import { createHash } from 'node:crypto';
import type { CharacterInstanceId, EncounterId } from '../contracts/ids.ts';
import type { ItemInstance } from '../contracts/items.ts';
import { fightSetup, intoBackpack, lookupOf, resolveFight, rollLoot, type EncounterContent } from '../encounters/encounters.ts';
import type { Inventory } from '../inventory/inventory.ts';
import { award } from '../progression/model.ts';
import type { TwistOutcome } from '../../src/twist.ts';
import { careerState } from './career.ts';
import type { Db } from './db.ts';
import { openHoldingsWith } from './holdings.ts';
import type { CareerRow, Json } from './store.ts';

export type Kill = { account: string; character: string; token: string; fight: string | null; seed: number; enemy: string; level: number; twist: string | null };
export type Paid = { batch: Json[]; summary: { cp: number; cpReason: string; drops: string[]; lootRefused: string | null; unpaid: string[] } };

const CAP_REACHED = Number.MAX_SAFE_INTEGER;   // no "wins today / rolls this week" read yet: the cap counts as reached, so nothing is paid past it

// Pure: the server's own state in, the batch lines out. `at` is the server time (ISO). Nothing here reads the client's body.
export function mobBatch(kill: Kill, state: { career: CareerRow | null; inventory: Inventory }, content: EncounterContent, at: string): Paid {
  const none = (why: string): Paid => ({ batch: [], summary: { cp: 0, cpReason: why, drops: [], lootRefused: null, unpaid: [] } });
  if (!kill.fight) return none('no-fight-id');   // a token issued before the fight id was carried: the event only, as before
  const setup = fightSetup(kill.fight, content);
  if (!setup.ok || setup.value.opponent.body !== kill.enemy || setup.value.opponent.level !== kill.level) return none('fight-mismatch');   // never pay a fight the run does not describe
  const target = setup.value.opponent.character, killRow = content.local.killRows[target] ?? null;
  const career = state.career ? careerState(state.career) : null;
  const firstWin = killRow !== null && career !== null && !career.beaten.includes(`${killRow}:${target}`);
  const res = resolveFight({ fight: kill.fight, result: 'won', twistOutcome: kill.twist as TwistOutcome | null, firstWin, bountyWinsToday: CAP_REACHED, bossRollsThisWeek: CAP_REACHED }, content);
  if (!res.ok || !res.value.kill) return none(res.ok ? 'no-kill' : 'unresolved');
  const { payout } = res.value, batch: Json[] = [], unpaid: string[] = [];
  const eventId = `enc:${kill.token}`, secs = Math.floor(Date.parse(at) / 1000);

  // The kill's CP, priced by award() and booked with career_set (the row's version guards it: a stale row aborts the whole settle).
  let cp = 0, cpReason = 'no-career';
  if (state.career && career && payout.killRow) {
    const won = award(career, { kind: 'kill', id: eventId, at: secs, type: payout.killRow, target, targetLevel: kill.level });
    cpReason = won.reason;
    if (won.reason === 'ok' && won.cp > 0) {
      cp = won.cp;
      batch.push({
        op: 'career_set', account: kill.account, expected_version: state.career.version, world_credit: Number(state.career.world_credit) + cp, rested: won.state.rested,
        rested_at: won.state.restedAt, heat: won.state.heat, story: won.state.story, beaten: won.state.beaten,
      });
    }
  }

  // The loot: the table rolled on the SERVER's seed (the page rolls the same seed, so it shows the same drops), into the pack all or nothing.
  const drops: string[] = [];
  let lootRefused: string | null = null;
  if (payout.lootTable) {
    const rolled = rollLoot(payout.lootTable, kill.seed, content, { foeLevel: kill.level });
    if (!rolled.ok) lootRefused = rolled.issues[0]!.message;
    else {
      const encounter = setup.value.scope === 'open-world' ? null : (kill.fight as EncounterId);
      const got = intoBackpack(state.inventory, rolled.value, { wonBy: kill.character as CharacterInstanceId, killId: killIdOf(kill.token), encounter, at }, content);
      if (!got.ok) lootRefused = got.issues[0]!.message;   // the pack could not take it (full, or one-of-each): nothing minted, as the page says
      else {
        const lookup = lookupOf(content);
        for (const id of got.value.received) {
          const inst = got.value.inventory.items.find((i) => i.id === id)!;
          batch.push(mintOp(inst, lookup(inst.item)?.stack === 1));
          drops.push(inst.item);
        }
        if (got.value.metal > 0) unpaid.push(`bronze ${got.value.metal}`);
      }
    }
  }
  if (payout.metal > 0) unpaid.push(`bounty bronze ${payout.metal}`);
  return { batch, summary: { cp, cpReason, drops, lootRefused, unpaid } };
}

// The kill's key inside mint keys: mint keys are lowercase (/^[a-z0-9][a-z0-9:._-]{7,127}$/) and the token is base64url, so the key is a digest of
// the token, one per kill: loot:enc.<32 hex>:<n>.
export const killIdOf = (token: string): string => `enc.${createHash('sha256').update(token).digest('hex').slice(0, 32)}`;

// One placed instance as origins_apply's `mint` (202610060001): its pack place, its mint key (loot:<killIdOf(token)>:<n>, unique, so a replay cannot mint twice).
function mintOp(inst: ItemInstance, singleCopy: boolean): Json {
  const l = inst.location as { kind: string; owner: string; index?: number };
  return {
    op: 'mint', item: {
      id: inst.id, item: inst.item, quantity: inst.quantity, tier: inst.tier, upgrade_level: inst.upgradeLevel ?? 0, loc: { kind: l.kind, owner: l.owner, index: l.index },
      bound_to: inst.boundTo, mint_key: inst.provenance.mintKey, provenance: inst.provenance, history: inst.history, single_copy: singleCopy,
    },
  };
}

// The writer's `rewards` for encounterOps: read the character's pack and career row (one origins_open), then price the kill.
export function mobRewards(content: EncounterContent, now: () => Date = () => new Date(), log: (line: string) => void = console.log) {
  const lookup = lookupOf(content);
  return async (kill: Kill, db: Db): Promise<Json[]> => {
    const { inventory, snap } = await openHoldingsWith(db, kill.account, kill.character, { lookup });
    const paid = mobBatch(kill, { career: snap.career, inventory }, content, now().toISOString());
    log(`encounter rewards ${kill.token.slice(-6)}: ${JSON.stringify(paid.summary)}`);
    return paid.batch;
  };
}
