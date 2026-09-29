// Special Moves, prototype rule for the numbers (Lead's brief 2026-09-29; FINAL rules, Dom 20:2x via Strategy/Lead): a test-layer wrapper
// around stepDuel, OFF the sim. Nothing in src/ changes, so SIM_DIGEST, RECORD_VERSION and every record replay exactly as before; the Thor
// pilot moves the rule into duel.ts with the bump.
// The rule: one special per fighter, cast from `ready` inside `reach` (mid-range). A COMMITTED `windup`: the caster stands and tracks, and
// cannot guard, roll or parry until release, while incoming blows land on him normally (stagger included). Nothing interrupts it. Released,
// it is UNBLOCKABLE and UNDODGEABLE: a guaranteed hit for `damage` (or `bossDamage` from `bossFrom`, the rank-8 level) × the target's max
// health. The race (Dom 20:2x): a caster killed DURING the wind-up fizzles (no damage); a release on the same tick the caster takes a lethal
// blow still lands, and if it kills too the fight is a double kill through the sim's own draw (Finish.draw). The cooldown is spent at
// commitment; the first cast is available `first` ticks into the fight. Deterministic: no randomness of its own; geometry through detmath.
import { decide, initialAi } from '../src/ai.ts';
import { stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { RULES, opponentAt, profileAt, type Opponent } from '../src/moves.ts';
import { M } from '../src/detmath.ts';
import { STRATEGIES, act, arena, gap, idle, k, P, ready, W } from './strategies.ts';

// Every knob in one row, so an answer from Dom is a one-line change. 60 Hz: windup 120 = 2 s, 1200 = 20 s. bossFrom 36: career.ts level =
// 1 + wins, five sub-ranks per title, so rank 8 (Primus) begins at level 36. The player's special is a class move (`damage`) at every level.
export const SPECIAL = { windup: 120, cooldown: 1200, first: 1200, reach: 3, damage: .2, bossDamage: .3, bossFrom: 36 };
export type SpecialRule = typeof SPECIAL;

type Side = 0 | 1;
export type Race = 'pending' | 'fizzled' | 'landed' | 'double' | 'moot';
// One tick of a winding special, after stepDuel. `releasing`: this is the release tick. A caster already dead fizzles unless he dies on the
// release tick itself (then it still fires). Mutates the step's fresh fighters, and returns the duel with its finish (a double kill sets draw).
export function resolveSpecial(d: Duel, s: Side, releasing: boolean, share: number): { d: Duel; race: Race } {
  const A = d.fighters[s], o = (1 - s) as Side, D = d.fighters[o];
  if (!releasing) return { d, race: A.health ? 'pending' : 'fizzled' };
  if (!D.health) return { d, race: 'moot' };   // the target already fell this tick (the other side's special): nothing left to hit
  D.health = Math.max(0, D.health - Math.round(share * D.maxHealth));
  if (D.health) return { d, race: 'landed' };
  D.phase = 'dead'; D.age = 0; D.stun = RULES.death;
  const finish = d.finish ? { ...d.finish, draw: true } : { victim: o, location: 'torso' as const, move: 'kick' as const, heading: A.body.heading };
  return { d: { ...d, finish }, race: A.health ? 'landed' : 'double' };
}

// The one strategy that answers a visible wind-up (Lead): light spam as usual, but while the opponent winds a special it sprints in and cuts.
export const PUNISH_WINDUP = { 'punish the wind-up': (d: Duel, winding: boolean): Intent => {
  if (!winding) return STRATEGIES['light spam'](d);
  const g = gap(d), p = P(d).body, w = W(d).body;
  return g <= 1.7 * k(d) ? (ready(d) ? act('light') : idle()) : { ...idle(), move: { x: (w.x - p.x) / g, z: (w.z - p.z) / g, yaw: 0, run: true } };
} };

export type SpecialTally = { cast: number; landed: number; fizzled: number; double: number };
const tally = (): SpecialTally => ({ cast: 0, landed: 0, fizzled: 0, double: 0 });
// decided: the loser's death came from a special, or the special that put him behind on health (as a share of max) for the rest of the fight.
export type FightResult = { outcome: 'win' | 'loss' | 'stall'; ticks: number; decided: boolean; player: SpecialTally; ai: SpecialTally };

// One fight: tests/strategies.ts battery()'s loop (the same arena, AI seed and step) with the day-one Pommel carried, as the ladder battery
// does; with `rule` null it is that battery's fight, unchanged. A strategy is also told whether the opponent is winding a special.
export function fight(level: number, seed: number, opponent: Opponent, strategy: (d: Duel, winding: boolean) => Intent, rule: SpecialRule | null, ticks = 7200): FightResult {
  const profile = profileAt(opponent, level), share = [rule?.damage ?? 0, level >= (rule?.bossFrom ?? Infinity) ? rule!.bossDamage : rule?.damage ?? 0];
  let d = arena(opponentAt(opponent, level), 'longsword', 'pommel'), ai = initialAi((seed * 2654435761) >>> 0), specialKill = false;
  const cd = [rule?.first ?? 0, rule?.first ?? 0], wind = [0, 0], tallies: [SpecialTally, SpecialTally] = [tally(), tally()];
  const behindSince = [-1, -1], specialAt: number[][] = [[], []];   // the tick each side last fell behind for good; the ticks a special landed on each
  for (let i = 0; i < ticks && !d.finish; i++) {
    const w = decide(d, 1, ai, profile); ai = w.ai;
    const intents: [Intent, Intent] = [strategy(d, wind[1] > 0), w.intent];
    if (rule) {
      const g = M.hypot(d.fighters[0].body.x - d.fighters[1].body.x, d.fighters[0].body.z - d.fighters[1].body.z);
      for (const s of [0, 1] as const) {
        // Cast whenever it is ready and in reach: the upper bound on how often a special can matter.
        if (!wind[s] && !cd[s] && d.fighters[s].phase === 'ready' && d.fighters[s].health > 0 && g <= rule.reach) { wind[s] = rule.windup; cd[s] = rule.cooldown; tallies[s].cast++; }
        if (wind[s]) intents[s] = idle();   // committed: standing, tracking the target; no guard, roll or parry
      }
    }
    d = stepDuel(d, intents);
    if (rule) for (const s of [0, 1] as const) {
      cd[s] = Math.max(0, cd[s] - 1);
      if (!wind[s]) continue;
      const r = resolveSpecial(d, s, --wind[s] === 0, share[s]), o = (1 - s) as Side;
      d = r.d;
      if (r.race === 'pending') continue;
      wind[s] = 0;
      if (r.race === 'fizzled') tallies[s].fizzled++;
      if (r.race === 'landed' || r.race === 'double') { tallies[s].landed++; specialAt[o].push(d.tick); if (!d.fighters[o].health) specialKill = true; }
      if (r.race === 'double') tallies[s].double++;
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
export function cell(level: number, seeds: number, opponent: Opponent, strategies: Record<string, (d: Duel, winding: boolean) => Intent>, rule: SpecialRule = SPECIAL): { off: Mode; on: Mode } {
  const empty = (): Mode => ({ wins: 0, fights: 0, ticks: [], decided: 0, flipped: 0, player: tally(), ai: tally() }), out = { off: empty(), on: empty() };
  for (const strategy of Object.values(strategies)) for (let s = 1; s <= seeds; s++) {
    const off = fight(level, s, opponent, strategy, null), on = fight(level, s, opponent, strategy, rule);
    for (const [m, r] of [[out.off, off], [out.on, on]] as const) {
      m.fights++; m.wins += +(r.outcome === 'win'); m.ticks.push(r.ticks); m.decided += +r.decided; m.flipped += +(r.outcome !== off.outcome);
      for (const key of Object.keys(m.player) as (keyof SpecialTally)[]) { m.player[key] += r.player[key]; m.ai[key] += r.ai[key]; }
    }
  }
  return out;
}
