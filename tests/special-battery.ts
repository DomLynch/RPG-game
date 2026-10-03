// Special Moves battery (scripts/special-battery.mjs): the strategy battery's fight with the sim's own Special Moves (duel.ts withSpecials,
// RULES.special) off and on over the same seeds. The AI casts its own special (ai.ts); the scripted player casts whenever it is ready and in
// reach, over whatever its strategy does (the upper bound on how often a special can matter). Counts come from the fight's events.
import { decide, initialAi } from '../src/ai.ts';
import { legal, stepDuel, withSpecials, type Duel, type Intent } from '../src/duel.ts';
import { RULES, opponentAt, profileAt, type Opponent } from '../src/moves.ts';
import { skillOf } from '../src/loot.ts';
import { STRATEGIES, act, arena, gap, idle, k, P, ready, W } from './strategies.ts';

export const SPECIAL = RULES.special;

// The one strategy that answers a visible windup (Lead): light spam as usual, but while the opponent winds a special it sprints in and cuts.
export const PUNISH_WINDUP = { 'punish the wind-up': (d: Duel): Intent => {
  if (!W(d).special) return STRATEGIES['light spam'](d);
  const g = gap(d), p = P(d).body, w = W(d).body;
  return g <= 1.7 * k(d) ? (ready(d) ? act('light') : idle()) : { ...idle(), move: { x: (w.x - p.x) / g, z: (w.z - p.z) / g, yaw: 0, run: true } };
} };

export type SpecialTally = { cast: number; landed: number; fizzled: number; double: number };
const tally = (): SpecialTally => ({ cast: 0, landed: 0, fizzled: 0, double: 0 });
// decided: the loser's death came from a special, or the special that put him behind on health (as a share of max) for the rest of the fight.
export type FightResult = { outcome: 'win' | 'loss' | 'stall'; ticks: number; decided: boolean; player: SpecialTally; ai: SpecialTally };

// One fight: tests/strategies.ts battery()'s loop (the same arena, AI seed and step) with the day-one Pommel carried, as the ladder battery
// does; with `specials` false it is that battery's fight, unchanged.
export function fight(level: number, seed: number, opponent: Opponent, strategy: (d: Duel) => Intent, specials: boolean, ticks = 7200): FightResult {
  const profile = profileAt(opponent, level), arenaFight = arena(opponentAt(opponent, level), 'longsword', 'pommel');
  let d = specials ? withSpecials(arenaFight, level, skillOf(opponent.id)) : arenaFight, ai = initialAi((seed * 2654435761) >>> 0), specialKill = false;
  const tallies: [SpecialTally, SpecialTally] = [tally(), tally()], behindSince = [-1, -1], specialAt: number[][] = [[], []];
  for (let i = 0; i < ticks && !d.finish; i++) {
    const w = decide(d, 1, ai, profile); ai = w.ai;
    const cast = specials && legal(P(d), 'skill') && gap(d) <= SPECIAL.reach;
    d = stepDuel(d, [cast ? act('skill') : strategy(d), w.intent]);
    for (const e of d.events) {
      const t = tallies[e.actor];
      if (e.type === 'SpecialStarted') t.cast++;
      if (e.type === 'SpecialFizzled') t.fizzled++;
      if (e.type === 'SpecialLanded') { t.landed++; specialAt[e.target!].push(d.tick); if (!d.fighters[e.target!].health) specialKill = true; if (d.finish?.draw) t.double++; }
    }
    const f = d.fighters, lead = f[0].health / f[0].maxHealth - f[1].health / f[1].maxHealth;
    for (const s of [0, 1] as const) { const behind = s === 0 ? lead < 0 : lead > 0; if (!behind) behindSince[s] = -1; else if (behindSince[s] < 0) behindSince[s] = d.tick; }
  }
  const outcome = !d.finish ? 'stall' : !d.finish.draw && d.finish.victim === 1 ? 'win' : 'loss', loser = outcome === 'win' ? 1 : 0;
  const decided = outcome !== 'stall' && (specialKill || specialAt[loser].includes(behindSince[loser]));
  return { outcome, ticks: d.tick, decided, player: tallies[0], ai: tallies[1] };
}

// One opponent at one level over every strategy × seed, OFF and ON on the same seeds. `ticks` keeps every fight's length (a stall counts
// as the full 7200), so the report takes the median and p90 itself.
export type Mode = { wins: number; fights: number; ticks: number[]; decided: number; flipped: number; player: SpecialTally; ai: SpecialTally };
export function cell(level: number, seeds: number, opponent: Opponent, strategies: Record<string, (d: Duel) => Intent>): { off: Mode; on: Mode } {
  const empty = (): Mode => ({ wins: 0, fights: 0, ticks: [], decided: 0, flipped: 0, player: tally(), ai: tally() }), out = { off: empty(), on: empty() };
  for (const strategy of Object.values(strategies)) for (let s = 1; s <= seeds; s++) {
    const off = fight(level, s, opponent, strategy, false), on = fight(level, s, opponent, strategy, true);
    for (const [m, r] of [[out.off, off], [out.on, on]] as const) {
      m.fights++; m.wins += +(r.outcome === 'win'); m.ticks.push(r.ticks); m.decided += +r.decided; m.flipped += +(r.outcome !== off.outcome);
      for (const key of Object.keys(m.player) as (keyof SpecialTally)[]) { m.player[key] += r.player[key]; m.ai[key] += r.ai[key]; }
    }
  }
  return out;
}
