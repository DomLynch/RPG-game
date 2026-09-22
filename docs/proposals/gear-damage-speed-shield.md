# Proposal — damage by grip, speed, and the shield

Stats lane, 2026-09-22, for Dom. Docs only: nothing here is built. Every number in §1 is read out of `src/moves.ts` on trunk
(3405a95) by running the module, not copied from a brief. Where trunk is known to be stale, it is flagged in the row.

**The three asks, answered up front.**

1. **One Attack multiplier for every weapon, not a cap per grip.** Grip does not predict any number in the live tables, so a
   per-grip cap would invent a balance axis that does not exist.
2. **Speed stays fixed per weapon**, because punish windows are a skill the player has already learned.
3. **Shield: option (b), the guard profile only, no passive number.** Option (a) is the one that makes the shield a must-pick.

---

## §1 The live tables

Read from `src/moves.ts` on trunk 3405a95. One tick = 16.67 ms (`src/sim.ts:1`, `STEP = 1/60`). "Speed" is
windup + active + recovery for one swing. Light is `light_right`; heavy is `heavy_overhead`; thrust is `thrust`.

### One-hand

| weapon | light | heavy | thrust | light speed | heavy speed | thrust speed | reach | light stam | heavy stam |
|---|---|---|---|---|---|---|---|---|---|
| Cleaver | **17** | **26** | 7 | 56 t / 933 ms | 78 t / 1300 ms | 49 t / 817 ms | 2.00 | 28 | 42 |
| Knife | 10 | 14 | 9 | **36 t / 600 ms** | 53 t / 883 ms | **36 t / 600 ms** | 1.45 | **18** | **26** |
| Estoc | 9 | 15 | **14** | 50 t / 833 ms | 68 t / 1133 ms | 42 t / 700 ms | 2.00 ⚠ | 25 | 35 |

### Two-hand

| weapon | light | heavy | thrust | light speed | heavy speed | thrust speed | reach | light stam | heavy stam |
|---|---|---|---|---|---|---|---|---|---|
| Longsword | 14 | 18 | 11 | 50 t / 833 ms | 68 t / 1133 ms | 42 t / 700 ms | 2.00 | 25 | 35 |
| Trident ⚠ | 12 | 20 | 12 | 54 t / 900 ms | 72 t / 1200 ms | 44 t / 733 ms | **2.25** | 25 | 38 |
| Scythe | 16 | 22 | 8 | 58 t / 967 ms | 74 t / 1233 ms | 48 t / 800 ms | 2.10 | 28 | 38 |
| Warhammer | 15 | **24** | 7 | 56 t / 933 ms | 78 t / 1300 ms | 49 t / 817 ms | 1.40 | 28 | 42 |

⚠ **Two values on this page are not what trunk says.**
- **Trident grip.** Trunk says `one-hand`; #472 (open, approved) makes it `two-hand`. It is grouped as two-hand above, on #472.
- **Estoc reach.** The trunk rows carry the sword's numbers as a spacing estimate. The measured frontier is sword + 0.30 m and
  lives only on #419, which is held on a Combat dependency. Treat estoc reach as **2.30 m**, not 2.00, in any reach argument;
  the table above prints trunk's value so the two are not silently conflated.

Everything else — damage, windup/active/recovery, stamina, chip — is current on trunk, including the knife's thrust recovery of
20 and the scythe's heel-jab recovery of 30 (both from #440).

### Two things the tables show that the brief does not

**The cleaver's two light attacks are not the same attack.** `light_right` is 17 damage, `light_left` is **9** — the only weapon
in the game with an asymmetric light. Every other player weapon has identical left and right. Any per-weapon Attack reasoning
that quotes "the cleaver's light" has to say which one.

**Chip varies 2.5× and nobody has been costing it.** Heavy chip, the fraction that passes through an ordinary block:
knife 0.2, estoc 0.25, warhammer 0.3, longsword 0.4, and cleaver, trident and scythe all at 0.5. A blocking defender takes half
a trident heavy through the guard and a fifth of a knife heavy. RES multiplies damage taken **including chip** (brief 19), so
the RES a player is carrying is worth two and a half times more against a trident than against a knife. That is a real
interaction between the gear layer and the weapon tables, and it is in no brief.

---

## §2 Does grip predict anything? No.

The expected pattern is 1h = faster, weaker, cheaper; 2h = slower, stronger, dearer. **The live numbers do not follow it.**

| claim | verdict from the tables |
|---|---|
| 2h hits harder | **False.** The hardest heavy in the game is the **cleaver's 26**, one-handed — above the warhammer's 24 and the scythe's 22. |
| 1h is faster | **False except the knife.** Cleaver light is 56 t, exactly the warhammer's. Estoc is 50 t, exactly the longsword's. Only the knife (36 t) is actually fast. |
| 1h is cheaper | **False.** Cleaver light costs 28 stamina — the same as the scythe and warhammer, and *more* than the two-handed longsword's 25. |
| 2h reaches further | **Mixed.** The warhammer is the shortest weapon in the game at 1.40 m, shorter than the one-handed cleaver and estoc. |

Efficiency, which is where a pattern would show if there were one:

| weapon | grip | light damage per tick | heavy damage per stamina |
|---|---|---|---|
| Cleaver | 1h | **0.304** | **0.62** |
| Longsword | 2h | 0.280 | 0.51 |
| Knife | 1h | 0.278 | 0.54 |
| Scythe | 2h | 0.276 | 0.58 |
| Warhammer | 2h | 0.268 | 0.57 |
| Trident | 2h | 0.222 | 0.53 |
| Estoc | 1h | 0.180 | 0.43 |

The best and worst weapons on both measures are both **one-handed** (cleaver and estoc). Grip is uncorrelated.

**And this is by design, not drift.** `src/moves.ts:189` defines the grip type with the comment: *"DATA ONLY: nothing in the sim
reads it, no reach/timing/damage."* Grip exists to decide which animation clips a weapon uses and whether a shield can be held.
It has never been a balance axis, and the tables were tuned per weapon against the fairness battery without reference to it.

The real axis the numbers do follow is **role**: the estoc is a thrust weapon (thrust 14 is its best attack and the only weapon
where that is true), the cleaver a chopper, the scythe and trident spacing weapons, the knife a fast closer.

---

## §3 The Attack multiplier — one cap for all

**Proposal: Attack 1.00 → 1.15 applies identically to every weapon, scaled only by the weapon piece's tier (`SLOT_WEIGHT` in
`src/gear-stats.ts`, #488). No per-grip cap.**

Three reasons, in order of weight.

**A per-grip cap would invent an axis the game does not have.** §2 shows grip predicts none of damage, speed, cost or reach. A
cap that gave two-handers, say, 1.20 and one-handers 1.10 would hand the cleaver — already the hardest-hitting and most
efficient weapon in the game — the *smaller* multiplier, and the estoc, already the weakest per tick, the same smaller one. It
would not correct the spread; it would scramble it along an unrelated line.

**The multiplier is proportional, so it already scales with weapon identity.** A 1.15 Origin cap adds 3.9 damage to a cleaver
heavy and 2.7 to a longsword heavy. The weapon that hits harder gains more in absolute terms, which is the right behaviour and
comes free. A per-grip cap would fight that.

**It keeps the fairness argument single-variable.** The battery already runs seven weapons × six rungs × two levels. Brief 19
adds three kit brackets, tripling that. A per-grip cap does not add a bracket, but it does mean every future weapon argument
carries "…and which grip" — and the grip field is currently *wrong on trunk for the trident*, which is exactly how a balance
axis built on an unread data field goes bad quietly.

**What I would watch instead.** The 15% Attack cap is 3.9 damage on the cleaver's heavy and 1.35 on the estoc's light. Against
the opponent health pool those are small, but the number that matters is whether any of them crosses a **kill-count boundary** —
turns a four-hit kill into a three-hit kill at some rung. That is a discrete cliff, not a smooth tilt, and it is measurable but
has not been measured. It belongs in deliverable 4's bracketed battery, and if a boundary is crossed the answer is to lower the
Attack cap for everyone, not to split it by grip.

---

## §4 Speed is fixed, and here is why

**No stat and no tier changes the timing of any attack, parry, roll or wind-up.** The speed column in §1 is a property of the
weapon and nothing else. Brief 19 states it as a rule; it is worth recording the reason, because a bare rule invites relaxation.

**The reason: punish windows are learned.** `docs/progression-direction.md:16` records the standing position on DEX — *"Keep
weapon recovery fixed so learned punish windows survive."* A player who has learned that a scythe heavy leaves 33 ticks of
recovery has built a real skill. A speed stat would silently invalidate it: the same opponent, the same tell, a window that is
no longer there. Worse, it invalidates it *invisibly* — nothing on screen says the window moved.

Two further facts from the Weapons lane that constrain any future speed proposal:

- **Recovery is the lever that moves fairness rows; wind-up is not.** Measured: changing recovery moves battery rows
  monotonically, while changing wind-up shifts the tell in and out of each opponent's read window non-monotonically. Both of
  #440's fixes were recovery changes (knife thrust 15 → 20, scythe heel-jab 18 → 30), and both removed rows. A speed stat that
  scaled total duration would move wind-up too, with unpredictable results per opponent.
- **The estoc's timings are pinned to the longsword's by test.** `tests/weapons.test.ts` asserts `ESTOC.paths === PATHS` — the
  same object, not a copy — and `ESTOC_MOVES` carries the sword's exact 20/8/22, 32/5/31 and 16/5/21. That identity is what the
  weapon *is*: the sword's timings with a point instead of an edge. Any per-weapon speed stat that varies the estoc breaks its
  defining test.

If a speed stat is ever wanted it should be its own proposal with its own battery, and the honest framing is that it is a
character-layer stat (DEX) with a documented owner decision against it, not a gear stat.

---

## §5 The shield — three options, costed

### Where the ownership line falls, before the options

This matters because two of the three options assign work to a lane that is not mine.

- A **passive damage multiplier** is a resistance value. That is the gear layer, brief 19, **Stats — mine.**
- A **guard profile** is combat rules: `GuardProfile` at `src/moves.ts:160` carries `costScale`, `arc`, `window`, `recovery`,
  `commits`, `stopsHeavy`, `heavyBreaks`. Those live in Combat's files. **I may propose it; I may not build it.** Deliverable
  5's ordering behind knife → cleaver → estoc → shield still binds either way.

So option (b) is entirely Combat's work, (a) is entirely mine, and (c) is both.

### On the battery cost — read this before the numbers

**I cannot run the fairness battery. It is the Weapons lane's, and it is currently blocked behind Combat's approach fix.** Every
cost below is an **estimate from the battery's shape**, not a measurement, and it is stated in units of battery runs rather than
outcomes, because the shape is all I can honestly derive.

The last signed run is **2026-09-21**, re-signed 2026-09-22 after #440, recorded in `tests/player-weapons.test.ts`: 24 seeds ×
7 weapons × 6 rungs × 2 levels = **2,016 fights**, currently **6 pairings over a cap**. The whole slow suite, which contains it,
runs in **95 seconds** on this Mac (measured just now: `npm run test:slow`, 95 pass, 0 fail, 95.5 s real).

| # | option | who builds it | new battery axes | est. cost | what it does to "skill decides" |
|---|---|---|---|---|---|
| **a** | Passive −20% incoming, no outgoing penalty | Stats | shield on/off × 3 kit brackets | **6× the current battery** (~10 min/run) plus a re-sign of all 6 rows | **Breaks it.** See below. |
| **b** | Guard profile only, no passive number | Combat | shield on/off only | **2× the current battery** (~3 min/run) | **Keeps it.** The shield changes what you can do, not how much you survive. |
| **c** | Guard profile + smaller passive RES + a penalty | Combat **and** Stats | shield on/off × 3 brackets × the penalty's axis | **6–12×**, and two lanes must agree on one number | Keeps it, at roughly triple the tuning cost of (b). |

### Why (a) is the must-pick

A flat −20% incoming is **the entire Origin armour cap, from one item, for free.** A full Origin set of six pieces — the whole
loot ladder, the endgame of the career — is worth 0.80 RES. Option (a) hands the same 0.20 to anyone who picks up a shield at
Recruit.

Stacked, it is worse: 0.80 × 0.80 = **0.64**, a 36% total reduction, which is 80% above brief 19's own 20% ceiling on how far
gear may tilt a stat. It would not be a tilt; it would be the dominant defensive decision in the game, and every one-hand
weapon would be strictly better than every two-hander for reasons that have nothing to do with how either fights.

Your question was whether outgoing damage should be penalised to compensate. **My answer is that the compensation is the tell
that the number is wrong.** A −20% incoming with, say, −15% outgoing is a straight trade of offence for defence at a fixed
rate — the player makes that choice once, at the menu, and never again during a fight. It is a build decision wearing a combat
decision's clothes, and it is the shape brief 19 rules out ("gear tilts, skill decides").

### Why (b) is the recommendation

The shield brief on record (Strategy, 2026-09-21) already describes a shield that is *interesting*: two sides covered, stops
heavies, cheaper to hold, posture drains faster while held, one-hand weapons only, stowed on the back with a two-hander.

Every one of those is a **decision the player makes during the fight**. Hold it and you are safe from the overhead but your
posture is bleeding. Drop the guard to attack and the two covered sides are open. Pick it up and you have given up every
two-handed weapon. That is skill deciding, and none of it needs a damage multiplier — the existing `GuardProfile` fields carry
all of it (`stopsHeavy`, `costScale`, `arc`).

It is also the cheapest to validate by a wide margin: one new axis instead of a multiplied one, and no interaction with the
three kit brackets deliverable 4 is already adding.

**If the shield turns out to feel weak in play, the right first move is `costScale` and `arc` — Combat's knobs, no new
axis — not a passive number.** Reach for (c) only if those are exhausted, and if so the passive should be **at most −5%** (a
quarter of one armour slot's worth) so it reads as a nudge rather than a second armour set.

---

## What this proposal does not settle

- The kill-count boundary question in §3 is unmeasured and needs deliverable 4's bracketed battery.
- Every shield cost is an estimate from the battery's shape, not a measurement. Weapons owns the real numbers and is blocked.
- Estoc reach (#419) and trident grip (#472) are both in flight; if either lands differently, §1 changes.
- Chip's interaction with RES (§1) is a genuine finding with no owner. It should probably be a Combat/Stats conversation before
  deliverable 5, not after.
