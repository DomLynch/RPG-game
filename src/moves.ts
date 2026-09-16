// Combat data. Every timing is in fixed 60 Hz ticks; every number here is a tuning candidate, not a validated value.
// Damage is tuned for a Souls-length duel: AI vs AI at normal runs ~9 clean hits / ~35 s (light 11, heavy 18, riposte 24, heavy riposte 30, kick 4).
// The engine (duel.ts) reads this table; nothing here may depend on rendering, clocks or browser state.
export type MoveId = 'light_right' | 'light_left' | 'heavy_overhead' | 'thrust' | 'riposte' | 'heavy_riposte' | 'heavy_counter' | 'critical' | 'kick';
export type Direction = 'right' | 'left' | 'overhead' | 'thrust' | 'low';
export type Timing = { windup: number; active: number; recovery: number };
export const total = (t: Timing): number => t.windup + t.active + t.recovery;

// Baked blade trajectories: one immutable table per (authored clip, timing). scripts/bake-blades.mjs samples the rig at these
// timings; tests assert the shipped rig still agrees. `source` is the contact time inside the clip; `clip` is the rig animation.
export type PathId = 'light_right' | 'light_left' | 'light_right_chain' | 'light_left_chain' | 'heavy_overhead' | 'heavy_overhead_chain' | 'thrust' | 'riposte' | 'heavy_riposte';
export const PATHS: Record<PathId, Timing & { clip: 'Attack' | 'Return' | 'Heavy' | 'Riposte'; source: number }> = {
  light_right: { clip: 'Attack', source: 18 / 66, windup: 14, active: 5, recovery: 21 },
  light_left: { clip: 'Return', source: 1 - 18 / 66, windup: 14, active: 5, recovery: 21 },
  light_right_chain: { clip: 'Attack', source: 18 / 66, windup: 12, active: 5, recovery: 17 },
  light_left_chain: { clip: 'Return', source: 1 - 18 / 66, windup: 12, active: 5, recovery: 17 },
  heavy_overhead: { clip: 'Heavy', source: .48, windup: 32, active: 5, recovery: 31 },
  heavy_overhead_chain: { clip: 'Heavy', source: .48, windup: 22, active: 5, recovery: 31 },
  thrust: { clip: 'Riposte', source: .34, windup: 16, active: 5, recovery: 21 },
  riposte: { clip: 'Riposte', source: .34, windup: 12, active: 5, recovery: 19 },
  heavy_riposte: { clip: 'Heavy', source: .48, windup: 20, active: 5, recovery: 25 },
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
  breaksGuard: boolean;           // cannot be blocked: a standing guard is broken instead (a charged heavy always breaks)
  chip: number;                   // fraction of damage that passes through an ordinary block (a perfect block stops it all)
  parryable: boolean;
  knockback: number;              // defender shove ticks on a clean hit
  stepIn: number;                 // wind-up lunge speed (fraction of walking speed) from RULES.stepInFrom until contact
  feintUntil: number;             // a fresh guard press inside this many wind-up ticks cancels the swing into a guard (0 = never)
  posture: number;                // posture put on the defender by a clean hit or a block (a perfect block takes RULES.posture.perfect of it)
  chamber: number | null;         // wind-up tick at which a held swing pauses (the load is the tell); null = a press always swings through
  charges: boolean;               // a chamber held for RULES.charge.min ticks becomes the charged swing (multiplied, breaks a guard)
  reach: number;                  // AI range estimate for swords; the actual cone for kicks
  vsGuard: { stagger: number; staminaDamage: number } | null;  // kick against a standing guard
};

const light = (id: 'light_right' | 'light_left', direction: Direction): MoveDef => ({
  id, direction, path: id, chainPath: `${id}_chain`, chained: { windup: 12, active: 5, recovery: 17 },
  chain: { window: 18, follow: [id === 'light_right' ? 'light_left' : 'light_right', 'heavy_overhead'] },   // the opposite cut chains fast; a heavy finisher winds up quicker
  windup: 14, active: 5, recovery: 21, damage: 11, stamina: 20, staminaDamage: 25, stagger: 24, poise: 0, poiseFrom: 0,
  breaksGuard: false, chip: 0, parryable: true, knockback: 4, stepIn: .55, feintUntil: 7, reach: 1.65, vsGuard: null, posture: 18, chamber: 6, charges: false,
});
export const MOVES: Record<MoveId, MoveDef> = {
  light_right: light('light_right', 'right'),
  light_left: light('light_left', 'left'),
  heavy_overhead: {
    id: 'heavy_overhead', direction: 'overhead', path: 'heavy_overhead', chainPath: 'heavy_overhead_chain', chained: { windup: 22, active: 5, recovery: 31 }, chain: null,
    windup: 32, active: 5, recovery: 31, damage: 18, stamina: 35, staminaDamage: 40, stagger: 24, poise: 24, poiseFrom: 24,
    breaksGuard: false, chip: .4, parryable: true, knockback: 4, stepIn: .55, feintUntil: 11, reach: 1.9, vsGuard: null, posture: 30, chamber: 10, charges: true,   // a guard takes it for chip and 40 stamina; only the charged swing breaks a guard. Feintable through the charge point
  },
  // Thrust: a lunge (stepIn 1 = walking pace) that lands from 2.0 m in 16 ticks, where a cut needs 1.75 m and a heavy 32 ticks; fully
  // blockable, so it is the spacing and counter-hit tool, not the guard opener.
  thrust: {
    id: 'thrust', direction: 'thrust', path: 'thrust', chainPath: null, chained: null, chain: null,
    windup: 16, active: 5, recovery: 21, damage: 14, stamina: 25, staminaDamage: 25, stagger: 20, poise: 0, poiseFrom: 0,
    breaksGuard: false, chip: 0, parryable: true, knockback: 3, stepIn: 1, feintUntil: 9, reach: 2, vsGuard: null, posture: 14, chamber: 8, charges: false,
  },
  riposte: {
    id: 'riposte', direction: 'thrust', path: 'riposte', chainPath: null, chained: null, chain: null,
    windup: 12, active: 5, recovery: 19, damage: 24, stamina: 20, staminaDamage: 0, stagger: 24, poise: 0, poiseFrom: 0,
    breaksGuard: true, chip: 0, parryable: true, knockback: 4, stepIn: .55, feintUntil: 6, reach: 1.65, vsGuard: null, posture: 0, chamber: null, charges: false,   // the parry already filled posture; the riposte is the damage payoff, not a second one (two parries must not be a kill)
  },
  heavy_riposte: {   // the heavy answer to a successful parry: slower and costlier than the thrust, but it breaks a guard raised in panic
    id: 'heavy_riposte', direction: 'overhead', path: 'heavy_riposte', chainPath: null, chained: null, chain: null,
    windup: 20, active: 5, recovery: 25, damage: 30, stamina: 35, staminaDamage: 0, stagger: 24, poise: 0, poiseFrom: 0,
    breaksGuard: true, chip: 0, parryable: true, knockback: 4, stepIn: .55, feintUntil: 6, reach: 1.9, vsGuard: null, posture: 0, chamber: null, charges: false,   // as the riposte: no posture on top of the parry's
  },
  heavy_counter: {   // guard counter: a heavy thrown straight out of a block. Fast and armoured against lights; shares the heavy riposte's baked path and timing.
    id: 'heavy_counter', direction: 'overhead', path: 'heavy_riposte', chainPath: null, chained: null, chain: null,
    windup: 20, active: 5, recovery: 25, damage: 20, stamina: 30, staminaDamage: 0, stagger: 30, poise: 24, poiseFrom: 4,
    breaksGuard: true, chip: 0, parryable: true, knockback: 4, stepIn: .55, feintUntil: 6, reach: 1.9, vsGuard: null, posture: 30, chamber: null, charges: false,
  },
  // Critical: the earned hit on a broken posture — Heavy inside the critical window. Unparryable, armoured, twice a heavy's damage.
  critical: {
    id: 'critical', direction: 'overhead', path: 'heavy_riposte', chainPath: null, chained: null, chain: null,
    windup: 20, active: 5, recovery: 25, damage: 40, stamina: 25, staminaDamage: 0, stagger: 40, poise: 30, poiseFrom: 0,
    breaksGuard: true, chip: 0, parryable: false, knockback: 6, stepIn: .55, feintUntil: 0, reach: 1.9, vsGuard: null, posture: 0, chamber: null, charges: false,
  },
  kick: {
    id: 'kick', direction: 'low', path: null, chainPath: null, chained: null, chain: null,
    windup: 18, active: 1, recovery: 25, damage: 4, stamina: 25, staminaDamage: 15, stagger: 18, poise: 0, poiseFrom: 0,
    breaksGuard: false, chip: 0, parryable: false, knockback: 6, stepIn: .55, feintUntil: 0, reach: 1.2, vsGuard: { stagger: 36, staminaDamage: 45 }, posture: 24, chamber: null, charges: false,
  },
};

export const RULES = {
  draw: 42, roll: 36, safeStart: 4, safeEnd: 20, rollCost: 30,
  // Backstep: a short positional evade with no invulnerability. speed 1 = walking pace, so 12 ticks travel 0.6 m; its tail can be
  // cancelled into an attack, and holding the dodge control converts it into a roll for the price difference.
  backstep: { ticks: 12, speed: 1, cost: 10, cancelFrom: 8 },
  dodgeAttackWindow: 2,   // a light started this soon after an evade (or from a backstep's tail) uses its chained timing
  // perfectBlock: a block in the first ticks of a held guard costs perfectBlockCost of the normal price.
  // breakCost: a broken guard loses this much stamina (not all of it): from a full bar the defender keeps one roll to escape the follow-up.
  parry: 10, parryCooldown: 30, parryStun: 90, parryRecovery: 8, feintCost: 10, blockCost: 25, breakCost: 60, perfectBlock: 3, perfectBlockCost: .5, guardSpeed: .35, guardArc: Math.PI / 3, directionalGuard: false,
  regen: .4, regenDelay: 60, sprintCost: .2, exhaustRecover: 20, exhaustedSpeed: .7,
  wound: 240, woundRegen: .8, death: 144, kickArc: Math.PI / 4,
  // Counter-hit: a clean hit on a fighter committed to a swing, or in the vulnerable tail of a roll, lands harder and staggers longer.
  // Rear hit: a modest bonus for striking inside the target's rear arc; a true backstab is earned later under stricter conditions.
  counter: { damage: 1.25, stagger: 1.5 }, rear: { arc: Math.PI / 2, damage: 1.15, stagger: 1.25 },
  guardCounter: 20,   // ticks after a block in which Heavy becomes the guard counter; any attack consumes the window
  // Posture (Sekiro-style): blocks, clean hits and being parried fill it; it drains while the fighter is not staggered. Full = a posture
  // break: a long stagger and a critical window in which the opponent's Heavy is the `critical` move. A guard break resets it (that was the payoff).
  posture: { max: 100, decay: .2, stun: 90, parry: 35, perfect: .5 },
  // Chamber and charge: a held swing pauses at its move's `chamber` tick (the load is the tell) for at most `max` ticks; a move that
  // `charges` gains hyper-armour there and, after `min` held ticks, swings for the multiplied damage and stagger and breaks a standing
  // guard. A tap never holds; a heavy press must last chamber + min ticks (0.67 s) to charge, so a hold and a quick press differ.
  charge: { min: 30, max: 54, damage: 1.5, stagger: 1.5 },
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
  hard: { reaction: 10, accuracy: .95, parry: .6, dodge: .35, aggression: .85, pressure: .5, discipline: 40 },   // 167 ms: hard is decisions and feints, not input-reading (was 7)
};
