# Duel rules: notes

The values are rows in `src/fight/rules-defs.json` (built into `RULES` by `src/fight/rules.ts`). These notes are the comments that sat beside the old `RULES` literal in `src/fight/moves.ts`, kept so what each number means and which record version changed it is not lost. The literal below is the PRE-ROWS source: read it for meaning, not for values.

```ts
export const RULES = {
  health: 150,                    // a duel of 8–15 blows (the owner's target): 150 with the 40/s regeneration measured 10 hits / 38 s at normal in review
  draw: 42, roll: 36, safeStart: 4, safeEnd: 20, rollCost: 30,
  // Backstep: a short positional evade with no invulnerability. speed 1 = walking pace, so 12 ticks travel 0.6 m; its tail can be
  // cancelled into an attack, and holding the dodge control converts it into a roll for the price difference.
  backstep: { ticks: 12, speed: 1, cost: 10, cancelFrom: 8 },
  dodgeAttackWindow: 2,   // a light started this soon after an evade (or from a backstep's tail) uses its chained timing
  // perfectBlock: a block in the first ticks of a held guard costs perfectBlockCost of the normal price.
  // breakCost: a broken guard loses this much stamina (not all of it): from a full bar the defender keeps one roll to escape the follow-up.
  feintBeat: 10, parry: 10, parryCooldown: 30, parryStun: 90, parryRecovery: 8, feintCost: 10, blockCost: 25, breakCost: 60, perfectBlock: 3, perfectBlockCost: .5, guardSpeed: .35, guardArc: Math.PI / 3, directionalGuard: true,   // owner 2026-09-20: five sides on the Guard button (duel.ts covers()); null = straight = thrust
  // Special Moves (Dom 2026-09-29 via Strategy / Lead; Combat): the SKILL slot's rule when a fighter carries `specialShare` (duel.ts withSpecials).
  // A committed windup (2 s at 60 Hz: no guard, roll or parry, blows land normally; damage taken during it adds up and at `interruptAt` of his max health the cast is cut (no strike, no recovery, `interruptCooldown` instead of `cooldown`; docs/specs/combat/interruptible-windups.md)), then an unblockable, undodgeable
  // hit for `damage` of the target's max health (`bossDamage` for an opponent from level `bossFrom`: career.ts level = 1 + wins, five
  // sub-ranks a title, so rank 8 begins at 36). Cast inside `reach`; the cooldown re-arms `cooldown` ticks after the RELEASE; first available `first` ticks in; after a release the caster starts no attack for `recovery` ticks (the presentation's 45; defence and movement stay his). Final numbers: Dom 2026-10-01, docs/briefs/specials/boss-special-balance-2026-10-01.md. One row,
  // so a ruling is a one-line change; PvP reads the same `damage`.
  gambit: { stagger: 40 },   // RV33: the ticks a failed Gambit's thrower is staggered (src/fight/gambit.ts: about 1 in 2 lands for 2x; the stagger is what makes it slightly worse than a heavy)
  special: { windup: 120, cooldown: 1200, first: 1200, recovery: 45, reach: 3, damage: .2, bossDamage: .25, bossFrom: 36, interruptAt: .1, interruptCooldown: 480 },
  skillCooldown: 900,   // the equipped skill's cooldown (15 s): spent at commitment, so a whiff, a block, a parry and a stuffed windup all spend it; ticks down like parryCooldown (duel.ts)
  regen: 2 / 3, regenDelay: 45, guardRegen: .5, sprintCost: .2, exhaustRecover: 20, exhaustedStun: 36,   // RV29 (3B): a heavy-class blow or a kick landing on an exhausted fighter stuns `exhaustedStun` ticks (.6 s) longer; the existing hurt pose, no ground state
   exhaustedSpeed: .7,   // 40 stamina/s after .75 s; a raised guard regenerates at half rate
  wound: 240, woundRegen: .8, death: 144, kickArc: Math.PI / 4,
  // Counter-hit: a clean hit on a fighter committed to a swing, or in the vulnerable tail of a roll, lands harder and staggers longer.
  // Rear hit: a modest bonus for striking inside the target's rear arc; a true backstab is earned later under stricter conditions.
  counter: { damage: 1.25, stagger: 1.5 }, rear: { arc: Math.PI / 2, damage: 1.25, stagger: 1.25, posture: 1.5, downed: 1.5 },   // RV29 (item 4): damage 1.15 -> 1.25; `posture` multiplies the rear hit's posture; `downed` is the rear hit's TOTAL damage multiplier on a hurt (staggered or posture-broken) target, replacing `damage`, not stacked (Lead, Dom's option C)
  guardCounter: 20,   // ticks after a block in which Heavy becomes the guard counter; any attack consumes the window
  // Posture (Sekiro-style): blocks, clean hits and being parried fill it; it drains while the fighter is not staggered. Full = a posture
  // break: a long stagger and a critical window in which the opponent's Heavy is the `critical` move. A guard break resets it (that was the payoff).
  posture: { max: 100, decay: .2, hold: 60, stun: 90, parry: 25, perfect: .5, bloodied: .3, bloodiedDecay: .5 },   // RV29 (Dom 2026-10-07): hold 45 -> 60; a fighter under `bloodied` of his max health drains posture at `bloodiedDecay` of the speed (2C)   // slice Q: the drain pauses `hold` ticks after any gain, so a run of blocks can reach a break; swept to ~one break per two duels at normal
  // The ring wall: knockback that meets the wall adds stagger and posture (the wall hits back); a fighter with the wall at its back cannot
  // backstep. `edge` is how close to RADIUS counts as at the wall.
  // `raise`/`raiseAgain`: how many ticks before the lash the lorarius lifts his whip (`WhipRaised`) — longer before the first lash than
  // before a repeat, because the first is a warning and the rest are a rhythm. Presentation scales its raise animation by the event's
  // `lead`, so retuning these moves the tell without a change in the world lane.
  // Anti-turtling (owner 2026-09-21, "both 1 and 2"): the lorarii. A fighter within `loiter.band` of the wall for `loiter.ticks` without
  // attacking is whipped — `chip` health (never the last point), `posture`, and a `shove` back into the fight (toward an opponent within
  // `into` metres, else toward the centre) — and the lorarii keep at it:
  // the next lash comes `again` ticks later while he stays in the band (posture stacks toward a break). Attacking or leaving the band
  // resets the clock. Both fighters: the warden cannot camp the wall either.
  wall: { edge: .25, stagger: 12, posture: 15, loiter: { band: 1, ticks: 180, again: 60, chip: 3, posture: 15, shove: .6, into: 2, raise: 60, raiseAgain: 30 } },
  // Anti-turtling 2: no rest at the wall. A tick that opens the gap to the opponent by more than `away` metres (a walk straight back is .05
  // at 3 m/s; strafing is ~0) while the fighter is inside the wall band (`wallOnly`, the same `wall.loiter.band`) regenerates no stamina;
  // regen resumes the tick he stops, strafes or advances. The band form is the owner's choice: the everywhere form broke the rung pins
  // (the numbers are in docs/state/combat.md, Anti-turtling). Set `wallOnly: false` to try it.
  retreat: { away: .02, wallOnly: true },
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
```
