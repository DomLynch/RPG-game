# Stats, damage and defence — lane state

Lane opened 2026-09-22 on Dom's word ("yes for stats, if we're going to do it, let's do it properly"), brief 19
(`docs/briefs/gear-stats.md` on `origin/briefs/gear-stats`, PR #486, not yet merged). Worktree `~/Developer/frankendom-stats`,
reports to Lead; Strategy reviews every PR body before Lead merges.

## Gotcha worth reading before anything else

**A mutation probe must prove its own mutation landed, or its result means nothing.** Twice today a probe reported a clean pass while
doing nothing. First: `perl -pi -e 's/(levelOf(tier) - 1)/levelOf(tier)/'` — perl read the parentheses as capture groups, substituted
nothing, and 0 failures read as "the tests do not guard the ramp". They do; 9 of 15 fail. Second, worse because it was in the test
itself: the float-drift test derived its "naive" expression as `1 - CAPS.res`, which is `0.19999999999999996` and therefore a *third*
expression rather than the natural one — so it passed against a module that used the naive form, because the two wrong answers
disagreed with each other. Only the mutation proof caught it, and only because swapping the module to the naive form failed nothing.

Both were caught on implausibility, not from the output. The probe now asserts the source actually changed before running the suite.

## Now

Deliverable 2 — the loadout in the fight record — settled with Lead and Strategy and split into two PRs that ship on **different
deploys**:

- **PR A**: `unpackRecord` returns the version it actually parsed (today `src/record.ts:127` returns the constant, so a decode-then-
  repack would silently upgrade a v5 record; `packRecord`'s existing guard at `:73` then turns that into a loud throw). Plus the
  widened accept-list, pinned as **data beside `SIM_DIGEST`**. Re-pins `SIM_DIGEST` **without a bump** under the #439 precedent, with a
  behaviour-unchanged receipt from `scripts/record-replay-check.mjs`.
- **PR B**: bumps `RECORD_VERSION` to 6, signed by name in the pin, carrying the encoder and the loadout tail.

**PR A is a server change, not a client one.** `scripts/verify-daily.mjs:12-13` imports `decodeRecord` from `src/record.ts` and
`deploy.sh` rsyncs `src/**/*.ts` to the verifier host, so the deploy carrying PR A replaces the verifier's decoder too. One accept-list,
executed on both sides — there is no second list in SQL (`mint_share` treats the record as opaque base64url).

Before starting, rebase `stats/lane` onto a trunk where `src/arena.ts` compiles (see Gotchas).

## Done today

**2026-09-22 — Deliverable 1, the tier stat table (`src/gear-stats.ts`, `tests/gear-stats.test.ts`). Data and tests only; no sim
change, and `src/loot.ts`'s "visual cosmetics only, no stats" header still stands.**

**Two stats, not four.** The first cut had gear carrying Attack, Defence, Poise and Stamina. Brief 19 was revised at 22:40 to sit under
`docs/progression-direction.md` (owner, 2026-09-19), which puts POISE, health (VIG) and stamina (END/DEX) in the **Origin character
layer** and has the heavy armour classes *costing* stamina economy rather than granting it — the armour line there says in as many
words that armour does not add POISE. So the gear layer carries **Attack and RES** and nothing else, and a shipped four-stat table
would have contradicted the character layer before either existed. There is now a test asserting the key set, because a third column
here is a layer boundary being crossed, not a table being extended.

One number per tier per slot, as the brief asks. The number is a slot's **coverage weight** (Helmet 20, Body 30, Greaves 18,
Arms 12, Boots 12, Gloves 8, Crest 0 — summing to 100), scaled by the tier's place on the ladder *above the bottom rung*:
`(levelOf − 1) / 9`. A full set at Origin is therefore exactly 900 points, and the four multipliers are integer divisions of it:

| stat | from | formula | naked | full Origin |
|---|---|---|---|---|
| Attack | the one weapon slot | `(90000 + 15·p) / 90000` | 1 | **1.15** |
| RES | the six wearing armour slots | `(90000 − 20·p) / 90000` | 1 | **0.80** |

Both scale damage — Attack what you deal, RES what you take, chip included. **Neither touches posture (`shake`) or any timing**: a
longsword tell is a longsword tell at every tier, which is the progression-direction rule and the reason nothing here is a duration.

Because every cap is a whole set rather than a fitted constant, the Origin row is *exactly* on the caps — and **both** ends of the
ladder are exactly the identity: no gear, and a full Recruit set. Strict equality throughout, not a tolerance.

**A full Recruit set carries nothing** (Strategy, 2026-09-22, overturning this lane's first cut, which had rags at a tenth of a cap,
and Lead's first reading, which agreed with the first cut). Brief 14's Recruit is rag & scrap on 2 of 6 slots — salvage, not armour —
and the naked bracket is only a real guarantee if the new player actually standing in rags is inside it. Legionary leather is the
first tilt in the game.

Numbers re-derived here rather than inherited: the six slot weights are this lane's, invented for this table and defensible only
as coverage judgement. The linear ramp was this lane's too; its zero point is Strategy's. The four caps, the ten tiers and the six
armour slots came from brief 19 and Brief 14 and were each checked against the code — `TIERS = career.ts TITLES`
(`src/grades.ts:14`), ten rungs with Origin at level 10, and `ARMOUR_SLOTS` at `src/loot.ts:10` carrying **seven** entries, Crest
included.

15 tests, all passing; full suite 481 pass / 0 fail. Mutation-proved rather than merely green — each probe asserts its own mutation
landed before the suite runs (see the gotcha at the top of this file):

| mutation | tests that fail |
|---|---|
| Helmet weight 20 → 21 | 8 |
| Crest 0 → 1 | 9 |
| ramp `(levelOf − 1)` → `levelOf` | 9 |
| RES written as the naive float | 1 |
| RES coefficient 20 → 21 | 6 |
| Attack coefficient 15 → 20 | 5 |
| gear layer regains a `poise` value | 6 |

## Open

- **A piece has no tier yet, so nothing can resolve a real player's kit.** `LootId` is `<opponent>.<slot>` with no tier in it,
  and `GradeRecord` (`src/grades.ts:74`) is declared but `OPPONENTS` carries no `grade` field on becec83 — `grep -n
  "grade\|tier" src/roster.ts` returns nothing. Deliverable 1's API therefore takes `(tier, slot)` pairs directly. **Lead owns
  landing the grade record onto OPPONENTS**; until then this table is data with no caller, which is what deliverable 1 should be.
- **Resolved and now moot: the Defence/Poise shared-total question.** Raised as a design cost of "one number per tier per slot",
  ruled keep-for-beta, then evaporated entirely when Poise left the gear layer. The hedge it prompted — deriving every multiplier
  inside one private `multipliers()` function — is what made the four-stats-to-two cut a small edit instead of a rewrite, and is the
  same seam the Origin character layer will extend through.
- **Settled: the bottom rung is the zero point.** Flagged as a design claim rather than buried in arithmetic, argued, and
  overturned within the hour — which is the whole value of separating the two. The ramp is `(level − 1) / 9`.
- **SETTLED by Dom, 2026-09-23 00:45 — Brief 19 Addendum C** (`docs/briefs/gear-stats.md`, verified at source on
  `origin/briefs/gear-stats`, not taken from the relay). Three decisions, all matching what this lane proposed in #491:
  1. **One Attack multiplier for every weapon**, ramped by tier exactly as `src/gear-stats.ts` does it — nothing at Recruit, one
     step per tier, the cap at Origin. Grip is not a balance axis. **Caps stay 1.15 / 0.80**: Dom floated +10/+10, Strategy kept
     15/20 because the brackets are built on them and 10 is barely felt on a 150-health fight. Changing either is one number in
     `CAPS`, and the addendum says so explicitly — so treat a future "make it 10" as a one-line edit, not a redesign.
  2. **Speed fixed per weapon.** No speed stat, no tier touches any timing.
  3. **Shield = option (b)**, guard profile only. Dom's earlier −20 % incoming is **withdrawn**. Combat builds the shield brief
     as written and nothing else.
- **DISPLAY FORMAT CHANGED, and deliverable 4 must use the new one.** Addendum C: whole points, not multipliers — an Origin
  weapon reads **`+15 ATK`**, a full Origin armour set reads **`20 RES`** (note: no sign on RES), each piece its slot's share.
  This **supersedes** the `+6 ATK` / `-4 RES` signed-delta shape relayed from Web earlier on 2026-09-22. Web has not been told;
  the next session owes them that line before building the panel half of deliverable 4.
- **CLOSED, no action: the two findings this lane raised in #491.** Both were settled as design rather than defects, and the
  reasons are worth keeping because they answer the questions rather than dismissing them. The cleaver's asymmetric light
  (`light_right` 17, `light_left` 9) is **the back of the blade — blunt, half damage, by design**. And RES multiplying block
  chip means armour is worth more against heavy hitters, **which is armour doing its job**; the 2.5× chip spread is the
  intended texture, not an undesigned interaction. Do not re-raise either.
- Superseded, kept for the trail — this was logged as an open question routed to Combat and Weapons by Lead (2026-09-22): heavy chip
  varies 2.5× across weapons, so the gear layer's value silently depends on which opponent you face.** Heavy `chip` — the
  fraction that passes through an ordinary block — is knife 0.2, estoc 0.25, warhammer 0.3, longsword 0.4, and cleaver, trident
  and scythe all 0.5 (read from `src/moves.ts`, trunk 3405a95). Brief 19 has RES multiply damage taken *including* chip, so a
  player's RES is worth two and a half times more against a trident than against a knife. Nobody designed that interaction.
  It matters for sequencing, not just for tidiness: discovering it after the multiplier seam ships means re-measuring the
  ladder twice. Neither lane can act until its queue clears, so this file is the record.
- Parked as an observation, not a defect (Lead, 2026-09-22): the cleaver's light attacks are asymmetric — `light_right` 17,
  `light_left` 9 — and it is the only player weapon where the two differ. Possibly deliberate character for a butcher's weapon.
  Note it, don't chase it. It does mean any Attack argument quoting "the cleaver's light" is ambiguous and must say which.
- Deliverable 5 (the seam in `src/duel.ts`, opponents wearing their tier, the ladder retune) is **blocked by Lead** behind
  Combat's queue: knife approach fix, Executioner profile, Nightborn retune, shield rule. Stats never jumps the four weapons.
- Deliverable 3 (server-authoritative awards) needs Backend's review and Deploy's apply; loot stays cosmetic in play until it lands.
- Format constraint received from Web via Strategy for deliverable 4: the loot card has five 56 px tiles in one row at 375 px
  with no room inside a tile, so the take's delta gets its own line as short signed values per stat (`+3 DEF  +2 POI`), not a
  sentence.

## Gotchas

- **Trunk becec83 does not compile, and the red is not yours.** `src/arena.ts:446` reads `get guards() { return
  lorarii.standing; }` after #467 deleted the lorarii, so `npx tsc --noEmit`, `npm run build` and `npm run quality:stop` all
  fail with `TS2304: Cannot find name 'lorarii'`. Four lanes had already re-diagnosed it before this lane opened. World's #485
  is the one-line fix. Do not spend a minute on it; do not trust a local gate until it lands.
  Receipt that it is the *only* break: both `npx tsc --noEmit` and `npm run typecheck:tests` return that single error and
  nothing else, and with the line locally stubbed to `get guards() { return { built: 0, of: 0 }; }` — a throwaway probe,
  reverted, `git status --porcelain src/arena.ts` empty afterwards — both come back completely clean.
- **Never write a multiplier as the obvious float.** `1 − 0.2 · 288/900` is `0.9359999999999999`; `(90000 − 20·288)/90000` is
  `0.936`. 68 of the 901 reachable armour totals drift this way, and a Veteran set with Gladiator arms is one of them. This is not pedantry borrowed from a doc — the first version of the mixed-kit test was written the naive way and
  failed against the module, which is why `tests/gear-stats.test.ts` now pins both forms. A paperdoll rounds it away; a
  1500-tick fight does not, and that is what the arm64/x64 digest rule exists to stop.
- `src/gear-stats.ts` is deliberately **not** in `eslint.config.js`'s `SIM` list and never needs to be. The sim takes a
  `Loadout` — the four resolved numbers — and never sees a tier, a slot or a table, which keeps `src/duel.ts` free of any
  import of `loot.ts` or `grades.ts` that `tests/sim-boundary.test.ts` would refuse.
- A zero-weight slot and an omitted slot behave identically today and diverge the moment the slot carries something: the
  omission silently under-weights every set while the total quietly stops being 100. Hence `Crest: 0` as an explicit row, with
  a test that says so.
- **Two weapon-table values are wrong on trunk, and deliverable 5's multipliers land on top of them.** A multiplier over a wrong
  base is a wrong result that looks derived, so both are recorded here rather than left in a proposal.
  - `TRIDENT.grip` reads `'one-hand'`; it should be `'two-hand'` (#472, open). Evidence in the file, not recollection: of the
    five `guard: 'shaft'` weapons the trident is the only one not two-hand (scythe, maul, reaper, warhammer all are), and its
    `guardProfile` is character-for-character identical to the scythe's and the warhammer's.
  - `ESTOC` reach on trunk is the sword's spacing estimate; the measured frontier is sword + 0.30 m = **2.30 m**, and that
    correction lives only on #419, parked at `ad928ec` pending a battery re-measure after Combat's approach fix.
  - Everything else in the weapon tables is current, including the knife's thrust recovery of 20 and the scythe's heel-jab
    recovery of 30 (both #440). Verified by running `src/moves.ts`, not by reading a brief.
- **Reading a live table faithfully is not the same as being right.** A proposal that quotes trunk verbatim is accurate about
  the file and wrong about the weapons — the same shape as the float-drift test above, where a faithful reading of the wrong
  expression passed. Read the table, then ask the owning lane which entries are known wrong and where the correction lives.
- The worktree ships without `node_modules`; `npm ci` first or every gate reports the tools as missing rather than as failing.
- **A mutation probe must prove its own mutation landed.** `perl -pi -e` with parentheses in the pattern silently matches nothing
  and the suite then passes for the wrong reason. Assert the source changed, then run.
