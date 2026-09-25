// The autopsy (beta plan brief 2): at most two plain lines under a death, computed from what the warden already counted — its Habits and
// Reads (src/ai.ts) — and from the fight's own event log. Pure: no DOM, no renderer, no opponent names, nothing tuned per opponent.
// The warden's action comes first (how the player died, from events), the player's habit second (the read, with its numbers). Numbers
// over adjectives; no advice; nothing confident to say → nothing said.
import type { Habits, Reads } from './ai.ts';
import type { CombatEvent, Duel } from './duel.ts';
import { RULES, type MoveId } from './moves.ts';

const BLOW: Record<MoveId, string> = { light_right: 'cut', light_left: 'cut', heavy_overhead: 'heavy', thrust: 'thrust', riposte: 'riposte', slash_riposte: 'riposte', heavy_riposte: 'riposte', heavy_counter: 'counter', critical: 'critical', kick: 'kick', skill_witchfire: 'Witch-fire' };
const WINDOW = RULES.posture.stun + 60;   // a break (guard or posture) is the cause of a death that follows within its stun plus the killing swing's wind-up
const share = (a: number, b: number) => `${Math.round(100 * a / Math.max(1, b))} %`;

// The warden's action: how the player (side 0) died, from the whole fight's event log and the finished duel.
export function cause(log: CombatEvent[], duel: Duel): string | null {
  const finish = duel.finish;
  if (!finish || finish.draw || finish.victim !== 0) return null;
  const kill = log.filter(e => e.type === 'Killed' && e.target === 0).pop();
  if (!kill) return null;
  const before = (type: CombatEvent['type']) => log.some(e => e.type === type && e.target === 0 && e.tick <= kill.tick && kill.tick - e.tick <= WINDOW);
  const blow = BLOW[finish.move] ?? finish.move;
  if (finish.move === 'critical' || before('PostureBroken')) return `Your posture broke and the ${blow} went through it.`;
  if (before('GuardBroken')) return `Your guard broke and the ${blow} came through.`;
  // `exhausted` is read from the finished duel: a dead fighter never regenerates, so the flag is still the state at the kill tick.
  if (duel.fighters[0].exhausted) return `You were out of stamina when the ${blow} landed.`;
  return `The ${blow} landed on your ${finish.location}.`;
}

// The player's habit: the one read the warden made, with the count that made it a read. One line; the reads are checked in the order
// the warden's answers are most visible (a waited-for cut, a kicked guard) so a player with two habits hears the louder one. A line names
// the warden's answer only where every warden gives it (src/ai.ts decide: anticipation, the kick and charge at a guard, baits and feints
// at a parry, the swing into a roll's tail); the answers that hang on a profile knob (a kicker's kick at a stepper, a guardless fighter's
// respect for the point or the kick, a committing parrier's wariness of the park) stay unsaid, and the numbers stand alone.
export function habit(h: Habits, reads: Reads): string | null {
  const swings = h.lights + h.heavies + h.thrusts;
  if (reads.spammer) return `${h.lights} of your ${swings} swings were cuts; he was waiting for the cut.`;
  if (reads.turtle) return `You held guard for ${share(h.guard, h.ticks)} of the fight; a standing guard gets kicked and charged.`;
  if (reads.parryHappy) return `You pressed parry against ${h.parries} of his ${h.attacks} swings; a pressed parry gets baited and feinted.`;
  if (reads.roller) return `You rolled from ${h.rolls} of his ${h.attacks} swings; he swings into the tail of the roll.`;
  if (reads.stepper) return `You slipped back from ${h.steps} of his ${h.attacks} swings.`;
  if (reads.kicker) return `You threw ${h.kicks} kicks and ${swings} swings.`;
  if (reads.poker) return `${h.thrusts} of your ${swings} swings were thrusts.`;
  if (reads.parker) return `${h.parks} of your ${swings} swings sat at the chamber.`;
  return null;
}

export const autopsy = (h: Habits, reads: Reads, log: CombatEvent[], duel: Duel): string[] => [cause(log, duel), habit(h, reads)].filter((s): s is string => s !== null);
