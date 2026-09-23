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

## Now (2026-09-23 ~07:15Z)

**Deliverable 3, server-authoritative awards: UNBLOCKED. Strategy ruled (relayed by Backend, 2026-09-23 ~07:30Z). This is the next
build; start here.**

Strategy's ruling:
- **(a): marks are server-authoritative.** Every verified ladder win is one server mark. Drop, tier and rank come from verified data.
  `victory_marks` and `owned` are caches. (c) isn't needed.
- **Grandfather, don't reset.** A new `account_seed(user_id uuid pk references auth.users, marks int check 0..100000, owned jsonb,
  seeded_at)`, **written only by this migration** with `insert … select` from `fighter_profiles` at apply time. **Never hardcode** a
  real uuid or loot in git. RLS on, no client grant (owner-select only if the client needs it). One-off by construction: no function or
  grant can re-run it. The post-apply receipt is a non-identifying summary ("1 account seeded, marks N, K pieces").
- Server marks = `seed.marks + count(verified ladder wins)`. Server owned = `seed.owned ∪ awards`. **`awards` stays pure**: every row is
  backed by a verified record, and no claims are faked for the seed.
- **Guests:** loot is a device-only cache with no award. On guest→account the cache carries over as device-only cosmetics, and the
  account's server marks **start at 0 from its first verified win**, so a forged guest cache never becomes rank.
- The PR goes through **Lead**, with the migration and the tests. **Poster binding is NOT in this migration.** It's PR B's
  record-format change (account id in the bytes, the verifier compares `record.owner` to `claim.user_id`), Lead's item. Interim: global
  unique hash plus claiming before Share.
- **Four more tests (Strategy), each mutation-tested with the probe first proving its mutation landed:** (1) seed: a fixture profile →
  seeded exactly those, once; (2) verified win: server marks = seed + 1, and the drop = `dropFor` at the server subRank; (3) guest convert:
  no seed row → marks 0, then 1 after the first verified win; (4) forged cache: the client writes `victory_marks = 100000` and an Origin
  piece into `fighter_profiles.loot` → server marks and owned unchanged.

The design below (agreed with Backend) still holds.
Backend's review, accepted in full:
- Two tables. `loot_claims`: owner insert, unverified, unique on `sha256(record)` **globally** (one award per fight), size and rate
  caps. `awards(claim_id pk references loot_claims(id), piece, tier, awarded_at)` with **no `user_id`**: owner-select goes through the
  join, and the verifier gets only `insert (claim_id, piece, tier)`, plus a trigger that refuses unverified claims. There's no column to
  redirect an award with, so a leaked verifier credential can't mint loot for another account.
- Armour claims carry **no piece**. The verifier computes it with `dropFor` (`src/loot.ts`). `piece` is only for the "Take one"
  weapon choice, checked by importing `src/loot.ts`, never a LOOT mirror in SQL.
- **Marks: option (a).** The verified-claim ledger *is* the mark ledger (server marks = count of verified wins), so `victory_marks`
  and `owned` both become caches computed from verified data. The client posts a claim for **every** ladder win, before Share is offered.
  **(b), "rung in the record", does NOT close the hole until deliverable 5**: a wrong rung replays a different fight only once the sim
  reads the tier. That was my error, and Backend caught it.
- **Waiting on Strategy/Dom:** whether existing marks and `owned` are grandfathered or reset (live has ~1 `fighter_profiles` row).
  Also for Strategy/Lead: record-to-account binding (B can claim A's shared kill; the same hole is in `daily_results` today, ticket
  it), and guests holding no awards.
- Backend's DB-check list is the acceptance criteria, every item mutation-tested: client can't write `awards` or flip a claim's
  `verified`; verifier can't award a nonexistent claim or award twice; owner sees only their own awards, anon sees none; duplicate
  record hash refused; caps trip.
- Branch `stats/server-awards` exists off trunk, empty.

**Open PRs:**
- **#528**: PR A v2, READY, head `e3bd67f`. Held for **Window 1**: it publishes together with Combat's knife (bump to 6,
  `READABLE_VERSIONS` `[5]`→`[6]` as a *replacement*) and PR B. Never split the window: a knife-first publish would mint tail-less v6
  links that PR B can't read.
- **#514**: kit resolver, retargeted to trunk (head `8e07865`), local gate 496/494/0/2. Its `quality`/`base`/`browser` jobs were
  cancelled by `cancel-on-close` racing my close-and-reopen. The runs were re-run directly (`gh run rerun`). The READY line goes to
  Deploy when they're green.
- **#523** (tier-table re-land, `Shield: 0`) is **merged**, trunk `5c19f8b`. #503 is closed, superseded by #528.

**PR B** (next after Window 1 is agreed): encoder + loadout tail at v6 on top of the knife, the real parsed-version guard (v5 bytes on
a v6 build decode to `v === 5` and throw on repack; the PR A assertion is vacuous until then), and re-writing the knife's v6 replay
fixtures.

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
     15/20 because the brackets are built on them and 10 is barely felt on a 150-health fight.
     **Correction, and it is in the brief too: changing a cap is TWO edits, not "one number in `CAPS`".** Addendum C says one;
     this lane told Strategy the same; both are wrong about the implementation. `multipliers()` carries the integer coefficients
     15 and 20 as literals and cannot derive them from `CAPS`, because doing so in floats gives 14.999999999999991 and
     19.999999999999996 — the exact drift this module exists to avoid. So `CAPS` and the coefficients are two facts that must
     agree. They cannot silently disagree: editing `CAPS` alone fails five tests (mutation-proved against Dom's floated
     +10/+10), one of which now states the rule outright. Still minutes of work — but two edits and a snapshot re-pin, and
     whoever does it should be told that rather than discover it as five failures.
  2. **Speed fixed per weapon.** No speed stat, no tier touches any timing.
  3. **Shield = option (b)**, guard profile only. Dom's earlier −20 % incoming is **withdrawn**. Combat builds the shield brief
     as written and nothing else.
- **DISPLAY FORMAT — final, from Strategy 2026-09-23 after Web was told. Two shapes, and they differ:**
  - **Paperdoll totals: unsigned**, `ATK 15 · RES 20` — what the whole worn kit is worth.
  - **Kill-screen take delta: signed, one token**, `+6 ATK` or `+4 RES` — what the piece in front of you would add.
  Note the take delta is `+4 RES` *positive* even though RES is a damage multiplier that goes **down**: the player reads "more
  resistance", not "a smaller multiplier". Deliverable 4 supplies both numbers; Web owns the copy and skin. This supersedes the
  earlier `+3 DEF +2 POI` and the intermediate whole-points-everywhere reading.
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

- **Background gate loops walk past the one-deployer lock.** The lock is enforced by the session's PreToolUse hook, not by npm. A
  Monitor that "retries while its own log mentions the lock" never sees the lock and runs immediately. Two suites ran through deploy
  `2d614dc` that way, and one flaked `tests/release-checks.test.ts:73` (a 2 s timing test) under the load. Probe the lock with a
  light hooked call first.
- **Retargeting a PR's base does not trigger `quality.yml`** (pull_request opened/synchronize/reopened only). **Close-and-reopen doesn't
  work either**: `cancel-on-close.yml` cancels whatever the reopen starts. Use `gh run rerun <id>` on the cancelled runs.
- **A merge into a reverted branch brings nothing back.** Re-landing reverted work means `git revert <the revert>` on a fresh branch.
- **Resolving an append/append conflict by slicing can drop the shared closing `});`.** Parse the file before trusting the resolution.

- **After fast-forwarding onto trunk `fe0d8e0` or later, run `npm ci` before the gate.** This worktree's `node_modules` is the
  2026-09-17 install, and `quality:stop` fails on a missing `@types/node` against the newer trunk — a stale install, not a breakage
  (World hit it first; their gate went green straight after the `npm ci`). Relevant the moment PR B rebases.

- **RESOLVED 2026-09-22 (was: trunk becec83 does not compile).** World's #485 landed: trunk is now `cb8ff5b`, `src/arena.ts` is byte-identical between it and this lane, and `npx tsc --noEmit` is clean. Kept below for the receipt shape, not as a live warning.
- **Trunk becec83 did not compile, and the red was not ours.** `src/arena.ts:446` reads `get guards() { return
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
