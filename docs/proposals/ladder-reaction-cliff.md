# Proposal — the ladder's reaction cliff (and a Goblin that never scales)

Status: **PROPOSAL, nothing in `src/` changes in this PR.** For the Combat lane, 2026-10-04. Evidence is from `scripts/ladder-sweep.mjs` (added here), which runs scripted players on the headless simulation, so every number below is reproducible with the commands at the end.

## 1. What was found

**Several wardens go from easy to a wall in a single ladder level.** Below the cliff a simple strategy wins 60–95 % of fights; one level later the same strategy wins 5–15 %, and the blend then barely moves until L18. Measured, 6 of the 10 live rungs: the cliff is at **L12** for the Veteran, Executioner, Dwarf and Knight, and at **L14** for the Pitborn and Shieldmaiden (the held Skeleton also falls at L12). Each is the level at which that warden's `reaction` first drops under 20.

**Cause, isolated.** A warden notices the player's swing `reaction` ticks after it starts (`ai.ts`, `noticed = threat && elapsed >= reaction`). The player's longsword cut has a 20-tick windup. While `reaction >= 20` the warden can never answer a cut; at `reaction <= 19` he answers nearly every one (block, parry, roll). `profileAt` blends `reaction` down by about a tick a level, so one level crosses the line. Receipt (Veteran, 150 fights per cell, `masher` / `blocker` win %):

| Fight | masher | blocker |
|---|---|---|
| L11 as shipped (reaction 20) | 58 % | 99 % |
| L12 as shipped (reaction 19) | 5 % | 43 % |
| **L12 with L11's reaction (20)** | **55 %** | **100 %** |
| **L11 with L12's reaction (19)** | **7 %** | **49 %** |
| L14 with reaction held at 20 | 49 % | 99 % |

Changing only that one integer moves the fall to wherever the integer crosses. Other knobs are not the cause: ramping the `guard` share across L6–18 left the cliff in place (tried, not kept).

**It is not an artefact of crude bots.** `skilled` reads the move, covers the correct directional-guard side, times the parry inside the 10-tick window, rolls what cannot be parried and punishes; it falls off the same cliff (Veteran 92 % at L11, 8 % at L12; table below).

**Separate finding: the Goblin does not scale.** The Goblin's reaction is already under 20 at L6, so he has no cliff — and no slope either. A bot that only holds the right guard side wins **98–100 % at every level sampled (L1, 6, 12, 18, 32, 46, Origin included)**:

```
goblin: win% by ladder level (60 fights per cell)
level       masher   blocker   skilled
1              95%      100%      100%
6              27%      100%       97%
12             28%      100%       87%
18             10%       98%       80%
32             15%      100%       83%
46             15%       98%       87%

nightborn: win% by ladder level (60 fights per cell)
level       masher   blocker   skilled
1             100%      100%      100%
6               2%       72%       48%
12              0%       48%       15%
18              0%       30%        8%
32              0%       13%        5%
46              0%        7%        2%
```

(The Nightborn, also under 20 at L6, is the control: it declines smoothly from 72 % to 7 % for the same `blocker`.) `tests/battery.test.ts` gates only the Veteran, so nothing currently flags this.

## 1b. What else the survey turned up

The live ladder is ten rungs (`ladder.ts`: Veteran, Pitborn, Goblin, Nightborn, Executioner, Dwarf, Plague Doctor, Knight, Witch, Shieldmaiden). The Minotaur, Werewolf, Wraith and Skeleton are `hold: true` recipes, so players do not meet them yet.

- **The cliff is on 6 of the 10 rungs** (above). The Nightborn and Plague Doctor, whose `reaction` is already under 20 at L6, decline smoothly instead (`blocker` Nightborn: 72 % at L6, 30 % at L18, 7 % at L46).
- **The Goblin and the Witch are easy at every level.** Goblin: a guard-only bot wins 98–100 % from L6 to Origin (§1). Witch: the same bot wins 100 % at L6, 77 % at L18, 67 % at Origin (table below); at Origin the guard-only bot wins 100 % against the Goblin and 67 % against the Witch, the two highest of the ten rungs, and no test gates either.
- **Latent, not live: the Minotaur and Werewolf are walls from L6.** Both carry the Pitborn's 190-health body and its full poise 16, but `POISE_FULL_AT` (`moves.ts`) lists only the Pitborn and Shieldmaiden, so they are at poise 16 from L6, and a light cut (14) never staggers them. The code comment on that table gives exactly this as the reason for the ramp. Receipt (60 fights per cell; `masher` / `blocker` / `skilled`): Minotaur at L6 shipped 0 / 0 / 2 %, with the Pitborn's poise ramp 67 / 73 / 82 %; at L10 shipped 2 / 0 / 2 %, with the ramp 52 / 67 / 75 %. The Werewolf matches. If they are ever released as rungs, add them to `POISE_FULL_AT` (and to the test at `tests/ladder-levels.test.ts` that pins the Pitborn and Shieldmaiden); like the lapse ramp, that is a sim change and needs the `RECORD_VERSION` decision.

Per-level sweeps of the six opponents first inferred from their reaction curves (40 fights per cell):

```
skeleton: win% by ladder level (40 fights per cell)
level       masher   blocker   skilled
10             33%      100%       83%
11             33%      100%       68%
12              3%       50%       33%
13              3%       55%       40%
14              0%       38%       33%
15              0%       40%       30%
18              0%       55%       43%

dwarf: win% by ladder level (40 fights per cell)
level       masher   blocker   skilled
10             28%      100%       80%
11             13%      100%       73%
12              5%       53%       25%
13              0%       33%       28%
14              0%       57%       43%
15              0%       53%       33%
18              0%       57%       45%

knight: win% by ladder level (40 fights per cell)
level       masher   blocker   skilled
10             68%       73%       38%
11             53%       75%       60%
12             10%       13%       13%
13             13%       10%       13%
14              8%       13%        5%
15              0%       10%        3%
18              0%        3%        5%

minotaur: win% by ladder level (40 fights per cell)
level       masher   blocker   skilled
10              3%        0%        0%
11              0%        3%        0%
12              0%        0%        0%
13              0%        0%        3%
14              0%        0%        0%
15              0%        0%        0%
18              0%        0%        0%

werewolf: win% by ladder level (40 fights per cell)
level       masher   blocker   skilled
10              3%        0%        3%
11              0%        3%        8%
12              0%        3%        0%
13              0%        0%        3%
14              0%        3%        0%
15              0%        0%        3%
18              0%        0%        3%

shieldmaiden: win% by ladder level (40 fights per cell)
level       masher   blocker   skilled
10             50%       95%       93%
11             40%       90%       83%
12             45%       88%       85%
13             35%       83%       85%
14              0%       23%       20%
15              0%       13%       10%
18              0%       10%        3%
```

Roster-wide matrix at L6, L18 and L46 (30 fights per cell, win % / mean seconds):

```
=== ladder level 6 (1 Recruit, 6 easy, 18 normal, 46 Origin) · 30 fights per cell · win% / mean seconds ===
opponent              masher       blocker       skilled
veteran              73% 26s      100% 24s      100% 23s
pitborn              70% 32s       83% 35s       77% 39s
goblin               27% 33s      100% 20s      100% 34s
nightborn             0% 21s       57% 31s       30% 31s
executioner          77% 23s      100% 26s      100% 24s
minotaur              0% 14s        7% 31s        3% 27s
wraith               10% 31s       97% 32s       97% 38s
werewolf              3% 15s        7% 32s       10% 28s
skeleton             47% 29s      100% 22s       87% 29s
dwarf                33% 33s      100% 29s       83% 31s
plaguedoctor          0% 22s       57% 31s       30% 31s
knight               70% 30s       87% 27s       87% 31s
witch                 0% 23s      100% 24s       77% 32s
shieldmaiden         60% 32s       97% 34s      100% 37s

=== ladder level 18 (1 Recruit, 6 easy, 18 normal, 46 Origin) · 30 fights per cell · win% / mean seconds ===
opponent              masher       blocker       skilled
veteran               0% 17s       23% 33s        0% 31s
pitborn               0% 14s        0% 25s        0% 25s
goblin               17% 52s      100% 42s       90% 50s
nightborn             0% 16s       23% 25s       10% 26s
executioner           0% 18s       10% 26s       13% 27s
minotaur              0% 14s        0% 24s        0% 25s
wraith                0% 22s       77% 36s       70% 35s
werewolf              0% 14s        0% 25s        0% 25s
skeleton              0% 18s       43% 38s       43% 35s
dwarf                 0% 21s       60% 38s       40% 41s
plaguedoctor          0% 15s       20% 25s        7% 25s
knight                3% 15s        3% 23s        3% 21s
witch                 0% 18s       77% 32s       50% 36s
shieldmaiden          0% 15s       10% 49s        3% 40s

=== ladder level 46 (1 Recruit, 6 easy, 18 normal, 46 Origin) · 30 fights per cell · win% / mean seconds ===
opponent              masher       blocker       skilled
veteran               0% 14s       37% 39s       10% 40s
pitborn               0% 13s        0% 28s        3% 26s
goblin               17% 64s      100% 51s       93% 62s
nightborn             0% 12s        7% 24s        3% 23s
executioner           0% 16s       20% 26s       10% 24s
minotaur              0% 13s        0% 25s        0% 25s
wraith                0% 19s       30% 29s       23% 25s
werewolf              0% 13s        0% 28s        3% 26s
skeleton              0% 16s       57% 34s       43% 37s
dwarf                 0% 21s       50% 40s       43% 43s
plaguedoctor          0% 12s        7% 24s        3% 23s
knight                0% 15s        3% 24s        0% 22s
witch                 0% 16s       67% 33s       37% 38s
shieldmaiden          0% 14s       17% 45s        3% 43s
```

## 2. Shipped curve (win % by ladder level, 60 fights per cell)

```
veteran: win% by ladder level (60 fights per cell)
level       masher   blocker   skilled
10             63%      100%       95%
11             62%       97%       92%
12              5%       35%        8%
13              0%       28%       12%
14              8%       28%       13%
15              3%       20%       12%
16              5%       30%       15%
17              0%       27%        7%
18              0%       27%        2%

pitborn: win% by ladder level (60 fights per cell)
level       masher   blocker   skilled
10             48%       67%       73%
11             60%       75%       67%
12             45%       62%       63%
13             45%       57%       48%
14              2%        5%        8%
15              5%        7%        3%
16              7%        8%       13%
17              0%        0%        2%
18              0%        0%        2%

executioner: win% by ladder level (60 fights per cell)
level       masher   blocker   skilled
10             68%       98%       88%
11             77%       93%       80%
12              5%       37%       25%
13              8%       23%       18%
14             13%       27%       23%
15              8%       25%       22%
16             10%       30%       12%
17              3%       18%       13%
18              7%       17%       17%
```

## 3. Proposed change (verified, not applied)

`lapse` is the chance a noticed swing gets no answer. At the first level whose reaction is under the player's cut windup, start the warden at `lapse` 0.9 and ease it down to the blend's own value over 7 levels. A warden that is already under the windup at L6 gets no ramp, and the anchors and every level outside the ramp are untouched.

Result with the diff below applied (same seeds, same bots):

```
veteran: win% by ladder level (60 fights per cell)
level       masher   blocker   skilled
10             63%      100%       95%
11             62%       97%       92%
12             62%       82%       77%
13             40%       80%       52%
14             25%       58%       35%
15             15%       42%       33%
16              8%       47%       27%
17              0%       42%       13%
18              0%       27%        2%

pitborn: win% by ladder level (60 fights per cell)
level       masher   blocker   skilled
10             48%       67%       73%
11             60%       75%       67%
12             45%       62%       63%
13             45%       57%       48%
14             17%       23%       37%
15             22%       23%       20%
16             17%       15%       15%
17              0%        0%        0%
18              0%        0%        2%

executioner: win% by ladder level (60 fights per cell)
level       masher   blocker   skilled
10             68%       98%       88%
11             77%       93%       80%
12             50%       63%       70%
13             28%       63%       48%
14             42%       58%       55%
15             20%       48%       40%
16             20%       43%       27%
17             10%       23%       25%
18              7%       17%       17%
```

Veteran vs `skilled`: 92 → 77 → 52 → 35 → 33 → 27 → 13 → 2 % across L11–L18, instead of 92 → 8 → 12 → 13 → 12 → 15 → 7 → 2 %. The Pitborn's L14 fall (45–57 % at L13 → 2–8 % at L14, all three bots) becomes, for `skilled`, 48 → 37 → 20 → 15 → 0 % across L13–L17.

```diff
diff --git a/src/moves.ts b/src/moves.ts
index 8e6a1ec..1f1a944 100644
--- a/src/moves.ts
+++ b/src/moves.ts
@@ -758,7 +758,26 @@ export function profileAt(o: Opponent, level: number): AiProfile {
   const [from, to, a, b] = l < LEVEL_ANCHORS.easy ? [LEVEL_ANCHORS.novice, LEVEL_ANCHORS.easy, novice(o.profiles.easy), o.profiles.easy]
     : l < LEVEL_ANCHORS.normal ? [LEVEL_ANCHORS.easy, LEVEL_ANCHORS.normal, o.profiles.easy, o.profiles.normal]
     : [LEVEL_ANCHORS.normal, LEVEL_ANCHORS.hard, o.profiles.normal, o.profiles.hard];
-  const profile = blend(a, b, (l - from) / (to - from));
+  const blended = blend(a, b, (l - from) / (to - from));
+  const profile = lapseRamp(o, l, blended);
   levelCache.set(key, profile);
   return profile;
 }
+// The reaction cliff (Ladder sweep, 2026-10-04): a warden notices the PLAYER's swing `reaction` ticks after it starts, so while his reaction is at or above
+// the player's cut windup (20 ticks, the longsword's) he can never answer a cut, and one tick under it he answers nearly all of them. The blend moves reaction
+// about one tick a level, so at the level it first drops under the windup a bystander's win rate fell 60-95 % -> 5-15 % in one step (Veteran and
+// Executioner, L11 -> L12, six scripted strategies; L12 with L11's reaction restored it, L11 with L12's reproduced the fall). `lapse` is the chance a
+// noticed swing gets no answer, so that first level starts almost all lapse and eases to the blend's own value over LAPSE_RAMP levels. Only a warden whose
+// reaction crosses the windup between L7 and L17 has a cliff: those already under it at L6 (Goblin, Nightborn, Witch...) are untouched, and so are the
+// anchors and every level outside the ramp. Other player weapons have other windups; the longsword is the one the ladder is tuned on.
+export const LAPSE_RAMP = 7, LAPSE_START = .9;
+const lapseRamp = (o: Opponent, l: number, p: AiProfile): AiProfile => {
+  if (l <= LEVEL_ANCHORS.easy || l >= LEVEL_ANCHORS.normal) return p;
+  const windup = PATHS.light_right.windup;
+  const reactionAt = (k: number) => k === l ? p.reaction : blend(o.profiles.easy, o.profiles.normal, (k - LEVEL_ANCHORS.easy) / (LEVEL_ANCHORS.normal - LEVEL_ANCHORS.easy)).reaction;
+  let crossing = 0;   // the first level whose reaction is under the windup, the level before it still at or over
+  for (let k = LEVEL_ANCHORS.easy + 1; k < LEVEL_ANCHORS.normal && !crossing; k++) if (reactionAt(k) < windup && reactionAt(k - 1) >= windup) crossing = k;
+  if (!crossing || l < crossing || l - crossing >= LAPSE_RAMP) return p;
+  const lapse = Math.max(p.lapse, LAPSE_START - (LAPSE_START - p.lapse) * ((l - crossing + 1) / LAPSE_RAMP));
+  return { ...p, lapse: Math.round(lapse * 1000) / 1000 };
+};
```

### What the change trips (so it is the lane's call, not a drive-by)

Run on top of trunk `4056467` with `npm test`: 1785 pass on trunk; with the diff, 2 fail:

1. `between anchors every level is a blend: skill knobs move monotonically…` — the ramp makes `lapse` rise at the crossing, deliberately. The test needs an exemption for `lapse` (or a rule that allows exactly this ramp).
2. `a sim change without a RECORD_VERSION bump would break every live kill link` — levels 12–17 would replay differently, so `RECORD_VERSION` needs a bump (`src/record.ts`), and with it the cost of old kill links at those levels. That cost is Combat's and Dom's to weigh; nothing here assumes it.

Also: the windup is the **longsword's** (20). Other player weapons have other windups, so the same cliff sits at a different level for them; the ramp is tuned for the weapon the ladder is tuned on.

## 4. Caveats

- The bots read the simulation state directly (exact ticks, exact sides), so they are tighter than a thumb; `masher` is cruder than any person. A win rate says what a strategy *can* do. Whether L12 feels like a wall to a human is a playtest question, and these runs say nothing about feel, animation or readability (the headless sim has no renderer).
- 60 fights per cell: single cells move by about ±6 points between seed sets; the cliffs are 40–90 points.
- Level-by-level sweeps cover the Veteran, Pitborn, Executioner, Goblin, Nightborn (60 fights per cell) and the Skeleton, Dwarf, Knight, Minotaur, Werewolf, Shieldmaiden (40 fights per cell, L10–L15 and L18). The Plague Doctor, Witch and Wraith appear only in the matrix (L6, L18, L46). An earlier draft of this page assumed the Minotaur and Werewolf share the Pitborn's curve; the sweep showed they do not (§1b).

## 5. Reproduce

```
node scripts/ladder-sweep.mjs curve --n=60 --opponents=veteran,pitborn,executioner --levels=10,11,12,13,14,15,16,17,18
node scripts/ladder-sweep.mjs curve --n=60 --opponents=goblin,nightborn --levels=1,6,12,18,32,46
node scripts/ladder-sweep.mjs matrix --n=40 --levels=1,18
```

Apply the diff above to `src/moves.ts` and re-run the first command to see the "after" table. About 1–2 minutes each on 4 CPUs.
