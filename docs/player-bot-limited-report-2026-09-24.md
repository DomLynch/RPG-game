# Player bot, limited observation: report (Strategy item 5)

Pitborn lane, 2026-09-24, for Lead and Strategy. PR #680, with #668 (`9483f894`) merged in.

"Limited" is the bot the Lead's review allowed: it sees what a player sees, 11 ticks late. There is no `data-threat` read.
An enemy attack counts from a **seen** swing start to a **seen** end, and the bot is never told a swing is charged. It
learns that from the `charge` sound (which carries no actor, and is ignored while the bot holds its own charge) or from
the hold time. Meters, contact sounds, whiffs, rolls and distance are allowed.

Scripts (repo-relative, headless, real sim, no sim change):

- `node scripts/player-bot-scenarios.mjs out.json` gives the KICK and ROLL scenarios (b, d), on all nine live opponents.
- `node scripts/player-bot-replay.mjs <fight.json> out.json 1` gives the tick-by-tick replay of a recorded bot fight (c).
- `node scripts/player-bot.mjs --opponents=all --fights=3 --no-video [--observation=debug]` gives the batch (a), which
  runs only when `~/.claude/state/deploy_in_flight.json` is absent.

## Three findings that need a ruling

1. **KICK: a guarded kick never opens a punish, at any reaction speed** (Combat's to rule). The kick starts at 12 and
   makes contact at 30 with `Staggered(36)`, so the window is **30 → 66**. The player's **first legal action is 57**,
   because the kick's 25-tick recovery takes 27 of the 36 stagger ticks. The fastest windup is the thrust at **16**,
   giving contact at 73, 7 ticks after the window closed. The result is the same with **zero** perception delay, and
   the same on all nine opponents. The levers are the kick's recovery and the vsGuard stagger, not perception. Details
   in (b).
2. **Wall roll: straight back is a trap against a charged heavy** (Strategy/Combat, for teaching or tuning). With the
   player's back 1.0 from the wall, a straight-back roll takes the charged heavy on **4–8 of 9** opponents, whatever
   the timing (it ends 0.0 from the wall, gap 1.9–2.4, inside reach). A **sideways roll on the hold-time read takes
   0 of 9** and is the fastest back in (85 ticks). Details in (d).
3. **GOBLIN: a stale guard, not the game** (the bot's policy; #680's filter already removes it). At **1924** the Codex
   bot raised a left guard carried over from the **1889** light_right, 3 ticks before the goblin's thrust started at
   **1927**. The thrust landed at **1939** and broke posture for 90 ticks, so nothing was legal until the critical at
   **2012 → 2028** killed. Zero rejected inputs; the fight reproduces 133/133 events. Details in (c).

**Needs a human browser look (not measured by anything here): whether the posture-broken state reads on screen.** The
bot was never asked to read it, and the replay proves only that nothing was legal.

## (a) The readability gate, and what each defence earned

**The gate.** This is the owner's bot acceptance (`22ca94ff`): **at least two-thirds real Easy wins against every
opponent, with no run errors.** It is applied here to the *limited* bot, which sees only what a player sees, so passing
it means every rung can be beaten from on-screen information alone. The run is at `a962f66b`: 9 live opponents × 3
seeds (731, 2230671998, 2504048581), `--no-video`, lock-aware (it waited out the a5590911 deploy, and no fight ran
through a deploy).

**Result: PASS on all nine. 24 wins from 27 fights, 0 run errors.**

| opponent | W/L | gate (≥2/3) | dmg dealt/taken | charged heavies correct / guarded into / other | cue named |
|---|---|---|---|---|---|
| dwarf | 3/0 | pass | 537/45 | 0 / 0 / 0 | - |
| executioner | 3/0 | pass | 492/0 | 0 / 0 / 0 | - |
| goblin | 2/1 (timeout,win,win) | pass | 298/257 | 3 / 1 / 0 | hold time 3, nothing 1 |
| nightborn | 3/0 | pass | 463/199 | 0 / 0 / 0 | - |
| pitborn | 2/1 | pass | 552/285 | 1 / 0 / 0 | hold time 1 |
| plaguedoctor | 2/1 | pass | 400/303 | 0 / 0 / 0 | - |
| shieldmaiden | 3/0 | pass | 624/220 | 0 / 0 / 0 | - |
| veteran | 3/0 | pass | 488/38 | 0 / 0 / 0 | - |
| witch | 3/0 | pass | 488/38 | 0 / 0 / 0 | - |

- Witch = veteran, fight for fight. That is not a harness slip: on this build `OPPONENTS.witch` and
  `OPPONENTS.veteran` are identical in the sim (trident, 150 health, the same Easy profile), so the same seed gives the
  same fight.
- The three non-wins:
  - **pitborn 2504048581**, a loss: 14 parries, and killed by a `slash_riposte` after its own swing was parried.
  - **plaguedoctor 2504048581**, a loss: killed by a `light_right`, with only 2 parries in the fight.
  - **goblin 2230671998**, a timeout at 90 s: the player on 11, the goblin on 74, and 42 s without contact, a
    stand-off with no kill either way.
- **Codex's goblin loss (seed 2504048581) is a win under #680's filter** (26.1 s). The stale-guard chain in (c) does
  not happen, because the side comes from the seen start.
- **Charged heavies: 5 seen, 4 answered correctly, all 4 on the hold-time read; 1 guarded into, no cue named.** The
  charge sound never fired first. The hold-time read beats it, as it did in the interim run.
- **Kicks:** opponents landed 29 kicks on the bot, and the bot threw 0 (its policy has no `KeyC`).

**What each defence earned** (all 27 fights, from the exact event log; a review measure, never bot input).
"Window used" means the player started an attack inside the defence's window: guard counter 20, parry stun 90,
whiff recovery 45 for an evade. Δgap and Δwall are measured over 30 ticks; a positive Δwall means drift toward the wall.

| defence | count | under threat | damage avoided | hit anyway | windows opened | used | landed | Δgap | Δwall |
|---|---|---|---|---|---|---|---|---|---|
| block | 11 | 11 | 125 | 0 | 11 | 1 | 1 | 0.20 | 0.12 |
| perfect block | 11 | 11 | 140 | 0 | 11 | 5 | 5 | -0.10 | 0.08 |
| parry | 43 | 43 | 541 | 0 | 43 | 34 | 34 | 0.08 | 0.12 |
| roll | 17 | 12 | 157 | 4 | 8 | 0 | 0 | 1.33 | 0.99 |
| backstep | 0 | 0 | 0 | 0 | 0 | 0 | 0 | - | - |


- **The parry is the bot's engine:** 43 parries, all under threat, 541 damage avoided, and **34 of 43 punished and
  landed**.
- **Blocks avoid damage but rarely convert:** a plain block converted 1 of 11, a perfect block 5 of 11.
- **Rolls buy space, not openings:** +1.33 m of gap, but +0.99 m toward the wall. 4 of 17 were hit anyway, 5 were
  not under threat at all, and **0 of 8 opened windows were used**. That agrees with (d): the roll escapes, and the
  return trip is too long to punish from.
- **Backstep: never chosen** in 27 fights.

The debug-observation run (the exact-state comparison) was stopped for a deploy that started after the limited run
finished. It resumes by itself, and its numbers will go on #680 as a comment. None of the rulings above depend on it.


## (b) KICK: the stagger window, whether it is seen, whether a quick attack lands, the reposition

Setup: close range (gap 1.05), the opponent holds a standing guard, and the player kicks at tick 12. All nine live
opponents give **identical** numbers, because kick stats are not per opponent.

| step | tick | |
|---|---|---|
| kick starts | 12 | windup 18, active 1, recovery 25 |
| contact: `Hit` + `Staggered(36)` on the guard (vsGuard) | 30 | stagger window **30 → 66** (36 ticks) |
| the bot **sees** the stagger (+11) | 41 | inside the window, with 25 ticks left |
| the player's **first legal action** (kick recovery ends) | **57** | the kick's own recovery uses 27 of the 36 stagger ticks |
| light pressed at 57, active at 77 (windup 20) | — | **11 ticks after the stagger ended**. Blocked, no hit |
| thrust pressed at 57, active at 73 (windup 16) | — | **7 ticks late**. Blocked, no hit |

- **Seen: yes.** The 11-tick delay is not the constraint. With **no delay at all** (`light@earliest`) the press still
  goes out at 57 and still misses. **No quick attack can land inside a guarded kick's stagger**: 9 usable ticks
  (57 → 66) are shorter than the fastest windup (thrust, 16).
- **Reposition** from tick 57, measured when the stagger ends:

  | answer | gap to foe | distance to wall | stamina left |
  |---|---|---|---|
  | backstep | 1.75 (+0.60) | 7.65 | 65 |
  | roll straight back | 2.19 (+1.04) | 7.21 | 45 |
  | roll angled (back-right) | 2.02 (+0.87) | 7.28 | 45 |

  So the kick buys **space and 45 stamina off the guard, not a hit**. The foe is back in guard at 66.
- Cross-check (Codex's browser runs, read only): `kick-candidate-2` and `kick-candidate-all-3` hold 4 player kicks,
  each ending in `Staggered(36)`. **None** is followed by a player hit inside the 36 ticks, which matches the sim.
- As before, the tactical bot **never kicks** (its policy has no `KeyC`), so all kick data comes from a script.
  Opponents kicked it 35 times in 18 interim fights.

**Verdict:** the kick is a guard-breaker for spacing and stamina. Nobody, human or bot, can turn it into a quick
punish at 60 Hz. If Strategy wants the kick to *open* a punish, the lever is the kick's 25-tick recovery or the 36-tick
vsGuard stagger (Combat's). Nothing about perception changes it.

## (c) GOBLIN: tick-by-tick replay of `limited-all-easy-3/goblin-2504048581.json` (Codex's loss)

**It reproduces exactly.** Feeding the recorded key edges into the sim one tick later (as `src/input.ts` does) through
`stepPractice(goblin, easy)` gives **133 of 133 events identical**. The fight ends at the same tick (2028), with the
player on 0 and the goblin on 14. So the per-tick legal/requested/accepted trace below is the real fight, not an
approximation.

- **Rejected inputs: none.** There were 26 requests; `accepts()` dropped 0, and every forwarded request started on the
  same tick.
- **Seventeen hits were taken.** By what the bot could have done:

| class | hits | ticks | what happened |
|---|---|---|---|
| **missed chance**: attacked into a visible swing (a defence was legal) | 7 | 378, 579, 872, 1157, 1306, 1440, 1854 | it pressed light/thrust after the enemy's swing had started and traded, 5–18 damage each |
| **missed chance**: no input at all while a defence was legal for the whole swing | 5 | 913, 1031, 1601, 1761, 1889 | three kicks, one thrust, one light |
| **wrong defence**: guard against a kick | 1 | 447 → 465 | a kick goes through a guard (vsGuard); the answer is to step or roll |
| **wrong side from a stale tell** | 2 | 420 → 426, **1924 → 1939** | see below |
| **no escape** | 1 | 2012 → 2028 | posture broken at 1939 (90 ticks), nothing legal for 89 ticks; the critical kills |

- **The loss chain.** At 1924 the bot raised a **left** guard 3 ticks *before* the goblin's thrust started (1927). It
  was still acting on the previous tell (the light_right at 1889; a light_right is mirrored with left). A left guard
  does not cover a thrust, so the thrust landed (9 damage), **broke posture for 90 ticks**, and the critical at
  2012 → 2028 killed a player with nothing legal. The parry at 420 → 426 is the same fault: a left guard, carried over
  from the tell at 377, against a light_left.
- **Why (inferred from the behaviour and the code, not stepped through).** The Codex policy (`9483f894`) guards
  `state.tell`'s side whenever the page snapshot's `enemyPhase` reads `attack`. The guard at 1924 went up before any new
  start could have been seen, and it had the old tell's side. So `tell` outlived the swing it described, and the next
  swing inherited its side. #680's filter ends an attack only on a seen resolution and takes the side from the seen
  start.
- **Verdict: missed chances, then no escape the bot had earned itself.** It is not rejected inputs and not unclear
  feedback. Recovery feedback was not what failed: every request was taken the tick it was legal. What the replay cannot
  judge is whether a *human* can read the posture-broken state on screen. That needs a browser look, and I did not take
  one.

## (d) ROLL: straight back vs angled

The opponent opens with a heavy_overhead (plain, or held to a full charge) from a gap of 1.6. The player rolls when it
**perceives** the swing: `seen` is the start +11; `hold-time` is the start + chamber + 8 + 11, the read #680 is allowed
for a charge. After the roll the player walks back in and swings light. The foe is scripted to stand after its heavy,
so "ticks to first hit" is the player's own return trip. Directions: `back` = no stick (roll away from the foe),
`angled(1,1)` = back-right, `angled(1,0)` = straight right. Centre start: the player is 7.7 from the wall. Wall start:
the player's back is 1.0 from it. Nine opponents per row.

| start | heavy | roll on | direction | hit (of 9) | mean dmg | gap after | wall after | ticks to first hit |
|---|---|---|---|---|---|---|---|---|
| centre | plain | seen | back | 0 | 0 | 4.0 | 4.6 | 107 |
| centre | plain | seen | angled back-right | 0 | 0 | 3.8 | 4.8 | 103 |
| centre | plain | seen | angled right | 0 | 0 | 3.0 | 5.3 | **88** |
| centre | charged | seen | back | 0 | 0 | 4.5 | 4.6 | 107 |
| centre | charged | seen | angled back-right | 3 | 9.2 | 4.3 | 4.8 | 115 |
| centre | charged | seen | angled right | **7** | **30.4** | 3.4 | 5.3 | 142 |
| centre | charged | hold-time | any | 0 | 0 | 3.4–4.5 | 4.6–5.3 | 85–107 |
| wall | plain | seen | back | 0 | 0 | 1.9 | **0.0** | 65 |
| wall | plain | seen | angled back-right | 0 | 0 | 2.5 | **0.0** | 77 |
| wall | plain | seen | angled right | 0 | 0 | 3.0 | 0.4 | 88 |
| wall | charged | seen | back | 4 (+5 races) | 13.2 | 2.4 | 0.0 | 81 |
| wall | charged | hold-time | back | 8 | 33.8 | 2.4 | 0.0 | 131 |
| wall | charged | seen | angled back-right | 8 | 33.8 | 3.0 | 0.0 | 148 |
| wall | charged | hold-time | angled back-right | 6 | 25.4 | 2.9 | 0.0 | 119 |
| wall | charged | seen | angled right | 7 | 30.4 | 3.4 | 0.4 | 142 |
| wall | charged | hold-time | **angled right** | **0** | 0 | 3.4 | 0.4 | **85** |

"+5 races" means the charged swing parks until about tick 94, and the player's walk-in light lands at 92–93. That is a
trade won by 1–2 ticks, not an avoid.

- **A plain heavy is avoided by any roll, from anywhere.** The difference is the return. A roll to the side keeps you
  3.0 away and hits first in 88 ticks; straight back throws you 4.0 away (107).
- **Against a charged heavy, the timing matters more than the direction.** A roll on the *seen start* is spent (36
  ticks, safe 4–20) long before a charged swing's contact at about 94. It escapes only if the roll carried you out of
  reach. In the centre, straight back does that and a side roll does not (7 of 9 hit). The **hold-time read**
  (start + 29) puts the roll over the contact, and then **every direction is clean in the centre**.
- **At the wall, straight back is a trap.** The wall is behind you (0.0 after the roll, gap 1.9–2.4, inside
  heavy reach 1.9 plus a 0.55 step), and a charged heavy lands 4–8 of 9 whatever the timing. Back-right also ends
  flush with the wall. **Only the sideways roll on the hold-time read is clean at the wall (0 of 9)**, and it is also
  the fastest back (85 ticks).
- **Verdict:** retreating is safe only in open ground. The angled (sideways) roll is the one that works everywhere,
  *if* it waits for the hold-time read. That supports #680's limited bot rolling sideways on the charge cue and not on
  the swing start.
