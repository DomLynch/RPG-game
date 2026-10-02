# Stats, damage and defence — lane state

Lane opened 2026-09-22 on Dom's word ("yes for stats, if we're going to do it, let's do it properly"), brief 19
(`docs/briefs/gear-stats.md` on `origin/briefs/gear-stats`, PR #486, not yet merged). Worktree `~/Developer/frankendom-stats`,
reports to Lead; Strategy reviews every PR body before Lead merges.

## 2026-10-02 07:42 (+04) — HANDOFF before /clear (Stats, app worktree session). READ FIRST, then the 2026-10-01 entry below, then memory

1. **LIVE `51e092ae`** (phase 0B-swordplay) by my own curl of frankendom.com/release.json at 07:39. The deploy lock file `~/.claude/state/deploy_in_flight.json` was present at 07:39 and gone at 07:42, so a run had just finished or was finishing. Re-curl before quoting.
2. **Went live from this lane (verified by `gh pr view`, 2026-10-02):** #1229, #1234, #1236 (boss/class special spec and difficulty-curve docs), **#1235 (fallback table, head `7279488a`) MERGED**, **#1248 (the 10-01 state handoff, head `692430dc`) MERGED**. All docs-only. The special spec is Dom's: boss 25 % ranks 8-10, class 20 % ranks 1-7, one special per 20 s (first use 20 s), unblockable, not interruptible. Lead asked whether #1229 says this; it does (answered by message).
3. **NOT LIVE / open:** the post-beta tuning proposal (docs-only, no PR yet).
   - Part 2 (real-player win % SQL + beacon migration) is drafted on `origin/stats/post-beta-tuning-doc` @ `c298620a`, file `docs/briefs/post-beta-tuning-2026-10-01.md`. Still to add: privacy (no user id beyond what the beacon has, which is none), retention (delete rows older than 90 days), and one Dom-ask line ("OK to add these five columns to the beacon (opponent, level, outcome, mode, attempt) right after Saturday so the first week collects data?"), flagged post-beta.
   - Part 1 (per-opponent knobs): the first calibration agent died at the /clear without writing anything. A second background agent was started 2026-10-01 evening to resume from the finished baselines. By 07:36 it had produced `proposal.json` (104 KB) and `proposal_tables.md` (36 KB) in `/private/tmp/claude-501/scratch/tuning/`, run rounds r1-r9 and a `final` batch on the VPS, and 4 `tune/curve.ts` processes were still running at 07:40. Its final report had NOT arrived when I wrote this. **Do not trust the numbers until its summary lands or you have checked the tables yourself**; I have not read them.
4. **VPS cleanup is mine to verify:** `/tmp/stats-tune` on 49.12.7.18 holds 496 output files. It must be deleted when the agent is done: `ssh -i ~/.ssh/binance_futures_tool root@49.12.7.18 'rm -rf /tmp/stats-tune; ls -d /tmp/stats-tune'` (kill only my own `tune/curve.ts` pids first). Copy anything wanted from `/tmp/stats-tune/out` to the scratch dir BEFORE deleting; the scratch dir is also under /private/tmp, so copy the final `proposal.md`/`proposal_tables.md` into the PR (a data appendix under `docs/briefs/`) rather than leaving them only there.
5. **Sessions down:** none known.
6. **Rulings (memory):** `sims-vps-only` (Lead: sims on the VPS only, nice 19, at most 3 procs, delete the dir after), `specials-chain-2026-10-01`, `difficulty-curve-finding` (no tuning before Saturday 2026-10-03; sim frozen; proposal only), `stats-parked` (gear stats and D3 client-claims stay parked by `docs/SCOPE.md`).
7. **QUEUE:** (a) collect the agent's result into Part 1 of the tuning doc (check: mid-skill win within about +-10 of the pooled curve at every rank; nightborn/plaguedoctor/witch/veteran ramp with level; Nightborn and Plague Doctor differ; tap-attack L1 gate; no no-strategy bot over 80 %); (b) finish Part 2 (item 3); (c) delete the VPS dir (item 4); (d) ONE docs-only PR on base trunk, send Strategy the full head sha, do NOT merge (Deploy merges docs-only PRs head-pinned); (e) report to Lead.
8. **No crons.** This session's worktree: `/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/elastic-gates-c6edc0`, branch `stats/handoff-1002` (this entry only). The Mac was at load about 190 and the Stop quality gate deferred or timed out; that is load, not a failure. When Dom is home: reopen on `~/Developer/frankendom-stats` with the worktree switch off.

## 2026-10-01 — HANDOFF before /clear (Stats session 2c1c7e). READ FIRST, then memory

**Now:** the post-beta tuning proposal (Strategy's ask, docs-only) is half done. Part 1 (per-opponent knobs, sim-checked) is being produced by a background calibration agent (agent id `a03e5093848205381`, started 2026-10-01 ~16:50; brief: fit a few existing levers per opponent so mid-skill win is within about +-10 of the pooled curve at every rank, make nightborn/plaguedoctor/witch/veteran ramp with level, make Nightborn and Plague Doctor behave differently, run the tap-attack L1 gate and the no-strategy-over-80 % guard). Its files go to `/private/tmp/claude-501/scratch/tuning/` (`proposal.md`, `proposal.json`, harness) and it works in `/tmp/stats-tune` on the VPS 49.12.7.18 (it must delete it; VERIFY it is gone, `ssh -i ~/.ssh/binance_futures_tool root@49.12.7.18 'ls -d /tmp/stats-tune'`). If a /clear killed it, restart it from this paragraph (brief is in the session transcript; recreate it from Strategy's ask below). Part 2 (real-player win % SQL + beacon migration) is drafted in the repo on branch `stats/post-beta-tuning-doc` @ c298620a, file `docs/briefs/post-beta-tuning-2026-10-01.md` (WIP, no PR yet).
**Next:** (1) collect the agent's proposal into Part 1 of that file; (2) add to Part 2 the concrete beacon migration sketch Strategy asked for: the five columns (opponent, level, outcome, mode, attempt) on `perf_beacons` are already sketched, still to add: privacy (no user id beyond what the beacon already has, which is none), retention (suggest deleting rows older than 90 days), and a one-line Dom-ask ("OK to add these five columns to the beacon right after Saturday so the first week collects data?") flagged post-beta; (3) open one docs-only PR (base trunk), send Strategy the full head sha, do NOT merge (Deploy merges docs-only, no publish, head-pinned).

**Done today (all docs-only, no src change, sim frozen):**
- Boss special study (Strategy/Dom): harness `scripts/special-balance.ts` on `stats/special-balance` @ 841e2c1c (modes: none, `interrupt`, `poise`, `block`, `final`, `dom`, `class`, `fallback`, `curve`); results in `docs/briefs/specials/boss-special-balance-2026-10-01.md`. Final spec (Dom): boss 25 % (ranks 8-10), class 20 % (ranks 1-7), once every 20 s (first use 20 s), unblockable, NOT interruptible, 45-tick recovery (caster does not attack until the presentation ends); fallback 15 %/20 % every 30 s (measured: fires in only 10-48 % of fights, the cadence not the damage makes it rare). PRs #1229, #1234, #1236 merged; **#1235 (fallback table, head `7279488a7551d93441d3eb494e83e29dace4d8ac`, base trunk) is OPEN, Deploy merges it head-pinned after run BX; do not push to `stats/specials-fallback-table`.**
- Difficulty curve on the live sim (e2e70ab1), `docs/briefs/difficulty-curve-2026-10-01.md` (#1236): pooled curve flat after rank 3 (mid-skill 31-35 %, mastery 71-76 %); the OPPONENT sets the difficulty (mid-skill bot: dwarf, executioner, knight, pitborn 1-9 % at every rank from 2, goblin/nightborn/plaguedoctor/witch 50-77 %); nightborn and plaguedoctor are sim-identical (Plague Doctor row is a copy of the Nightborn's); executioner and knight ramp, nightborn/plaguedoctor/witch/veteran/shieldmaiden do not. Strategy ruling: no tuning before Saturday, the sim stays frozen for the beta.
- Real-player data question: the hosted DB (project "Frankendom Origins", id rxbewmzmovelckzoosss) cannot give a win %: it never stores a lost attempt (`loot_claims` wins only, `fight_records` self-selected shares, `daily_results` empty, `perf_beacons` has no opponent/level/outcome). The fix is five columns on the existing beacon (Part 2 draft).

**Open:** #1235 (above); the tuning proposal (above); the VPS dir check; the Dom-ask for the beacon columns. Gear stats (Brief 19) and D3 client-claims stay PARKED by `docs/SCOPE.md`.

**Rulings and rules:** sims run on the VPS ONLY (Lead 2026-10-01: the Mac belongs to Deploy and short tests): `nice -n 19`, at most 3 processes, work in `/tmp/stats-<x>` and delete it after, ship with `tar | ssh`. Never merge; Deploy merges docs-only PRs. Do not push to a PR branch Deploy is holding. The stop-hook audit (claude-opus) failed on a weekly limit until 2026-10-05 23:00 Dubai; a reviewer once flagged a stale status check, so re-verify a PR's state with `gh pr view` right before reporting it.

**Gotchas (cost real time):**
- The curve harness imports the sim from whichever tree it sits in: stage the LIVE revision's `src/` (`git archive <rev> src tests/strategies.ts package.json`) plus the script, not your branch's src.
- `profileAt`/`opponentAt` cache by `${id}:${level}` and key POISE_FULL_AT/LOADOUT_FROM on the id, so a tuned variant of the same opponent id cannot share a process and must not rename the id; re-implement the blend instead.
- zsh: `$T:src/x` is a history modifier (use `${T}:src`); an unquoted heredoc executes backticks in the text (quote the delimiter); macOS `sed -i ''`; no `timeout`; `ssh ... tar xf` prints harmless xattr warnings; the `.mts` imports need absolute paths.
- A mid-skill bot is a parry script: its per-opponent numbers mean "a player who answers swings with parries", not a person.

## 2026-09-30 16:18 (+04) — HANDOFF before /clear. READ FIRST, then "Now (2026-09-27 night)" below, then memory

1. **LIVE `3fab84c4`** by my own curl of frankendom.com/release.json at 16:18. The deploy lock (`~/.claude/state/deploy_in_flight.json`,
   `scripts/deploy.sh:8`) was PRESENT at 16:22: phase "run BC gate+merge+deploy", tree `f033fdea`, started 16:16:28. A run is in flight.
2. **Went live (merged 2026-09-28 00:05–01:06 +04, verified in `3fab84c4` by `git merge-base --is-ancestor`):** the legends check is done.
   - #933: the Dwarf and Shieldmaiden rows are corrected, and a pronoun check is added.
   - #935 (head `bb151392`): the living-scripture check, with the known-fail list EMPTY after #930 and #936 swapped the last four rows.
     Local `node --test tests/legends.test.ts` passed 4 of 4.
   - #957 (Centurion ladder) and #959 (Executioner's Redcap, Count Dracula, Goibniu) passed the scripture scan before merge, 0 of 100.
3. **NOT LIVE:** nothing from this lane is open. Gear stats (Brief 19, #707) and the D3 client-claims PR stay PARKED by `docs/SCOPE.md`
   (#729) until Lead reopens them.
4. **Sessions down:** none known to this lane.
5. **Rulings (in memory):** Lead said push #935 on the node scan and let CI cover it (`legends-work`). #957 lands before #959 because
   of their GAME_SPEC.md conflict (done). Deadlines are NOW or ASAP only (`deadlines-now-or-asap`). The stop gate lints the Desktop
   checkout, so don't `npm install` there (`stop-gate-worktree-bug`).
6. **QUEUE:** empty. Ask Lead for the next task. Any new legends row must pass `tests/legends.test.ts`: no living-scripture source,
   and each opponent keeps its pronoun at every rung (e.g. the Dwarf is he, the Shieldmaiden she).
7. **No crons.** Worktree `~/Developer/frankendom-stats`, and this entry is on branch `docs/stats-handoff-0930`. Memory to read first:
   `legends-work`, `deadlines-now-or-asap`, `stop-gate-worktree-bug`, `stats-parked`.

## Gotcha worth reading before anything else

**A mutation probe must prove its own mutation landed, or its result means nothing.** Twice today a probe reported a clean pass while
doing nothing. First: `perl -pi -e 's/(levelOf(tier) - 1)/levelOf(tier)/'` — perl read the parentheses as capture groups, substituted
nothing, and 0 failures read as "the tests do not guard the ramp". They do; 9 of 15 fail. Second, worse because it was in the test
itself: the float-drift test derived its "naive" expression as `1 - CAPS.res`, which is `0.19999999999999996` and therefore a *third*
expression rather than the natural one — so it passed against a module that used the naive form, because the two wrong answers
disagreed with each other. Only the mutation proof caught it, and only because swapping the module to the naive form failed nothing.

Both were caught on implausibility, not from the output. The probe now asserts the source actually changed before running the suite.

## Now (2026-09-27 night): legends work for Lead. READ FIRST before a restart

Gear stats stay parked. Lead gave this lane the legends check (text and the legends test only):
- **#933** `stats/legends-check`, head `6f9eb5d7`, READY. Dwarf and Shieldmaiden rows checked: Brokkr (Loki staked his head), Alvis
  (Thor's questions, not riddles), Tomyris sourced to Herodotus (plus the GAME_SPEC.md table cell). Adds a pronoun pin (Dwarf he,
  Shieldmaiden she), mutation-proved.
- **#935** `stats/legends-rules`, head `688bf3b7`. `LIVING_SCRIPTURE` blocklist test; `SCRIPTURE_KNOWN_FAIL` names Goliath, The Reaper,
  Pestilence and Witch of Endor, checked both ways so it can only shrink. Also the hand-review comment for living named-people folk heroes.
- **NEXT, on Lead's ping:** batch order is #930 (the Reaper's source) → #936 (Multi Chars' swaps: Gogmagog, Resheph, Mother Shipton,
  Reynard) → #935 LAST. After both merge, rebase #935 and EMPTY `SCRIPTURE_KNOWN_FAIL`, run `node --test tests/legends.test.ts`, push,
  and send Lead the head.
- **Stop-gate gotcha:** the Stop quality gate lints `~/Desktop/Business/frankendom` (this worktree's git common dir; stale, no
  node_modules) even when the payload cwd is this worktree. Reported to the hooks session. Don't `npm install` there. Proof of this lane's
  work is eslint plus the single test file here, and PR CI.

## Now (2026-09-27): PARKED; deadlines are NOW or ASAP

**Standing rule (Dom, 2026-09-27, relayed by Strategy to every lane):** "dont set fake extended deadlines or times, everything is NOW
or ASAP." The only deadline this lane gives Dom, Lead or Strategy is NOW or ASAP. If today is physically impossible, name the physical
blocker (a battery still running with its minutes left, a red gate, the box busy, an HF quota), never a day or a clock time.

**The lane is parked.** Dom's SCOPE rewrite (`docs/SCOPE.md`, #729, 2026-09-25) parks gear stats (Brief 19) and gear damage/defence
until after Origin. #707 is closed with the `parked` label (branch kept at `9ddf6801`); `src/gear-stats.ts` is imported only by its
test, so no fight number on trunk depends on it. D3: #539, #551 and #554 are merged; the client-claims PR below is the next Stats item
**only if Lead reopens the lane**, and the apply stays held for Lead. Phase L went to World #705. No open Stats PRs.

## Then (2026-09-23 ~10:30Z)

**Deliverable 3, server-authoritative awards: #539 MERGED, sweep #551 READY, apply HELD.** Start with the client-claims PR.

- **#539 MERGED** (`0a81d8c`, head `be58866`, OK from Lead and Backend). Migration `202609230001`:
  - `account_seed` is written once at apply by `insert … select` from `fighter_profiles`.
  - `loot_claims`: global unique `record_hash`; 16 KB records; 60 an hour enforced by a BEFORE INSERT **row trigger** (Backend [B1]: a STABLE policy function let one bulk insert pass the cap).
  - `awards` has no `user_id`; a trigger refuses unverified claims, and a verified claim stays verified.
  - `standing_of` / `my_standing` = seed + verified claims, seed.owned ∪ awards.
  - `src/awards.ts` `awardFor`: the award is the **claimed piece, armour or weapon** (Strategy's any-piece ruling, SCOPE.md Loot v2). It must be in `kitAt(opponent, tierAt(server marks before the win))`. `dropFor` no longer decides the award.
  - `WORN_FROM` (the kit floor) is **data** in `src/loot.ts` (Lead's condition). It's empty = every piece worn from Recruit, Strategy's beta answer; the values are Multi Chars', post-beta.
- **#551 READY** (head `66e798f`, OK from Lead and Backend), merging after Publish B. `scripts/verify-loot.mjs` is the VPS sweep, run as `frankendom_verifier` over `DATABASE_URL`.
  - **[B4] The win is proven from the record:** claimed opponent, outcome `killed`, and a `verifyRecord` replay. Any throw is a refusal with a `note`, never a skip.
  - **[B2] Lead's ruling:** a proven win is ALWAYS a mark. An off-kit piece gets no award, and the reason goes in `loot_claims.note`, which only the verifier can read or write.
  - **[B3]:** `standing_of(account, before_claim)` counts only claims earlier by `(created_at, id)`, with one signature. A claim waits while an earlier claim from its account is unchecked.
  - It amends the unapplied `202609230001` in place. Backend checked `list_migrations` on hosted: it stops at `202609220010`.
  - `scripts/awards-database-check.mjs` drives the REAL sweep over replayed records: a Goblin kill (easy, seed 1, a walk-in with an attack every 45 ticks) and a Veteran loss. Mutation probes: 27/27 caught.
- **#554 draft**, stacked on #551: Backend's N1–N3 (an error settling one claim goes into `errors` and the sweep continues; a loss unit case; the recheck caveat documented). **Retarget to trunk and run the gate once #551 merges.** Lead requires it BEFORE the apply.
- **NEXT: the client-claims PR (Stats).**
  - Post a claim with the chosen slot for every ladder win, before Share is offered.
  - Build the kill-screen offer from `my_standing()`, not cached marks (Backend B2).
  - Add Strategy's line to SCOPE.md Loot v2: "the Recruit floor is the beta answer; WORN_FROM post-beta".
  - The flow and copy don't change. Backend reviews it.
- **APPLY HELD.** Lead orders it only after the client PR and #554 are in. It ships in ONE publish: the apply, a VPS timer unit for `verify-loot.mjs`, and the client PR. Applying early loses every win between the apply and the client switching over. The post-apply receipt is non-identifying: `select count(*), sum(marks), sum(jsonb_array_length(owned)) from public.account_seed`.
- **Still open (not Stats):** records aren't bound to an account (Lead's item: an opaque token in the record, which is PR B's format change).

**Window 1:** #528 (PR A v2) goes first, then #530 (Combat's knife v6). PR B stacks on #530: the loadout tail, the version guard, the v6 fixture rewrite, the opaque account token. It must keep Web's `peekRecordHeader` (added to `src/record.ts` on top of #528) working.

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
