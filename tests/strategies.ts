// The scripted strategies and the battery runner shared by tests/battery.test.ts, tests/opponents.test.ts and tests/autopsy.test.ts.
// Moved here verbatim from tests/battery.test.ts so a test can import the strategies without re-registering the battery's slow gates.
import { decide, initialAi } from '../src/ai.ts';
import { createFighter, elapsed, idleIntent, legal, mirror, movesOf, opponentFighter, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { LONGSWORD, MOVES, OPPONENTS, PROFILES, RULES, SKILL_MOVE, type AiProfile, type Opponent, type SkillId, type WeaponId } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';

export const idle = (): Intent => ({ ...idleIntent(), lock: true });
export const act = (action: Intent['action'], extra: Partial<Intent> = {}): Intent => ({ ...idle(), action, ...extra });
// `skill`: the player's equipped move (null = none, the battery every rung is pinned on).
export const arena = (o: Opponent = OPPONENTS.veteran, weapon: WeaponId = 'longsword', skill: SkillId | null = null): Duel => ({ tick: 0, fighters: [{ ...createFighter({ x: 0, z: TARGET.z + 1.2, heading: Math.PI, distance: 0 }, 'ready', weapon), skill }, opponentFighter(o, { ...TARGET, heading: 0, distance: 0 })], finish: null, events: [] });
export const gap = (d: Duel) => Math.hypot(d.fighters[0].body.x - d.fighters[1].body.x, d.fighters[0].body.z - d.fighters[1].body.z);
export const W = (d: Duel) => d.fighters[1], P = (d: Duel) => d.fighters[0];
// The strategies were written for the longsword's reach; with another weapon in the player's hand their distances scale by its cut (or thrust) reach, so the
// same thumb closes to where its blade lands. With the longsword both factors are exactly 1 and the battery is unchanged.
export const k = (d: Duel) => movesOf(P(d)).light_right.reach / LONGSWORD.moves.light_right.reach, kt = (d: Duel) => movesOf(P(d)).thrust.reach / LONGSWORD.moves.thrust.reach;
export const ready = (d: Duel) => P(d).phase === 'ready';
export const swingStart = (d: Duel) => W(d).phase === 'attack' && W(d).age === 0 && W(d).move !== 'kick';
// Directional guard: a scripted guard or parry reads the warden's swing perfectly and holds the matching side (a cheese upper bound); with nothing coming it stands straight.
export const side = (d: Duel): Intent['guardDirection'] => { const w = W(d); return w.phase === 'attack' && w.move ? mirror(movesOf(w)[w.move].direction) : undefined; };
export const guard = (d: Duel, extra: Partial<Intent> = {}): Intent => ({ ...idle(), guard: true, guardDirection: side(d), ...extra });
// Each strategy is a pure function of the committed state: exactly what a thumb could do with perfect information.
export const STRATEGIES: Record<string, (d: Duel) => Intent> = {
  'kick only': d => (ready(d) && gap(d) <= 1.5 * k(d) ? act('kick') : idle()),
  'light spam': d => (ready(d) && gap(d) <= 1.7 * k(d) ? act('light') : idle()),
  'held lights': d => (ready(d) && gap(d) <= 1.7 * k(d) ? act('light', { held: true }) : { ...idle(), held: P(d).phase === 'attack' && P(d).charge < 6 }),
  'heavy only': d => (ready(d) && gap(d) <= 1.8 * k(d) ? act('heavy') : idle()),
  'charged heavy only': d => (ready(d) && gap(d) <= 1.8 * k(d) ? act('heavy', { held: true }) : { ...idle(), held: P(d).phase === 'attack' && !P(d).charged }),
  'thrust from range': d => (ready(d) && gap(d) >= 1.5 * kt(d) && gap(d) <= 1.95 * kt(d) ? act('thrust') : idle()),
  'turtle and punish': d => (P(d).punish > 0 || P(d).critical > 0 || P(d).counterWindow > 0 ? (ready(d) || P(d).phase === 'guard' ? guard(d, { action: 'heavy' }) : guard(d)) : guard(d)),
  'roll and punish': d => (swingStart(d) && ready(d) && P(d).stamina >= RULES.rollCost ? act('dodge') : ready(d) && W(d).phase === 'hurt' ? act('light') : idle()),
  // Perfect-information parry: press exactly so the window covers contact, and kick anything that is not parryable.
  // The press is timed on the tell (elapsed ticks since the swing started), the way a human reads it: a held swing that parks at its chamber
  // draws the press early and meets nothing, which is what a bait is for.
  'perfect parry': d => { const w = W(d); if (w.phase === 'attack' && w.move && !w.landed && ready(d)) { const t = movesOf(w)[w.move]; if (!t.parryable) return P(d).stamina >= RULES.rollCost ? act('dodge') : idle(); if (t.windup - elapsed(w) === RULES.parry - 2 && !P(d).parryCooldown) return guard(d, { action: 'parry' }); } return ready(d) && P(d).punish > 0 ? act('heavy') : idle(); },
};
// The two scripted uses of an equipped skill (battery `skill` <id>): cast whenever it is ready and in reach, and cast then follow with a
// light into whatever stagger it leaves (for the Pommel, the 50-tick stagger it exists for). Generated per SkillId from its move's reach,
// so every skill in SKILL_MOVE is swept the same way. Shared by tests/skill-*.test.ts and scripts/skill-battery.mjs.
export function skillUses(skill: SkillId): Record<string, (d: Duel) => Intent> {
  const reach = MOVES[SKILL_MOVE[skill]].reach, cast = (d: Duel) => ready(d) && gap(d) <= reach && legal(P(d), 'skill');
  return {
    [`${skill} on cooldown`]: d => (cast(d) ? act('skill') : idle()),
    [`${skill} then light`]: d => (ready(d) && W(d).phase === 'hurt' && gap(d) <= 1.7 ? act('light') : cast(d) ? act('skill') : ready(d) && gap(d) <= 1.7 ? act('light') : idle()),
  };
}
export const POMMEL = skillUses('pommel');
// Every equipped skill's scripted uses, keyed by SkillId: what scripts/skill-battery.mjs sweeps.
export const SKILL_STRATEGIES = Object.fromEntries((Object.keys(SKILL_MOVE) as SkillId[]).map(id => [id, skillUses(id)])) as Record<SkillId, Record<string, (d: Duel) => Intent>>;
// `opponent` picks who stands in the ring (moves.ts OPPONENTS): the same battery is the fairness gate for every man on the roster.
export function battery(level: keyof typeof PROFILES, seeds = 24, ticks = 7200, opponent: Opponent = OPPONENTS.veteran, strategies = STRATEGIES, weapon: WeaponId = 'longsword', skill: SkillId | null = null) {
  const rows: Record<string, { wins: number; losses: number; stalls: number; untouched: number; taken: number; landed: number; firstBreak: number[] }> = {};
  for (const [name, strategy] of Object.entries(strategies)) {
    const row = rows[name] = { wins: 0, losses: 0, stalls: 0, untouched: 0, taken: 0, landed: 0, firstBreak: [] as number[] };
    for (let s = 1; s <= seeds; s++) {
      let d = arena(opponent, weapon, skill), ai = initialAi((s * 2654435761) >>> 0), taken = 0, landed = 0, broke = false;
      for (let i = 0; i < ticks && !d.finish; i++) {
        const w = decide(d, 1, ai, opponent.profiles[level] as AiProfile); ai = w.ai; d = stepDuel(d, [strategy(d), w.intent]);
        if (!broke && d.events.some(e => e.type === 'GuardBroken' && e.target === 0)) { broke = true; row.firstBreak.push(d.tick); }   // the tick the player's guard first broke this fight
        // Damage taken: a hit, a broken guard, or chip through a block — a turtle that dies to chip was touched.
        for (const e of d.events) { const hurt = e.type === 'Hit' || e.type === 'GuardBroken' || (e.type === 'Blocked' && (e.damage ?? 0) > 0); if (hurt && e.target === 0) taken++; if (hurt && e.target === 1) landed++; }
      }
      if (!d.finish) row.stalls++; else if (d.finish.draw) row.losses++; else if (d.finish.victim === 1) row.wins++; else row.losses++;
      if (taken === 0) row.untouched++; row.taken += taken; row.landed += landed;
    }
  }
  return rows;
}
