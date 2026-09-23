# Weapons — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Session handover — maul part shipped, estoc parked, and a trap waiting for whoever rigs the maul (weapons lane, 2026-09-22)

**Now.** Nothing is in flight. #509 (the Knight's maul part) is ready and with Deploy in the code batch; #501 (this file) is in the
docs batch; #419 (estoc reach) is parked. The next piece of weapons work is whatever the next Strategy session assigns.

**Done today.** #509 the maul PART at silhouette stage (`scripts/build-weapon.mjs`, one file, gate green 468/466/2 on base
`fe0d8e0`). #501 the estoc findings off trunk. The bearded-axe cost measurement that overturned Brief 15 §2 (Strategy is having
Pitborn correct the brief): **one-hand weapons in this repo do not get a clip family.** cleaver, estoc and knife each map ten move
ids onto the same four shared hero clips — `Attack`, `Return`, `Heavy`, `Riposte` — with `clips: null` in `WEAPON_BUILDS`; only the
two-hand poles own prefixed families. The brief's "~13 clips to author" is a two-hand pole family's cost (the scythe's) applied to a
one-hand weapon. Real cost: a part, plus at most the already-shared `CLEAVER_KEYS` re-key.

**Open.** #419 waits on a Nightborn **profile** item in Combat's lane (levers only, no data move): with the estoc at +0.30 m the
Nightborn normal profile must hold `trident vs nightborn normal: charged heavy only` at ≤ 12/24 with margin (14/24 with the fix,
8/24 without), fight length back under the 240-tick bar (321 exhausted over 24), and his hard-tier feint-and-punish identity pin
intact (0/24). Combat stacks the estoc flip on #419 as one PR riding Stats' single bump to 6. Then ONE full-battery re-run on the
pair and a READY line. **Do not re-run the battery before that PR exists** — nothing else moves those rows.

**Gotchas.**
1. **THE MAUL TRAP, for whoever rigs it next.** #509 is the part only — `clips: null`, no rig, no loadout. But `WEAPONS.maul.paths`
   names `Maul_Slash` / `Maul_Heavy` / `Maul_Thrust`, and **those clips exist only on the creature side**: they are authored in
   `scripts/build-creature-weapons.mjs` for the Minotaur, at the Minotaur's contact span `{from: .73, to: 1.11}`. The hero-rig part
   this lane shipped has contact `{from: .65, to: .87}` — a different object at a different scale. So a hero-rig maul needs its own
   family or a re-key onto the shared hero clips, exactly as the warhammer got `Warhammer_*` "on the trident's machinery" rather than
   borrowing the Minotaur's creature-authored `Maul_*` set. **Anyone switching a hero-rig donor to the maul and expecting the paths
   to resolve will bind to creature clips or to nothing.** Strategy has the Executioner doing that switch the day this lands.
2. **The maul's crown is load-bearing, not cosmetic.** `WEAPONS.maul` and `WEAPONS.warhammer` carry identical reaches (light 1.65,
   heavy 1.90, thrust 1.40 — both CLEAVER-derived), so the head crowns at the warhammer's .76. The `real reach` test does not cover
   the maul yet because it is neither a shipped (rig, weapon) pair nor a player weapon; it starts covering it the moment it is rigged.
   Do not "tidy" that height.
3. **The stale-node_modules gotcha is install-date, not base-sha.** World reported that a worktree fast-forwarded onto `fe0d8e0` can
   fail `quality:stop` on a missing `@types/node`, fixed by `npm ci`. This worktree **was** on `fe0d8e0` and did not hit it (468/466/2,
   World's own post-`npm ci` numbers). It depends on when that worktree last installed. Do not run `npm ci` as a ritual, and do not
   read a green gate on `fe0d8e0` as evidence the gotcha is imaginary.
4. **Open the file before acting on a relayed mechanism.** Three plausible relays were wrong in one night, each from a competent
   lane. The costly one: the kicker hover was relayed as the estoc's unblocking event, but it is gated on `guardShare === 0`, which
   is the Goblin's profiles alone — it can never fire on the Nightborn. Acting on it meant a full battery re-run for the same table.

## Estoc reach — re-measured and HELD: the estoc clears, the Nightborn breaks (weapons lane, 2026-09-22) — HELD, NOT PARKED
The estoc was un-parked on the reach fix alone (Dom via Strategy, the lead relaying): `ESTOC.fight.close` is not touched, so the old
stance-hunt revival condition below is **moot** and that hunt stays dead. #419 rebased onto trunk `1741dc5`, head `b1455d4`, PR draft.

**The estoc itself clears with room.** `ESTOC_MOVES` = the sword's spacing convention **+ 0.30 m**, the blade's measured frontier. Full
battery re-run, every weapon, both levels. Against a bar of margin ≥ 2, **zero estoc rows are below it** — worst are goblin normal thrust
6/24 and executioner normal charged heavy 6/24 (cap 12), and goblin hard charged heavy 4/24 (cap 8). The four old rows: goblin normal
thrust 24/24 → 6/24, goblin hard light spam 9/24 → 1/24, goblin hard thrust 23/24 → 3/24, dwarf hard thrust 10/24 → 3/24.

**But the weapon does not travel alone, and that is the finding.** The Nightborn wields the estoc, so +0.30 m on every one of his moves
changes how he fights everyone. Three consequences, each with an in-process control that restored cleanly:

| # | finding | control |
|---|---|---|
| 1 | **new** over-cap row on the **trident** (shipped, offered): `trident vs nightborn normal: charged heavy only` 8/24 → **14/24**, cap 12 | estoc back on sword reach → 8, restored → 14 |
| 2 | Nightborn **fight-length pin fails**: exhausted **321** ticks over 24 fights, bar 240 | `ESTOC_REACH = 0` passes (median 20.5 s, hero wins 10/24); `.30` fails |
| 3 | Nightborn **fight-identity fails** at hard: the feint-and-punish his design names wins **0/24** | same |

(2) and (3) are design contracts, not thresholds — his brief is that he is "beaten by wit, not stamina".

**The lever the brief named is shut by contract, not by taste.** Tuning the estoc's thrust recovery the way the knife's was tuned breaks
`tests/weapons.test.ts`, which pins the estoc's windup/active/recovery/stepIn/feintUntil/chamber to the sword's **exactly** — "the sword's
timings and lunges exactly" is the weapon's brief. Swept before concluding it: 21 → trident 14 FAIL; 24 → trident 7 but the estoc's own
goblin row goes to margin 0; 27 → 12 thin; 30/31/32 → both clear. Non-monotonic, *and* it breaks the defining test at every value. Record
the closed door rather than leaving it ambiguous. Wind-up and stance untouched, as instructed.

**The lead's ruling, 2026-09-22: the trident does NOT leave `PLAYER_WEAPONS_OFFERED`** — "un-offering a shipped weapon to make room for a
shelf one is not a trade I'll make". The branch as pushed *does* remove it, because the table forces the pair (the test asserts a weapon
with no over-cap row must be offered and one with a row must not be). That is why this cannot land as-is and is held rather than fixed: the
invariant and the ruling disagree until the trident row goes away. Same invariant that forced the scythe in on #440 — the system working.

**Held, deliberately, on a dependency.** Combat is fixing a shared approach defect in `src/ai.ts`: every opponent's approach settles at a
*raw* reach value while `inReach` needs `reach − .1`, so wardens park just outside their own range. That changes stopping distance, which
is exactly what +0.30 m interacts with — findings (2) and (3) are engagement-distance symptoms and may move on their own. Re-measuring
before it lands would be the stale-base trap one layer up. **Nothing is retuned and nothing is measured again until that fix is on trunk.**

`RECORD_VERSION` 5 → 6 with `SIM_DIGEST` re-pinned over the final tree and references regenerated (still replaying identically, 1677/1452).

**BUMP RULING, 2026-09-22 (the lead) — the estoc's 6 is NOT this lane's to write.** Trunk carries `RECORD_VERSION = 5` (the batched
knife+scythe flip). Stats' PR B needs 6 for the loadout tail and is ready first, so **Stats carries the bump and this lane rides it**; the
rule is whoever is ready first takes it, and if #419 somehow lands ahead of Stats' PR B the order reverses. The `weapons/estoc-reach`
branch currently writes 6 itself — that stays only while it is a draft, and **the bump comes out (with `SIM_DIGEST` re-pinned) before #419
goes READY behind Stats**. One bump for many, because kill links are the viral surface and N bumps means N waves of dead links.

**SEQUENCING, 2026-09-22 (the lead, correcting himself with Combat's answer).** Combat's **knife** is next, not the cleaver, and it
touches the warden approach in `src/ai.ts` rather than estoc data — so #419's draft status does **not** gate them tomorrow; only the
cleaver-and-after stacks on this lane. Read the other direction, that is this entry's unblocking event: the approach fix this entry is
held on is the thing Combat is about to ship, so **watch trunk for `src/ai.ts`** rather than waiting to be told. Combat is taking this
lane's knife `thrust.recovery` 15 → 20 as measured rather than re-deriving it.

**CORRECTION, 2026-09-22 — the kicker hover is NOT this entry's unblocking event, and #419 should not be sequenced behind it.**
Combat corrected their own mechanism (via the lead): the park is not the approach stop but the **kicker hover**, `src/ai.ts:323`
`const hover = guardShare === 0 ? (reads.poker ? theirs.thrust.reach : reads.kicker ? theirs.kick.reach + .3 : 0) : 0`, with the clamp at
`:330` zeroing forward drive below `hover − margin` (`:328`, margin `.05` for a kicker). That mechanism is real and the arithmetic
reproduces: `MOVES.kick.reach` is 1.2, so hover = 1.50 and forward drive dies at **1.45**; the parked warden's *usable* reaches
(`reach − .1`, the margin `inReach` keeps) are light 1.10, thrust 1.35, heavy 1.45 — parked at exactly the heavy's usable edge, only the
heavy legal. **But those are the knife's reaches (1.2 / 1.45 / 1.55), not the estoc's** (1.95 / 2.30 / 2.20 with the fix). The warden is
the **Goblin**, and that is forced: `guardShare = profile.guard ?? 1` (`:68`), and `guard: 0` appears in exactly one opponent's profiles
in `src/moves.ts` — the goblin's easy/normal/hard (`:509–511`), whose comment says outright "never guards (guard 0)".

**The Nightborn is not guardless**, so `hover` evaluates to 0 for him and the `hover > 0` clamp can never fire on his approach:
`nightborn` (`src/moves.ts:495`) carries `guard: { window, recovery, commits }` — the directional-guard object, a different key — and
none of his three profiles sets the AiProfile `guard` share, so it defaults to 1. **Therefore Combat's kicker-hover fix cannot move
findings (2) or (3), and cannot move the trident row.** What it *does* explain is the `knife vs goblin hard: kick only untouched` 3/24
stalemate this lane already routed to Combat as his approach rather than knife data — that row now has its mechanism, at 1.45 m.

So the hold does not lift when that fix lands. Either a Nightborn-profile change is made, or the trident row is accepted and the flip
test's membership pair is resolved by a product decision. **Do not re-run the full battery on the strength of the kicker fix alone** —
it is a no-op for this weapon's problem, and re-measuring against it would buy the same table a second time.

**Base check, 2026-09-22 (docs PR):** trunk has moved `1741dc5` → `cb8ff5b` (22 commits), and
`git diff --stat b1455d4...cb8ff5b -- src/{ai,duel,moves,sim,record,opponents}.ts` is **empty** — not one sim file moved. So the numbers
below are still the numbers on current trunk, and **Combat's `ai.ts` approach fix is not on trunk yet**: the dependency this entry is held
on is unresolved, not silently satisfied. Re-measuring today would re-derive the same table. (The lane's flip-test rule did land, as
`9ffce97`/#465.)

Evidence: `b1455d4`. Gate 464/467 with 2 skipped and 1 failure, plus 93/94 slow — both failures are the Nightborn and both are caused by
this change; neither pin was relaxed. Remaining validation: **re-run the full battery once Combat's `ai.ts` approach fix is on trunk**, then
either the estoc lands nearly clean, or the surviving trident row goes to Combat as a Nightborn profile item and #419 waits for it.

## Knife flip prep — two rows fixed, one isn't knife data, and a program-level cost (weapons lane, 2026-09-22) — BLOCKED ON A DECISION
Lead's item (1), knife. Three rows on trunk 187dd89, all reproduced: `knife vs veteran normal: thrust from range 18/24`,
`knife vs goblin normal: thrust from range 15/24` (caps 12), `knife vs goblin hard: kick only untouched 3/24` (cap 2).

**The two thrust rows are knife data and are fixed here**: `KNIFE_MOVES.thrust.recovery` 15 -> 20. The knife's poke was unpunishable —
out and home before either warden could answer — so a poker parked at range and won. The wind-up stays 12, the fastest tell in the game
and the floor the knife's brief sets for readability, so it still feels like a knife; only the whiff becomes punishable. Total commitment
12+20 = 32 ticks still undercuts the sword's 16+21 = 37.

**Wind-up is the wrong lever**, measured: 13 -> 22/19, 14 -> 24/24, 15 -> 1/23, 16 -> 2/24. It shifts the tell in and out of each warden's
read window, non-monotonically. Recovery is the mechanism; wind-up is a coin toss.

**20 is the only usable value**, because the Goblin wields this knife and his own fight-length pin moves with it
(`tests/opponents.test.ts`, median 25–45 s):

| recovery | knife rows (Vet / Gob, cap 12) | Goblin median |
|---|---|---|
| 15 (trunk) | **18 FAIL / 15 FAIL** | 42.8 s |
| 16 | 8 / 12 (zero margin) | **47.5 s OVER** |
| 17 | 10 / **13 FAIL** | 43.7 s |
| 18 | 8 / 11 (margin 1) | 44.7 s |
| 19 | 5 / **16 FAIL** | 38.0 s |
| **20** | **5 / 6 (margin 7, 6)** | **44.6 s** |
| 21 | 3 / 4 | **48.5 s OVER** |

Note the median surface: 42.8, 47.5, 43.7, 44.7, 38.0, 44.6, 48.5 across adjacent ticks. 20 passes its pin by 0.4 s on a surface that
swings ten seconds between neighbours — that is luck, not headroom, and it should be re-measured if the Goblin is ever retuned.

**The third row is not knife data.** `KNIFE_MOVES.kick` IS the shared `MOVES.kick` object (identity-checked, `===`), and kick-only is
killed 24/24 by this same Goblin with every other weapon; only the knife pairing fails, and all 24 of its fights end in stalemate at the
7200-tick limit — a kicker and the hard Goblin simply never resolve. That is his approach against the shortest reach in the game
(Combat's lane), not a weapon number, and no weapons change should be made for it.

### Two facts that apply to EVERY weapon change, not just this one
1. **Every player weapon is also a warden's weapon** — goblin/knife, veteran/trident, nightborn/estoc, executioner/scythe,
   pitborn/cleaver, dwarf/warhammer. So every weapon-data change is simultaneously a warden change, and the warden's own pins
   (`tests/opponents.test.ts`) and every OTHER weapon's rows against him move with it. This change moved three of Combat's signed rows
   (estoc-vs-goblin hard light spam 11 -> 9 and thrust 22 -> 23, scythe-vs-goblin normal thrust 19 -> 16) purely because the Goblin's
   knife changed. Re-scan the whole table after any weapon edit; never assume the blast radius is the weapon you touched. It cost the
   estoc its reach fix (#419, parked) and it is the reason a knife tune needs Combat's re-signature.
2. **Every weapon-data change invalidates every shared kill link.** `tests/record-version-guard.test.ts` hashes
   `SIM_FILES = [duel.ts, moves.ts, ai.ts, sim.ts, record.ts]`; any change to `src/moves.ts` requires `RECORD_VERSION` to bump, which
   refuses all previously shared links at decode. That is the correct behaviour — a link must not replay a different fight — but it means
   **N weapon PRs merged separately cost N link-invalidation events.** The remaining flip work should be batched behind ONE deliberate
   bump rather than paid per weapon. That sequencing is the lead's call, which is why this entry is BLOCKED rather than shipped.

LEAD'S RULINGS, 16:31: (a) **Batch the bump** — one `RECORD_VERSION` 3 → 4 for the whole remaining flip work, because kill links are the
viral surface Dom is pushing (PLAY NOW shipped 2026-09-22) and N bumps means N waves of dead links for no product gain. #440 stays a
draft; the scythe and any further weapon-data change stack on the same branch, landing as ONE PR with a single bump and a single
`SIM_DIGEST` re-pin. Leaving the guard red was endorsed explicitly: "I'd rather see it red than see someone bump quietly." (b) The
Goblin kick row is **Combat's**, accepted on the identity/stalemate evidence, routed as a hard-profile item behind Brief 13 and named a
first candidate for Brief 14's per-grade knob — no weapon data is to be spent on it. (c) The knife fix is **approved as measured**.
(d) **Combat's re-signature on the moved snapshot rows is required before the batched PR goes READY** — the lead will not merge on the
weapons lane's signature alone.

STANDING WARNING tied to the Goblin: recovery 20 clears its pins at a median of 44.6 s against a 45 s ceiling, on a surface that swings
38 → 48.5 s across adjacent recovery ticks. That is luck, not headroom. **If the Goblin is ever retuned, re-measure this.**

COMBAT'S ANSWER on (d), 2026-09-22 — **measure once**. He declines to sign magnitudes he has not re-derived on his own seeds ("a
signature that means the other lane told me and it looked plausible is worth nothing"), and box windows are the scarce resource, so
measuring the knife head now would buy a number he'd throw away once the scythe lands. Agreement: **when the scythe is stacked and this
branch is stable, send him ONE sha and ONE consolidated set of every row of his that moved**; he re-derives them all in a single window
and signs or sends his numbers. Until then the three rows are labelled UNVERIFIED BY COMBAT in the #440 body, not "signed" — if the lead
merges first it merges on this lane's measurement alone, and that label is the honest record. Do not soften it.

Two process facts from the same exchange. **Send the head sha you actually measured, re-checked after any rebase**: this branch moved
f890dae → f87d721 when trunk gained #431/#432/#433/#434, and those merges touch none of `duel/moves/ai/sim/record/opponents.ts` or
`tests/player-weapons.test.ts`, so the numbers survived — but an unchecked stale sha manufactures a "disagreement" that is really two
different trees, and costs the other lane a whole window to discover. **Determinism first**: five identical runs in one process were
verified on this surface, which is what makes any difference between two lanes real signal rather than seeds.

State: ready on `weapons/knife-thrust-recovery` (a078af6), snapshot updated, full suite 491/494 (2 skips are the char lane's hand pins),
the ONLY failure the version guard — deliberately red, by the lead's ruling, until the batch lands. Not merged.

## Scythe flip prep — heel-jab recovery 18 → 30, both rows cleared, the scythe is offerable (weapons lane, 2026-09-22) — FIXED
The last of Combat's four. The scythe's two `thrust from range` rows (Veteran 19/24, Goblin 16/24, cap 12) were scythe data, the same
shape as the knife's: the heel-jab reaches 2.10 m and at recovery 18 it was home before either warden could answer, so a jabber parked at
range and never paid. Recovery 18 → 30 clears both with margin (8/24, 6/24). Wind-up stays 14 — the jab still *comes out* quick, which is
the trait the brief names ("quick, short… spacing and interrupt tool"); what changes is that a whiffed jab is punishable.

**This one has an interior, which is why it is payable where the cleaver and estoc were not.** Recovery, 24 seeds, normal, cap 12:

| recovery | Veteran | Goblin | |
|---|---|---|---|
| 18 (shipped) | 19 | 16 | FAIL |
| 26 | 16 | 18 | FAIL |
| 27 | 17 | 18 | FAIL |
| 28 | 12 | 12 | passes, but **exactly on the cap** — margin 0 |
| 29 | 11 | 8 | passes |
| **30** | **8** | **6** | **passes, margin 4 and 6 — taken** |
| 31 | 1 | 4 | passes |
| 32 | 17 | 1 | FAIL |

28–31 is contiguous and graded, and 30 is its centre with both neighbours passing. That is the opposite of the cleaver's surface (22 fails
at 17, 21 and 20 pass at 11, 19 fails at 18 — one tick either way flips it) and of the estoc's. The two reasons that parked those two —
non-monotonic, and zero-ish margin — are both absent here, so the change was taken rather than handed back.

**Wind-up is the wrong lever and was measured as such** (recovery held at 18): 16 → 0/24 FAIL, 18 → 0/20 FAIL, 20 → 0/0, 22 → 0/0. The
Veteran column falls 19 → 0 between wind-up 14 and 16 — a read-window cliff, not a gradient — and 20/22 would clear both rows with a huge
margin for exactly the wrong reason: the tell moves out of the warden's read window. Raising it also costs the trait the brief protects.

**The Executioner wields this scythe, so his side was measured before the change was taken** (AI vs AI, 24 seeds, the `18–45 s` pin):
median 25.9 s untouched, 27.4 at 28, 27.7 at 29, **27.0 at 30**, 27.9 at 31; range 16.2–41.0 s at 30, no unfinished fights at any value.
Unlike the Goblin's pin under the knife change (44.6 s against a 45 s ceiling — luck, and flagged as such), this one has real headroom.

**One other row moved through him**: `cleaver vs executioner normal: light spam` 17/24 → **18/24**. Over the cap either way and its cause is
unchanged (his read of a 22-tick tell, the entry below), so the cleaver's diagnosis and its hand-over to Combat both still stand — but the
number in that entry's table is now 18, not 17. Snapshot updated; **needs Combat's re-signature together with the knife's**.

**The scythe now has no over-cap row at any rung, so it enters `PLAYER_WEAPONS_OFFERED`.** That is not a taste call: the test derives the
excluded set from the table and asserts that a weapon with no row *must* be offered, so the list follows the measurement. Offered is now
longsword, warhammer, trident, scythe.

Also finishes the knife change from `1bb9153`: `KNIFE_MOVES.thrust` went to recovery 20 but `KNIFE_PATHS.thrust` stayed at 15. The path
tables drive the clip retime (`clipSpec`, `src/combat.ts`), not the sim — a path shorter than its move leaves the stab looking recovered
for 5 ticks while the sim still holds the fighter. Both path tables now follow their moves. Presentation only, so no measurement re-opens.

Every sweep ran an untouched control in the same process; it reproduced 19/24 and 16/24 exactly and restored to them after every patch
(the control rule in the entry below — it is what caught the cleaver's asymmetric-light error).

Evidence: `44d414e`. Gate 456/459 plus 93/93 slow, and the fairness table passes against the updated snapshot. The one failure is the
`RECORD_VERSION` guard, red deliberately under the lead's ruling (a): one 3 → 4 bump for the whole remaining flip work, not one per weapon.
**The batch then closed, and the branch was rebased onto trunk `c43c677`** (head `3245d6e`, #440 MERGEABLE/CLEAN). Two things the rebase
changed, both worth keeping: **`RECORD_VERSION` is 5, not 4** — trunk had already taken 4 for Brief 13's whip tell (#431) while this branch
was in flight, so the batch is a further sim change on top of it. And the rebase pulled in a **299-line `src/ai.ts` change plus `duel.ts`,
`moves.ts` and `record.ts`** that belong to the lorarii work, not to this lane: the fairness table was therefore re-run on the rebased tree
before the sha went to Combat, and the snapshot still matches exactly, so neither trunk's changes nor this lane's moved a row. The reference
fights' state digests moved to `d953a09b` / `552f30e5`, which is byte-for-byte what trunk's own fixture already carried — the knife and
scythe move those two Veteran fights not at all (same ticks 1677/1452, outcome and killed tick).

The `grip` field also landed here (the shield brief, via the lead, folded in rather than paying a second bump): one-hand = knife, cleaver,
estoc, trident; two-hand = warhammer, scythe, longsword. The brief named seven; `MAUL` and `REAPER` spread `CLEAVER` and `ESTOC`, so without
an explicit override they would have silently inherited `one-hand` — both set to `two-hand` and flagged to the lead. Data only, nothing in
the sim reads it. `RECORD_VERSION` 3 → 4 was the single bump ruling (a) reserved for the whole flip work. `src/record.ts`
is itself one of the hashed `SIM_FILES`, so the digest was computed *after* the bump rather than copied from the failure message, which
prints the pre-bump one. References regenerated per the documented procedure (`scripts/record-replay-check.mjs --write`, same PR as the
bump) — and both replay to the **identical** fight, same ticks (1677, 1452), outcome, killed tick and state digest. Only the version byte
moved, because neither reference uses the knife or the scythe; the bump is there to refuse older links cleanly, not because these changed.
Gate green on the rebased tree: 465/467 with 2 skipped and 0 failures, plus 94/94 slow.

Remaining validation: **Combat re-signs the snapshot** (this entry's cleaver row and the knife's three estoc/scythe rows) and the PR goes
ready only after that (ruling (d)); the scythe has had no browser/feel pass as a *player* weapon — the
recovery is 200 ms longer than shipped and that is a real change to how the jab reads in the hand, which the numbers cannot judge.

## Cleaver flip prep — the Executioner row is not payable in this lane either (weapons lane, 2026-09-22) — MEASURED, NOT FIXED
Lead's item (1): clear `cleaver vs executioner normal: light spam wins 17/24` (cap 12) with a measured 24-seed battery. Re-run on trunk
9f77fe4 — the row survives every trunk change since it was signed, still exactly 17/24. Every other cleaver pairing passes (veteran,
pitborn, goblin, nightborn, dwarf, at both levels). Diagnosis below; **no cleaver change is proposed, and none should be made.**

It is not the cleaver, it is a tell the Executioner cannot read. Light spam against him, every player weapon, 24 seeds, normal:

| weapon | light windup | result |
|---|---|---|
| cleaver | 22 | **17W/7L** |
| warhammer | 22 | 11W/13L — *already offered* |
| trident | 22 | 11W/13L — *already offered* |
| longsword | 20 | 0W/24L |
| estoc | 20 | 0W/24L |
| knife | 14 | 0W/24L |

Every weapon with a 22-tick light beats him; every weapon with 20 or 14 never touches him. Two of the three 22-tick weapons are shipped
and offered today at 11/24, one cap-step below the cleaver. So this is an Executioner-side blind spot that already ships, and the cleaver
is its worst instance rather than a broken weapon.

Every weapons-side lever, measured (`battery('normal', 24, 7200, OPPONENTS.executioner, STRATEGIES, 'cleaver')`, deterministic — verified
by five identical runs in one process, and by identical-value object copies):

| lever | result | cost |
|---|---|---|
| untouched | 17W FAIL | — |
| light windup 22 → 21 | 11W pass, margin 1 | the heavy-chopper tempo; 22 is deliberate (readability, and slower than the sword by brief) |
| light windup 22 → 20 | 11W pass, margin 1 | as above, and makes it the sword's tempo exactly |
| light windup 22 → **19** | **18W FAIL** | — |
| backhand posture 34 → 20 | 11W pass, margin 1 | a 41 % cut to the weapon's defining trait ("the back of the cleaver is a hammer") |
| backhand posture 34 → 24 | 14W FAIL | — |
| chop posture 26 → 20 | **18W FAIL** (worse) | — |

Two reasons not to take any of them, the same two that parked the estoc. **Non-monotonic**: 22 fails at 17, 21 and 20 pass at 11, 19 fails
at 18 — one tick either way flips the result, so this is sampling noise, not a gradient with a safe interior. **Zero-ish margin**: every
passing value lands on 11/24 against a cap of 12. And each costs a trait the cleaver's brief states explicitly.

### Sweeping a weapon: keep a control inside the harness (rule, not an anecdote)
**Every weapon sweep must run the untouched weapon as a control in the same process as the patched runs, and the control must reproduce
the number you are trying to move.** If it doesn't, your patch is changing more than you think and every row in the sweep is suspect.

This is not hypothetical: the first sweep of this row was wrong and looked entirely plausible. The cleaver's two lights are asymmetric by
design — chop `light_right` posture 26 / damage 17, backhand `light_left` posture **34** / damage 9 (the brief: "the back of the cleaver
is a hammer") — so a patch written as "set the light's posture" hits both and silently nerfs the backhand. It produced a **14W baseline
for an untouched weapon whose true baseline is 17W**, i.e. a plausible three-win error in the direction of the answer I was looking for.
It was caught only because that baseline disagreed with an earlier run of the same config.

Two supporting facts, both measured rather than assumed:
- `tests/strategies.ts` `battery()` **is deterministic** — five identical calls in one process all returned 17W, as did calls made after
  reassigning `WEAPONS.cleaver` to an identical-value deep copy. So a number that differs between two runs means *you changed something*;
  it is never flakiness, and must be explained before the sweep is trusted.
- Per-move patches must name `light_right` and `light_left` separately. Any weapon may carry asymmetric lights; the cleaver does, and the
  knife's brief (edge vs the hook's sharpened back) suggests it may too — check before sweeping, don't assume symmetry.

Handover: the lever is the Executioner reading a 22-tick tell (his reaction window), which is Combat's lane, not a weapon number. Until
that moves, the row stands and the cleaver stays out of `PLAYER_WEAPONS_OFFERED`. Knife and scythe prep follow separately; nothing here
blocks them, and nothing here touches the loot ids (takeable ≠ offered).
## Estoc reach — PARKED, no stance value clears both axes (combat lane, 2026-09-22) — SUPERSEDED 2026-09-22: un-parked on the reach fix alone; the stance hunt stays dead and this entry's revival condition is moot (see the HELD entry above)
The weapons lane's estoc reach fix (#419, now a draft) is correct about the blade and is NOT merged: it cannot ship until the estoc's
stance is retuned, and no stance value exists that is safe. **To revive it, one of two things must change: either the Nightborn stops
carrying the estoc, or the trident-vs-Nightborn fairness row is re-measured against a deliberately retuned Nightborn.** Neither is a
side effect of a weapons change — whoever touches `ESTOC_MOVES` reach or `ESTOC.fight.close` next should read this entry first.
Lead named a third route, but gated: a per-opponent knob or a deliberate Nightborn discipline retune, and only if Strategy or the owner
wants the estoc sooner — it is a bigger change than the estoc is worth. Retuning the TRIDENT's charged heavy (the row that actually
trips) would also clear it and is deliberately NOT listed as a free option: it retunes a shipped, offered weapon to accommodate a shelf
one, which is the trade Lead refused when he put axis 2 in scope. If someone takes that road it is a trident decision on its own merits,
not an estoc fix.

Why a stance retune was needed at all: `ESTOC.fight.close` stood at the longsword's own 1.15 while the move table wore the sword's
reach. Giving the estoc its blade's real reach (+0.30 m) left the stance behind, so the wielder closed to 1.95 - 1.15 = 0.80 m inside
his own cut (with #419 applied; **on trunk today the estoc's stand-off reads 0.50**, light 1.65 against close 1.15, because the reach
fix is unmerged — check the number against a tree with #419 in it, not against trunk) — deeper than any weapon we ship (longsword/cleaver/maul/warhammer 0.50, reaper 0.65, per the weapons lane's sweep). He
over-swung and exhausted himself: `tests/opponents.test.ts` "beaten by wit, not stamina" went 105 -> 321 ticks over 24 fights, cap 240.

Why no retune works. Two axes pull against each other. Axis 1 is that exhaustion pin. Axis 2 is `tests/player-weapons.test.ts`, the
24-seed battery — in scope because **the Nightborn wields the estoc**, so his stance changes how a TRIDENT player fights him, and the
trident is shipped and offered. Stand-off below is `ESTOC.moves.light_right.reach (1.95) - ESTOC.fight.close`:

| close | stand-off | Nightborn exhausted (cap 240) | 24-seed battery |
|---|---|---|---|
| 1.15 | 0.80 | 321 FAIL | pass |
| 1.17 | 0.78 | 215 | FAIL — trident vs nightborn normal: charged heavy only 13/24 |
| 1.19 | 0.76 | 215 | pass |
| 1.20 | 0.75 | 215 | pass |
| 1.21 | 0.74 | 215 | pass |
| 1.23 | 0.72 | 215 | FAIL — same row, 13/24 |
| 1.25 | 0.70 | 215 | FAIL — same row |
| 1.30 | 0.65 | 215 | FAIL — same row |
| 1.35 | 0.60 | 230 | FAIL — same row |
| 1.40 | 0.55 | 317 FAIL | pass |

The 1.19-1.21 window is not usable, for two independent reasons. (1) **Zero margin**: measured directly, the trident's charged-heavy
row is exactly 12/24 at 1.19, 1.20 and 1.21. The cap is 0.5 and the check is `wins/seeds > cap`, so 12/24 passes only by not being
strictly greater — one seed flips it to a failure. A pass by tie-break is not evidence. (2) **It contradicts its own rationale**: a
stand-off of 0.75 makes the estoc the deepest-closing weapon in the game, when the point of the fix is that a point-first blade stands
off FURTHER than a cutter. Note also that 1.17 FAILS while 1.19 passes at identical exhaustion (215): at this resolution the surface is
sampling noise, not a plateau with edges, so bisecting for a better value is not worth anyone's time.

Evidence: sweep run 2026-09-22 on `combat/estoc-offer` (since reverted to its committed head; nothing pushed, no PR). Axis 1 from a probe
reproducing the opponents pin exactly; axis 2 from `node --test tests/player-weapons.test.ts` at each value; the 12/24 margin from a
direct `battery('normal', 24, 7200, OPPONENTS.nightborn, STRATEGIES, 'trident')` read. Also green at the rejected 1.30 before axis 2
caught it, which is the point: `record-replay-check` (both fixtures, digests match), `kill-link-check` (36 fights),
`tests/weapons.test.ts` 34/34, `tests/opponents.test.ts` 20/20. A green suite is not a safe number.

Riding with any revival: a rewritten stance pin (Weapons' anchoring — `reach - close === 0.65` for both the estoc and `WEAPONS.reaper`,
so a longsword retune cannot drag the estoc's pin with it) is kept as `estoc-stance-pin.patch` in the combat lane's scratchpad. It is a
better pin than the `LONGSWORD.fight.close + .15` it replaces, and against today's committed `close` of 1.15 it fails as
`0.8 !== 0.65` — the bug stated as a test. `RECORD_VERSION` stays 3 on trunk: the sim change is parked with the rest.

## Takeable weapons — loot ids for every warden's weapon (weapons lane, 2026-09-22)
Owner (via Strategy, 12:55): "any item can be taken, armour or weapon." Shelf side in `src/loot.ts`: `WEAPON_SLOTS` (Trident, Cleaver,
Knife, Estoc, Scythe, Warhammer) join `ARMOUR_SLOTS` in `LOOT_SLOTS`; `PAPERDOLL.main = WEAPON_SLOTS`; ids `veteran.Trident`,
`pitborn.Cleaver`, `goblin.Knife`, `nightborn.Estoc`, `executioner.Scythe`, `dwarf.Warhammer` appended to `LOOT`; `weaponOf(id)` = the slot
lower-cased (`isWeaponLoot`, `isWeaponSlot`). `dropFor` filters to armour: a weapon is never dropped, it is TAKEN (the lead's kill-screen
"Take one" reads `LOOT[opponent]` minus owned). No loot.glb draw for a weapon — the visual is its equip file `src/assets/weapons/player/
<weapon>.glb` (#309 contract) loaded when `equipped.main` is set; that runtime step and the fight-with-it seam (`playerWeapon` from
`equipped.main`) are the lead's/Combat's. Tests: the loot.glb pin now compares ARMOUR ids to the file's draws (loot-data + loot-wear);
a sibling pin walks every weapon piece → PLAYER_WEAPONS member, main-hand paperdoll, its opponent's roster weapon, equip file present
with WeaponDrawn and its WEAPON_CLIPS family; every ladder warden's weapon is a piece; `dropFor` never returns a weapon; a taken weapon
cleans/wears/unwears only in `main`. Whether a weapon is OFFERED stays `PLAYER_WEAPONS_OFFERED` (Combat's fairness table), untouched.
Shelf status for the lead's (b): all six equip files ship complete as wieldable since #309 — cleaver/knife/estoc on the sword family
(+ a re-keyed Heavy for cleaver/knife; the estoc re-keys nothing by design), scythe/trident/warhammer with their 13/13/12-clip families;
every one has a hero bake pinned by `tests/blade-rig.test.ts`. No family is missing; what gates each weapon is the runtime equip + fairness.

## Flat blade table dropped — `bladePathsByRig` is the only export (weapons lane, 2026-09-22)
The seam PR landed (`src/blade.ts` reads `bladePathsByRig[rig][weapon]`, `tests/blade-rig.test.ts` pins every pair), so
`bake-blades.mjs` no longer writes the transitional flat `bladePaths[weapon]` (the first manifest entry per weapon) — `src/blade-paths.ts`
496 KB → 270 KB, `bladePathsByRig` byte-identical. The last readers were tests: repointed to the rig each one means (hero for
longsword/trident/cleaver/scythe, goblin.knife, nightborn.estoc, minotaur.maul, wraith.reaper); the manifest test now checks every bake
carries all of its weapon's paths and every non-placeholder weapon is baked on some rig. The dead placeholder-borrowing loop in the
bake (no `placeholder` weapon exists) went with it. Closes auditer finding #6 on the merged weapons PRs.

## Player-wieldable weapons — equip files + blade tables by rig (weapons lane, Brief 5, 2026-09-21)
Six loot weapons on the shelf as their own files, `src/assets/weapons/player/<id>.glb` (`scripts/build-player-weapon.mjs`): the
hero build's `WeaponDrawn` in `hand_r`, the skeleton as empties, and only the clips the weapon owns (family + re-keyed `Heavy` for the
cleaver/knife + the Quiet One solved from the weapon) — packed 209–884 KB, nothing in `warrior.glb`, per-fight budget unchanged
(8,817,201 gzip). `blade-manifest.json` gained `rig` and `attach`; `bake-blades.mjs` emits `bladePathsByRig[rig][weapon]` beside the
unchanged flat table (Combat's nested lookup + `Fighter.rig` + the pin land from their lane; until then the flat export is what the sim
reads). Facts: cleaver/warhammer/trident/scythe in the player's hand bake identically to their shipped tables; knife (Goblin rig,
0.816 m off) and estoc (Nightborn body, 0.148 m off) have new `hero` tables baked from the equip files on `warrior.glb`; each equip
file's bake equals a full hero-rig bake (verified all six). Draw vs armed: owner "go" on armed + ready stance (Strategy session).
Open: Combat's runtime equip + sim lookup; the per-weapon battery per rung (Combat); `warrior.glb` lags a rebuild in `Death_QuietOne`.

## Dwarf warhammer — integration of the weapons lane's shelf package (2026-09-20)
Owner: the Dwarf gets a warhammer instead of the Veteran's trident. Weapons shipped `warhammer` on the shelf (#233, weapons/warhammer-v1:
part, 12 `Warhammer_*` clips on the base humanoid rig, WEAPON_CLIPS, `WEAPONS.warhammer = {...MAUL, placeholder}`). Character lane
(`char/dwarf-warhammer`, on top of #233): the donor is rebuilt with `WARRIOR_WEAPON=warhammer`, the Dwarf refitted and packed (37 clips,
185 finite poses, both hands on the haft < 0.08 m, source maps retained; sha 82dab728…), roster `weapon: 'warhammer'`, the creature
browser check keys on the `Warhammer_*` family, and the role-table test maps the warhammer to dwarf.glb. Still Combat's: the reach band and
lifting the `placeholder` flag (the sim uses the maul's numbers until then); the browser gate and the deploy stay with the deployer.

## Warhammer — the Dwarf's, on the shelf (weapons lane, 2026-09-20)
Owner: "Create the dwarf hammer / war hammer - should be medium size". Part (0.93 m, square face on +x, back-spike, langets), the
12-clip `Warhammer_*` family on the humanoid rig (the trident's machinery shared as `twoHandFamily()`, Veteran byte-identical),
`WEAPONS.warhammer` = the maul's set, PLACEHOLDER (Combat sets the .78-fighter reach), `WEAPON_CLIPS.warhammer`, manifest + baked
table, shelf rig `veteran-warhammer.glb`, pose sheets. Grip check at the Dwarf's .78: both wrists ≤ 0.071 m from the haft on the five
grip roles. Next: character lane integrates (donor rebuild `WARRIOR_WEAPON=warhammer` → refit → roster `weapon: 'warhammer'`).

## Weapons Phase 2 polish — reconstructed parts, in progress (weapons lane, 2026-09-20)
Owner reversed the freeze for weapons: polish all of them now for beta, keep the procedural parts as the revert. Trident (Veteran)
and cleaver (Pitborn) ship as TRELLIS.2 reconstructions fitted by `scripts/weapon-fit.py` on the unchanged contact segments
(`bake-blades` tables identical; `WEAPON_VARIANT=short|A` rebuilds byte-identical to the previous rigs). Knife (Goblin), estoc
(Nightborn) and longsword (hero, hand + scabbard) followed in v2 the same way; the scythe part is fitted but not on a rig (the
Executioner's donor re-pack is the character lane's) and maul/claws/reaper (creature injector) are not started. Skeleton,
dwarf and werewolf pick the new parts up on their next creature pack. Evidence: `artifacts/weapons/REPORT.md` "Phase 2 polish".

## Wraith reaper scythe — weapons lane, in progress
Owner replaces claws with a massive two-handed reaper, explicitly distinct from Executioner. New crescent geometry, dark swept haft, twelve Reaper clips and dedicated blade-edge contact marker; original25 base/finisher clips, body maps/skin and1.5 spectral scale retained. Minotaur differs only in shared generator provenance; all seven non-Wraith baked paths unchanged. CPU grip, torso, exact animation/contact, inner/outer reach and AI approach/escape tests pass; visual acceptance and public deployment remain pending the lead-coordinated GPU/release window. Evidence: artifacts/weapons/wraith-reaper/. PR167 finisher repair integrated; rerun Wraith Opened split/fade/ground behavior before release.

## Creature weapons — weapons lane, 2026-09-19
Owner enables stone maul for Minotaur and bare claws for Wraith. Additive offline authoring preserves original creature surfaces/maps/weights and old clips. Twelve new clips per creature cover ready/gaits/attacks/guard/reactions/death/roll/kick. Maul front hand slides within reach; Wraith contact is derived from actual hand/finger vertices and includes its existing 1.5 presentation scale in the bake. Maul shove samples the haft, other attacks sample the stone head. New geometry/contact regression covers all new clips, exact baked/rendered paths, close hits and measured outer misses. Existing head-region grid now uses each weapon's actual timing instead of the sword clock; all previous expected regions remain pinned. All26 configured local gates passed, including real-game creature damage/death/rematch. Integrated draw-bell trunk e8670fa; full quality293/293 and both affected audio gates pass. Final front/side/rear pose sheets reviewed. Creature browser gate now selects full Chromium consistently with the combat gate; default headless-shell timing failures and diagnostics are retained. GitHub Actions did not start because of account billing/spending limits; no CI success claimed. Full contract and deployment receipts: artifacts/weapons/creature-weapons/. Public release authority remains release.json plus live/receipt.json; physical handset review remains owner-only.

## Polearm rear-arm visibility — weapons, 2026-09-19
Owner's rear/front phone captures exposed a second pose defect after PR157: the rear hand was authored on +X (the rig's left side), sending the right elbow through the torso. Both arms and their skin weights were present. Reauthored ready, gait, guard, attack and reaction goals keep the rear grip on the right side; the raised attack passes in front of the shoulder, and supporting-hand slides stay reachable. The shared polearm IK bends outward and forward while retaining the anatomical hinge constraint.

Both live rigs and the canonical scythe bake rig are rebuilt, with collision paths rebaked. New 120 Hz regression samples both upper/lower arms against the posed torso core in all clips; the old shipped rig fails it. Existing hinge, grip, contact-height, head-region and reach pins pass. Mesh attributes, material definitions, texture pixels and 2,354 non-arm tracks per rig remain unchanged. A new completion gate captures front, side and rear views at eight ready/gait/guard/attack poses. Initial full quality: 267/267 plus build/audit/budget/browser PASS; account-integrated CPU quality: 270/270. Integrated Quiet One and warm dust trunk 1ee616d, regenerated the three rigs with Death_QuietOne retained, and made its append-preservation fixture cover full exports and additive rigs. All 16 contract commands, final gates and release receipts are recorded in artifacts/weapons/polearm-rear-arm. Sentry FRANKENDOM-5 latest event is texture loading on 714e969; FRANKENDOM-6 is a stackless load failure on f7a1e99. Neither explains the reproduced offline pose; neither is claimed resolved. Physical-phone review remains owner-only.

## Polearm elbow correction — weapons, 2026-09-19
Owner reproduced inward, twisted elbows on the Executioner and Veteran in the live game. Their correct polearm gait clips were already selected. Offline IK used reversed left/right bend poles for this rig and shortest-arc bone aiming left axial roll unconstrained. Polearm-only authoring now places elbows outward and aligns the anatomical hinge from the library stance; sword authoring and all combat timings stay unchanged. The Executioner slides his supporting hand down the haft during the raised wind-up to stay within reach.

Both live rigs and the canonical scythe bake rig are rebuilt, with collision paths rebaked. A 120 Hz shipped-rig regression checks every polearm clip for hinge direction and front-wrist distance, plus outward elbows throughout ready gaits. Original shipped rigs fail this regression. Mesh attributes, material definitions, texture pixels and all 2,354 non-arm animation tracks per live rig are unchanged (procedural PNG compression bytes vary on rebuild). Close-up render evidence and validation logs: `artifacts/weapons/polearm-elbows`; delivery is tracked in PR #157. Integrated camera/audio trunk `a8e72e6`: full quality 265/265, build, audit, budget and browser PASS. New real-game desktop/phone-viewport polearm gate verifies served asset hashes and actual polearm playback. Physical-phone validation remains owner-only.

## Button-consistent parry counters — weapons, 2026-09-19
Owner authorized fix and deployment. After a successful parry, Slash selects `slash_riposte` with each weapon's cut clip
and a separately baked collision path; Stab retains `riposte`; Heavy retains `heavy_riposte` (or the earned posture critical).
The counter cut keeps that weapon's existing riposte damage, stamina and timing. The scythe reap retains its 1.4 m dead band;
the trident counter sweep uses its low direction. Ordinary blocks still yield normal Slash/Stab and the existing Heavy counter.
No new control or GLB. Field Journal now describes the actual buttons. Audio's fixed thrust exchange explicitly presses Stab.
Verification: real-touch browser captured the hero's Slash/Attack/24, Stab/Riposte/24 and Heavy/Heavy/30 after actual parries.
Regression checks all light inputs, Stab and Heavy after a real parry, reward consumption, costs, damage and ordinary blocks.
Restoring the old forced-thrust selector fails the regression. Render/bake tests include the new path across weapon families.
The first full run exposed two old assumptions: the AI opener filter counted earned counter cuts as ordinary openers, and
an audio fixture pressed Slash to request its fixed thrust. Those fixtures now name the correct moves; focused 83/83 pass.
Integrated full quality passes 250/250 tests, lint, build, audit, budget and the shared browser gate. Estoc #142 is merged
as d3114a9 with Split Crown #144 preserved. All earlier blade tables are byte-identical; only the new counter paths are added.
Completion and release receipts: `artifacts/weapons/counter-buttons/`. Public deployment remains pending.

## Estoc A activation — 2026-09-19 — PR #142, NOT DEPLOYED
Weapons branch `weapons/estoc-live`, based on trunk `d383b66`. Variant A is built on the current Nightborn,
with matching render/bake GLBs, manifest entry, real ESTOC data, rebaked paths and flipped shelf receipts. Existing clips,
body geometry and textures preserved; all five other weapon trajectory tables unchanged. Preview `--azimuth` added.
The longer point initially registered head hits on the upright Nightborn. The estoc part now carries a 10-degree grip tilt,
composed with the hand attachment by the builder. Only WeaponDrawn's quaternion changes in the GLB: geometry, animations,
textures and every other node remain identical. The unchanged head-region rule passes; no contact remapping or clip edits.
A new real-duel regression checks non-head contacts and measured cut/heavy/thrust frontiers of 2.0/2.5/2.3 m.
Restoring the old blade paths makes that regression fail. The .75 thrust share remains necessary: .70 still fails the unchanged
roll-and-punish cap (3/24 untouched); .75 passes both fairness batteries. AI-vs-AI median 20.9 s, hero wins 9/24.
No AI, damage, timing or spacing edits. Full `npm run quality`: 246/246 tests, build, audit, budget and browser gate PASS.
Estoc browser completion verifies the served rig SHA, WeaponDrawn, portrait/landscape layout and an opponent hit.
Evidence: `artifacts/weapons/estoc-live/` (logs, browser JSON, probes), `estoc-aim/` (reviewed captures).
Lead owns roster integration and deployment; no weapons-lane deployment was attempted. Physical-phone validation outstanding.
Sentry still has earlier unresolved load/texture/WebGL issues (6/A/5/9/8); this unshipped branch cannot resolve those.

## Trident v1 — the weapons lane — 2026-09-16
- Branch `weapons/trident-v1` from trunk 86189a5 (slice U). The Veteran's short trident: a rigid part under `hand_r` (`WeaponDrawn`,
  `extras.contact` on the tines, 652 triangles, no textures) and 13 original clips on the rig (`Trident_Idle/Walk/StrafeLeft/StrafeRight/
  Thrust/ThrustChain/Sweep/High/Guard/BlockImpact/Deflected/Hit/Death`), all two-handed; built by `scripts/build-weapon.mjs` through
  `build-warrior.mjs` (`WARRIOR_WEAPON=trident`, default output byte-identical) into `src/assets/weapons/trident/veteran-trident.glb`
  (not imported by the runtime: the bundle is unchanged until the render lane switches the opponent).
- Data: `WEAPONS.trident` is real (`TRIDENT_MOVES` / `TRIDENT_PATHS`, guard `shaft`, material `bronze`), baked from its own rig via
  `scripts/blade-manifest.json`. Slash = low sweep, Stab = thrust (chains into a second thrust), Heavy = the overhead pin. Measured
  against a standing target with the owner's pick (variant `short`: B's wide fork on a 60% stick, 1.42 m, brown shaft; the thrust reaches
  by driving the rear arm to full extension): thrust lands to 2.25 m (sword stab 2.0), sweep 1.75 (cut 1.7), pin 2.15 (heavy 2.2);
  every `reach` is that number (tests assert ±0.1 m). All numbers provisional — GAMEPLAY CHANGE for combat review; nothing changes on trunk (`initialDuel`
  still longsword vs longsword).
- Harness: `scripts/character-preview.mjs --weapons [--enemy <glb>]` — weapon turntable, on-rig close-ups, clip sheet, 393×852 /
  852×393 lock stills, a 6 s scripted exchange, a cost table; baseline and three passes under `artifacts/weapons/` (REPORT.md).
- Evidence: tests/weapons.test.ts 8 tests (rig + contact segment + clip set, clips agree with the data's contact keys, reach frontier);
  quality gate per the PR. Requests to other lanes in `artifacts/weapons/REQUESTS.md`: the renderer's per-weapon clip list and weapon
  node (the trident is not visible in the game until then), the combat flip and review, a rule for "weak inside the point" (the sim
  sweeps the tines from the wind-up pose, so a thrust lands from 0.4 m like the sword's), the shaft guard profile. Silhouette picked
  by the owner 2026-09-16 (`short`); A/B/C remain as `WEAPON_VARIANT` options.

## Cleaver v1 — the weapons lane — 2026-09-16
- Branch `weapons/cleaver-v1` (stacked on #80 trident + #81 Pitborn seam). The Pitborn's cleaver: "a fat scythe-type cleaver, wider and
  the same length as the longsword" (owner). A procedural single-edged loft (0.19 m belly toward a hooked tip, 0.20 m forward sweep, 615
  triangles, no textures; silhouette A picked by the owner 2026-09-17, B/C remain options) under `hand_r` as `WeaponDrawn` (contact = the edge .14–.86). It rides
  the **sword's clip family** — same 21 clips, same order; only `Heavy` is re-keyed on its rig as a diagonal hack so the edge leads
  (edge·motion .95 vs the sword's .68) — so the renderer needs nothing; `pitborn-cleaver.glb` is his own body carrying it, and the
  shipped `pitborn.glb` takes it with the build flag + one test relaxation (REQUESTS §5). Baked at 1.0× like his sword; at his real
  1.13× the chop reaches 1.85 and the whiff punisher goes 0/24 — the scale call is the combat lane's (REQUESTS §6). `build-warrior.mjs` takes a per-weapon `{ part, clips, keys }` table; default output byte-identical.
- ON THE SHELF (the lanes' split): `CLEAVER` is exported real data — the chop (17, chip .2), the back of the cleaver (the backhand leads
  with the spine: 9 dmg, posture 34 — a hammer), the hack (26, chip .5, posture 42), the poke (7) — but `WEAPONS.cleaver` still borrows the
  longsword and there is no manifest entry: the Pitborn is unchanged until the combat lane flips it (REQUESTS §5). Measured for that flip:
  with lunges equal to the sword's and the sword's reach convention, the Pitborn battery passes 4/24 normal · 6/24 hard with 6/24 stalls at a
  1.0× bake; at his 1.13× the whiff punisher goes 0/24 (REQUESTS §6). The whiff-punisher script now reads the warden's own weapon table.
- Evidence: tests/weapons.test.ts +3 (rig + clip set + edge segment; edge-leading per cut; reach and lunge parity with the sword),
  169/169; `artifacts/weapons/REPORT.md` (cleaver section), sheets under `artifacts/weapons/cleaver-v3/`, `cleaver-B/`, `cleaver-C/`.

## Knife v1 — the weapons lane — 2026-09-17
- Branch `weapons/knife-v1` (stacked on #86 goblin + #82 cleaver). The goblin's short hooked knife: a **sica** — forward grip, inward hook,
  double-edged over the hook so the backhand cuts — 943 triangles, no textures, a 0.42 m blade in his 0.81× hand; his own re-proportioned rig
  carries it (`src/assets/weapons/knife/goblin-knife.glb`) on the sword's clip family, only `Heavy` re-keyed (the diagonal hack). On the shelf:
  `KNIFE` exported (the character lane's proposed timings: wind-ups ≥ 12, feints ≈ 40 % of the wind-up, damage/cost below a sword's; the
  critical's cost 26 → 20), `WEAPONS.knife` still the placeholder, no manifest entry.
- Measured on his rig with the knife's timings: slash lands to 1.2 m, stab 1.45, hack 1.55 (a man's sword 1.7 / 2.0 / 2.2; his placeholder
  today swings the man's table). The character lane's reverse-grip suggestion rejected with numbers: on the sword's clips it never lands (0 m
  at every gap) — it would need its own clips. Owner picked A, the sica (2026-09-17); C stays an option (REQUESTS §11).
- Evidence: tests/weapons.test.ts +4 (193/193 on the merged tree), `artifacts/weapons/REPORT.md` (knife section), sheets `knife-v1/`,
  `knife-B/`, `knife-C/`, `goblin-baseline/`. Hand-off to the combat lane: REQUESTS §9–10.

## Estoc v1 — the weapons lane — 2026-09-17
- Branch `weapons/estoc-v1` from trunk 9d08824. The Nightborn's estoc: a long, thin, thrust-first square-section blade with no edge,
  black iron cross + side ring, wire grip — 1,252 triangles, no textures, contact = the last 40 cm (the point); his own rig carries it
  (`src/assets/weapons/estoc/nightborn-estoc.glb`) with EVERY clip byte-identical to nightborn.glb (nothing re-keyed). On the shelf:
  `ESTOC` exported (the sword's timings and lunges exactly; cuts weaker, no chip; the thrust stronger and chaining; the riposte his payoff;
  `fight.thrustShare .7`; material `'steel'`, a new word in `Material` for audio), `WEAPONS.estoc` still the placeholder, no manifest entry.
- Measured on his rig: the blade lands 0.30 m past the sword everywhere (thrust 2.35, cut 2.0, heavy 2.5); `reach` stays the sword's
  conservative numbers per his brief, the margin reported for combat review. Owner's pick pending: A estoc (default), B rapier cut, C long
  tuck (REQUESTS §14). Hand-off: REQUESTS §12–13. Tests: 224/224.

## Scythe v1 — the weapons lane — 2026-09-18
- Branch `weapons/scythe-v1` from trunk 7ee6e34. The Executioner's scythe (owner picked B over axe, 2026-09-18: the axe duplicated the
  Pitborn's cleaver): 1.32 m haft, 0.74 m blade, sweep .30, iron `#4c4946` — 495 triangles, no textures, contact = the head (1.22–1.32 m).
  His own 1.36× rig carries it (`src/assets/weapons/scythe/executioner-scythe.glb`) with a 13-clip `Scythe_*` family authored on it (the
  trident's two-hand grip solver, per-key blade roll so the crescent reads from the game camera). On the shelf: `SCYTHE` exported,
  `WEAPONS.scythe` still the placeholder, no manifest entry; the combat lane's flip is REQUESTS §15–17 and every part of it is a
  GAMEPLAY CHANGE (new timings, shaft guard profile, chip profile, the arc's dead band).
- Measured on the man-scale bake rig `warrior-scythe.glb` (the cleaver convention — his own 1.36× GLB bakes over a man's capsule and
  everything whiffs): reap lands 1.40–2.10 m, the headsman's high 2.30, the heel-jab 2.05; `reach` = the conservative spacing estimates
  1.8 / 2.0 / 1.8. The dead band is 1.40 m, not the brief's ~1 m — flagged for combat review. The bake caught and the rig test now pins:
  the striking segment must sit ON the target line at the clip's contact key (the first reap keyed it 0.7 m past the crossing and the
  whole active window whiffed).
- Evidence: tests/weapons.test.ts +4 (231/231 on the branch; shelf state, rig contract, contact-pose regression guard, data rules),
  `artifacts/weapons/scythe-notes.md`, sheets `scythe-A/`, `sche-B/…`, `scythe-C/`, `scythe-v1…v5/`, `executioner-baseline/`.
- 2026-09-18 (world lane): motes doubled 260 → 520 per owner live feedback ("motes are good. just double their number") after the
  half-size deploy (PR #123). Size stays 0.1 m, opacity 0.62, drift and gust unchanged — same specks, twice the air.
