// World creature fights, verified server side (docs/specs/origins/server-save-schema.md ruling 6). The Pit's verifier pattern (src/replay.ts verifyRecord: initialPractice, then
// stepPractice per recorded intent) re-simulates the record, but with the parameters the SERVER holds for the encounter (origins_encounter_runs: seed, enemy, level, bar, twist
// flags, mob layer), never the ones the record claims: a client cannot name its own foe, level, seed, pool or twist. The preview host (origins/preview/pit-duel.ts) adds exactly two
// things on top of the sim, and this file repeats them in the same order with the same pure functions, so a verified record means what the client played:
//   - the foe's one-health-bar pool: withBar(practice, bar) after initialPractice, only when a one-health-bar flag is present;
//   - the twist, read after every step that did not finish the fight (stepTwist), and once more on the foe's defeat (the catch window): 'fled' / 'escaped' end the fight with both standing.
// tests/world-fight-determinism.test.ts pins that a sparring Match (what the client runs) and initialPractice + stepPractice are the same fight tick for tick.
// A mob layer (src/mobkit.ts via origins/mobs/kits.ts mobLayer, stepPractice's 4th argument, as Match.layer) is a style id the server holds; an unknown one is refused. Fail closed on anything this
// build cannot step. A refusal is a normal loss, never a reward.
import { initialPractice, stepPractice } from '../../src/combat.ts';
import { RANK_STEPS, TITLES } from '../../src/career.ts';
import { underRecord } from '../../src/detmath.ts';
import { LEVELS, OPPONENTS, opponentAt, profileAt } from '../../src/moves.ts';
import type { FightRecord } from '../../src/record.ts';
import { recordSpecials } from '../../src/replay.ts';
import { STEP } from '../../src/sim.ts';
import type { DuelPose } from '../../src/duel.ts';
import { noTwist, stepTwist, type TwistFlag, type TwistOutcome } from '../../src/twist.ts';
import { mobLayer } from '../mobs/kits.ts';
import { kitOfBuild, kitTag } from '../mobs/kit-version.ts';
import { MOB_STYLES, type MobStyle } from '../mobs/styles.ts';
import { withBar } from '../shared/with-bar.ts';

// What the server holds for the fight (origins_encounter_get): the record is checked against it and re-simulated with it.
// pose: the start pose the server issued at encounter_start (encounter-pose.ts, read back from the token), null for a pit-mark fight; the record must name exactly it.
export type EncounterParams = { seed: number; enemy: string; level: number; bar: number | null; flags: readonly TwistFlag[]; layer: string | null; pose?: DuelPose | null };
// kitMismatch: the record was played on another mob kit than this build's (see origins/mobs/kit-version.ts): not a loss, the fight cannot be judged here.
export type Verified = { ok: true; result: 'won' | 'lost'; twist: TwistOutcome | null; ticks: number } | { ok: false; reason: string; kitMismatch?: true };
export type VerifyEncounter = (record: FightRecord, params: EncounterParams) => Verified;

export const MAX_FIGHT_TICKS = Math.round(15 * 60 / STEP);   // a fight longer than 15 minutes is not a fight

// Special Moves are on for a warden from the Veteran rung up (src/match.ts CLASS_B_FROM with LIVE_SPECIALS on): the server dictates it, the record's flag must agree.
const SPECIALS_FROM = 1 + RANK_STEPS * TITLES.indexOf('Veteran');
export const liveSpecials = (level: number): boolean => Number.isInteger(level) && level >= SPECIALS_FROM && level <= LEVELS;

export const knownLayer = (layer: string): layer is MobStyle => (MOB_STYLES as readonly string[]).includes(layer);
const refuse = (reason: string): Verified => ({ ok: false, reason });
// Exact, bit for bit: both sides are float32 values the server issued (Object.is also tells -0 from 0, as the record's bytes do).
const samePose = (a: DuelPose | undefined, b: DuelPose | null): boolean => !a || !b ? !a && !b
  : Object.is(a.hero.x, b.hero.x) && Object.is(a.hero.z, b.hero.z) && Object.is(a.foe.x, b.foe.x) && Object.is(a.foe.z, b.foe.z) && Object.is(a.heroFacing, b.heroFacing);

export function verifyEncounter(record: FightRecord, p: EncounterParams): Verified {
  if (p.layer !== null && !knownLayer(p.layer)) return refuse(`the mob layer ${p.layer} is not one this verifier knows`);
  if (p.layer !== null) {   // a mob layer is in play: the record must have been played on the kit this build replays with
    const theirs = kitOfBuild(record.build), mine = kitTag();
    if (theirs !== mine) return { ok: false, kitMismatch: true, reason: `kit mismatch: the record was played on mob kit ${theirs ?? '(untagged)'}, this build's is ${mine}` };
  }
  if (record.opponent !== p.enemy || record.level !== p.level || record.seed !== p.seed) return refuse('the record is not this encounter\'s fight (enemy, level or seed differ)');
  if (record.group) return refuse('one stream of a shared-health group is not verified alone (its siblings supply its incoming damage)');
  if (!samePose(record.pose, p.pose ?? null)) return refuse(p.pose ? 'the record does not start from the pose this encounter was issued' : 'the record starts from a pose this encounter was not issued');
  if (!!record.specials !== liveSpecials(p.level)) return refuse('the record\'s special-move phase is not the one this warden fights in');
  if (!Number.isInteger(record.ticks) || record.ticks < 1 || record.intents.length !== record.ticks || record.ticks > MAX_FIGHT_TICKS) return refuse('the record\'s length is not a fight');
  try { return underRecord(record, () => run(record, p)); }   // the record's version picks the sim's math, as in every replay
  catch (error) { return refuse(`this build cannot step the record: ${error instanceof Error ? error.message : String(error)}`); }
}

function run(record: FightRecord, p: EncounterParams): Verified {
  const opponent = OPPONENTS[record.opponent];
  if (!opponent || !Number.isInteger(p.level) || p.level < 1 || p.level > LEVELS) return refuse('unknown opponent or warden level');
  const profile = profileAt(opponent, p.level), flags = p.flags;
  let practice = initialPractice(p.seed, opponentAt(opponent, p.level), record.weapon, record.skill ?? null, recordSpecials(record), record.gambit ? p.seed : undefined, record.stances, p.pose ?? undefined);   // the SERVER's issued pose (equal to the record's, checked above); the record's own Gambit and stance pick, as src/replay.ts (RV34: stances ON for all)
  if (p.bar !== null && flags.some((f) => f.kind === 'one-health-bar')) practice = withBar(practice, p.bar);
  const layer = p.layer === null ? undefined : mobLayer(p.layer as MobStyle);   // fresh per fight: its state resets on tick 0, as the client's does
  let twist = noTwist(), endedAt = 0;
  for (let i = 0; i < record.intents.length; i++) {
    if (endedAt) return refuse(`the fight ended at tick ${endedAt}, before the record's last tick ${record.ticks}`);
    practice = stepPractice(practice, record.intents[i]!, profile, layer);
    if (practice.finish) {
      if (flags.length && practice.finish.victim === 1) twist = stepTwist(practice.duel, flags, twist).twist;   // 'caught' inside the catch window
      endedAt = i + 1;
    } else if (flags.length) {
      twist = stepTwist(practice.duel, flags, twist).twist;
      if (twist.outcome === 'fled' || twist.outcome === 'escaped') endedAt = i + 1;   // the foe ran, both standing
    }
  }
  if (!endedAt) return refuse('the record does not reach its end');
  const finish = practice.finish;
  if (!finish) {   // a twist ended it with both fighters standing: the recorder's outcome for a fight with no finish is 'abandoned'
    if (record.outcome !== 'abandoned') return refuse(`the fight ended with the foe ${twist.outcome}, the record says "${record.outcome}"`);
    return { ok: true, result: 'won', twist: twist.outcome, ticks: endedAt };
  }
  const outcome = finish.draw ? 'draw' : finish.victim === 1 ? 'killed' : 'died';
  if (outcome !== record.outcome) return refuse(`the replay ends in "${outcome}", the record says "${record.outcome}"`);
  return outcome === 'killed' ? { ok: true, result: 'won', twist: twist.outcome === 'caught' ? 'caught' : null, ticks: endedAt } : { ok: true, result: 'lost', twist: null, ticks: endedAt };
}
