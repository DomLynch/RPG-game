# Combat — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Cleave lever and Dirty Jab closed (no change), Sparring dummy e7d97ac0 — combat lane, 2026-09-26 14:2x

**Now:** (1) The dummy ships inside Web's wiring PR (Lead 13:5x): Web cherry-picks e7d97ac0 (`combat/sparring-dummy`) verbatim; Lead closes #816. Stay on call for the fold (add/add with #815's src/sparring.ts and tests/sparring.test.ts). (2) The Dirty Jab
best-window table (land / counter / blocked % per opponent, easy + normal, 480 seeds), numbers only.

**Done:** **Cleave lever CLOSED, NO CHANGE** (Strategy 13:3x). Do not re-run. Recovery-window counter %, 480 seeds, trunk acdbe355,
easy / normal (scratch counter2.mts with a PATCH env):

| Cleave variant | Goblin | Shieldmaiden | Nightborn | Plague Doctor |
|---|---|---|---|---|
| base (heavy 32/5/31) | 89 / 69 | 65 / 71 | 63 / 26 | 50 / 34 |
| poise 24 from 24 (Reaping's) | 89 / 70 | 65 / 71 | 66 / 27 | 51 / 34 |
| poise 24 from 8 or 0 | 90 / 69 | 65 / — | 66 / — | 52 / — |
| light row 20/8/22 (± poise) | 49 / 44 | 1 / 0 | 0 / 0 | 0 / 0 |
| Reaping, control (live) | 86 / 70 | 74 / 84 | 76 / 38 | 68 / 45 |

Poise only turns the counter into a trade (Goblin normal trades 0 → 208). The light row clears the target by overshooting to ~0 and
removes the readable tell; skill-caps allows no row in between. The 48-seed fairness screen of the light row was within Pommel + 6 on
all 140 pairings; the 480-seed rows were stopped (not needed). Ruling: the recovery counter is the heavy-windup class's property
(Reaping has it live), not a Cleave hole; Reaping v Shieldmaiden normal 84 closes with it.
**Sparring dummy (e7d97ac0, was #816):** `src/sparring.ts` OUTSIDE SIM_FILES (ai.ts / moves.ts untouched: no RV bump, no fixture). `SPARRING_DUMMY` =
easy + aggression 0, parry 0, dodge 0, guard .25; `disarm()` strips light / heavy / thrust / kick / skill after `decide()`;
`stepSparring` = drop-in for `stepPractice`. Not in PROFILES, so it stays out of #815's picker (SPARRING_LEVELS = Object.keys(PROFILES)), the batteries and the ladder.
Receipts: 48-seed sanity, 14 opponents × {idle, light spam, heavy only}: 0 attack ticks, 0 hits on the player, guard 0–13 % of
ticks; tests/sparring.test.ts 4 / 4 (SPARRING_DIGEST pinned); record-version-guard green; both tsc clean.

**Dirty Jab best-window table: CLOSED, no hole** (Strategy 14:1x). 480 seeds, the player walks inside the 1.0 m reach, ≤ 3 casts a
fight; best window land / counter / blocked %, easy | normal: Goblin recovery 87/22/6 | 46/28/5 (the weakest), Wraith neutral 67/0/0 |
recovery 31/0/56 (never swings in range), Nightborn 92/7/7 | swing 78/22/0, Shieldmaiden 87/13/0 | 94/6/0, Plague Doctor 92/8/0 | 91/9/0;
the other nine land 100/0/0 in their best window at both levels. Best-window counter < 50 everywhere. Scratch: jabwalk.mts. A player
who does not walk in reaches 1.0 m on only 58 of 1,440 cast chances v the Centurion, so the live "0 Jabs in 28 min" reads as reach; open
until Web's press-gap tick log (Web's 11:32 run walked to reach and still landed none).

**Open:** Web's tick logs: one Cleave clip (the sim has 0 same-beat trades in 926 swing-start casts) and the Jab presses v the
Centurion. Lead's Jab reach table (1.0 / 1.2 / 1.4 m), numbers only; reach is in SIM_FILES, so a change is an RV bump and Strategy's.

**Gotchas:** (1) Any edit to src/ai.ts or src/moves.ts moves SIM_DIGEST → RV bump; data that must not bump lives outside SIM_FILES.
(2) The dummy steps back out of reach, so a scripted player that never walks in can go 0 / 48; a real player walks.

## RV15 live, kick item closed, Cleave lever next — combat lane, 2026-09-26 midday

**Now:** (1) **Cleave lever**, numbers to Lead + Strategy by 14:15 (proposal only, no build). Target (Strategy): Cleave cast in the
opponent's RECOVERY countered < 50 % on normal and < 70 % on easy v the Goblin, Shieldmaiden, Nightborn and Plague Doctor; Pommel + 40 at
480 seeds held on every Cleave pairing; Reaping unchanged. Levers in order: poise ticks on the windup (as Reaping's poise 24 from 24),
then a shorter tell; never damage. If none clears it without breaking the bar, say so: Cleave ships as is, Goblin noted as a weakness.
Baseline recovery counter % (easy / normal): Goblin 89 / 69, Shieldmaiden 65 / 71, Nightborn 63 / 26, Plague Doctor 50 / 34.
(2) **Dirty Jab** best-window table (land / counter / blocked % per opponent, easy + normal, 480 seeds); no window that lands = a hole =
a proposal. (3) Live Pommel over a .5 win rate on cleaver / maul v the Executioner (254 and 250 / 480): its own item, parked.

**Done:** **RV15 LIVE a0c71273** (my curl: release.json, served bundle v:15, offers lunge→nightborn, jab→goblin, ironrush→knight).
#806 (1cbad5a6): Lunge damage 11, Iron Rush 10, both stagger 0 and staminaDamage 0, reach / stepIn / Rush poise kept; Jab re-offered as
is; skill-caps NO_STAGGER {lunge, ironrush}; RECORD_VERSION 15; SCOPE item 8 dated line. Receipts: npm test 708 / 0 / 2, --strict 5 / 5,
ceilings pass (Goblin 44.6 s). #807 (cb97c190): loot-smoke-check taps above #loot-panel (elementFromPoint === CANVAS); the re-offered
Jab's tile had covered the fixed (190, 300) tap and failed release row 36 twice.
**The 480-seed bar** (Strategy, from Combat's analysis): at 48 seeds the gap between two ~50 % rows has sd ≈ 4.9 wins, so "Pommel + 4"
could not tell an inert Jab (28 / 48) from Pommel; every skill row is now judged at 480 seeds, ≤ Pommel + 40, cleared by ≥ 11.
Binding pairing estoc v Goblin: Pommel 226, bar 266; Lunge 241, Iron Rush 242, Jab 250 (no skill 221).
**Item 7 kick punish: no change needed** (480 seeds, normal + hard). Player 'kick only' wins 0 / 480 v every opponent except the
Goblin (normal 34, hard 3) and the Dwarf (normal 2). Opponent kicks never make a turtle lose more; the Goblin's kick gets through a
perfect-read guard 46 % of the time at normal (Centurion 0 %), which belongs to the parked Goblin kick trim, not item 7.
**Cleave counter table:** the Centurion counters Cleave at his swing start 35 % easy / 25 % normal, below all but the Knight and the
Executioner, so no lever for him; in the sim a Cleave at his swing start either lands or is countered, never both (0 trades / 926), so
Web's 8 / 8 same-beat trades are a harness-timing question for Web.

**Open:** the Cleave lever and the Jab table (above). Web to tick-stamp one Cleave clip.

**Gotchas:** (1) An idle-player battery runs every fight to 7,200 ticks; cap a per-cast measurement at 3 casts / 3,600 ticks or it
takes hours. (2) A new loot offer grows the kill panel: fixed-coordinate taps in browser checks break (row 36). (3) The Pommel row on
the estoc is the weapon's own, so a patch to MOVES.skill_pommel does not reach it; an uncastable skill (stamina 9999) is the true
no-skill baseline. (4) The .5 / .35 absolute cap is NOT a ruled bar (live Pommel already exceeds it v the Executioner).

## SCOPE 8: the opponent skills, #794 (RV 14) — combat lane, 2026-09-26

**Now:** a Goblin skill-counter is ON HOLD for Strategy. GAME_SPEC.md:93 says he never guards, so a block is out. The Goblin lane
proposes a dodge/back-step share against skill wind-ups (`disengage`/`step` already exist on his profile). **Hard constraint:** his
AI-vs-AI median is 44.6 s against the 45 s ceiling, so any counter that lengthens his fights has 0.4 s of room. Lead asked for both options
on paper: the knob, plus the expected Lunge and Iron Rush on estoc v Goblin. **No sim edits until Strategy rules.** If it lands, the
fix re-offers Lunge and Iron Rush (rows and codes already in) with one bump 14 → 15, the fixture and `--strict`, the battery, and Pommel
re-measured (the bar moves with it).

**Done:** #794 (`combat/scope8-skills` @ `2579c4df`), GO to Deploy 07:33. Spec: docs/briefs/scope8-rows.md. **6 of 9 ship** (Scutum
Shove, Reaping Blow, Butcher's Cleave, Anvil Stomp, Miasma, Shield-Hewer). **Pulled** (loot.ts `opponent: null`; MoveDef + record code
kept): Estoc Lunge 22/24, Iron Rush 22/24, Dirty Jab 14/24, all estoc v Goblin. Strategy's pass bar per pairing: ≤ 12/24 OR ≤ Pommel + 3.
Baselines, measured 07:22 on 2579c4df's parent (normal, 24 seeds, best scripted use):

| pairing | Pommel | no skill | bar = max(12, Pommel + 3) | worst shipping skill | pulled skills |
|---|---|---|---|---|---|
| estoc v Goblin | 9 | 9 | 12 | shove 11, reaping 11 | lunge 22, ironrush 22, jab 14 |
| longsword v Goblin | 1 | 0 | 12 | ≤ 6 | lunge 13 |
| cleaver v Executioner | 10 | 8 | 13 | ≤ 12 | lunge 13, ironrush 13 |
| warhammer v Executioner | 11 | 7 | 14 | cleave 13, miasma 13 | — |

Knobs that shipped: Shove and Reaping stepIn → 0; Hewer direction → right (Strategy 07:16). Receipts on
2579c4df: unit 691/0, `--strict` 5/5 digestMatch, ceilings unchanged (goblin 44.6 s ≤ 45), SIM_DIGEST 28364bb9, shards 140/140 for
shove/reaping/hewer. `skill-battery.mjs` exits 1 on OVER; tests/skill-caps.test.ts pins the caps (Combat owns the nine from here on).

**Open:** live verification of the RV14 run (Deploy). Web's take thumbs for the ids; per-move clips (each plays its timing row's clip).

**Gotchas:** (1) A shaft guard (`heavyBreaks`) breaks on ANY overhead, so an overhead skill breaks trident/scythe/maul/warhammer/reaper
guards outright. (2) `skillUses()` captures a skill's reach when strategies.ts loads, so a probe that mutates `MOVES.reach` afterwards
still casts from the old gap and its reach numbers read optimistic (Jab: probe 6, real 14). stepIn probes are sound. (3) The Goblin never
blocks, so any skill that reaches him lands every cooldown; that was the whole failure. (4) A new SkillId breaks tests that assume only
the Witch offers a move (skill-take, graphics' first-unowned-tile pick) and the "unknown skill byte" test. (5) The deploy hook blocks any
bash whose TEXT contains `node --test`; the Write tool refuses ~/Developer/frankendom-combat (write there with a heredoc).

## Local test player evidence — combat lane, 2026-09-24

Draft PR #632 remains local test tooling. The charged policy won 26/27 real browser fights on Easy across nine playable opponents (three seeds each); Pitborn was 2/3, the others 3/3. A separate ten-seed Pitborn batch won 7/10. Owner set the batch acceptance to two-thirds per opponent; the configured three-fight Pitborn check now passes 2/3 with all inputs released. Build and 412 targeted tests passed. Decision/outcome receipts and short clips are included; Playwright clips are silent, and the constrained-observation mode lost its first Pitborn trial. Broader seeds, sound, touch and real-player readability remain validation, not claimed passes.
## Publish B′ live (v7, the Veteran on the trident) — combat lane, 2026-09-23 evening

Supersedes the Publish B entry below wherever the two conflict. #557 (B, with the Centurion swap) reached trunk and was reverted (#560)
when Strategy held the swap. **B′ = #563, live as `a50f22f`** (release.json checked).

**Now:** bump 8 = **#550** (`combat/executioner-anticipate` @ `9801276`). Merge trunk into it (no force-push). The one row to fix is
`cleaver vs executioner normal: light spam 18/24` → ≤ 12; then offer the cleaver. No new over-cap rows, the Executioner's identity pins
intact, re-pin last, and a before → after table for Lead. On #545's tree its profile measured cleaver 8, warhammer 7, trident 7 and
knife thrust 11 (unchanged): **re-measure on the v7 tree**, because the base moved.

**Done:** B′ recipe: `4a30ef6` → a revert of it → reverse of #547's own `a9d6734..28a0fd0` (not `9858588..`, which would strip #538) →
trunk merge. v7, `SIM_DIGEST` 3d3a9322…, replay refs 1677/1452. On B′: knife vs veteran 4/24, cleaver vs veteran 4/24, trident vs veteran
6/24, gladius offered (worst 2/24). **`OFFERED_DESPITE` never shipped**, and `KNOWN_UNFAIR` holds only the cleaver vs executioner row.
Receipts: quality:stop 523/0/2, test:slow 101/101, guard 4/4, release rows 2/11/12/34 solo.

**Open:** the Centurion's gladius + scutum (#547) is held until he reads as a gladius fighter. With it, knife vs veteran was 23/24 and
cleaver vs veteran 16/24, so that return owes a battery too.

**Gotchas:** before reversing a PR's diff, check its range for commits carried from elsewhere. `blade-paths.ts`, `blade.ts`,
`roster.ts` and `finishers.ts` are in the digest now: a rebake or roster change needs a bump.

## Publish B (v7) and the road to bump 8 — combat lane, 2026-09-23

**Now:** bump 8 = **#550** (`combat/executioner-anticipate` @ `9801276`, stacked on #545): the Executioner's own normal profile
`{ ...PROFILES.normal, anticipate: 3, lapse: .2, read: .75 }` plus `ai.ts:114` `profile.anticipate ?? READ.anticipate`. It must also
fix the rows that #557 signed: `knife vs veteran normal: thrust from range 23/24` (the named `OFFERED_DESPITE` exception),
`cleaver vs veteran normal: charged heavy only 16/24` and `cleaver vs executioner normal: light spam 18/24`. Then remove
`OFFERED_DESPITE` and offer the cleaver. **Bump 8 does not ship while `OFFERED_DESPITE` is signed** (Lead + Strategy). Merge trunk into
#550 once B is live. Theory to measure: the Centurion's gladius (sword −0.23 m) lets a knife poker park at his range. Watch item:
`trident vs veteran normal: charged heavy only 12/24`, on the cap.

**Done today:** #530 knife (v6, Publish A, live). **#545**: the Nightborn's `aggression` normal .6→.55, hard .75→.65. That fixed the
three findings the estoc's +0.30 m reach (#532) caused (trident 14→8/24, exhausted 321→108 ticks, hard feint-and-punish 0→7/24), and the
estoc is offered. **#557**, the single Publish B merge (#545 + #547 + #543 + #532 + trunk): `RECORD_VERSION` 7, `READABLE_VERSIONS` [7],
`SIM_DIGEST` d63f3a22…; `SIM_FILES` widened to the sim's runtime import closure (+ blade.ts, blade-paths.ts, roster.ts, finishers.ts)
with a test that walks the closure; the knife and scythe thrust tables rebaked (stale since 5); gladius offered; #547's reds re-signed
(trident-mechanics pins now fight an explicit trident Veteran). Tables and receipts are in the PR bodies.

**Open:** #557's merge and publish is Deploy's (Lead gave GO: #552, then #557). After it lands: #550 → bump 8 (above). Veteran lane
owes the regenerated versus card and identity pin (#547).

**Gotchas:** a fight record carries only (opponent, level byte), and `replay.ts:16` rebuilds the profile from `OPPONENTS[id].profiles[level]`.
So every AI value lives in moves.ts per-opponent profiles, never merged in from grades.ts (Lead's first anticipate spec had that bug).
The blade bake samples `total(spec)`: any timing change needs `node scripts/bake-blades.mjs`, and the closure test now catches a
forgotten one via the digest. Profile knobs are chaotic: single values are non-monotonic across seeds (Nightborn aggression .50/.55/.60
put scythe at 14/8/9), so measure every weapon's row, not the target alone. While `~/.claude/state/deploy_in_flight.json` exists, every
`node --test` is blocked, even a single file.


## The knife is offerable — and the mechanism below this entry was wrong (combat lane, 2026-09-22)

**Read this before the entry beneath it.** That entry's evidence stands — the pinned gap, the profile sweep, Lead's ruling, Strategy's
conditions — but its MECHANISM is disproved. It says the Goblin's *approach* settles at a raw reach value. It does not. `ai.ts`'s
approach stop is `thrust.reach - .2` (1.25) or `fight.close` (KNIFE's is 1.0), and neither is 1.41. That number should have bothered us
sooner; it was reasoned, not measured, and three sessions repeated it before anyone instrumented it.

**The measured cause, two layers.** (1) A guardless warden reading a kicker holds at `theirs.kick.reach + .3` = 1.50, zeroing his
forward drive at 1.45 (`reads.kicker=true`, `poker=false`; park 1.431 / 1.420 / 1.417, p10 = median = p90, seeds 1-3). (2) Underneath
it, the real defect: **`next.next` was `light` on 6599 of 6599 ready ticks.** The plan is picked once, re-picked only when null, and
cleared by being thrown — so a warden held at a gap his queued move cannot reach never attacks, never clears the plan, never re-rolls.
Thrust was legal and in reach on 3340 of those ticks at full stamina, no threat. Measured attack starts are **4-5** per 7200 ticks, not
the 3 recorded below.

**Two designs measured, one rejected — this is why the shipped one is minimal and not merely the first thing that went green.**

| design | knife row | cost |
|---|---|---|
| hold derives from the QUEUED move (1.05) | clears | **breaks the Goblin identity pin**: normal kick-only 5 wins vs the honest answer's 4 — inside the kicker's 1.2 reach, trading a stalemate for the cheese the hover exists to deny |
| hold at thrust margin (1.35), re-pick **ungated** | clears | **`knife vs goblin normal: thrust from range` 15/24 vs cap 12** — fired on the poker hover, whose design is patience (Brief 5: stand off the live point, go in on the whiff) |
| **shipped:** hold at thrust margin, re-pick gated to non-pokers | clears | none — final table is the old set minus the knife row |

`ai.ts:191` already re-picks a plan the warden is too CLOSE for; the shipped fix is that rule's missing far side. Strategy's condition
(a) — derive the target from the same margin `inReach` uses — survived the correction intact; it applies to the hover HOLD rather than
the approach stop. Read it as refinement, not invalidation. The `cramped` branch was NOT redundant and stays.

**Blast radius, narrower than first reported.** Gated on `guardShare === 0`, and `guard: 0` appears on exactly three lines of
`src/moves.ts` — the Goblin's easy/normal/hard. No other warden moves; the Nightborn is untouched, so #419 was never sequenced behind
this. But the Goblin is the opponent in many rows, so the whole table was re-scanned, not the knife's.

**Receipts.** `quality:stop` 468 tests / 466 pass / 0 fail (2 skipped). `test:slow` 94/94. `record-replay --write` then verify PASS
(veteran-walk-in 1677 died, veteran-scripted 1452 died, both digests match). RECORD_VERSION 5 -> 6; SIM_DIGEST `713efc17…` ->
`86e61b16…`, PINNED_FOR_VERSION 6 — **read AFTER the bump**, because `src/record.ts` is inside its own hashed set.
`READABLE_VERSIONS` deliberately untouched: widening the reader belongs with Stats' v5 decoder branch (#503), not this writer bump.
`knife vs goblin hard: kick only untouched` 3/24 removed from `KNOWN_UNFAIR`; `knife` added to `PLAYER_WEAPONS_OFFERED`, now
longsword / warhammer / trident / scythe / knife.

**Gotcha worth carrying beyond this lane:** a number that no constant in the code can produce is a sign the mechanism is wrong, not
that the constant is hidden. 1.41 matched nothing in the approach path, and the cost of not checking that was three sessions carrying a
wrong cause into their own notes and briefs.

**Now:** knife ready at local `1a83c3c` on trunk `fe0d8e0`, unpushed — the remote needs the owner's word. **Next:** the Nightborn/estoc
profile item (Strategy), then cleaver — which is blocked on Lead's per-grade `anticipate` field, because `ai.ts:114` clamps the spam
read to `READ.anticipate` (8) and swallows any per-grade `reaction` above it.

## The Goblin parks 0.1 m outside his own reach — the knife's last blocker (combat lane, 2026-09-22)

**Finding, measured not guessed.** `knife vs goblin hard: kick only untouched 3/24` is the only row left keeping the knife out of
`PLAYER_WEAPONS_OFFERED` (the scythe cleared and ships; see the weapons lane's entry). It is NOT knife data. The Goblin's approach
stopping distance and his in-reach test disagree by the 0.1 m margin, so against a passive opponent he parks just outside his own
attack range and stays there.

Evidence, one instrumented fight (seed 12345, knife player, `kick only`, 7200 ticks):
- gap p10 = median = p90 = **1.41 m** — pinned, not a distribution.
- **3 attacks started in 7200 ticks.** Hero 137 hp, Goblin 116 hp, tick limit reached. The whole row is 24/24 stalls.
- His usable reaches (ai.ts `inReach`: `gap <= reach - .1`): light **1.10**, thrust **1.35**, heavy **1.45**. At 1.41 only the heavy
  is legal, which is why he throws almost nothing.
- Forcing `circle` 1 -> 0.5 -> 0 changes nothing (3 attacks each); at circle 0 the gap sits at **exactly 1.45 = `thrust.reach`**. So
  circling is NOT the cause — ruled out by experiment, not by argument.
- `KNIFE.fight.close` is **1.0**, and ai.ts:314 walks him forward while `gap > fight.close` (or `thrust.reach - .2` when a thrust is
  planned). He should close to 1.0, where the light works. He stops at raw `thrust.reach` instead.
- Not the body separation floor either: that is 0.85 (duel.ts:230), well inside where he stops.

**So the hole is general, not the Goblin's and not the knife's:** any warden whose approach settles at a raw reach value rather than
inside the `reach - .1` margin can park where nothing of his is legal. It shows up on the knife because the knife's short reaches make
the 0.1 m band the difference between every move and one move.

**A hard-profile change alone CANNOT fix this — measured, 2026-09-22.** Lead's brief prescribed fixing the Goblin's hard profile only
(stall window -> close-and-punish), on the GAME_SPEC rule that profiles move reaction/prediction/aggression and never data. But the
parking distance is geometric, and a profile cannot move where he stops. Sweep on seed 12345, 3600 ticks, `kick only`, knife:

| profile | attacks | gap median | hero hp | outcome |
|---|---|---|---|---|
| hard as shipped | 3 | 1.41 | 137 | stall |
| aggression 1 + pressure 1 | 3 | 1.41 | 137 | stall |
| reaction 1 (instant) | 5 | 1.34 | 98 | stall |
| discipline 0 (never rests) | 3 | 1.41 | 137 | stall |
| **every knob maxed for commitment** (aggression/pressure 1, reaction 1, discipline 0, circle/disengage/lapse 0) | 5 | 1.28 | 98 | **stall** |

Even with every commitment knob at its limit the fight does not resolve. `reaction` is the only knob that moves the gap at all
(1.41 -> 1.34) and it buys 2 attacks. So the target "knife row <=1/24 and the Goblin resolves" is not reachable from the profile, and a
profile change that half-moves it would be tuning toward a pin without fixing the defect. The fix has to be the approach/in-reach
disagreement itself in ai.ts — which is shared by every opponent, so it needs the full battery across all weapons.

**RULING (Lead, 2026-09-22, after the sweep): fix the approach/in-reach disagreement in `src/ai.ts`.** The profile-only prescription is
superseded by measurement. Lead's reading, and he is accountable for it: GAME_SPEC's "profiles move reaction/prediction/aggression,
never data" governs PROFILES; ai.ts approach logic is neither a profile nor weapon data, it is the code profiles feed, so fixing a
logic defect there is in scope.

**Precedent that corroborates the diagnosis — put it in the PR.** ai.ts:311-313's `cramped` branch exists for this same class of bug:
its comment records the reaper Wraith, whose approach stops at 1.9 m, meeting a fighter parked at 1.45 m and never moving again. That
was patched for ONE opponent at ONE range. This is the general case. **Fix the seam; do not add a second patch beside the first.**

Conditions on the fix: (1) full 24-seed battery, every weapon, both levels — shared by every opponent, so the blast radius is the whole
table; snapshot diff in the PR body with every moved row attributed. (2) RECORD_VERSION bump — **5 is live so the next is 6** — and
SIM_DIGEST re-pinned AFTER the bump. (3) fight-length pins green for EVERY opponent, not just the Goblin. (4) **Re-measure
`cleaver vs executioner normal: light spam` before touching item 2** — if this fix improves it, item 2's Executioner profile edit may
be unnecessary; tell Lead the number either way, item 2 is now provisional. (5) flip 'knife' into PLAYER_WEAPONS_OFFERED in the same PR
if the row clears; if it does not, bring Lead the table and decide then — **do not tune toward the pin.**

**Strategy's four conditions on top of Lead's, and (a) is the actual shape of the fix.** (a) **Derive the approach target from the
same margin `inReach` uses** — "close until the planned move is in reach" — rather than introducing a second constant that can drift
from it again. The bug is two numbers that must agree being written independently, so the fix is to stop writing them independently.
**If the `cramped` branch (ai.ts:311-313) becomes redundant once the target is derived, delete it in the same PR** — it was the
one-opponent patch of this same defect, and leaving it would be two mechanisms for one rule. (b) The PR body carries the seed-12345
`kick only` trace before AND after: attacks started, gap p10/median/p90, resolution tick. The "before" is 3 attacks / 1.41 pinned /
no resolution; the "after" must show all three moving. (c) **Re-record the daily fight and the kill-link fixtures under
RECORD_VERSION 6 in the same PR** — every fight's approach moves, so the fixtures move with it; do not let that trail into a
follow-up. (d) Clear before starting.

Sequencing: item 2 (cleaver/Executioner) is **provisional and behind this**. Re-measure `cleaver vs executioner normal: light spam` on
the FIXED approach before touching his profile and send Lead the number; if it clears, the cleaver flip ships alone, and if the table
is already re-signed in the knife PR it can ride there rather than waiting for a second one. ETA agreed: first thing, not tonight —
"better a true morning than a false midnight". Nothing in this lane must move tonight.

**Do not fix this by tuning the row.** 3 untouched against a cap of 2 is one fight over — a tie-break margin, and tuning to clear it is
exactly what produced the estoc mess. Fix the approach/in-reach disagreement on its merits; the row clears or it does not, and if it
does not, bring Lead the table. Whatever lands needs the full 24-seed battery re-run, because every player weapon is also a warden's
weapon and this touches ai.ts, which every opponent shares.

## Two PRs closed, 2026-09-22 20:40 (lead, Dom via Strategy)
**#370 "Brief 8: the Veteran's authored opening" — CLOSED, not abandoned.** The branch was OPEN and CONFLICTING against trunk and had been since the beta stack landed; rebasing it is part of its remaining cost, and the opponent it scripts is being renamed (the Veteran opponent becomes **the Centurion**, name field only). Brief 8 stays on the board: redo the authored opening against the Centurion after the shield. Do not resurrect this branch — cut a fresh one.

**#186 "Reaper Wraith: inside the point the kick counts from" — CLOSED under the creatures hold.** Draft, conflicting, and the Season-2 creatures are held for beta ([[frankendom_season2_creatures_on_hold]]). The finding itself is worth keeping: the Reaper's kick counted from the point rather than from inside it. Re-open the work with the creature roster, not before.

## The whip tell + the estoc park — combat lane, 2026-09-22

**Brief 13, the lorarii's tell (#441, `combat/whip-tell`).** The anti-turtling lash had no warning: the first a player knew of it was
the chip. `WhipRaised` now precedes every lash — `RULES.wall.loiter.raise` (60 ticks) before the first, `raiseAgain` (30) before a
repeat. The lead times live beside the rule, not as constants in duel.ts, and travel on the event as `lead` so presentation scales its
raise animation by what the sim means. That parameter exists because of a real defect caught before it shipped: the world lane had a
hard-coded 1.2 s hold, which fits the 1.0 s first lead and overruns every 0.5 s repeat, firing the lash mid-lift.

Both whip events carry `guard` — which sixth of the wall the lorarius stands in, `floor(angle / 60°)`, exported as `lorariusGuard`. One
source of truth: the world lane had believed a `lorariusAngle` existed in the sim (it did not, on any branch), and would have computed
its own and drifted. `Fighter.lashed` separates a first lash from a repeat and clears when the spell ends; the two raise thresholds
would otherwise collide, because a lash resets the clock to `ticks - again`, which IS the first-raise threshold. `anti-turtling 1b`
pins that case. Behaviour unchanged — both fixtures re-record to identical ticks and outcomes (1677 died, 1452 died).
Receipts: quality:stop 452/0, test:slow 93/0, kill-link PASS (36 fights), record-replay --write. RECORD_VERSION 3 → 4, SIM_DIGEST
re-pinned to d824c624…, PINNED_FOR_VERSION 4. **Gotcha: read the digest AFTER the version bump — record.ts is inside its own hashed set.**
Not done, deliberately: whether the warden should react to the raise (tick 120) rather than the magic `.75 × ticks` constant (tick 135)
in ai.ts. Real question, but it lands in the four lines #439 reformats, so it waits for that merge.

**The estoc is parked (#419 draft, #429 carries the record).** No `ESTOC.fight.close` clears both the Nightborn exhaustion pin and the
24-seed player-weapon battery. Full grid, the zero-margin proof and the revival condition are in docs/state/weapons.md — written there
rather than here because the next person to trip it will be holding a weapon, not a warden. Two lessons worth keeping in this lane:
a green suite is not a safe number (1.30 passed record-replay, kill-link, weapons 34/34 and opponents 20/20 and was still wrong, the
battery caught it); and **every player weapon is also a warden's weapon** — goblin/knife, veteran/trident, nightborn/estoc,
executioner/scythe, pitborn/cleaver, dwarf/warhammer — so a weapon edit's blast radius is every OTHER weapon measured against whoever
carries it. Lead has made that a standing rule for all lanes.

**Closed.** #441 merged (merge commit 9562c25) and the owed guard run is discharged: `record-version-guard` passes 1/0 on trunk
c7d942a, which carries the whip tell. The pin had been COMPUTED by hand (deploy in flight, suites blocked) and independently
recomputed by Auditer; both agreed, but two hand computations that read the recipe from the same source agree even when both are
wrong, so only this run counts as the receipt.

**NEXT, and top priority** (owner via Strategy/Lead, 2026-09-22 17:55): make the **cleaver, knife, estoc and scythe wieldable** —
ahead of #370, #186 and Brief 13 follow-ups. Why it is urgent: every opponent's weapon is already takeable in the kill-screen loot
panel and the equip files shipped in #309, so a player can take a cleaver and then not fight with it. Loot v2 is not done until a taken
weapon can be wielded. The only gap is the fairness table: `PLAYER_WEAPONS_OFFERED` on live c7d942a is still
`['longsword','warhammer','trident']`, and a weapon is offered only when it has no over-cap row in `KNOWN_UNFAIR`
(tests/player-weapons.test.ts derives the offered set from the 24-seed battery — it is never typed in by hand).

Order and rules: **one PR per weapon**, shipped as each clears, not four together. Start with the **knife** — Weapons has already
measured it (`thrust.recovery` 15 -> 20 clears both rows at 5/24 and 6/24 on branch weapons/knife-thrust-recovery); take their work
rather than re-deriving it, but re-run the WHOLE battery, because every player weapon is also a warden's weapon. Then cleaver
(`cleaver vs executioner normal: light spam 17/24` — a read problem, the Executioner cannot see a 22-tick tell; warhammer and trident
ship at 11/24 on the same mechanism, so this is a Brief 14 per-grade knob, not cleaver data) and scythe (two `thrust from range` rows).
The **estoc stays parked**: bring Lead a Nightborn-profile or trident-row DECISION, never a reopened stance number. Bar unchanged —
inside the cap on every rung, identity pins intact, no opponent retune that breaks a Combat-signed pin; if a weapon cannot clear
without one, bring the numbers and say which and why rather than weakening a pin. One RECORD_VERSION bump per PR is fine here (Lead,
explicitly: shipping a weapon a player can feel is worth the link invalidation).

**Behind the four weapons, nothing pre-empts them** (owner GO 18:40, 2026-09-22): the **Veteran's shield**. Combat's slice is the
rules only. The shield is a **GuardProfile, not a damage multiplier**: it covers **two of the five guard sides**, sets `stopsHeavy` (a
heavy no longer breaks the guard), and is cheaper to hold (costScale down). **No flat attack penalty** — the one-hand weapon table is
the attack cost. The only legible cost is that posture drains faster while the shield guard is held, so a shield turtle is not
available. Wall whip unchanged. Every number comes from the battery inside the wins/24 cap with the identity pins intact — same bar as
the weapons, and no weakened pins. Also this lane's: the Veteran OPPONENT carries the same profile from Legionary grade up, and his AI
must actually raise it (a profile he never uses is the same bug as a tell nobody can see).

Scope protection agreed with Strategy: if the shield rules are not through by beta freeze, the Veteran's shield starts at **Gladiator**
grade instead of Legionary, so beta never ships a shield that does nothing.

Not this lane's, but the seam to expect: Weapons add a `grip` field to moves.ts (ONE-HAND knife/cleaver/estoc/trident-as-spear,
TWO-HAND warhammer/scythe/hero's sword) and equipping a two-hander stows the shield; Multi Chars do the asset and back stow; Web design
the panel line. Take-one stays strict — the shield is one item, never bundled with a weapon.

**Now:** nothing in flight. **Done today:** Brief 13's whip tell (merged, live), the estoc park with its grid recorded on trunk (#429),
#439 reviewed and approved. **Quote the sha you measured, and re-read it before you publish the number.** Four separate incidents on 2026-09-22 where the fact was
right and the note about it was stale: a sha sent after trunk had moved; a comment quoting a rejected iteration's results (recovery 21)
beside the shipped value (20); a merge commit misquoted as the trunk head; and a re-signature requested against a head that was
CONFLICTING and mid-rebase at the time of asking. None was a measurement error — every one would have produced a phantom disagreement
costing someone a measurement window. Never measure a branch that reads CONFLICTING; wait for the stable head and record it beside the
numbers.

**Gotchas worth carrying:** a green suite is not a safe number — 12/24 against a strictly-greater cap of 12
is a tie-break, not a pass; every player weapon is also a warden's weapon, so re-scan the WHOLE fairness table after any weapon edit,
not just the edited weapon's rows; read a sim digest AFTER the version bump, because record.ts is inside its own hashed set; and a
finding recorded inside a PR that gets parked is parked with it — put it on trunk.

Open and owed by this lane: #370 (Veteran's opening) held on the owner's own verdict on feel — nothing technical left. `knife vs goblin
hard: kick only untouched 3/24` routed here as an approach-logic hole, not knife data (identity-shared MOVES.kick, every other weapon's
kick-only dies 24/24, all 24 knife fights stalemate at the tick limit). Weapons' #440 moves three rows in the signed KNOWN_UNFAIR table
(estoc/goblin hard ×2, scythe/goblin normal) — **unsigned by Combat**: re-deriving them needs the box, and a signature on someone else's
numbers is worth nothing.

## Tuning history moved out of src/moves.ts — 2026-09-22 (Auditer lane, GPT audit "readability")
The comments in moves.ts now keep only why each current rule exists; the dated experiments and probe numbers that set them live here.
- Anti-turtling band form (owner 2026-09-21): the "no regen while retreating anywhere" form failed 3 of the 24 rung identity pins (a charged-heavy spammer beat the Veteran 13/24, goblin fights ran past 45 s) and halved the hero brain's Veteran-normal wins — the rungs were tuned to recover by backing off. `RULES.retreat.wallOnly: false` restores it.
- Trident: LIVE since slice V (combat review 2026-09-16) — initialDuel gives the Veteran the trident table; the shaft-guard and thrust-opener rules landed in the same slice.
- Cleaver: LIVE since slice W (2026-09-17), OPPONENTS.pitborn. Knife: LIVE since slice X (2026-09-17), OPPONENTS.goblin; a reverse-grip hook was tried and rejected with numbers — on the sword's clips the blade sits behind the fist and never lands (0 m at every gap), it would need its own clip set.
- Scythe: shipped 2026-09-18 as the Executioner's arc (WEAPONS.scythe = SCYTHE); the earlier "on the shelf" state (REQUESTS.md §15–17) is over.
- Dwarf's warhammer (2026-09-20): hero's brain at normal 11/24 against it; the maul placeholder it replaced was 2/24.
- Veteran hard (owner 2026-09-20): the shared hard beat the hero's brain only 13/24, two wins tighter than normal; pressure .7 + discipline floor 30 → 18/24 (sweep, 24 seeds).
- Pitborn normal (owner 2026-09-20): rung 2 was the softest fight on the ladder — the hero's own brain beat him 41/48, mostly by stop-hitting him as he walked in (the thrust did 1254 of the damage across 24 fights; blocks and parries barely happened at reaction 18 / lapse .3). Reaction 18 → 14 and lapse .3 → .1; the whiff punisher stays at 9/24.
- Nightborn easy (owner 2026-09-20): an 8-tick reaction and a .45 parry made easy as hard as hard (hero's brain 8 / 9 / 9 across levels); a human reaction, a quarter parry and more lapses → 20/24 (sweep, 24 seeds).

## Ladder slice: Goblin normal rung, reaction 11 / accuracy .7 — 2026-09-22 (Auditer lane, Brief 1)
Strategy via Lead (02:50 local): Goblin-only retune, target 9–11 hero-brain wins at normal so the ladder reads ~15/13/10/10/6/8; same rules as #366 (normal profile knobs only, no pin edited without its owner's ruling), Combat signs.
Measured on trunk (24 seeds, `artifacts/ladder-levels.ts`, `tests/opponents.test.ts` goblin pins, the KNOWN_UNFAIR derivation of `tests/player-weapons.test.ts`, the seed-5 knife record fixture): 11/.7 → hero 10, identity pins 4/4; 12/.7 → 9 but "read the feint" ties (light spam 1 ≥ the answer's 1) and AI-vs-AI median 52.9 s over the 25–45 s band; 14/.7 → 11 but "heavy only wins 4 ≥ the answer's 4"; 13/.7 (earlier, on 2c0fe0f) → 8 with three new poker rows and a stalled fixture; accuracy alone (10/.7, .65, .6) → 5/4/4. Only `reaction` moves the hero brain against him.
Shipped: Goblin `reaction` 10 → 11, `accuracy` .8 → .7. Hard profile untouched. The slower read lets a poker park at range, so four KNOWN_UNFAIR rows move, all on weapons already carrying rows elsewhere: knife-normal "thrust from range wins 15/24" replaces "kick only untouched 3/24"; estoc-normal thrust 23 → 24/24; scythe-normal "thrust from range wins 19/24" added. Derived offered set (weapons with no over-cap row on any live rung, the test's own derivation) before and after: ["longsword", "warhammer", "trident"], equal to `PLAYER_WEAPONS_OFFERED`. Combat's ruling: re-sign the snapshot for 11/.7 on that condition; their re-sign comment on the PR is the gate. The seed-5 knife light-spam fixture no longer finishes in 3600 ticks at 11/.7 (abandoned) while its assertion (the longsword replay is refused) still holds.
Remaining validation: humans have not played the rung; the hero brain is a proxy for a reading player. Ladder after this and #366: normal 15/13/10/10/6/8 expected, to be re-measured on the merged trunk.
## Ladder retune: Nightborn and Dwarf normal rungs; the Goblin lever goes back to Combat — 2026-09-22 (Auditer lane)
Owner (2026-09-21, via Strategy/Lead): beta plan v3 item 1, "Nightborn retune"; Lead + Strategy aligned that the Auditer measures and ships it, Combat reviews and signs. Scope: only `OPPONENTS[id].profiles.normal` knobs; hard profiles, shared constants, timings, player guard constants, `RULES.retreat.wallOnly` and the loiter knobs untouched; no pin edited.
Problem: on trunk 3a11413 the hero brain (`artifacts/ladder-levels.ts`, 24 seeds) won normal Veteran 15, Pitborn 13, Goblin 4, Nightborn 5, Executioner 6, Dwarf 10 — rungs 3 and 4 harder than rungs 5 and 6, and the Dwarf (sixth rung) easier than the Executioner. Combat's reach fix (combat/warden-reach 2c0fe0f, #358) moved only the Goblin, 4 → 5. Every number below was measured on 2c0fe0f.
Method: nine single-knob experiments per rung. Nightborn: only `lapse` moves him (.25 → 10, .3 → 10, .35 → 9; `read` .7 → 5). Dwarf: only `read` moves him DOWN (.8 → 8, .9 → 3); lapse .2 → 12, parry .3 → 10, reaction 10 → 17, reaction 18 → 18, accuracy .9 + pressure .4 → 14, aggression .65 + lapse .4 → 14, read .9 + discipline 30 → 7, discipline 30 → 13 all make him easier.
Shipped: Nightborn `lapse` .15 → .3; Dwarf `read` .7 → .8 (own commit). Ladder normal 15/13/5/10/6/8 (was 15/13/5/5/6/10 on 2c0fe0f), hard rows unchanged 6/11/2/1/1/11.
NOT shipped — the Goblin, handed to Combat as a slice with the data: only `reaction` (+`accuracy`) moves the hero brain against him, and every reaction value tried fails a Combat-signed pin from one side or the other. 13/.7 (hero 8): opponents.test.ts 20/20 but the player-weapons KNOWN_UNFAIR snapshot changes (knife/goblin-normal "kick only untouched 3/24" clears; new knife "thrust from range wins 14/24", estoc "thrust from range untouched 6/24", scythe "thrust from range wins 24/24" + "untouched 3/24"; estoc thrust 23 → 24) and the seed-5 knife light-spam record fixture no longer finishes in 3600 ticks with either weapon. 12/.7 (hero 9): weapon rows smaller (estoc 24/24 + untouched 4/24, scythe 24/24; fixture finishes at tick 2538) but the identity pins fail ("read the feint": light spam 1 ≥ the answer's 1; AI-vs-AI median 52.9 s over the 25–45 s band). 12/.75 → 7, 11/.7 → 10, 13/.75 adds a trident row (an offered weapon). Accuracy alone does nothing: 10/.7 → 5, 10/.65 → 4 (AI-vs-AI median 46.4 s), 10/.6 → 4. Reading: a slower Goblin lets a poker park at range and drags AI-vs-AI fights; his hero-brain difficulty is his approach logic against a reading player, which is Combat's lever, not a profile knob.
Kill links: `RECORD_VERSION` 2 → 3 in src/record.ts and the decoder now refuses every earlier version (Lead's decision, 02:06): #371 and this retune changed how fights play out, so a link recorded before them would replay a different fight; a version refusal is the honest answer. tests/fixtures/fight-records.json re-recorded (same ticks/outcomes, new encoding); scripts/kill-link-check.mjs (gate row 30 since #332) passes 36 fights with the refusal in place; its missing weapon field, which crashed the script on heads without #332, was fixed by #332 itself minutes before this branch tried to.
Gates: opponents.test.ts identity/fairness pins 20/20 on the 3-rung candidate that included the Goblin, so Nightborn and Dwarf alone cannot fail them; the over-cap weapon table on 2c0fe0f + all three rungs changed only Goblin rows, so Nightborn and Dwarf add none. PR receipts: full ladder, pins, `npm test`, `npm run test:slow` on 2c0fe0f + these two commits, and `npm run quality:stop` on trunk + these two commits. Remaining validation: humans have not played these rungs; the 24-seed hero brain is a proxy for a reading player, not a phone player; Combat's review is the sign-off.

## Anti-turtling — combat half (sim rules + warden), 2026-09-21
Owner, verbatim in the combat session: "both 1 and 2." (whip at the wall + no stamina regen while backing away, as the lead proposed) — then, shown the measurements, "lets do this - Ship whip + wall-band variant now (recommended) — keeps every rung's feel, still kills the wall-camp." Visuals & World own the presentation (lorarii on the walkway, lash line, crack, flinch) against the `Whipped` event.
`duel.ts`: `Fighter.loiter` counts ticks within `RULES.wall.loiter.band` (1.0 m) without attacking; at `ticks` (180) the fighter is whipped — `Whipped` { actor = target, x, z, damage: chip }, health −3 floored at 1, +15 posture via the hoisted `shake()`, a 0.6 m shove toward an opponent within `into` (2 m) else toward the centre (none at grips < 1 m — a shove to the centre was pushing a cornered man out of his opponent's reach, rescuing the turtle), and again every `again` (60) ticks while he stays. `RULES.retreat` { away .02, wallOnly true }: inside the band a walking tick that opens the gap by more than `away` sets a one-tick rest (the sprint mechanism), so no regen while backpedalling at the wall; strafing, advancing, standing and open-ground retreats regenerate. `ai.ts`: at three quarters of the loiter clock the warden's next opener is now (wait 0), a circler with stamina above its floor closes to deliver it, and out of range it blends a 50 % inward step — the Goblin, who circled the patient man at 1.3 m with a knife that reaches 1.1, was lashed 17 times in 24 fights before this.
Why the band form: measured on the same tree, the everywhere form failed 3 of the 24 rung identity pins (a charged-heavy spammer beat the Veteran-normal 13/24 over the 50 % cap; goblin AI-vs-AI fights ran past the 45 s band) and halved the hero brain's Veteran-normal wins (16→7): every rung was tuned to recover by backing off. An AI "breathing drift" (slow circling retreat) was tried and made it worse (6 failures) — dropped. `wallOnly: false` is the switch for a future retune slice.
Gates: duel 46/46 (whip, repeat lash, shove direction, no-shove at grips, band-only regen rule with the everywhere form pinned behind the flag), ai 35/35 (the stamina-cost test now asserts the fight's stamina floor, not the end state), quality:stop 352/352, test:slow 68/68 incl. all 24 identity/fairness pins. Two test scripts changed with the rule: the goblin's scripted "patient" answer now walks off the wall (its backsteps drifted it there; standing in the band is what gets a man lashed — it lost two fights to the whip before), and the patience-vs-eagerness comparison is read over 48 seeds (at 24, with 21–22 stalls, its two win counts sit at 2–3 and one chaotic seed decides it: 3-vs-2 before, 2-vs-2 after one lash; 48 seeds read 3-vs-2 with the rule, 4-vs-2 without).
Ladder (24 seeds, before → shipped): normal Veteran 16→15, Pitborn 13→13, Goblin 7→4, Nightborn 5→5, Executioner 7→6, Dwarf 11→10; hard 6/11/7/1/1/9 → 6/11/2/1/1/11. Whips over 24 fights: Goblin normal 8 on him / 3 on the hero brain, hard 12 / 5; every other rung ≤ 1. The Goblin fights at the wall and is the one rung the rule visibly touches.

## Directional guard — combat half (sim rule + warden), 2026-09-21
Owner (2026-09-20): five-sided guard on the Guard button, ON by default; lead owns input/pose (#257), Combat the rule and the brain.
`duel.ts covers()`: the defender's side must mirror the attack's direction (LEFT meets a RIGHT cut), null = thrust, a held guard follows
`intent.guardDirection` each tick, a LOW guard braces a kick as an ordinary block, any other side still eats the vsGuard shove. `ai.ts`:
`AiProfile.read` on every table; a misread guards elsewhere; a read kick is braced; guardless fighters roll nothing. Gates: duel 42/42
(mirror, null, parry side, brace, slide; legacy guard tests hold the matching side), ai 35/35, battery + all six rung gates green.
Hero-brain ladder shifted with the rule (its own read is .7): normal Veteran 13→16, Pitborn 13→13, Goblin 9→7, Nightborn 9→5,
Executioner 5→7, Dwarf 12→11; a perfect-reading hero makes the Pitborn (24/24) and Dwarf (17/24) easy and leaves the Nightborn (7) and
Executioner (8) hard — the ladder now rewards reading. Retune of the rung profiles is a follow-up once humans have played it.

## Combat: Pitborn tune, Executioner gate, a planned-cut fix — 2026-09-20
- Pitborn normal reaction 18 → 14, lapse .3 → .1 (hard 12 / .08): hero brain 17/24 → 13/24 (Veteran 13); gate + a win-share pin. Executioner gets a fairness gate (caps, touched, honest answer, parked probes, AI-vs-AI 18–45 s). Fix found by the gate: a planned cut inside its own point (scythe 1.4 m) becomes the heavy/thrust when throwable — the hard Executioner froze over a man at 1.2 m. Other wardens' battery tables byte-identical. 312/312.
- Reaper Wraith (#186, draft — on hold with the Wraith for Season 2): inside the point the kick counts to its landing range; check 28 is a wall-clock UI duel that also fails on a trunk build on this Mac (61/78 hp left), so it is not a receipt here.

## Combat feel upgrade — in progress, 2026-09-13
Owner authorized all three passes in order and one audit before completing each, then supplied Claude's review. Scope expands to combos/heavy/riposte, moving/defending warden and feedback; no online/build economy, purchases or dependencies. Candidates: cosmetic-only changes cannot address static combat; a generic AI/animation framework adds scope; selected small fixed-tick rules plus existing renderer/rig. Keep steady camera, deterministic simulation, touch cancellation, resource budgets and guest persistence.
- Pass 1 audit: shortened light contact/recovery 18/66→14/40 ticks; source contact pose remains mapped to 18/66 through eased timing. Exponential action-weight transitions, one buffered attack in the last eight ticks, cleared on interruption. Brief presentation-only impact pause, 12 reusable sparks and original procedural Web Audio (mute control, gesture unlock, node cleanup). No simulation hitstop or camera shake. Required quality gate passes, 42 tests including contact pose and entry-point buffering/cancellation. Browser actual hit 100→75, counter damage and scene continued; no error/warning logs. Spot-check 60fps/p95 17ms is not phone/thermal validation. Audio sound quality still requires listening on user hardware.
- Safari remains separately unresolved: native Safari failed a raw 640x480 WebGL clear before the first frame; matching IOSurface allocation errors. Restart requested; no unverified claim that combat changes fix this OS/browser failure.
- Pass 2 audit: two-hit light chain with expiry, distinct 35-stamina/38-damage heavy and one 40-damage parry riposte. New Return/Heavy/Riposte clips on the existing rig; contact-pose tests inspect actual exported blade positions. Controlled wind-up turning replaces snap; bounded step-in shares arena collision. Late dodge/attack buffers stay one-action and clear on interruption. Required gate passes: 45 tests plus lint/typecheck/build/audit/budget. Browser heavy contact: warden 100→62, player 100, stamina 100→65; rendered pose inspected, no console errors. No purchased assets or runtime dependencies. Original heavy/thrust and reversed coherent backhand are prototype motion, not a claim of AAA motion capture.
- Pass 3 audit: warden approach/circle/retreat/visible guard, seeded bounded decision waits, delayed response to a confirmed whiff, finite guard stamina and heavy guard break. No random hit cancellation, hidden-input anticipation, behaviour-tree framework or camera shake. Dynamic opponent position now feeds collision, facing, marker and duel camera; both actors remain bounded/separated in 16,000-frame replay tests. Impact recoil and short blade ribbon are render/sim-separated; game rules never read animation. Fixed attack-start distance so the approach/lunge reaches a stationary player.
- Verification: required gate currently 49 passing tests, lint, typecheck/build, zero runtime vulnerabilities and budget pass (about 3.76MB raw / 1.25MB gzip, same two dependencies). Isolated mutations bypassing enemy guard and removing heavy cost were both caught. Entry-point buffer interruption and GPU restoration regressions still pass. CodeGraph synced; refresh after final renderer edit. Runtime TypeScript 760 lines including new 42-line audio module, versus 606 at prior release; no new framework/service.
- Browser: actual game embedded at 375x812 and 844x390 has no horizontal overflow; four combat targets >=44px high. Warden approached and dealt damage; held guard kept health100 while spending100→25 stamina; guard stance and heavy-break hint visible. 60fps/p95 18ms desktop spot checks. The iframe test tab logged an injected MutationObserver error (no occurrence in project source or harness); fresh standalone browser logs remain a separate release check. This is emulation/controlled keyboard input, not a physical phone/5-minute/minimum-hardware result. Native Safari still needs the requested restart/retest.

- Final manual check: portrait rematch returned both health bars and stamina to100, sheathed state/start positions, retained guest name; landscape844x390 and portrait375x812 receipts include button bounds and screenshots. Final pre-release gate49/49; whitespace/shell checks pass. Public standalone/CSP/service/artifact checks follow the configured release workflow; detailed receipts stay ignored under artifacts.

## Combat core (symmetric engine, data-driven moves, utility AI) — 2026-09-14
- Owner brief authorized the combat-developer scope; branch `combat/core-v1` from live trunk `codex/01a09a76/task-1` (60e94b3), isolated worktree. No visual-developer files touched: `scripts/character/*`, `src/assets/**`, `build-warrior.mjs` untouched; `characters.ts` untouched; `scene.ts` changed in three blocks only (event-driven contact sparks, per-actor poses via `actorPose`, threat colour) so the warden animates its own heavy/kick/guard/roll instead of a hard-coded 36/100 timeline.
- Discovery: three Semble queries (result consumers, buffering, timing constants) and CodeGraph impact on `stepPractice`/constants found the hidden seam `scripts/bake-blades.mjs` reads attack timings; blade sides verified empirically from tip x over the swing (Attack = right cut, Return = left cut, Heavy = overhead). Baseline on the clean trunk: 71/71 tests.
- Engine: `duel.ts` steps both fighters with one rule set from pre-tick state, expires phases, moves in index order, then resolves contacts simultaneously against a snapshot (trades land both blows). Sim-owned input buffer (one action, last 8 ticks, 9-tick TTL, cancel on interruption) replaced the entry-point buffers. Events per tick: ActionStarted, AttackStarted/Active/Missed, Hit, Blocked, Parried, GuardBroken, Dodged, Staggered, StaminaExhausted, Killed. Rules injectable for tests. `combat.ts` projects `Practice` for the renderer/HUD (all previously read fields kept, plus threat/threatMove/exhausted/events) and keeps SWORD/ATTACKS/KICK/DEFENCE views equal to the move data (tested).
- AI: reaction-delayed perception, one plan per noticed attack (parry/dodge/block/evade/ignore), utility scores (punish, chain, kick, heavy, light), seeded bounded movement, guard-probe baiting, stamina discipline above a heavy's cost. Bugs found and fixed by the new tests: exhaustion spiral (attack cost with a 30 floor), whiffing heavies from 2.2 m (reach margin), a stale-guard release rule that dropped a fresh parry, blocking swings from 4 m away, per-tick light/heavy roll that never reached light range, evade turning its back.
- Tests: 81 passing (was 71): duel rules (attack phases, draw, range/facing, death, block/break, parry window boundaries and cooldown, exposure and directional guard under rule overrides, roll boundaries, stamina/exhaustion, chains, buffering, interrupts/poise trades, heavy vs guard, kick, wounds, 16k-tick event fuzz with sticky held guard, 12k-tick determinism/immutability/bounds), AI (reaction honesty per profile, same API and stamina, readable opener across seeds, punish/kick behaviour, parry/roll rates, no idling ≤480 ticks, modes and arena bounds, committed-state-only, difficulty ordering), projection/HUD (constant views, mirrored fields, threat, hint priorities, control gating, defeat/reset/describe, 16k seeded replay, and a sim replica of the browser gate's parry→60→52 sequence). Entry-point suite (`graphics.test.ts`, real transpiled main.ts) passed unchanged throughout. Determinism lint proven by injecting `Math.random`/`Date.now` (2 violations caught).
- Gate: `npm run quality` passes — lint, 81 tests, typecheck/build (777.9 kB JS / 211 kB gzip), 0 vulnerabilities, budget PASS (4.19 MB raw / 1.31 MB gzip fight-ready), Playwright receipt: real touch parry at 514.5 ms after the tell → "Parried! The warden is open.", riposte → warden 60, kick → 52, exactly one 35 swipe deduction, blood modes, GPU loss/restore, zero page errors. Browser pane: art loads, `?debug` overlay live (`#debug`), warden plays its own heavy wind-up with the heavy-specific banner, mobile 375×812 journal shows Warden/Combat-debug controls without overflow. A stale `artifacts/serve-production.mjs` from 2026-09-13 still listens on 4173/4174 in the main checkout (not killed).
- Feel changes to evaluate in play: warden damage is now symmetric (25 light / 38 heavy vs 20 before), so an idle player falls to three heavies in ~8 s at normal; exhaustion refuses guard until stamina 20; heavy has late-wind-up poise. Directional guard and parry exposure are implemented but off. Remaining for the visual developer: `characters.ts` clip selection for `enemyParried`/warden roll poses uses the same `actorPose`/events API; `Practice` view stays until their migration.
- Release follow-up (same day): the first deploy attempt's browser gate failed once on the kick (warden 60, not 52). Sim replay of the gate's timing showed the warden counter-attacking straight out of its stagger with a poised heavy: its cadence timer kept running while staggered and a landed hit's recovery counted as an "opening". Fixed: AI timers pause while staggered and the cadence re-rolls on being hit (a landed blow earns a punish window, as the old warden gave); only whiffs, staggers and exhaustion are openings; a swing is a threat only until its active window closes (the AI previously sat in defence through a whiff's recovery and never punished it); kicks lunge like sword moves (`MoveDef.stepIn`) so a backstep cannot walk out of a point-blank kick by 1 cm. Kick-margin grid now HIT for wait 30–48 ticks × walk 6–24 ticks around the gate's 36×14. Two regression tests added (82 total). Test harness bug fixed: the "immortal" observation fight had left the warden in the dead phase after its first death, which had masked per-level defence; corrected numbers vs a light spammer over 3600 ticks — hits taken easy 60 / normal 45 / hard 34, parries 0 / 2 / 9. Browser gate rerun four times consecutively: parry → 60 → 52 → [35], zero errors.

## Swordplay pass P0–P1 — 2026-09-15
- Branch `combat/swordplay-v2` from trunk 399b998 (visual lane had merged; no combat files touched overnight). Discovery: three Semble queries (guard entry/release, dodge input path, renderer clip mapping) and CodeGraph impact over `stepDuel/legal/inBufferWindow/actorPose`.
- PR 0 deletion pass: dead `pathOf/pathFor`, internal-only `isLight/phaseLength/chooseMove`, legacy `KICK/DEFENCE/WOUND` views (tests read move data), six unread Practice fields. 82/82 unchanged. The optional `stepDuel` split was deliberately not done: the plumbing to keep it byte-identical outweighs the readability gain while P1–P5 still reshape the action section.
- PR 1: guard yields (attack legal from guard; attack wins over a same-tick hold), feint (`feintUntil`, `feintCost`, event `ActionStarted:feint`, control gate lights the guard button during the window), `parryRecovery` 0→8, `guardProfile` seam (costScale/arc/window/stopsHeavy) used at contact resolution and for the guard window. Hints: "Parry window open", "Parry missed · guard down for a moment"; journal line added. Tests 82→86 (guard yields, feint window/cost/cooldown/kick/exhaustion, exposure on by default with connected-parry exemption, guard profile, feint→raised guard→kick mind-game vs a blocking AI). Mutations: 7/7 caught (feint window, feint cost, attack-from-guard, exposure, profile cost/stopsHeavy/window). Gate green incl. browser parry→60→52→[35].
- PR 4: `inBufferWindow` covers every committed phase tail (attack/draw/roll/hurt; dead excluded); window 8→10, TTL 9→11. Tests: queued light out of a roll tail, queued heavy out of a stagger tail, too-early stagger press not queued; shipped numbers pinned. Mutation: roll-tail removal caught; the window-size mutation only survives because tests are parametrised on the rule, hence the pin. Gate green.
- PR 2: `backstep` phase/action (RULES.backstep: 12 ticks, speed 1 = 0.6 m, cost 10, cancelFrom 8), hold-to-roll conversion (dodge legal from backstep, charged rollCost−backstep cost), AI evade plan prefers backstep. Input layer: Dodge press = backstep, held ≥150 ms (frame-clock, testable) = roll; swipe-down = roll; keyboard E tap/hold; release/cancel/GPU loss clear the hold. Presentation: backstep renders as armed footwork ('ready' pose; travel sign drives the walk). Tests 86→89 (distance/heading/cost/no i-frames/spam/arena/tail cancel/queued cancel/hold conversion boundaries; AI evade backstep; projection; entry-point tap/hold/interruption through the real main.ts with a new `release()` harness helper). Mutations 6/6 caught (i-frames on backstep, facing away, free backstep, tail cancel, conversion cost, input hold). Gate green.
- PR 3: `heavy_overhead.chained` 22/5/31 with its own baked path `heavy_overhead_chain`; lights' follow lists include the heavy; `Fighter.evaded` (RULES.dodgeAttackWindow 2) makes a light out of an evade tail chained; `heavy_riposte` move (48 dmg, 20/5/25, path baked from Heavy at 20/50); `chooseMove` picks it for heavy during the punish window. Re-baked 8 tables (368 poses); rig-agreement test iterates PATHS. Tests 89→90; mutations 5/5 caught (follow list, dodge-attack, evade window, riposte choice, stale table). Gate green.
- PR 5: perfect block (RULES.perfectBlock 3, perfectBlockCost .5) resolved in the Blocked branch from `d.age − guard window`; `Blocked` events carry `stamina`/`perfect`; the projection keeps `result: 'blocked'` (renderer keys block recoil/pose on it in files outside this lane) and adds `resultPerfect` for the hint. Tests 90→91 (just-in-time vs settled guard, parry-window exclusion, exposure interplay, guard-profile composition, hint text); mutations 3/3 caught. Journal line updated.
- Lane status after P0–P5: all shipped to the trunk and live; live gate green after each deploy. Not done: the optional `stepDuel` split (deliberate). Remaining risk: all new numbers are untested on a phone; the roll now starts ~150 ms after a button press (tap = backstep) — swipe-down keeps the instant roll.

## Souls slice I — duel length — 2026-09-15
- Measured first: AI vs AI at normal was 13.7 s / 5 hits median. Candidate tables compared in-memory; chosen light 11 / heavy 18 / riposte 24 / heavy riposte 30 / kick 4 → normal 35 s, 9 hits (5–12); hard 20 s; easy 37 s (24 seeds each). Health, stamina, stagger, knockback unchanged, so the parry/riposte/kick punish remains the largest single swing.
- Tests made data-driven (`100 - move.damage`) rather than literal; the kill test loops `ceil(100/damage)` swings and refills stamina (the stamina economy is tested elsewhere); the event fuzz re-centres without healing and tops up stamina so Killed/Parried keep occurring at lower damage. Browser gate expectations updated deliberately: riposte 76, kick 72. Gate green.

## Souls slice A — counter-hit + rear hit — 2026-09-15
- RULES.counter {damage 1.25, stagger 1.5} applied when the target is in any attack phase or past a roll's i-frames; RULES.rear {arc 90°, damage 1.15, stagger 1.25} inside the rear arc; multiplicative; clean hits only. `Hit` events carry `counter`/`rear`; hints read "Counter … hit" / "Countered". Tests 91→93 (wind-up, whiff recovery, roll tail, ready target, guard exclusion, kicks/heavies; rear arc boundary, front, stacking). Mutations 4/4 caught. Gate: the kick after the riposte can now land as a counter (5) when the warden's re-engagement starts a tick before contact — the gate accepts both exact outcomes (72/71) rather than tuning gameplay to the script.
- Gate hardening (same PR): the parry press had drifted to 512–518 ms against a 533 ms contact ceiling (one flake in ~15 runs today, pre-existing). The script now presses at ≥430 ms (observed ~467 ms, tick 28; window 28–37 covers contact at 32 with ~67 ms margin both sides). Assertions unchanged; 3/3 green.

## Souls slice D — guard counter — 2026-09-15
- `Fighter.counterWindow` set to RULES.guardCounter (20) on every Blocked; `chooseMove('heavy')` → `heavy_counter` while open (punish → heavy riposte outranks); cleared by any attack start and by stagger. New move reuses the heavy riposte path/timing (no extra bake). Hint appends "· heavy to counter" while the window is open; journal line updated. Tests 93→94; mutations 4/4 caught after fixing a vacuous trade scenario (the warden had still been recovering from its blocked swing, so the poise check never ran).

## Souls slice E — charged heavy — 2026-09-15
- RULES.charge {at 10, min 12, max 40, damage 1.5, stagger 1.5}; `Intent.heavyHeld` level; `Fighter.charge/charged`; the wind-up section rewinds age to the charge point while held (Charging event once); hyper-armour while charging; charged multipliers on Hit and GuardBroken. Input: Heavy button/G hold → `heavyHeld`; release/cancel/GPU loss clear it. Overlay shows `charge n` / CHARGED. Tests 94→96 (hold/early release/long hold/max auto-release/hyper-armour with counter-hit/feint from charge/no charge for chained-riposte heavies; entry-point hold via the real main.ts with a `rendered` capture added to the harness). Mutations 7/7 caught incl. the input layer.
- Slice complete: I, A(+soft B), D, E all live. Next per plan: phone playtest, then C (thrust) and G (poise/posture).

## Souls slice F — guard takes a heavy for chip; charged heavy breaks guard; deliberate charge press — 2026-09-15
- Owner phone playtest found guard useless vs the warden (its heavies broke a guard for full damage + all stamina) and hold-Heavy indistinguishable from a press (a 400 ms press already charged; no cue). Live probe `artifacts/tap-vs-hold.mjs`: 60 ms → plain, 300 ms → charging, 400 ms → CHARGED on 690fee5.
- moves.ts: `MoveDef.chip` (heavy .4, others 0), heavy_overhead `breaksGuard false, staminaDamage 40`, RULES.charge {at 10, min 30, max 54}. duel.ts: `breaks = (breaksGuard || charged) && !stopsHeavy`; block branch applies chip (0 on a perfect block) through `wound(chip, 0, false)` (no wound mark, normal death path), `Blocked.damage`; `Charged` event once at min. ai.ts: `AiState.hold` + `Intent.heavyHeld` (held heavy at a settled guard, released at charge.min), plan `affordable ? 'block' : 'evade'`, re-plan off a charging heavy. combat.ts: `resultStamina`, hints. feedback.ts: `charged` tone. scene.ts: per-fighter charge PointLight.
- Live re-check after the first deploy (225106f): the warden charged *every* heavy at a guard, so a turtling player still died without ever seeing a block. Charge-through now rolls against `aggression − .25` (measured 8/15/24 of 40 at easy/normal/hard); the rest are plain heavies the guard takes for chip.
- Second live re-check (5a1e02e, HUD MutationObserver): the fixed 731 warden's first heavy at a guard is the charged one, and the old break rule drained *all* stamina, so the turtle was exhausted and punished to death every time. Now `RULES.breakCost` 60 (a broken guard keeps one roll from a full bar; still exhausts a low bar) and `main.ts` seeds each rematch differently (first match stays 731 for the gate).
- Evidence: 101/101 node tests; 13/13 rule mutations caught (charged-breaks, chip, perfect-no-chip, chip-kill, wound-mark, threshold, short-charge, AI hold/release/re-plan/afford/charge-at-reaction, hint); `npm run quality` green incl. Playwright gate (parry 466 ms, riposte 76, kick 72).

## Slice C — thrust, chamber and the weapon-disc control trial — 2026-09-15
- Owner asked for slash / overhead / stab and a way to A/B three right-thumb grammars; chose a menu switch over `/v1` paths (a subfolder per version would be served by nginx as-is — verified with a throwaway folder in the live release: `/zz-probe-7f3a/` → 200, `/v1` → 404 without one — but one build with a runtime scheme keeps engine, tests and gate identical).
- moves.ts: `thrust` (PATHS + MOVES, Riposte clip, 16/5/21, dmg 14, stepIn 1 → lands from 2.0 m; measured cut 1.75 / heavy 2.20), `MoveDef.chamber` (light 6, heavy 10, thrust 8, punish moves and kick null) and `charges` (heavy only); RULES.charge loses `at`. duel.ts: `Action` 'thrust', `Intent.held` (was heavyHeld), generalised chamber block, hyper-armour only for charging moves. ai.ts: `charging()` guard so a chambered light is blockable and a planned block is kept. gestures.ts returns a `Flick` direction (nearest axis, no diagonal dead zone). trial.ts (new, 40 lines): scheme + per-scheme scorecard in `frankendom.controls.v1`. main.ts: scheme cycle on the Controls button, DISC map (← → cuts, ↑ thrust, ↓ heavy), drag grammars hold and feint on return to centre, v2 releases before the charge, T = thrust, fight/rematch tallies, scorecard in the journal. style.css keeps Step visible beside Guard under the disc. Gate: the disc stroke is now downward (heavy, 35).
- Evidence: 106/106 node tests (new: thrust/chamber engine, AI chambered-light, disc grammars, scorecard, trial storage); 14/14 rule mutations caught (thrust map, chamber scope, charge scope, hyper-armour scope, lunge, AI ×2, flick/drag/feint/direction/tally rules, diagonal dead zone).

## Slice C2 — v4 invisible gesture field — 2026-09-15
- Owner prefers v1; asked for GPT's "invisible right-half gesture field" as v4. `Scheme` 'field': `beginStroke/moveStroke/endStroke` shared by the disc and the canvas; on the canvas a pointerdown at `clientX ≥ innerWidth/2` starts a stroke (left half orbits as before); `#touch-mark` ring follows the touch and hides on release/clearInput; `#field-help` line replaces the disc in the actions grid (`data-gestures=field`); HUD refreshes on a scheme change (`lastHud = ''`). Gate walks five labels back to buttons.
- Evidence: 107/107 tests (new v4 test: thrust on ↑, charge on a long hold, feint on return, left half never attacks, mark visibility); 5/5 v4 mutations caught.

## Slice C3 — v4 dropped; v5 thumb cluster and v6 segmented disc — 2026-09-15
- Owner disliked v4 after playing it; asked for an FPS-style round-button cluster (v5) and, per external review, the segmented disc (v6). v4 code removed (canvas field branch, touch mark, field help); a stored 'field' scheme falls back to buttons.
- v5: `#thrust-button` (Stab; hold = chamber) shown only in the cluster; CSS `.actions[data-gestures=cluster]` positions six round targets in a 176×200 arc (Slash 66 / Stab 50 / Heavy 50 / Kick 40 / Step 56 / Guard 64; the id-specific `#kick-button` rule needed explicit sizes). v6: `tapSector()` on the pad (centre-relative `swipeAction`, 28 px dead zone) → ↑ thrust · ← light · → heavy · ↓ kick with `held` while down; `#sectors` label overlay; Kick button hidden. `layout()` → `data-gestures` 'false' | 'true' | 'cluster' | 'sectors'. Gate walks six labels.
- Evidence: 107/107 tests (v5/v6 test: cluster layout, Stab thrusts and holds, each sector's attack, dead zone, held sector charges); local screenshots `artifacts/crop-v5.png` / `crop-v6.png` match the intended arc and disc.
- Live probe of c8cbc99 (real taps): v6 sectors all correct, v5 Slash fine, but a same-frame tap on **Stab** was lost. Root cause, latent for every captured button: `lostpointercapture` follows each ordinary `pointerup` and the release handlers treated it as a cancellation (`name !== 'pointerup'` → queued action withdrawn) — a tap that ends before the next 60 Hz tick (or under a dropped frame on a phone) lost its heavy / thrust / step / parry / flick. Now only `pointercancel` (and focus loss) withdraws a queued press. Regression test proves the old main.ts fails it.

## Control lock-in — thumb cluster is the mobile layout — 2026-09-16
- Owner chose v5. `Scheme` is now `'cluster' | 'flick'` (cluster default; any other stored value → cluster); `data-gestures` = the scheme name. Removed: the square-grid mobile layout as a scheme, the drag/charge disc grammars (held/feint on the pad), the segmented disc (`tapSector`, `#sectors`). Cluster design pass: `#17232952` fill, `#f0e3c94d` ring, inset ring, 11 px small-caps labels, `:active` brighten + scale(.95), `aria-disabled` at .5, Slash primary `#b7a27680`, Guard pressed tint. Gate: taps `Controls: thumb cluster`, walks back `['Controls: weapon disc · flick','Controls: thumb cluster']`.
- Evidence: 117/117 tests (suite also gained other lanes' tests via trunk); local screenshot `artifacts/crop-lock.png`; `npm run quality` green.

## Hotfix — the movement stick could stay pushed — 2026-09-16
- Owner report on the phone (screenshot: knob offset with no thumb on it, fighter circling the warden). Cause class: the joystick only released on events delivered *to the joystick* for its captured pointer; if iOS never delivered that pointerup (capture lost, or a gesture swallowed it) the stick stayed pushed and, worse, `moveId !== null` rejected every later touch on the pad. Fix: `releaseStick()` on window-level pointerup/pointercancel for the stick's pointer, on `touchend`/`touchcancel` with no fingers left, and a new touch on the pad always takes the stick over. Regression test fails on the previous main.ts.

## Slice G — posture and the critical — 2026-09-16
- moves.ts: `MoveDef.posture`, `critical` move, `RULES.posture {max 100, decay .2, stun 90, parry 35, perfect .5}`. duel.ts: `Fighter.posture/critical`, per-tick drain (not while hurt/dead), `shake()` in the contact loop (block, kick-vs-guard, clean hit, parried attacker), break → stun 90 + opponent `punish`+`critical` 90, `PostureBroken` event, guard break resets posture, `chooseMove` heavy → `critical` inside the window. ai.ts: `shaky` retreat/circle, `critical` score 1.6. combat.ts: `posture/enemyPosture` on Practice, results `postureBroken/enemyPostureBroken`, hints, overlay `po N CRIT n`. HUD: `#posture`, `#target-posture` (mobile grid rows re-numbered; pseudo-element rules needed id selectors to beat the desktop `.combat-hud meter::-webkit-meter-bar` rule — verified with a 4× zoom screenshot).
- Evidence: 121/121 tests; 15/15 posture mutations caught (after strengthening the HUD flag test); `artifacts/duel-length.mjs` 24 seeds per level (numbers in GAME_SPEC); `npm run quality` green.

## Slice H — hit-stop and camera kick — 2026-09-16
- main.ts: `HIT_STOP` table + `stopFor(events)`; on a contact tick the step loop empties the accumulator (the frame ends on the contact tick, no `break` needed) and `hitStop` holds stepping for the duration while frames render; `clearInput` clears it. scene.ts: `kick/kickHeading` nudge after the camera lerp, 2 / 4.5 cm, decays at .3 m/s, disabled by `prefers-reduced-motion`.
- Evidence: graphics test measures every contact of both fighters: frames on the contact tick = ceil(ms/17) + 1 exactly (Blocked 3, Hit 4, Parried 6, heavy Hit 7 …); long-frame run (51 ms, three ticks per frame) renders the identical contact-tick set as the 17 ms run and never jumps more than the frame's own ticks. Mutations: no hit-stop, heavy = light, light too long, leftover accumulator replay → all caught. Camera kick is not harness-testable (scene stubbed); verified by build + gate + live load.

## Slice J — adaptive warden — 2026-09-16
- ai.ts: `Habits`, `Reads`, `READ` thresholds, `readOpponent()`; observation from state edges each tick; `parryChance` (spammer), `opening` includes roll tails (roller), kick score/chance boost (turtle), `chargeChance` boost + held heavies without a guard (turtle/roller/parrier), baited lights (`hold` for lights, released after `READ.baitHold` ticks). combat.ts overlay: `habits g% parry n/m roll n/m Lx Hy reads …`. Tried and removed as redundant (mutation-equivalent): a heavy range gate and three movement tweaks against a turtle — the kick boost alone puts kicks ahead (23 kicks vs 4 heavies after the read at normal).
- Evidence: 124/124 tests; adaptation mutations 11/11 meaningful caught (observation ×4, parry boost, tail punish, kick boost, charge boost, baits/held heavies, light hold release, evidence gate); AI-vs-AI length unchanged (normal 22.6 s / 7 hits, hard 17.2 s / 8).
- Gate hardening in the same PR: the kick step failed once on wall-clock (warden hp 76: the kick whiffed on a retreating warden; 3/3 reruns passed). The HUD now flags kick reach (`#kick-button[data-reach]`, 1.5 m = the measured landing range of the lunge, pinned by a duel test; the cluster's Kick brightens when it can land) and the gate waits for that flag instead of a fixed 240 ms walk + tap. Lesson recorded: `npm run test:browser` alone serves the *previous* `dist/` — rebuild first.

## Slice K — the thrust in the warden's kit — 2026-09-16
- ai.ts: `AiState.next` gains 'thrust'; `THRUST_SHARE` .35 after the first attack; score `thrust` needs `gap ≥ cut reach` and no guard; a planned thrust inside cutting range sets `retreat`; approach stops at thrust reach − .2 when a thrust is planned; spammer parry cap `1 − dodge`. combat.ts: thrust threat hint (keeps the 'Incoming strike' prefix the gate keys on).
- Test lessons: consecutive small LCG seeds give near-identical first draws — spread test seeds with the golden-ratio hash; a passive player at hard is a punching bag (punish/chain loop starves openers), so opener behaviour is tested from constructed states plus a 'peek' player (guard 1.5 s / open 1.5 s).
- Evidence: 127/127 tests; 7/7 thrust mutations caught (first-opener gate, kit, range gate, step-back, no-guard, parry cap, hint); duel length above.

## DNA table closed for the sword loop — 2026-09-16
- Items 1–4 shipped and live (`4507458` posture, `d2ef97c` hit-stop, `ca38941` adaptive warden, `06fced0` thrust opener). Item 5 (momentum/dominance/crowd) proposed as a tug-of-war bar with a posture-break payoff and **rejected by the owner as cheesy — removed from the plan**; GAME_SPEC records the decision so it is not rebuilt. Item 6 (weapon families) parked by the owner until the longsword loop is perfect.
- Next, owner's choice: phone-playtest tuning pass; the hybrid build/stat layer (data-only margins); online 1v1 on the deterministic sim.

## Slice L — correctness pass from the external audits — 2026-09-16
- Three audits (GPT file + two reviews) distilled into a seven-block plan; block 1 (correctness) shipped here. Every claim was re-verified against the live sim before fixing (perception blind to held heavies, 2.26 m hold lunge, charged kick 6 dmg, perfect-block guard break at 15 stamina, mutual kill = loss, 5 cm index privilege, held-guard hole confirmed for block 2). duel.ts: `elapsed()`, `beginAttack()`, `parked` lunge gate, cost-first block affordability, armour scope, `Finish.draw`, movement vs `before` bodies + separation pass. ai.ts: perception on `elapsed`. main.ts: `withdraw()` with `sent` ownership → `Intent.cancel`. combat.ts: draw hint.
- Evidence: 132/132 tests (new: correctness pass, side symmetry, perception while parked incl. acting on the plan, cancel propagation with ownership); 11/11 mutations caught; duel length re-measured below.

## Slice M — fairness pass (audit block 2) — 2026-09-16
- Held Guard has no hole (exposure only after a released tap); the warden never guards or parries a kick (rolls it with its dodge share, otherwise takes it); a read spammer's cuts are anticipated (7 ticks, after 9 swings) so they can be parried, and the warden guard-walks into a spammer with the guard counter, whiff punish and cut conversions instead of throwing 32-tick heavies into cuts; reads after two exchanges; parrier sees baits/feints/kicks; ripostes carry no posture (two parries ≠ kill); hard reaction 10; `GuardBroken` sides fixed (attacker = actor). Thrusts counted separately from cuts in habits.
- New `tests/battery.test.ts`: nine scripted strategies × 24 seeds × 2 min at normal and hard; gate = no script wins > 50 % (normal) / > 35 % (hard), every script gets touched (perfect parry ≤ 6 untouched). Light spam went 18/24 → 7/24 at normal (owner asked for 5–8: the first pass at 5 ticks / 6 swings gave 1/24).
- Evidence: 136/136 tests (new: battery, fairness pass, kick never guarded, habit bins + reaction floors, event sides); 14/14 mutations caught (held-guard rule, kick answer, anticipation, counter score, exposed opening, pressure guard, standing-guard stall, heavy→cut conversion, feint execution, thrust bin, riposte posture, GuardBroken sides, READ.after, hard reaction); `npm run quality` green incl. browser gate.
- Remaining audit blocks: 3 presentation (hit-stop pose/owner, blocked-heavy hit-stop scaling), 4 controls, 5 stamina/tempo, 6 gladiator identity, 7 process (CI, reference reconciliation).

## Slice N — presentation correctness (audit block 3) — 2026-09-16
- One impact-pause owner (main's hit-stop; scene's own 50 ms animation pause removed; rigs evaluate at dt 0), contact tick's bodies on the frozen frames, overshoot carried into the next tick, blocked heavy 50 ms, journal Hit-stop on/off (persisted), real seconds on the scorecard, `?debug` frame probe (`#debug` data-frozen/tick/tip).
- Evidence: graphics tests (contact body + frozen flag, overshoot 0/1/4/6 under 40 ms frames, heavy Blocked 50, toggle off = no pause + persisted), characters test (zero-dt pose evaluation, no frozen trail samples), trial test (real seconds). Mutations: 8/9 caught in node; the scene's animation clock has no node harness and is checked by the live frame probe.

## Slice O — controls pass (audit block 4) — 2026-09-16
- Slash sends held; per-control held ownership (`holders` set, owner of the current swing); drag-off feint on Slash/Heavy/Stab; Kick 44 px + cluster re-laid 176×210; Step rolls at once with a deflected stick; v7 guard ring scheme (`ring`) with the gate walking all three schemes and checking ≥ 44 px targets and no overlaps (Slash-in-ring excepted).
- Evidence: graphics tests (held Slash chambers, drag-off feint + release, held ownership, deflected-stick roll vs neutral backstep, scheme cycle incl. ring); trial test (3 schemes); 8/8 mutations caught; screenshots `artifacts/cluster-v44.png`, `artifacts/ring-v7.png`.

## Slice P — stamina and tempo (audit block 5) — 2026-09-16
- Sprint: deliberate 1.4-rim push, lit knob, no regen-delay reset. Regen 40/s after .75 s; guard regenerates at half rate; block costs 15/20/30; health 150 (`RULES.health` everywhere); journal Tempo 60/50 Hz toggle. Spammer read re-swept (11 swings / 8 ticks → light spam 7/24 at normal).
- Measured AI-vs-AI (24 seeds): normal 12 hits / 24 s median, hard 13 / 27.6 s, easy 12 / 22.9 s — the 8–15 target met at every level (at health 100 with the new regen it was 8 / 16 s).
- Evidence: 141/141 tests (tests parameterised on `RULES.health`; new tuning-pins test; stamina test rewritten for guard/sprint regen; tempo toggle test); 10/10 mutations caught; browser gate updated (riposte = HP − 24). Remaining: 6 gladiator identity, 7 process.

## Slice Q — gladiator identity (audit block 6) — 2026-09-16
- Ring wall (stagger/posture on wall impacts, no backstep when cornered, warden footwork), attrition wounds (stamina ceiling −8 per wound, leg wound 85 % speed, AI floor scaled to the ceiling), thrust as the stop-hit (×1.5/×1.75 into a swing or a 0.3 m walk-in; whiff hangs 10 ticks; AI share 20 %, cadence-gated, no walk-back), posture retune (gain pauses drain 45 ticks; 20/32/16, parry 25) swept to ~one break per two duels at normal.
- Evidence: 147/147 tests (new: wall, attrition, stop-hit/whiff, posture pins, warden wall footwork, scaled floor); 12/12 mutations caught; battery green (light spam 5/24); AI-vs-AI normal 11 hits / 21 s. Remaining: 7 process.

## Slice R — process (audit block 7) — 2026-09-16
- CI workflow (`quality.yml`) runs `quality:ci` (lint, tests incl. the battery, build, audit, budget) on pushes/PRs to the live trunk; the Playwright gate needs a real GPU and stays pre-deploy + live (gate prints diagnostics on failure); reference doc reconciled (turn clamps in radians, hard's first opener, perfect block, all block 2–6 numbers, open questions rewritten).
- The seven-block audit plan is complete: M fairness (`0f40848`), N presentation (`d7b83f5`), O controls (`3a670f3`), P stamina/tempo (`3d16b02`), Q gladiator identity (`67109de`), R process.
- Next, owner's choice: feel the 50 Hz tempo and decide on the move re-timing (blade re-bake); play the v7 guard ring vs the cluster and let the scorecard decide; the reference's open questions (§11).

## Slice S — the cut is a cut — 2026-09-16
- Play audit on the live build (human-reaction bot, HUD-only): normal open 3W/2L in 21–38 s, turtle 0/5, hard 0/3, easy 3/3; warden cuts parried 1/36 (233 ms tell, under reaction). Owner: "slash too quick and shallow". Cut re-timed 20/8/22 and authored as a horizontal arc (both rigs rebuilt, paths re-baked); `lapse` profile field so the warden does not answer every readable cut.
- Evidence: 149/149 tests (timing-dependent tests rewritten against MOVES; perfect-parry script times on the tell); battery green (light spam 0/24 at normal — see GAME_SPEC S for why the old 5–8 target no longer applies); AI-vs-AI normal 12 hits / 21 s; frames `artifacts/mine-3/5/7.png` show cocked → front → across.
- Cross-lane note: `scripts/build-warrior.mjs` (authored Attack/Return keys; UAL2 candidates gated to the cuts with `WARRIOR_UAL2_ATTACKS=lights`), `src/assets/warrior.glb` + `veteran.glb` rebuilt from the committed sources — the char lane should rebuild from trunk before its next art change.

## Slice U — the weapon slot seam — 2026-09-16
- `Weapon`/`WEAPONS`/`weaponOf` (moves.ts), `Fighter.weapon` + `movesOf` (duel.ts), AI reads own/their tables, blade paths keyed by weapon from `scripts/blade-manifest.json`, contact events carry weapon + material. Trident = longsword placeholder; both fighters longsword on trunk.
- Evidence: 156/156 tests (new tests/weapons.test.ts: 5); 7/7 mutations caught; quality gate green. Weapons lane brief can land on it: add a manifest entry + a `WEAPONS.trident` table + clips on the Veteran rig; flip `initialDuel`'s opponent to 'trident' with combat review.

## Slice X — fight-identity knobs (for the goblin) — 2026-09-17
- `AiProfile.feint / guard / disengage / circle` (optional) and `Opponent.regen` → `Fighter.regen`; ai.ts/duel.ts read them with today's behaviour as the default (RNG sequence preserved: existing wardens' battery tables byte-identical). Tests: 5 new in tests/ai.test.ts, each with a control; 9/9 mutations caught; 197/197.
- **The goblin fights (part 2, same day):** #86 and #87 merged; `WEAPONS.knife = KNIFE`, manifest → `src/assets/goblin.glb` (rebuilt with the knife, his build default; the shelf duplicate removed); `OPPONENTS.goblin` gets regen 1.5, **speed 1.2** (new `Opponent.speed` → `Fighter.speed`, a pace multiplier through `advance()`), knobs feint/guard 0/disengage/circle plus the darter's `step`/`interrupt`/`kick`/`dash`; reads `stepper`/`poker`/`kicker`; `opponentFighter()` builds any opponent from all his data (the batteries use it). Ladder: Veteran → Pitborn → Goblin → Nightborn. Gate in tests/opponents.test.ts (caps, touched, patient whiff punisher the answer, never holds a guard, AI-vs-AI 38.8 s). **Health 100 → 120 the same day (owner):** rung 3 now out-fights the Pitborn (hero brain loses 15/24, was 8/24; AI-vs-AI median 42 s); patient play never loses to him but mostly runs out the two-minute clock (3/24 wins at normal) — the gate's floor is 2 + never loses. 21/21 mutations caught; 215/215 tests. Harness `artifacts/weapons/live-knife/`; game probe `OPP=goblin node artifacts/live-trident.mjs <url>`. **Character lane:** `WARRIOR_FIGHTER=goblin node scripts/build-warrior.mjs` keeps the knife. **Not done:** the camera request (#8 in his REQUESTS: the lock look-at for a 1.36 m man) is the camera lane's.

## Slice W — the Pitborn fights with the cleaver — 2026-09-17
- Flip: `WEAPONS.cleaver = CLEAVER`; manifest → `src/assets/weapons/cleaver/veteran-cleaver.glb` (1.0× bake, his sword's convention); `pitborn.glb` rebuilt with the cleaver (variant A, owner's pick; `WARRIOR_FIGHTER=pitborn` now defaults to the cleaver); `pitborn-cleaver.glb` removed (stale duplicate, 172 bytes behind the dark bone plates). Numbers kept as shipped.
- Combat fixes: ai.ts turns a planned opener the worn stamina ceiling can no longer pay for into a cut (the hack costs 42 > the attrition floor 40 — the 6/24 stalls); Pitborn hard discipline 20 → 24 (whiff punisher 10/24 → 7/24 at hard, under the 35 % cap; normal 9/24).
- Evidence: 186/186 tests; 5/5 mutations caught; `tests/opponents.test.ts` gate green (AI-vs-AI median 27.5 s); harness `artifacts/weapons/live-cleaver/`; game probe on the built dist: the Pitborn's rig plays under `WeaponDrawn` for every sample. **Character lane:** a Pitborn rebuild is `WARRIOR_FIGHTER=pitborn node scripts/build-warrior.mjs` (cleaver A by default); the bake source is the Veteran's body with the cleaver (`WARRIOR_WEAPON=cleaver WARRIOR_OUT=…/veteran-cleaver.glb`).

## Slice V (combat) — the Veteran fights with the trident — 2026-09-16
- Renderer plays roles from a per-weapon clip table (`characters.ts` `WEAPON_CLIPS`, `clipFor`), keeps `WeaponDrawn` in hand, trails its `extras.contact`; `combat.ts` `attackSpecs(weapon)`, thrust role; `scene.ts` passes the sim's weapons; `veteran.glb` = the trident Veteran (`WARRIOR_FIGHTER=veteran` now defaults to `WARRIOR_WEAPON=trident`; `src/assets/weapons/trident/veteran-trident.glb` removed, manifest → `veteran.glb`). Gameplay: `OPPONENTS.veteran.weapon = 'trident'` (the opponent seam below); `minReach` 1 m on the thrust (from where it started), shaft guard ×1.15 and broken by a plain overhead, the sweep trips a roll in its first half, `Weapon.fight` stance (thrust share .6, close 1.4, kick/backstep inside the point, no shaft vs heavies).
- Evidence: 166/166 tests (+ characters 3, weapons 3, combat 1, the old Veteran-parity and trunk-unchanged tests rewritten; battery now gates the trident AND the longsword warden); 17/17 mutations caught; AI-vs-AI duels longer (median 27 s normal vs 23); harness `artifacts/weapons/live/`; game probe `artifacts/live-trident.mjs` (the Veteran plays only Trident_* + body clips). **Character lane:** a Veteran rebuild is `WARRIOR_FIGHTER=veteran node scripts/build-warrior.mjs` (the trident is the default now; `WARRIOR_WEAPON=longsword` would hand him the sword back), then `node scripts/bake-blades.mjs`. **Weapons lane:** iterate the part in `scripts/build-weapon.mjs`, rebuild `veteran.glb`, re-bake; the harness `--enemy` default is `veteran.glb`.

## Slice V — the opponent seam (Opponent 3: the Pitborn, part 1) — 2026-09-16
- `Opponent`/`OPPONENTS`/`Level` (moves.ts): weapon, body `scale`, `health`, `poise`, a profile per easy/normal/hard. `initialDuel(opponent = veteran)`, `initialPractice(seed, opponent)`; `Fighter.scale/poise/maxHealth`; the blade sweep's capsule and hit regions scale with the target (blade.ts); a plain clean hit under `poise` damage wounds and builds posture but never staggers or moves him (heavies, counter/stop/rear hits and charged blows always do); HUD bars take their ceilings from the fighters. `WEAPONS.cleaver` = longsword placeholder (the weapons lane's fat cleaver replaces the data). `?opponent=pitborn` picks him at boot until the ladder (lead) sets it; scene.ts maps `OpponentId → GLB` (Pitborn borrows the Veteran's until `pitborn.glb` ships).
- Pitborn data (provisional, combat-owned): 1.13×, health 190, poise 16, normal `{reaction 18, parry .15, aggression .8, pressure .7, discipline 25}`. Probe (24 seeds): battery caps hold at normal and hard; a held guard is broken in every fight (median 72 ticks, 23/24 inside 6 s); the off-line whiff punisher wins 6/24 — the best honest script; AI-vs-AI (Veteran brain vs him) median 26.4 s. Discipline 15 made the punisher win 17/24 (rejected); accuracy is not a lever; a literal `StaminaExhausted` never fires at 40/s regen — the whiff window is the weakness.
- Evidence: 163/163 tests (new tests/opponents.test.ts: 7; battery takes an opponent and records first guard break), quality gate green incl. the browser gate. Veteran default byte-for-byte unchanged (`initialDuel()` deep-equals `initialDuel(OPPONENTS.veteran)`).
- Next (part 2, character lane): `pitborn.glb` from the KeenTools scan `01a0ab5b…` (7 owner portraits in `artifacts/source/face/pitborn/`), 1.13× hunched build, tusks, bone/iron kit; budget cap up from 12 MB as needed; per-fighter scale in tests/characters.test.ts.
