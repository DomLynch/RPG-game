// Combat data. Every timing is in fixed 60 Hz ticks; every number here is a tuning candidate, not a validated value.
// The engine (duel.ts) reads this table; nothing here may depend on rendering, clocks or browser state.
export type MoveId = 'light_right' | 'light_left' | 'heavy_overhead' | 'riposte' | 'kick';
export type Direction = 'right' | 'left' | 'overhead' | 'thrust' | 'low';
export type Timing = { windup: number; active: number; recovery: number };
export const total = (t: Timing): number => t.windup + t.active + t.recovery;

// Baked blade trajectories: one immutable table per (authored clip, timing). scripts/bake-blades.mjs samples the rig at these
// timings; tests assert the shipped rig still agrees. `source` is the contact time inside the clip; `clip` is the rig animation.
export type PathId = 'light_right' | 'light_left' | 'light_right_chain' | 'light_left_chain' | 'heavy_overhead' | 'riposte';
export const PATHS: Record<PathId, Timing & { clip: 'Attack' | 'Return' | 'Heavy' | 'Riposte'; source: number }> = {
  light_right: { clip: 'Attack', source: 18 / 66, windup: 14, active: 5, recovery: 21 },
  light_left: { clip: 'Return', source: 1 - 18 / 66, windup: 14, active: 5, recovery: 21 },
  light_right_chain: { clip: 'Attack', source: 18 / 66, windup: 12, active: 5, recovery: 17 },
  light_left_chain: { clip: 'Return', source: 1 - 18 / 66, windup: 12, active: 5, recovery: 17 },
  heavy_overhead: { clip: 'Heavy', source: .48, windup: 32, active: 5, recovery: 31 },
  riposte: { clip: 'Riposte', source: .34, windup: 12, active: 5, recovery: 19 },
};

export type MoveDef = Timing & {
  id: MoveId;
  direction: Direction;
  path: PathId | null;            // swept blade table; null = short reach cone (kick)
  chainPath: PathId | null;       // faster table when performed as a chain follow-up
  chained: Timing | null;         // timing as a follow-up; null = never accelerated
  chain: { window: number; follow: MoveId[] } | null;   // follow-ups started within `window` ticks after recovery use `chained`
  damage: number;
  stamina: number;                // attacker cost at commitment
  staminaDamage: number;          // defender guard stamina drained by a blocked sword hit / any kick hit
  stagger: number;                // hurt ticks dealt by a clean hit
  poise: number;                  // incoming stagger shrugged off between poiseFrom and the end of the active window
  poiseFrom: number;
  breaksGuard: boolean;           // cannot be blocked: a standing guard is broken instead
  parryable: boolean;
  knockback: number;              // defender shove ticks on a clean hit
  stepIn: number;                 // wind-up lunge speed (fraction of walking speed) from RULES.stepInFrom until contact
  feintUntil: number;             // a fresh guard press inside this many wind-up ticks cancels the swing into a guard (0 = never)
  reach: number;                  // AI range estimate for swords; the actual cone for kicks
  vsGuard: { stagger: number; staminaDamage: number } | null;  // kick against a standing guard
};

const light = (id: 'light_right' | 'light_left', direction: Direction): MoveDef => ({
  id, direction, path: id, chainPath: `${id}_chain`, chained: { windup: 12, active: 5, recovery: 17 },
  chain: { window: 18, follow: [id === 'light_right' ? 'light_left' : 'light_right'] },
  windup: 14, active: 5, recovery: 21, damage: 25, stamina: 20, staminaDamage: 25, stagger: 24, poise: 0, poiseFrom: 0,
  breaksGuard: false, parryable: true, knockback: 4, stepIn: .55, feintUntil: 6, reach: 1.65, vsGuard: null,
});
export const MOVES: Record<MoveId, MoveDef> = {
  light_right: light('light_right', 'right'),
  light_left: light('light_left', 'left'),
  heavy_overhead: {
    id: 'heavy_overhead', direction: 'overhead', path: 'heavy_overhead', chainPath: null, chained: null, chain: null,
    windup: 32, active: 5, recovery: 31, damage: 38, stamina: 35, staminaDamage: 0, stagger: 24, poise: 24, poiseFrom: 24,
    breaksGuard: true, parryable: true, knockback: 4, stepIn: .55, feintUntil: 10, reach: 1.9, vsGuard: null,
  },
  riposte: {
    id: 'riposte', direction: 'thrust', path: 'riposte', chainPath: null, chained: null, chain: null,
    windup: 12, active: 5, recovery: 19, damage: 40, stamina: 20, staminaDamage: 0, stagger: 24, poise: 0, poiseFrom: 0,
    breaksGuard: true, parryable: true, knockback: 4, stepIn: .55, feintUntil: 6, reach: 1.65, vsGuard: null,
  },
  kick: {
    id: 'kick', direction: 'low', path: null, chainPath: null, chained: null, chain: null,
    windup: 18, active: 1, recovery: 25, damage: 8, stamina: 25, staminaDamage: 15, stagger: 18, poise: 0, poiseFrom: 0,
    breaksGuard: false, parryable: false, knockback: 6, stepIn: .55, feintUntil: 0, reach: 1.2, vsGuard: { stagger: 36, staminaDamage: 45 },
  },
};

export const RULES = {
  draw: 42, roll: 36, safeStart: 4, safeEnd: 20, rollCost: 30,
  // Backstep: a short positional evade with no invulnerability. speed 1 = walking pace, so 12 ticks travel 0.6 m; its tail can be
  // cancelled into an attack, and holding the dodge control converts it into a roll for the price difference.
  backstep: { ticks: 12, speed: 1, cost: 10, cancelFrom: 8 },
  parry: 10, parryCooldown: 30, parryStun: 90, parryRecovery: 8, feintCost: 10, blockCost: 25, guardSpeed: .35, guardArc: Math.PI / 3, directionalGuard: false,
  regen: .4, regenDelay: 60, sprintCost: .2, exhaustRecover: 20, exhaustedSpeed: .7,
  wound: 240, woundRegen: .8, death: 144, kickArc: Math.PI / 4,
  bufferWindow: 10, bufferTtl: 11, stepInFrom: 3, turnStart: .3, turnWindup: .25,
  location: { head: 1, torso: 1, legs: 1 } as Record<'head' | 'torso' | 'legs', number>,
} as const;

// Per-fighter guard overrides (a shield is data, not code): defaults come from RULES at resolution time.
export type GuardProfile = { costScale: number; arc: number; window: number; stopsHeavy: boolean };

export type AiProfile = {
  reaction: number;    // ticks before a fresh opponent action is noticed
  accuracy: number;    // 0..1 timing precision when predicting contact
  parry: number;       // 0..1 chance to attempt a parry on a noticed attack
  dodge: number;       // 0..1 chance to roll instead of guarding
  aggression: number;  // 0..1 scales attack cadence
  pressure: number;    // 0..1 chance a non-punish attack is a light rather than a heavy
  discipline: number;  // stamina floor below which it retreats and recovers
};
export const PROFILES: Record<'easy' | 'normal' | 'hard', AiProfile> = {
  // discipline sits above a heavy's cost so the warden rests instead of swinging itself into exhaustion.
  easy: { reaction: 24, accuracy: .5, parry: .1, dodge: .1, aggression: .45, pressure: 0, discipline: 60 },
  normal: { reaction: 14, accuracy: .75, parry: .3, dodge: .2, aggression: .65, pressure: 0, discipline: 50 },
  hard: { reaction: 7, accuracy: .95, parry: .6, dodge: .35, aggression: .85, pressure: .5, discipline: 40 },
};
