import DEFS from './sandbox-rules-defs.json' with { type: 'json' };
import SWARM_DEFS from './swarm-defs.json' with { type: 'json' };
import type { Sheet } from './sheet-rows.ts';
import PHASE_DEFS from './boss-phase-defs.json' with { type: 'json' };

// sandbox-mech: the sandbox's own rule rows (sandbox-rules-defs.json), one number each, read once at load. Every rule is 0 / absent as shipped on trunk,
// so a trunk fight is byte-identical; the Sandbox panel (sandbox/rows.json) turns them on. A sim file: no clock, no Math.random.
//   dodgeCounter: ticks after a successful roll-dodge in which Heavy becomes the guard counter (the same window a block opens). 0 = off.
const ROWS = DEFS.rules as readonly { id: string; window?: number; value?: number }[];
const num = (id: string, field: 'window' | 'value'): number => {
  const v = ROWS.find((r) => r.id === id)?.[field] ?? 0;
  if (!Number.isInteger(v) || v < 0) throw Error(`sandbox-rules-defs "${id}": ${field} is a whole number, 0 or more`);
  return v;
};
export const DODGE_COUNTER = num('dodgeCounter', 'window');
//   interruptEarly: extra lockout, in per-mille of the base interruptCooldown, when a cast is cut at its very start; it falls to 0 as the cast nears release (ModernUO: the earlier the cut, the longer the lockout). 0 = off.
export const INTERRUPT_EARLY = num('interruptEarly', 'value');
export const interruptLockout = (base: number, left: number, windup: number): number => (INTERRUPT_EARLY > 0 ? Math.round((base * (1000 + (INTERRUPT_EARLY * Math.min(left, windup)) / windup)) / 1000) : base);

//   castPushback: ticks a hit that does not interrupt pushes the caster's windup back (WoW: 0.5 s, twice a cast); castPushbackMax: how many times per cast. 0 = off.
export const CAST_PUSHBACK = num('castPushback', 'value');
export const CAST_PUSHBACK_MAX = num('castPushbackMax', 'value');

// manyOnOne (Dom 2026-10-13: 1st attacker 100%, 2nd 50%, 3rd 30%, 4th+ 30%): swarm-defs.json `attackers` rows, { index, 'world-mob': per-mille damage }. A world-mob fight stream that
// names its attacker index (duel.roll.attacker, set by the world layer) scales that foe's damage to the player by the row at or below its index. No rows (trunk) = 1000 = untouched.
type AttackerRow = { index: number; 'world-mob'?: number };
const ATTACKERS = ((SWARM_DEFS as unknown as { attackers?: AttackerRow[] }).attackers ?? []).slice().sort((a, b) => a.index - b.index);
export const attackerPerMille = (index: number | undefined): number => {
  if (!index || !ATTACKERS.length) return 1000;
  let m = 1000; for (const r of ATTACKERS) if (r.index <= index && r['world-mob'] !== undefined) m = r['world-mob'];
  return m;
};

// bossPhases (Dom 2026-10-13: bosses change their ATTACK at health steps, never their colour): boss-phase-defs.json `phases` rows, { id, special ('*' = any), below (percent of max health), share (per-mille multiplier on the
// special's damage share), cooldown (percent of the special's normal cooldown left when the phase starts), label, note }. The first tick the boss is under `below` percent, once per fight, its special hits harder and is ready
// sooner (no window, tell or recovery moves). No rows (trunk) = never. The label and note are the on-screen message (wound-notice.ts).
export type PhaseRow = { id: string; special: string; below: number; share: number; cooldown: number; label?: string; note?: string };
export const PHASES: readonly PhaseRow[] = ((PHASE_DEFS as unknown as { phases: PhaseRow[] }).phases ?? []).map((r) => {
  if (!r.id || typeof r.special !== 'string' || !(r.below > 0 && r.below < 100) || !(r.share >= 1) || !(r.cooldown >= 0 && r.cooldown <= 100)) throw Error(`boss-phase-defs "${String(r.id)}": special, below (1-99), share (>= 1 per-mille) and cooldown (0-100) are required`);
  return r;
});
export const phaseText = (id: string): { label: string; note: string } | undefined => { const r = PHASES.find((p) => p.id === id); return r?.label ? { label: r.label, note: r.note ?? '' } : undefined; };

// castPenalty (Dom 2026-10-13: armour weight slows casting; numbers as Lead's #2577 armour-weights.json, heavy 20 / medium 10 / light 0): sandbox-rules-defs.json `castPenalty` rows, { id, dial, atLeast, percent }. The sim
// sees gear only as the sheet's ten dials, so the weight class is read off them: the heaviest row whose dial the wearer's sheet reaches adds `percent` of the windup to a special's cast time (plate = armour dial, leathers = stamina
// dial, robes match none). When promoted, a weightClass lookup replaces the dial test; the percentages stay. No rows (trunk) = the plain windup.
export type CastPenaltyRow = { id: string; dial: string; atLeast: number; percent: number };
export const CAST_PENALTY: readonly CastPenaltyRow[] = ((DEFS as unknown as { castPenalty?: CastPenaltyRow[] }).castPenalty ?? []).map((r) => {
  if (!r.id || !r.dial || !Number.isFinite(r.atLeast) || !(r.percent >= 0)) throw Error(`sandbox-rules-defs castPenalty "${String(r.id)}": id, dial, atLeast and percent (0 or more) are required`);
  return r;
});
export const castWindup = (sheet: Sheet | undefined, base: number): number => {
  let pct = 0; for (const r of CAST_PENALTY) if ((sheet?.[r.dial] ?? 0) >= r.atLeast && r.percent > pct) pct = r.percent;
  return base + Math.round((base * pct) / 100);
};

// execution (Dom 2026-10-13, Veloren poise-to-health, Sekiro deathblow): a critical blow (the `critical` move: the heavy thrown in the window a posture break opens) hits `executeMult` per-mille of its
// normal damage, and finishes outright a foe at or under `executeBelow` percent of max health. Both 0 = off (trunk): the blow is the plain number.
export const EXECUTE_MULT = num('executeMult', 'value');
export const EXECUTE_BELOW = num('executeBelow', 'value');
export const executed = (damage: number, critical: boolean, targetHealth: number, targetMax: number): number => {
  if (!critical || (!EXECUTE_MULT && !EXECUTE_BELOW)) return damage;
  const hit = EXECUTE_MULT ? Math.round((damage * EXECUTE_MULT) / 1000) : damage;
  return EXECUTE_BELOW && (targetHealth * 100) / targetMax <= EXECUTE_BELOW ? Math.max(hit, targetHealth) : hit;
};

// oneButton (Dom 2026-10-13, touch layout A): the STRIKE button decides its swing by the thumb. A release before `heavyHold` ms is the plain light, a slide up of `stabSlide` px is the thrust, a slide to a side is that cut (the
// existing slashSlide), a hold past `heavyHold` ms is the heavy (and keeps charging while held). Input intent only: the fight already takes every one of those actions. 0 = off (trunk): the button is today's Light.
export const ONE_BUTTON = num('oneButton', 'value');
export const HEAVY_HOLD_MS = num('heavyHold', 'value') || 180;
export const STAB_SLIDE_PX = num('stabSlide', 'value') || 18;
