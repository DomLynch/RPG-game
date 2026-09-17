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
export type PathSpec = Timing & { clip: 'Attack' | 'Return' | 'Heavy' | 'Riposte' | 'Trident_Thrust' | 'Trident_ThrustChain' | 'Trident_Sweep' | 'Trident_High'; source: number };
export const PATHS: Record<PathId, PathSpec> = {
  // The cut: a horizontal arc (UAL2 Sword_Regular_A right-to-left, _B the backhand) with a real swing — 20 ticks of tell (333 ms) and an
  // 8-tick sweep. It was 14/5/21 (233 ms, under human reaction) on a fast diagonal flick: the owner read it as "too quick and shallow".
  light_right: { clip: 'Attack', source: .34, windup: 20, active: 8, recovery: 22 },
  light_left: { clip: 'Return', source: .34, windup: 20, active: 8, recovery: 22 },
  light_right_chain: { clip: 'Attack', source: .34, windup: 16, active: 8, recovery: 18 },
  light_left_chain: { clip: 'Return', source: .34, windup: 16, active: 8, recovery: 18 },
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
  minReach?: number;              // a blow started inside this gap meets nothing (a pole's point: the tines drive past the target); absent = 0
  vsGuard: { stagger: number; staminaDamage: number } | null;  // kick against a standing guard
};

const light = (id: 'light_right' | 'light_left', direction: Direction): MoveDef => ({
  id, direction, path: id, chainPath: `${id}_chain`, chained: { windup: 16, active: 8, recovery: 18 },
  chain: { window: 18, follow: [id === 'light_right' ? 'light_left' : 'light_right', 'heavy_overhead'] },   // the opposite cut chains fast; a heavy finisher winds up quicker
  windup: 20, active: 8, recovery: 22, damage: 14, stamina: 25, staminaDamage: 15, stagger: 24, poise: 0, poiseFrom: 0,   // 14 for 25 stamina: the cut's tell (333 ms) is longer than the stab's, so it pays and costs more (owner, 2026-09-16); ladder stab 11 < cut 14 < heavy 18
  breaksGuard: false, chip: 0, parryable: true, knockback: 4, stepIn: .4, feintUntil: 10, reach: 1.65, vsGuard: null, posture: 20, chamber: 9, charges: false,   // stepIn .4 over 20 ticks ≈ the old .55 over 14: the same lunge
});
export const MOVES: Record<MoveId, MoveDef> = {
  light_right: light('light_right', 'right'),
  light_left: light('light_left', 'left'),
  heavy_overhead: {
    id: 'heavy_overhead', direction: 'overhead', path: 'heavy_overhead', chainPath: 'heavy_overhead_chain', chained: { windup: 22, active: 5, recovery: 31 }, chain: null,
    windup: 32, active: 5, recovery: 31, damage: 18, stamina: 35, staminaDamage: 30, stagger: 24, poise: 24, poiseFrom: 24,
    breaksGuard: false, chip: .4, parryable: true, knockback: 4, stepIn: .55, feintUntil: 11, reach: 1.9, vsGuard: null, posture: 32, chamber: 10, charges: true,   // a guard takes it for chip and 40 stamina; only the charged swing breaks a guard. Feintable through the charge point
  },
  // Thrust: a lunge (stepIn 1 = walking pace) that lands from 2.0 m in 16 ticks, where a cut needs 1.75 m and a heavy 32 ticks; fully
  // blockable, so it is the spacing and counter-hit tool, not the guard opener.
  thrust: {
    id: 'thrust', direction: 'thrust', path: 'thrust', chainPath: null, chained: null, chain: null,
    windup: 16, active: 5, recovery: 21, damage: 11, stamina: 20, staminaDamage: 20, stagger: 20, poise: 0, poiseFrom: 0,   // 11 clean for 20 stamina (14 counter, 17 as the stop-hit): the fastest tell, the longest reach
    breaksGuard: false, chip: 0, parryable: true, knockback: 3, stepIn: 1, feintUntil: 9, reach: 2, vsGuard: null, posture: 16, chamber: 8, charges: false,
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
  health: 150,                    // a duel of 8–15 blows (the owner's target): 150 with the 40/s regeneration measured 10 hits / 38 s at normal in review
  draw: 42, roll: 36, safeStart: 4, safeEnd: 20, rollCost: 30,
  // Backstep: a short positional evade with no invulnerability. speed 1 = walking pace, so 12 ticks travel 0.6 m; its tail can be
  // cancelled into an attack, and holding the dodge control converts it into a roll for the price difference.
  backstep: { ticks: 12, speed: 1, cost: 10, cancelFrom: 8 },
  dodgeAttackWindow: 2,   // a light started this soon after an evade (or from a backstep's tail) uses its chained timing
  // perfectBlock: a block in the first ticks of a held guard costs perfectBlockCost of the normal price.
  // breakCost: a broken guard loses this much stamina (not all of it): from a full bar the defender keeps one roll to escape the follow-up.
  parry: 10, parryCooldown: 30, parryStun: 90, parryRecovery: 8, feintCost: 10, blockCost: 25, breakCost: 60, perfectBlock: 3, perfectBlockCost: .5, guardSpeed: .35, guardArc: Math.PI / 3, directionalGuard: false,
  regen: 2 / 3, regenDelay: 45, guardRegen: .5, sprintCost: .2, exhaustRecover: 20, exhaustedSpeed: .7,   // 40 stamina/s after .75 s; a raised guard regenerates at half rate
  wound: 240, woundRegen: .8, death: 144, kickArc: Math.PI / 4,
  // Counter-hit: a clean hit on a fighter committed to a swing, or in the vulnerable tail of a roll, lands harder and staggers longer.
  // Rear hit: a modest bonus for striking inside the target's rear arc; a true backstab is earned later under stricter conditions.
  counter: { damage: 1.25, stagger: 1.5 }, rear: { arc: Math.PI / 2, damage: 1.15, stagger: 1.25 },
  guardCounter: 20,   // ticks after a block in which Heavy becomes the guard counter; any attack consumes the window
  // Posture (Sekiro-style): blocks, clean hits and being parried fill it; it drains while the fighter is not staggered. Full = a posture
  // break: a long stagger and a critical window in which the opponent's Heavy is the `critical` move. A guard break resets it (that was the payoff).
  posture: { max: 100, decay: .2, hold: 45, stun: 90, parry: 25, perfect: .5 },   // slice Q: the drain pauses `hold` ticks after any gain, so a run of blocks can reach a break; swept to ~one break per two duels at normal
  // The ring wall: knockback that meets the wall adds stagger and posture (the wall hits back); a fighter with the wall at its back cannot
  // backstep. `edge` is how close to RADIUS counts as at the wall.
  wall: { edge: .25, stagger: 12, posture: 15 },
  // Attrition: every blade wound takes `stamina` off the wounded fighter's maximum for the duel (floor `floor`); a leg wound slows walking by `legSpeed`.
  attrition: { stamina: 8, floor: 40, legSpeed: .85 },
  // The thrust as the stop-hit: into a swinging opponent, or one that has walked `walk` metres onto the point since the thrust started, it
  // counter-hits harder than a cut would; a thrust that meets nothing overextends and recovers `whiff` ticks longer.
  stopHit: { damage: 1.5, stagger: 1.75, whiff: 10, walk: .3 },   // walk: how far the target must have come on since the thrust started to count as walking onto it
  // Chamber and charge: a held swing pauses at its move's `chamber` tick (the load is the tell) for at most `max` ticks; a move that
  // `charges` gains hyper-armour there and, after `min` held ticks, swings for the multiplied damage and stagger and breaks a standing
  // guard. A tap never holds; a heavy press must last chamber + min ticks (0.67 s) to charge, so a hold and a quick press differ.
  charge: { min: 30, max: 54, damage: 1.5, stagger: 1.5 },
  bufferWindow: 10, bufferTtl: 11, stepInFrom: 3, turnStart: .3, turnWindup: .25,
  location: { head: 1, torso: 1, legs: 1 } as Record<'head' | 'torso' | 'legs', number>,
} as const;

// Per-fighter guard overrides (a shield is data, not code): defaults come from RULES at resolution time.
export type GuardProfile = { costScale: number; arc: number; window: number; recovery: number; commits: boolean; stopsHeavy: boolean; heavyBreaks: boolean };   // recovery: ticks exposed after a parry that met nothing (RULES.parryRecovery unless the guard says otherwise); commits: a parry that must run its window — no action out of it, and one that met nothing always ends exposed, held or not (a man's parry yields to any action; the Nightborn's does not)   // heavyBreaks: a plain overhead heavy breaks this guard (a shaft has no blade to catch it on)

export type AiProfile = {
  reaction: number;    // ticks before a fresh opponent action is noticed
  accuracy: number;    // 0..1 timing precision when predicting contact
  parry: number;       // 0..1 chance to attempt a parry on a noticed attack
  dodge: number;       // 0..1 chance to roll instead of guarding
  aggression: number;  // 0..1 scales attack cadence
  pressure: number;    // 0..1 chance a non-punish attack is a light rather than a heavy
  discipline: number;  // stamina floor below which it retreats and recovers
  lapse: number;       // 0..1 chance a noticed swing gets no answer at all (a human does not react to every cut they see; the AI would)
  // Fight-identity knobs (slice X, for the goblin; absent = the warden as it always was):
  feint?: number;      // 0..1 base share of cuts and heavies that are feints against anyone (the read-parrier's 1/6 still applies on top)
  guard?: number;      // 0..1 share of the guard in its game: the standing guard, the bait guard, the block plan and the guard-walk (0 = never guards: evades or steps back instead)
  disengage?: number;  // 0..1 chance to hop back out of range right after landing a blow (hit and run)
  circle?: number;     // 0..1 lateral drift while closing in (0 = walks straight in); it always circles once in range
  regen?: number;      // stamina regeneration multiplier for this fighter (1 = RULES.regen)
  step?: number;       // 0..1 share of evasions taken as a backstep rather than a roll (light on his feet: 10 stamina and 12 ticks, not 30 and 36)
  interrupt?: number;  // 0..1 chance to cut INTO a slower tell when his own cut lands first (a fast fighter's counter-swing; 0 = never attacks into a threat)
  kick?: number;       // 0..1 share of answers to a read roller or backstepper that are kicks (the one blow their timing does not escape)
  dash?: number;       // 0..1 chance to sprint into an opening (a whiff, a stagger) from outside reach instead of walking (a darter closes in a few ticks)
};
// A weapon is data a fighter carries: its move table, its blade paths (baked per weapon by scripts/bake-blades.mjs from
// scripts/blade-manifest.json), the kind of guard it makes, its material (audio picks cues by it) and the reach the AI reasons with.
// Every MOVES/PATHS/blade-path lookup in the simulation goes through the fighter's weapon (`weaponOf`), so a second weapon is a table,
// not a rule change. The trident entry is the longsword's data until the weapons lane lands its own — nothing changes on trunk.
export type WeaponId = 'longsword' | 'trident' | 'cleaver' | 'estoc' | 'knife';
export type Material = 'iron' | 'bronze' | 'wood';
export type Weapon = { id: WeaponId; moves: Record<MoveId, MoveDef>; paths: Record<PathId, PathSpec>; guard: 'blade' | 'shaft'; material: Material; reach: number; placeholder?: true;
  guardProfile?: Partial<GuardProfile>;   // how this weapon's guard takes a blow (absent = the longsword defaults in RULES)
  fight: { thrustShare: number; close: number };   // the warden's stance with it: share of non-cut openers that are thrusts (the first is always a heavy); the gap it closes to for a cut or a heavy
};
export const LONGSWORD: Weapon = { id: 'longsword', moves: MOVES, paths: PATHS, guard: 'blade', material: 'iron', reach: MOVES.thrust.reach, fight: { thrustShare: .2, close: 1.15 } };   // the thrust's real job is the stop-hit, so it is a minority opener

// ── Trident (weapons lane, 2026-09-16): the Veteran's short trident, a different fight from the longsword — reach and thrusts, weak
// inside the point. Rig: src/assets/veteran.glb, built with WARRIOR_WEAPON=trident (WeaponDrawn, contact = the tines). The move ids keep the
// game's button grammar: Slash = the low sweep (one clip, both sides), Stab = the thrust (it chains into a second thrust), Heavy =
// the overhead pin; riposte / counter / critical ride the thrust-chain and pin paths. The clips only fix where the contact key sits
// (.34, pin .48). LIVE since slice V (combat review 2026-09-16): initialDuel gives the Veteran this table; the reaches are the measured
// landing frontiers (tests/weapons.test.ts, ±0.1 m) and the balance is pinned by the battery (tests/battery.test.ts).
export const TRIDENT_PATHS: Record<PathId, PathSpec> = {
  light_right: { clip: 'Trident_Sweep', source: .34, windup: 22, active: 8, recovery: 24 },        // low sweep: a 1.9 m pole tells longer than a cut
  light_left: { clip: 'Trident_Sweep', source: .34, windup: 22, active: 8, recovery: 24 },
  light_right_chain: { clip: 'Trident_Sweep', source: .34, windup: 18, active: 8, recovery: 20 },
  light_left_chain: { clip: 'Trident_Sweep', source: .34, windup: 18, active: 8, recovery: 20 },
  heavy_overhead: { clip: 'Trident_High', source: .48, windup: 34, active: 5, recovery: 33 },       // the pin: slower and heavier than the sword's heavy
  heavy_overhead_chain: { clip: 'Trident_High', source: .48, windup: 24, active: 5, recovery: 33 },
  thrust: { clip: 'Trident_Thrust', source: .34, windup: 16, active: 5, recovery: 23 },            // the sword stab's tell, a longer recovery: the pole comes back
  riposte: { clip: 'Trident_ThrustChain', source: .34, windup: 12, active: 5, recovery: 19 },      // the second thrust, from half-withdrawn; also the riposte
  heavy_riposte: { clip: 'Trident_High', source: .48, windup: 22, active: 5, recovery: 27 },
};
const sweep = (id: 'light_right' | 'light_left'): MoveDef => ({
  ...MOVES[id], direction: 'low', path: id, chainPath: `${id}_chain`, chained: { windup: 18, active: 8, recovery: 20 },
  chain: { window: 18, follow: [id === 'light_right' ? 'light_left' : 'light_right', 'thrust'] },   // sweep, sweep, or a sweep into the thrust
  windup: 22, active: 8, recovery: 24, damage: 12, stamina: 25, staminaDamage: 15, stagger: 26, knockback: 5, stepIn: .3, feintUntil: 11, reach: 1.75, posture: 18, chamber: 10,   // lands to 1.75 m measured (the cut: 1.7): a short pole's low sweep
});
export const TRIDENT_MOVES: Record<MoveId, MoveDef> = {
  light_right: sweep('light_right'),
  light_left: sweep('light_left'),
  heavy_overhead: { ...MOVES.heavy_overhead, chained: { windup: 24, active: 5, recovery: 33 }, windup: 34, active: 5, recovery: 33, damage: 20, stamina: 38, staminaDamage: 35, chip: .5, stepIn: .45, feintUntil: 12, reach: 2.15, posture: 36, chamber: 11 },
  // Thrust: the trident's identity. Lands from 2.25 m against a standing target (the sword's stab from 2.0; measured, tests/weapons.test.ts)
  // on the stab's 16-tick tell and lunge, and chains into a second, faster thrust; parryable and fully blockable, as the stab is.
  // "Weak inside the point" is NOT in these numbers: the sim sweeps the tines from the wind-up pose, so a thrust lands from 0.4 m
  // like the sword's — a whiff inside ~1 m needs a rule (artifacts/weapons/REQUESTS.md), which is the combat lane's call.
  thrust: { ...MOVES.thrust, chainPath: 'riposte', chained: { windup: 12, active: 5, recovery: 19 }, chain: { window: 16, follow: ['thrust'] }, windup: 16, active: 5, recovery: 23, damage: 12, stamina: 22, staminaDamage: 22, stagger: 20, stepIn: 1, reach: 2.25, minReach: 1, posture: 16, chamber: 8 },   // minReach: a thrust started inside 1 m (bodies stand no closer than .85) drives the point past the target and meets nothing; the sweep and the kick have no such hole
  riposte: { ...MOVES.riposte, windup: 12, active: 5, recovery: 19, reach: 2.1 },
  heavy_riposte: { ...MOVES.heavy_riposte, windup: 22, active: 5, recovery: 27, reach: 2.15 },
  heavy_counter: { ...MOVES.heavy_counter, windup: 22, active: 5, recovery: 27, reach: 2.15 },
  critical: { ...MOVES.critical, windup: 22, active: 5, recovery: 27, reach: 2.15 },
  kick: MOVES.kick,
};
// Slice V (combat review, 2026-09-16): the shaft guard pays 15 % more for every block and a plain overhead heavy breaks it (the blade guard
// only breaks to a charged one); the Veteran opens with the thrust three times in five and closes to sweep range, not the sword's cutting range.
export const TRIDENT: Weapon = { id: 'trident', moves: TRIDENT_MOVES, paths: TRIDENT_PATHS, guard: 'shaft', material: 'bronze', reach: TRIDENT_MOVES.thrust.reach, guardProfile: { costScale: 1.15, heavyBreaks: true }, fight: { thrustShare: .6, close: 1.4 } };

// ── Cleaver (weapons lane, 2026-09-16): the Pitborn's. "A fat scythe-type cleaver, wider and the same length as the longsword" (owner):
// it rides the LONGSWORD'S CLIP FAMILY (Attack / Return / Heavy / Riposte on its own rig, src/assets/weapons/cleaver/veteran-cleaver.glb,
// WeaponDrawn, contact = the edge .14–.86) so the renderer needs nothing new. What the single edge does to the sword's moves, measured
// from the bake (artifacts/weapons/tools/edge-check.mjs): the forehand cut leads with the edge → the CHOP; the backhand leads with the
// spine → the BACK OF THE CLEAVER, a blunt hammer blow (less damage, more stagger and posture); the overhead is re-keyed on the cleaver's
// rig as a diagonal HACK so its edge leads (the sword's straight overhead comes down flat); the thrust is a clumsy POKE. Slower tells,
// longer recoveries, more damage and chip: a brute's weapon. Lunges (stepIn × wind-up) equal the sword's so the Pitborn's whiff window
// (tests/opponents.test.ts: a 12-tick backstep escapes his swing and the punish lands) survives; `reach` follows the SWORD's convention —
// the warden's conservative spacing estimate (cut 1.65 / heavy 1.9 / stab 2.0), not the measured frontier (1.7 / 2.2 / 2.05), so he
// spaces like the man the seam was tuned against. Every number PROVISIONAL — GAMEPLAY CHANGE for combat review.
export const CLEAVER_PATHS: Record<PathId, PathSpec> = {
  light_right: { clip: 'Attack', source: .34, windup: 22, active: 8, recovery: 26 },        // the chop: 2 ticks more tell than the cut, a longer recovery
  light_left: { clip: 'Return', source: .34, windup: 22, active: 8, recovery: 26 },         // the back of the cleaver
  light_right_chain: { clip: 'Attack', source: .34, windup: 18, active: 8, recovery: 22 },
  light_left_chain: { clip: 'Return', source: .34, windup: 18, active: 8, recovery: 22 },
  heavy_overhead: { clip: 'Heavy', source: .48, windup: 36, active: 6, recovery: 36 },      // the hack (the cleaver rig's own Heavy keys)
  heavy_overhead_chain: { clip: 'Heavy', source: .48, windup: 26, active: 6, recovery: 36 },
  thrust: { clip: 'Riposte', source: .34, windup: 18, active: 5, recovery: 26 },            // the poke
  riposte: { clip: 'Riposte', source: .34, windup: 12, active: 5, recovery: 21 },
  heavy_riposte: { clip: 'Heavy', source: .48, windup: 22, active: 6, recovery: 29 },
};
export const CLEAVER_MOVES: Record<MoveId, MoveDef> = {
  light_right: { ...MOVES.light_right, chained: { windup: 18, active: 8, recovery: 22 }, chain: { window: 18, follow: ['light_left', 'heavy_overhead'] },
    windup: 22, active: 8, recovery: 26, damage: 17, stamina: 28, staminaDamage: 24, stagger: 26, chip: .2, knockback: 5, stepIn: .36, feintUntil: 11, posture: 26, chamber: 10, reach: 1.65 },   // the chop: some of it comes through a guard. stepIn .36 over 22 ticks = the cut's lunge over 20 (the Pitborn's whiff window — a 12-tick backstep escapes it — is tuned to that distance)
  light_left: { ...MOVES.light_left, chained: { windup: 18, active: 8, recovery: 22 }, chain: { window: 18, follow: ['light_right', 'heavy_overhead'] },
    windup: 22, active: 8, recovery: 26, damage: 9, stamina: 24, staminaDamage: 30, stagger: 32, chip: 0, knockback: 6, stepIn: .36, feintUntil: 11, posture: 34, chamber: 10, reach: 1.65 },   // the back of the cleaver: a hammer — little damage, a lot of posture, hard on a guard
  heavy_overhead: { ...MOVES.heavy_overhead, chained: { windup: 26, active: 6, recovery: 36 }, windup: 36, active: 6, recovery: 36, damage: 26, stamina: 42, staminaDamage: 45, stagger: 30, poise: 24, poiseFrom: 22, chip: .5, stepIn: .48, feintUntil: 12, posture: 42, chamber: 12, reach: 1.9 },   // the hack: stepIn .48 over 36 ticks = the heavy's lunge over 32
  thrust: { ...MOVES.thrust, windup: 18, active: 5, recovery: 26, damage: 7, stamina: 18, staminaDamage: 14, stagger: 14, stepIn: .87, feintUntil: 9, posture: 10, chamber: 9, reach: 2 },   // the poke: a cleaver is no stabbing weapon. stepIn .87 over 18 ticks = the stab's lunge over 16
  riposte: { ...MOVES.riposte, windup: 12, active: 5, recovery: 21, damage: 28, reach: 1.65 },
  heavy_riposte: { ...MOVES.heavy_riposte, windup: 22, active: 6, recovery: 29, damage: 34, reach: 1.9 },
  heavy_counter: { ...MOVES.heavy_counter, windup: 22, active: 6, recovery: 29, damage: 24, reach: 1.9 },
  critical: { ...MOVES.critical, windup: 22, active: 6, recovery: 29, damage: 46, reach: 1.9 },
  kick: MOVES.kick,
};
export const CLEAVER: Weapon = { id: 'cleaver', moves: CLEAVER_MOVES, paths: CLEAVER_PATHS, guard: 'blade', material: 'iron', reach: CLEAVER_MOVES.thrust.reach, fight: { thrustShare: .1, close: 1.15 } };   // the poke is a rare opener (one non-cut opener in ten); he closes to the sword's cutting range for his chops
// ── Knife (weapons lane, 2026-09-17): the goblin's short hooked knife — a sica (forward grip, inward hook, double-edged over the hook) on
// the goblin's own re-proportioned rig, src/assets/goblin.glb (WeaponDrawn, contact = the blade .12–.52; 0.81× in his
// hand → a 0.42 m blade). The sword's clip family (only Heavy re-keyed as the diagonal hack, as the cleaver's). Timings are the character
// lane's proposal (artifacts/character/BRIEF-goblin.md): wind-up ≥ 12 ticks everywhere (the readability rule), feints = the first ~40 % of
// the wind-up, damage and cost below a sword's. Measured from his rig with these timings (artifacts/weapons/REPORT.md): the slash lands to
// 1.2 m, the stab 1.45, the hack 1.55 (the sword: 1.7 / 2.0 / 2.2) — `reach` is that frontier; the combat lane sets his stance, his knobs (feint rate, guard share 0, back-step
// after landing, circling, regen) and the battery. A reverse-grip hook was tried and rejected with numbers: on the sword's clips the blade sits
// behind the fist and never lands (0 m at every gap) — it would need its own clip set. Every number PROVISIONAL — GAMEPLAY CHANGE.
export const KNIFE_PATHS: Record<PathId, PathSpec> = {
  light_right: { clip: 'Attack', source: .34, windup: 14, active: 6, recovery: 16 },
  light_left: { clip: 'Return', source: .34, windup: 14, active: 6, recovery: 16 },
  light_right_chain: { clip: 'Attack', source: .34, windup: 12, active: 6, recovery: 14 },
  light_left_chain: { clip: 'Return', source: .34, windup: 12, active: 6, recovery: 14 },
  heavy_overhead: { clip: 'Heavy', source: .48, windup: 22, active: 5, recovery: 26 },
  heavy_overhead_chain: { clip: 'Heavy', source: .48, windup: 16, active: 5, recovery: 26 },
  thrust: { clip: 'Riposte', source: .34, windup: 12, active: 4, recovery: 15 },
  riposte: { clip: 'Riposte', source: .34, windup: 12, active: 4, recovery: 15 },
  heavy_riposte: { clip: 'Heavy', source: .48, windup: 16, active: 5, recovery: 20 },
};
const slash = (id: 'light_right' | 'light_left'): MoveDef => ({
  ...MOVES[id], chained: { windup: 12, active: 6, recovery: 14 }, chain: { window: 14, follow: [id === 'light_right' ? 'light_left' : 'light_right', 'thrust', 'heavy_overhead'] },
  windup: 14, active: 6, recovery: 16, damage: 10, stamina: 18, staminaDamage: 10, stagger: 18, chip: 0, knockback: 2, stepIn: .4, feintUntil: 6, posture: 14, chamber: 6, reach: 1.2,
});
export const KNIFE_MOVES: Record<MoveId, MoveDef> = {
  light_right: slash('light_right'),
  light_left: slash('light_left'),   // the backhand: the hook's outer edge is sharpened, so it cuts too (a rip)
  heavy_overhead: { ...MOVES.heavy_overhead, chained: { windup: 16, active: 5, recovery: 26 }, windup: 22, active: 5, recovery: 26, damage: 14, stamina: 26, staminaDamage: 20, stagger: 20, poise: 0, poiseFrom: 0, chip: .2, knockback: 3, stepIn: .55, feintUntil: 8, posture: 24, chamber: 7, reach: 1.55 },
  thrust: { ...MOVES.thrust, windup: 12, active: 4, recovery: 15, damage: 9, stamina: 14, staminaDamage: 12, stagger: 14, knockback: 2, stepIn: 1, feintUntil: 5, posture: 12, chamber: 5, reach: 1.45 },
  riposte: { ...MOVES.riposte, windup: 12, active: 4, recovery: 15, damage: 18, stamina: 16, feintUntil: 5, reach: 1.2 },
  heavy_riposte: { ...MOVES.heavy_riposte, windup: 16, active: 5, recovery: 20, damage: 22, stamina: 26, feintUntil: 6, reach: 1.55 },
  heavy_counter: { ...MOVES.heavy_counter, windup: 16, active: 5, recovery: 20, damage: 16, stamina: 26, feintUntil: 6, posture: 22, reach: 1.55 },
  critical: { ...MOVES.critical, windup: 16, active: 5, recovery: 20, damage: 30, stamina: 20, reach: 1.55 },   // the brief's table said 26; a sword's critical costs 25 and the knife's must not cost more
  kick: MOVES.kick,
};
export const KNIFE: Weapon = { id: 'knife', moves: KNIFE_MOVES, paths: KNIFE_PATHS, guard: 'blade', material: 'iron', reach: KNIFE_MOVES.thrust.reach, fight: { thrustShare: .4, close: 1.0 } };   // a knife fighter stabs often and closes inside a sword's cutting range — the combat lane's to tune with his knobs
// The lanes' split (2026-09-16): the weapons lane delivers a weapon unused; the combat lane puts it in the fight. The cleaver is LIVE
// since slice W (2026-09-17): OPPONENTS.pitborn carries it, baked at a man's 1.0× from veteran-cleaver.glb (his sword's convention — the
// brute's rendered blade runs ~10 cm past the simulated one, never the other way; a 1.13× bake let no backstep escape him).
// The knife is LIVE since slice X (2026-09-17): OPPONENTS.goblin carries it, baked from his own rig (goblin.glb: the knife is 0.81× in his .835 hand, a 0.42 m blade).
export const WEAPONS: Record<WeaponId, Weapon> = { longsword: LONGSWORD, trident: TRIDENT, cleaver: CLEAVER, estoc: { ...LONGSWORD, id: 'estoc', placeholder: true }, knife: KNIFE };   // estoc: the Nightborn's thin thrust-first blade, the longsword's data until the weapons lane lands it (artifacts/character/BRIEF-nightborn.md § Weapon)   // knife: the goblin's short hooked knife, likewise on the sword clip family until the weapons lane's data lands (artifacts/character/BRIEF-goblin.md)
export const weaponOf = (id: WeaponId): Weapon => WEAPONS[id];

export const PROFILES: Record<'easy' | 'normal' | 'hard', AiProfile> = {
  // discipline sits above a heavy's cost so the warden rests instead of swinging itself into exhaustion.
  easy: { reaction: 24, accuracy: .5, parry: .1, dodge: .1, aggression: .45, pressure: 0, discipline: 60, lapse: .45 },
  normal: { reaction: 14, accuracy: .75, parry: .3, dodge: .2, aggression: .65, pressure: 0, discipline: 50, lapse: .3 },
  hard: { reaction: 10, accuracy: .95, parry: .6, dodge: .35, aggression: .85, pressure: .5, discipline: 40, lapse: .1 },   // 167 ms: hard is decisions and feints, not input-reading (was 7)
};
export type Level = keyof typeof PROFILES;
// An opponent is data a duel is set up from: the weapon he carries, his body scale (the blade sweep's hit capsule and regions
// follow it; the renderer picks his GLB by id), his health, his poise and his own profile per level — the same easy/normal/hard toggle
// modulates every opponent. The Veteran is the warden as shipped; `initialDuel()` with no argument is still exactly him.
// poise: a plain clean hit dealing less than this damage never staggers him (it still wounds and builds posture); heavies,
// counter-hits, stop-hits, rear hits and charged blows always do. 0 = staggered by everything, the human default.
// guard: how this man's guard behaves on top of his weapon's (`Fighter.guardProfile`): the Nightborn's parry window is longer than a man's
// and a parry of his that meets nothing leaves him open longer — the one mechanism behind "bait him" (see OPPONENTS.nightborn).
export type OpponentId = 'veteran' | 'pitborn' | 'nightborn' | 'goblin';
export type Opponent = { id: OpponentId; weapon: WeaponId; scale: number; health: number; poise: number; profiles: Record<Level, AiProfile>; guard?: Partial<GuardProfile>; regen?: number; speed?: number };   // regen: stamina regeneration multiplier; speed: pace multiplier for walking, lunging and stepping (a small fighter is quick on his feet)
export const OPPONENTS: Record<OpponentId, Opponent> = {
  veteran: { id: 'veteran', weapon: 'trident', scale: 1, health: RULES.health, poise: 0, profiles: PROFILES },   // the trident since slice V (2026-09-16)
  // The pit brute: relentless light chains (aggression, pressure), a low parry rate, slower to notice, a low discipline floor so he
  // swings himself hot; poise 16 — a plain cut (14) or stab (11) never stops him, a heavy (18) or any counter does.
  // Health 190: with the Veteran's brain driving the hero he took 150 in ~22 s (probe, 24 seeds); the brute is meant to take more killing than a man.
  pitborn: { id: 'pitborn', weapon: 'cleaver', scale: 1.13, health: 190, poise: 16, profiles: {
    easy: { reaction: 28, accuracy: .5, parry: .05, dodge: .05, aggression: .6, pressure: .6, discipline: 30, lapse: .45 },
    normal: { reaction: 18, accuracy: .85, parry: .15, dodge: .1, aggression: .8, pressure: .7, discipline: 25, lapse: .3 },
    hard: { reaction: 14, accuracy: .9, parry: .3, dodge: .2, aggression: .95, pressure: .75, discipline: 24, lapse: .1 },   // discipline 20 → 24 with the cleaver (slice W): its hack costs 42, and at 20 he swung himself empty into the whiff punisher (10/24 at hard, over the cap); 24 keeps him hot-headed (the Veteran holds 40) and the punisher at 7/24
  } },
  // The Nightborn (opponent 5, the vampire duelist): the parry is his whole game — the highest parry share on the roster, the fastest
  // reaction, thrusts over cuts (pressure), a low dodge share, a man's health and no poise (a duelist is staggered like anyone; his
  // defence is the blade, not the hide). His guard is what makes him a fight and not a reskin: a 16-tick parry window (a man's is 10)
  // means the AI presses it at contact − 14 — tick 6 of a 20-tick cut, INSIDE the player's feint window (feintUntil 10) — so a feint
  // draws the parry; his parry COMMITS (guard.commits): he cannot cut out of it or hold it into a guard the way a man can, and he reads
  // the tell (elapsed time, not the blade's clock), so a swing held at its chamber draws it too. One that met nothing leaves him exposed
  // 40 ticks (a man's 8) with no swing out of it — the feint's own 10-tick guard, a human's ~200 ms to see the whiff and the punish cut's
  // 20-tick tell fit inside. His reaction (6 at normal) is the floor under the press: it must sit inside the feint window with a tick to spare.
  // The heavy's tell (34) is past his press, so an honest heavy is parried; a heavy held at its chamber past his press lands on the whiff.
  // Kicks open a standing guard. PROVISIONAL; the battery in tests/opponents.test.ts is the gate.
  nightborn: { id: 'nightborn', weapon: 'estoc', scale: 1.03, health: RULES.health, poise: 0, guard: { window: 16, recovery: 40, commits: true }, profiles: {
    easy: { reaction: 8, accuracy: .7, parry: .45, dodge: .1, aggression: .5, pressure: .4, discipline: 55, lapse: .3 },
    normal: { reaction: 6, accuracy: .85, parry: .7, dodge: .1, aggression: .6, pressure: .45, discipline: 45, lapse: .15 },   // pressure .45: enough heavies that a roller is charged through (a cut-and-thrust man rolls too easily)
    hard: { reaction: 5, accuracy: .95, parry: .8, dodge: .15, aggression: .75, pressure: .5, discipline: 40, lapse: .05 },
  } },
  // The goblin (opponent 4, the pit-runner): small, fast, mean — 0.78× a man (his measured standing height; the rig is re-proportioned, not
  // shrunk: build-warrior.mjs BUILD.goblin), 100 health, poise 0 (anything staggers him). Reaction fast, parry 0 (he never parries), the dodge
  // share high, a low discipline floor. Slice X (combat review, 2026-09-17) gave him his identity knobs: he feints (a share of every cut and
  // heavy, against anyone), never guards (guard 0: he evades or steps back where a man would block), hops back out after landing (disengage),
  // drifts sideways while closing (circle) and recovers stamina half again as fast (regen 1.5). He fights with the knife: slash 1.2 / stab 1.45 /
  // hack 1.55 m (measured), inside a sword's cutting range — his `fight.close` 1.0.
  goblin: { id: 'goblin', weapon: 'knife', scale: .78, health: 120, poise: 0, regen: 1.5, speed: 1.2, profiles: {   // health 100 → 120 (owner, 2026-09-17): a careless player deleted him in seven cuts; the hero brain beat him as often as the Pitborn, the rung before him
    easy: { reaction: 18, accuracy: .55, parry: 0, dodge: .3, aggression: .7, pressure: .5, discipline: 30, lapse: .4, feint: .15, guard: 0, disengage: .4, circle: .5, step: .6, interrupt: .3, kick: .4, dash: .6 },
    normal: { reaction: 10, accuracy: .8, parry: 0, dodge: .4, aggression: .85, pressure: .6, discipline: 20, lapse: .2, feint: .3, guard: 0, disengage: .6, circle: .8, step: .8, interrupt: .6, kick: .6, dash: 1 },
    hard: { reaction: 8, accuracy: .92, parry: 0, dodge: .5, aggression: .95, pressure: .65, discipline: 15, lapse: .08, feint: .4, guard: 0, disengage: .7, circle: 1, step: .8, interrupt: .8, kick: .7, dash: 1 },
  } },
};
