// Special Moves, prototype rule for the numbers (Lead's brief 2026-09-29, rules as changed by Dom 20:1x via Strategy): a test-layer wrapper
// around stepDuel, OFF the sim. Nothing in src/ changes, so SIM_DIGEST, RECORD_VERSION and every record replay exactly as before; the Thor
// pilot moves the rule into duel.ts with the bump.
// The rule: one special per fighter, cast from `ready` inside `reach` (mid-range). A `windup`-tick tell during which the caster stands and
// tracks, then it lands UNBLOCKABLE and UNDODGEABLE: once released it is a guaranteed hit for `damage` (or `bossDamage` from `bossFrom`, the
// rank-8 level) × the target's max health. The cooldown is spent at commitment; the first cast is available `first` ticks into the fight.
// The one open question (Dom): with `interruptOnHit`, a blow that staggers the caster during the tell cancels it; without, only his death does.
// Deterministic: no randomness of its own; the sim's geometry through detmath.
import { decide, initialAi } from '../src/ai.ts';
import { stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { RULES, opponentAt, profileAt, type Opponent } from '../src/moves.ts';
import { M } from '../src/detmath.ts';
import { arena, idle } from './strategies.ts';

// Every knob in one row, so an answer from Dom is a one-line change. 60 Hz: windup 120 = 2 s, 1200 = 20 s. bossFrom 36: career.ts level =
// 1 + wins, five sub-ranks per title, so rank 8 (Primus) begins at level 36. The player's special is a class move (`damage`) at every level.
export const SPECIAL = { windup: 120, cooldown: 1200, first: 1200, reach: 3, damage: .2, bossDamage: .3, bossFrom: 36, interruptOnHit: false };
export type SpecialRule = typeof SPECIAL;

type Side = 0 | 1;
export type SpecialTally = { cast: number; landed: number; cancelled: number };
// decided: the loser's death came from a special, or the special that put him behind on health (as a share of max) for the rest of the fight.
export type FightResult = { outcome: 'win' | 'loss' | 'stall'; ticks: number; decided: boolean; player: SpecialTally; ai: SpecialTally };

// One fight: tests/strategies.ts battery()'s loop (the same arena, AI seed and step) with the day-one Pommel carried, as the ladder battery
// does; with `rule` null it is that battery's fight, unchanged.
export function fight(level: number, seed: number, opponent: Opponent, strategy: (d: Duel) => Intent, rule: SpecialRule | null, ticks = 7200): FightResult {
  const profile = profileAt(opponent, level), share = [rule?.damage ?? 0, level >= (rule?.bossFrom ?? Infinity) ? rule!.bossDamage : rule?.damage ?? 0];
  let d = arena(opponentAt(opponent, level), 'longsword', 'pommel'), ai = initialAi((seed * 2654435761) >>> 0), specialKill = false;
  const cd = [rule?.first ?? 0, rule?.first ?? 0], wind = [0, 0], tallies: [SpecialTally, SpecialTally] = [{ cast: 0, landed: 0, cancelled: 0 }, { cast: 0, landed: 0, cancelled: 0 }];
  const behindSince = [-1, -1], specialAt: number[][] = [[], []];   // the tick each side last fell behind for good; the ticks a special landed on each
  for (let i = 0; i < ticks && !d.finish; i++) {
    const w = decide(d, 1, ai, profile); ai = w.ai;
    const intents: [Intent, Intent] = [strategy(d), w.intent];
    if (rule) {
      const gap = M.hypot(d.fighters[0].body.x - d.fighters[1].body.x, d.fighters[0].body.z - d.fighters[1].body.z);
      for (const s of [0, 1] as const) {
        // Cast whenever it is ready and in reach: the upper bound on how often a special can matter.
        if (!wind[s] && !cd[s] && d.fighters[s].phase === 'ready' && d.fighters[s].health > 0 && gap <= rule.reach) { wind[s] = rule.windup; cd[s] = rule.cooldown; tallies[s].cast++; }
        if (wind[s]) intents[s] = idle();   // the tell: standing, tracking the target, no guard
      }
    }
    d = stepDuel(d, intents);
    if (rule) for (const s of [0, 1] as const) {
      cd[s] = Math.max(0, cd[s] - 1);
      if (!wind[s]) continue;
      const A = d.fighters[s], o = (1 - s) as Side, D = d.fighters[o];
      if (A.phase === 'dead' || (rule.interruptOnHit && A.phase === 'hurt')) { wind[s] = 0; tallies[s].cancelled++; continue; }
      if (--wind[s] || !D.health || d.finish) continue;
      tallies[s].landed++; specialAt[o].push(d.tick);
      D.health = Math.max(0, D.health - Math.round(share[s] * D.maxHealth));
      if (!D.health) { D.phase = 'dead'; D.age = 0; D.stun = RULES.death; specialKill = true; d = { ...d, finish: { victim: o, location: 'torso', move: 'kick', heading: A.body.heading } }; }
    }
    const f = d.fighters, lead = f[0].health / f[0].maxHealth - f[1].health / f[1].maxHealth;
    for (const s of [0, 1] as const) { const behind = s === 0 ? lead < 0 : lead > 0; if (!behind) behindSince[s] = -1; else if (behindSince[s] < 0) behindSince[s] = d.tick; }
  }
  const outcome = !d.finish ? 'stall' : !d.finish.draw && d.finish.victim === 1 ? 'win' : 'loss', loser = outcome === 'win' ? 1 : 0;
  const decided = outcome !== 'stall' && (specialKill || specialAt[loser].includes(behindSince[loser]));
  return { outcome, ticks: d.tick, decided, player: tallies[0], ai: tallies[1] };
}

// One opponent at one level over every strategy × seed, in each mode. `ticks` keeps every fight's length (a stall counts as the full 7200),
// so the report takes the median and p90 itself.
export type Mode = { wins: number; fights: number; ticks: number[]; decided: number; flipped: number; player: SpecialTally; ai: SpecialTally };
export const MODES = { off: null, 'on, interrupt off': { ...SPECIAL, interruptOnHit: false }, 'on, interrupt on': { ...SPECIAL, interruptOnHit: true } } as const;
export function cell(level: number, seeds: number, opponent: Opponent, strategies: Record<string, (d: Duel) => Intent>): Record<keyof typeof MODES, Mode> {
  const out = Object.fromEntries(Object.keys(MODES).map(k => [k, { wins: 0, fights: 0, ticks: [], decided: 0, flipped: 0, player: { cast: 0, landed: 0, cancelled: 0 }, ai: { cast: 0, landed: 0, cancelled: 0 } }])) as Record<keyof typeof MODES, Mode>;
  for (const strategy of Object.values(strategies)) for (let s = 1; s <= seeds; s++) {
    let base: FightResult['outcome'] | null = null;
    for (const [name, rule] of Object.entries(MODES) as [keyof typeof MODES, SpecialRule | null][]) {
      const r = fight(level, s, opponent, strategy, rule), m = out[name];
      base ??= r.outcome;
      m.fights++; m.wins += +(r.outcome === 'win'); m.ticks.push(r.ticks); m.decided += +r.decided; m.flipped += +(r.outcome !== base);
      for (const k of ['cast', 'landed', 'cancelled'] as const) { m.player[k] += r.player[k]; m.ai[k] += r.ai[k]; }
    }
  }
  return out;
}
