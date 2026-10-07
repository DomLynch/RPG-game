// Origins slice 1, bite 2 (?region=1): the hunt. A creature tapped in the Frontier becomes a fight (Combat's startEncounterDuel runs it) and
// this file is what comes BEFORE and AFTER the duel, with no parallel rules: encounters.ts's fightSetup and fightSeed set it up, its
// resolveFight reads the result, rollLoot rolls what drops and intoBackpack hands it over. Pure: no DOM, no clock (the caller passes `at`),
// so the whole loop is tested in node (hunt.test.ts). Preview only: the pack, the metal and the counts are this page's memory.
import { ACCOUNT, PC } from '../contracts/fixtures.ts';
import type { Result } from '../contracts/core.ts';
import type { EncounterId } from '../contracts/ids.ts';
import { fightSeed, fightSetup, intoBackpack, loadEncounterContent, lookupOf, resolveFight, rollLoot, type EncounterContent, type FightSetup } from '../encounters/encounters.ts';
import { openInventory, type Inventory } from '../inventory/inventory.ts';
import type { MobSpec } from './mobs.ts';

export type Hunt = {
  content: EncounterContent; inventory: Inventory; metal: number;
  bountyWins: number;                 // paid Bounty wins so far (this page): resolveFight's daily cap reads it
  beaten: Set<string>;                // fights already won once (a world boss pays its table on the first win only)
  attempts: Map<string, number>;      // per fight: the attempt number, so a retry rolls afresh and a replay rolls the same
  kills: number;
};
export type Outcome = {
  won: boolean; text: string;
  drops: string[];                    // "Ash-crusted blade ×1", as the player reads them
  metal: number;                      // bronze that reached the balance (loot metal + a paid Bounty)
  bounty: { encounter: EncounterId; metal: number } | null;   // set when this win pays the open Bounty: the caller advances the journal
};

export const PACK = 12;
const must = <T>(r: Result<T>, what: string): T => { if (!r.ok) throw new Error(`${what}: ${r.issues[0]!.message}`); return r.value; };

export function newHunt(): Hunt {
  const content = must(loadEncounterContent(), 'region 1 content');
  return { content, inventory: must(openInventory({ owner: PC as never, account: ACCOUNT as never, items: [], packSize: PACK, bankSize: 1 }, lookupOf(content)), 'pack'), metal: 0, bountyWins: 0, beaten: new Set(), attempts: new Map(), kills: 0 };
}

// What a tapped creature fights as: a named one at its encounter's id, a plain creature as its own character (an open-world kill).
export const fightOf = (spec: Pick<MobSpec, 'encounter' | 'character'>): string => spec.encounter ?? spec.character;

// Set the fight up for the next attempt: the content's own setup and the seed for that attempt.
export function prepare(h: Hunt, spec: MobSpec): Result<{ setup: FightSetup; seed: number; fight: string; attempt: number }> {
  const fight = fightOf(spec), setup = fightSetup(fight, h.content);
  if (!setup.ok) return setup;
  const attempt = (h.attempts.get(fight) ?? 0) + 1;
  return { ok: true, value: { setup: setup.value, seed: fightSeed(setup.value.seedKey, setup.value.opponent.character, attempt), fight, attempt } };
}

const nameOf = (h: Hunt, id: string) => h.content.region.registry.items.get(id as never)?.name ?? id;
const line = (n: number, name: string) => (n > 1 ? `${name} ×${n}` : name);

// Settle a finished duel. `bountyOpen(encounter)`: the player holds that Bounty (talked to its giver, quest at "posted"), so a win pays it.
// The Bounty's metal is only credited when it is open; a kill without the Bounty taken still counts as a kill and says so.
export function settle(h: Hunt, spec: MobSpec, run: { fight: string; attempt: number; seed: number }, end: { result: 'won' | 'lost'; twistOutcome: 'fled' | 'caught' | 'escaped' | null },
  at: string, bountyOpen: (encounter: EncounterId) => boolean): Outcome {
  h.attempts.set(run.fight, run.attempt);
  const res = resolveFight({ fight: run.fight, result: end.result, twistOutcome: end.twistOutcome, firstWin: !h.beaten.has(run.fight), bountyWinsToday: h.bountyWins, bossRollsThisWeek: 0 }, h.content);
  if (!res.ok) return { won: false, text: `This fight cannot pay out (${res.issues[0]!.message}).`, drops: [], metal: 0, bounty: null };
  const r = res.value;
  if (!r.kill) {
    const text = end.result === 'lost' ? `${spec.name} beat you. Nothing lost; try again.` : r.forfeit ? `${spec.name} got away. Try again.` : `${spec.name} fled. No kill, no pay.`;
    return { won: false, text, drops: [], metal: 0, bounty: null };
  }
  h.kills++; h.beaten.add(run.fight);
  const out: Outcome = { won: true, text: '', drops: [], metal: 0, bounty: null };
  const parts: string[] = [`${spec.name} is down.`];
  if (r.payout.lootTable) {
    const rolled = rollLoot(r.payout.lootTable, run.seed, h.content, { foeLevel: spec.level });
    if (rolled.ok) {
      const got = intoBackpack(h.inventory, rolled.value, { wonBy: PC as never, killId: `${run.fight}#${run.attempt}`, encounter: spec.encounter, at }, h.content);
      if (got.ok) {
        h.inventory = got.value.inventory; h.metal += got.value.metal; out.metal += got.value.metal;
        const tally = new Map<string, number>(); for (const d of rolled.value.items) tally.set(d.item, (tally.get(d.item) ?? 0) + d.quantity);
        out.drops = [...tally].map(([id, n]) => line(n, nameOf(h, id)));
      } else parts.push(`Your pack is full: ${got.issues[0]!.message}.`);
    }
  }
  if (r.payout.metal > 0) {
    if (spec.encounter && bountyOpen(spec.encounter)) { h.bountyWins++; h.metal += r.payout.metal; out.metal += r.payout.metal; out.bounty = { encounter: spec.encounter, metal: r.payout.metal }; }
    else parts.push('No Bounty taken for this one: talk to the Bounty giver first.');
  }
  if (out.drops.length) parts.push(`Loot: ${out.drops.join(', ')}.`); else if (!r.payout.metal) parts.push('Nothing dropped.');
  if (out.metal) parts.push(`+${out.metal} bronze.`);
  if (out.bounty) parts.push('Bounty paid.');
  out.text = parts.join(' ');
  return out;
}
