# Move and path rows: notes

The values are rows in `src/fight/move-defs.json` (built into `MOVES` and `PATHS` by `src/fight/move-rows.ts`). These notes are the comments that sat beside the old literals in `src/fight/moves.ts`, kept so what each number means and which ruling set it is not lost. The code below is the PRE-ROWS source: read it for meaning, not for values. The rows are the resolved result of these literals and the `light()` / `skill()` helpers (identity hash of `JSON.stringify({MOVES, PATHS})` = `047083ca803af3faea1c8aee5b1811ccb366b239c8a0702adbe8be78083df453`, pinned in `tests/move-rows.test.ts`).

```ts
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
  slash_riposte: { clip: 'Attack', source: .34, windup: 12, active: 5, recovery: 19 },
  riposte: { clip: 'Riposte', source: .34, windup: 12, active: 5, recovery: 19 },
  heavy_riposte: { clip: 'Heavy', source: .48, windup: 20, active: 5, recovery: 25 },
};

const light = (id: 'light_right' | 'light_left', direction: Direction): MoveDef => ({
  id, direction, path: id, chainPath: `${id}_chain`, chained: { windup: 16, active: 8, recovery: 18 },
  chain: { window: 18, follow: [id === 'light_right' ? 'light_left' : 'light_right', 'heavy_overhead'] },   // the opposite cut chains fast; a heavy finisher winds up quicker
  windup: 20, active: 8, recovery: 22, damage: 14, stamina: 25, staminaDamage: 15, stagger: 24, poise: 0, poiseFrom: 0,   // 14 for 25 stamina: the cut's tell (333 ms) is longer than the stab's, so it pays and costs more (owner, 2026-09-16); ladder stab 11 < cut 14 < heavy 18
  breaksGuard: false, chip: 0, parryable: true, knockback: 4, stepIn: .4, feintUntil: 10, reach: 1.65, vsGuard: null, posture: 20, chamber: 9, charges: false,   // stepIn .4 over 20 ticks ≈ the old .55 over 14: the same lunge
});
// The SCOPE 8 skill template (the Pommel's shape) and the four timing rows a skill may copy; tests/skill-caps.test.ts holds each skill to one of them.
const LIGHT_TIMING: Timing = { windup: 20, active: 8, recovery: 22 }, LIGHT_CHAINED_TIMING: Timing = { windup: 16, active: 8, recovery: 18 };
const HEAVY_TIMING: Timing = { windup: 32, active: 5, recovery: 31 }, THRUST_TIMING: Timing = { windup: 16, active: 5, recovery: 21 }, KICK_TIMING: Timing = { windup: 18, active: 1, recovery: 25 };
const skill = (id: MoveId, timing: Timing, knobs: Pick<MoveDef, 'direction' | 'damage' | 'stagger' | 'staminaDamage' | 'posture' | 'knockback' | 'stepIn' | 'reach'> & Partial<MoveDef>): MoveDef => ({
  id, path: null, chainPath: null, chained: null, chain: null, ...timing, stamina: 40, poise: 0, poiseFrom: 0,
  breaksGuard: false, chip: .4, parryable: true, feintUntil: 0, vsGuard: null, chamber: null, charges: false, ...knobs,
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
  slash_riposte: {
    id: 'slash_riposte', direction: 'right', path: 'slash_riposte', chainPath: null, chained: null, chain: null,
    windup: 12, active: 5, recovery: 19, damage: 24, stamina: 20, staminaDamage: 0, stagger: 24, poise: 0, poiseFrom: 0,
    breaksGuard: true, chip: 0, parryable: true, knockback: 4, stepIn: .55, feintUntil: 6, reach: 1.65, vsGuard: null, posture: 0, chamber: null, charges: false,   // the parry already filled posture; the slash_riposte is the damage payoff, not a second one (two parries must not be a kill)
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
    breaksGuard: false, chip: 0, parryable: false, knockback: 6, stepIn: .55, feintUntil: 0, reach: 1.2, vsGuard: { stagger: 48, staminaDamage: 45 }, posture: 24, chamber: null, charges: false,
    // vsGuard.stagger 48 (was 36; Dom, 2026-09-24): the kick that opens a guard must be punishable. The kicker's first legal
    // attack plus every player weapon's fastest contact (the thrust; cleaver/warhammer/maul the slowest) now lands at least
    // 3 ticks inside the stagger against every opponent. At 36 the stagger ended 2–9 ticks before that contact. Symmetric:
    // an opponent's kick on your guard stuns you as long. Pinned in tests/duel.test.ts ('the kick that opens a guard...').
  },
  // SKILL 1, the Witch's arm (docs/briefs/skill-witch-arm.md (a); every number *prop* until Combat's battery): a palm cast from the grafted arm.
  // A 40-tick tell (longer than any heavy's 36) and a 40-tick recovery (the whiff is the punish); blockable, guardable and parryable like a heavy
  // (Strategy ruling 1). A cone like the kick (path null: reach 1.2, RULES.kickArc), so it needs no blade table. Damage 26 flat on every weapon
  // (ruling 2). Committed: no chamber, no charge, no feint, no step-in (she stands and casts). Cooldown RULES.skillCooldown, spent at commitment.
  // chainPath, chained and vsGuard: the brief is silent, so the thrust's (null). Every weapon's table shares this one entry, as the kick;
  // the per-weapon modifier rows (brief (c): reach, arc, side, chain, knockback) are not V1.
  skill_witchfire: {
    id: 'skill_witchfire', direction: 'thrust', path: null, chainPath: null, chained: null, chain: null,
    windup: 40, active: 6, recovery: 40, damage: 26, stamina: 40, staminaDamage: 30, stagger: 30, poise: 24, poiseFrom: 30,
    breaksGuard: false, chip: .4, parryable: true, knockback: 8, stepIn: 0, feintUntil: 0, reach: 1.2, vsGuard: null, posture: 40, chamber: null, charges: false,
  },  // The hero's day-one skill, Pommel Strike (Dom, 2026-09-25: "Hero starts with Pommel Strike; one skill slot; a take swaps it"). A short hilt
  // bash to the face: a cone like the kick (path null), reach 1.3 — arm's length, under the thrust's 2.0. Heavy-class damage (20: over the
  // heavy's 18 and over every opponent's poise, max 16, so it staggers them all); the Witch-fire's stamina (40); RULES.skillCooldown.
  // Blockable (chip as a heavy) and parryable. THE POINT is `stagger`: 50 ticks of the existing hurt state on a clean hit, and no knockback,
  // so the foe stays in reach. What is left of the active window, the recovery and a light's wind-up (3 + 18 + 20 = 41 ticks) all fit inside
  // those 50: a follow-up light lands before he recovers (tests/skill-pommel.test.ts). Committed: no chamber, charge or feint.
  // A different pick changes only this entry, SKILLS in loot.ts, and those tests.
  skill_pommel: {
    id: 'skill_pommel', direction: 'thrust', path: null, chainPath: null, chained: null, chain: null,
    windup: 18, active: 4, recovery: 18, damage: 20, stamina: 40, staminaDamage: 30, stagger: 50, poise: 0, poiseFrom: 0,
    breaksGuard: false, chip: .4, parryable: true, knockback: 0, stepIn: .55, feintUntil: 0, reach: 1.3, vsGuard: null, posture: 24, chamber: null, charges: false,
  },
  // SCOPE 8: the nine opponents' moves, a kill's second take (docs/SCOPE.md item 8; Combat's rows, Strategy's ruling 2026-09-26).
  // Each copies an existing row's windup/active/recovery unchanged; only the effect knobs differ. Every one is a Pommel-template
  // skill (path null: a cone of `reach` × RULES.kickArc; stamina 40; parryable; no chamber, charge or feint) and shared by every
  // weapon. The caps, pinned in tests/skill-caps.test.ts: damage ≥ 18 (≥ the heavy, and over every opponent's poise, max 16, so a
  // hero's take staggers them all); worst stun (counter × rear) short of a guaranteed follow-up light (only the Pommel owns that);
  // punishable on a block by the hero's 16-tick thrust with ≥ 9 ticks to spare.
  skill_shove: skill('skill_shove', KICK_TIMING, { direction: 'thrust', damage: 18, stagger: 22, staminaDamage: 30, posture: 24, knockback: 14, stepIn: 0, reach: 1.3 }),   // the Centurion's Scutum Shove: 14 ticks of shove (the kick's 6), into the wall's second impact. stepIn 0 (Strategy 07:24): with the thrust's lunge it reached a Goblin who never blocks every cooldown (estoc 18/24 → 11)
  skill_cleave: skill('skill_cleave', HEAVY_TIMING, { direction: 'overhead', damage: 22, stagger: 28, staminaDamage: 60, posture: 32, knockback: 4, stepIn: .55, reach: 1.6 }),   // the Pitborn's: staminaDamage = RULES.breakCost, so a guard below 60 cannot pay the block and breaks (ruled instead of breaksGuard)
  skill_jab: skill('skill_jab', LIGHT_CHAINED_TIMING, { direction: 'thrust', damage: 18, stamina: 30, stagger: 20, staminaDamage: 20, posture: 16, knockback: 2, stepIn: .4, reach: 1 }),   // the Goblin's Dirty Jab: the chained light's 16-tick windup, the fastest light timing; reach 1.0, inside arm's length (battery: at 1.3 the estoc's follow-up made it 15/24 on the Goblin → 6)
  skill_lunge: skill('skill_lunge', THRUST_TIMING, { direction: 'thrust', damage: 11, stagger: 0, staminaDamage: 0, posture: 20, knockback: 3, stepIn: 1, reach: 2.4 }),   // the Nightborn's Estoc Lunge (RV15, Strategy 2026-09-26: damage 20 -> 11, stagger 22 -> 0, staminaDamage 30 -> 0; the landed cast farmed the Goblin, who never blocks: 434/480 v Pommel 226 at 480 seeds; d11 reads 241/480 there, under Pommel + 40 = 266 by more than one sd; d12 253 does not): the longest reach (the estoc's thrust is 2.3); stepIn the thrust's 1, never faster than a backstep
  skill_reaping: skill('skill_reaping', HEAVY_TIMING, { direction: 'right', damage: 28, stagger: 28, chip: .6, staminaDamage: 40, posture: 32, knockback: 6, stepIn: 0, reach: 2, poise: 24, poiseFrom: 24 }),   // the Executioner's Reaping Blow: the nine's top damage and chip; the heavy's own armour. stepIn 0 (Strategy 07:24): estoc on the Goblin 15/24 → 11
  skill_stomp: skill('skill_stomp', HEAVY_TIMING, { direction: 'low', damage: 18, stagger: 24, staminaDamage: 30, posture: 50, knockback: 4, stepIn: 0, reach: 1.4 }),   // the Dwarf's Anvil Stomp: the top posture; low, so the low guard is the read
  skill_miasma: skill('skill_miasma', HEAVY_TIMING, { direction: 'thrust', damage: 18, stagger: 20, staminaDamage: 50, posture: 24, knockback: 0, stepIn: 0, reach: 1.2 }),   // the Plague Doctor's: a one-tick cone like the Witch-fire; a path-null move drains staminaDamage on a clean hit too (duel.ts)
  skill_ironrush: skill('skill_ironrush', THRUST_TIMING, { direction: 'thrust', damage: 10, stagger: 0, staminaDamage: 0, posture: 20, knockback: 3, stepIn: 1, reach: 2, poise: 24, poiseFrom: 8 }),   // the Knight's (RV15: damage 20 -> 10, stagger 22 -> 0, staminaDamage 30 -> 0, the same Goblin farm as the Lunge; estoc v Goblin 242/480 against Pommel + 40 = 266; the poise is its identity and stays): armoured from tick 8 against every plain blow (a light's stagger 24 equals a heavy's; the guard counter, critical and skills get through)
  skill_hewer: skill('skill_hewer', LIGHT_TIMING, { direction: 'right', damage: 18, stagger: 24, chip: 1, staminaDamage: 20, posture: 20, knockback: 4, stepIn: .4, reach: 1.4 }),   // the Shieldmaiden's Shield-Hewer: all of it through an ordinary block; a perfect block, parry or evade stops it. A side cut, not an overhead (Strategy 07:16): a shaft guard (heavyBreaks) breaks on any overhead, and a light-timed skill must never break one outright
};
```
