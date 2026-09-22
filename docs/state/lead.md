# Lead — project state

Entries moved verbatim from the root PROJECT_STATE.md on 2026-09-21 (state split). Append new entries at the TOP. Keep evidence and remaining validation in every entry (AGENTS.md).

## Lead handoff — 2026-09-23 00:30 (context restart)
**Now.** Nothing of mine is mid-flight. The merge queue is no longer Lead's — Dom moved it to Deploy tonight, and Strategy
has briefed the lanes directly with deadlines while this session clears, reverting to lanes -> Lead afterwards. Two of my
PRs are open and unmerged: **#499** (AGENTS.md, the outline-not-build briefing standard) and the state doc you are reading.

**Done tonight.**
- **#471** amended twice. `f6af593`: the brief said cleaver in three places and rested "zero new animation authoring" on the
  Pitborn's `Cleaver_*` set, which the bearded-axe amendment removes — it was understating its own cost. `099c24d`: new §5a
  naming her six takeable pieces against direction A, with `Helmet` and `Gloves` recorded as **open proposals awaiting Dom**
  because A is bare-headed and bare-handed. Pitborn and the Executioner lane both flagged the cleaver independently.
- **#499**, new AGENTS.md bullet, corrected three times as the lanes measured it properly. Character briefs specify
  **outline, not build**; an approved reference is a **direction, not a render**; every brief **names all six** takeable
  pieces (naming is not authoring — build order stays Recruit-2 first, and SCOPE.md's launch bar already says the six are
  scheduled, not optional). Plus the two measurement rules the lanes paid for: a background gate certifies the backdrop and
  **not the cut** (cut the mask from an unlit plate, `--flat`, #500), and **never upscale a short mask** to the comparison
  height — that invents edge detail on one side of the pair only, a bias rather than noise.
- Rulings taken: the **estoc's brief does not change** (thrust recovery is not a lever; the trident row goes to Combat as a
  Nightborn-profile item); **Stats' PR B carries the single bump to 6**, Weapons rides it, rule is whoever is ready first;
  **Greaves before Helmet**; the **paperdoll keeps `ATK 0 · RES 0`** on a bare fighter; the **opponent -> tier mapping is
  Multi Chars'**, the resolver is Stats', a piece with no tier resolves to exactly 1.00.
- Owner briefs sent to every active lane and the per-item owner/next-PR/ETA lines returned to Strategy.

**Open.**
- **Brief 14 is mine and barely started.** `src/grades.ts` already exists on trunk and already declares
  `GradeRecord = { level, tier, kit: LootId[], epithet, house }` at :74 — the remaining work is adding `profile?: GradeProfile`
  to it and `grade?` to the `ROSTER` recipes. Combat owns `GradeProfile`'s values: perception is **not** a new axis, it scales
  the existing `profile.reaction` in absolute ticks, and `anticipate` must stay because `ai.ts:114` clamps the spam read to
  `READ.anticipate` (8), so any per-grade `reaction` above 8 is swallowed on exactly the cleaver row. Combat's cleaver PR is
  gated on this.
- **#419 (estoc) waits on a Nightborn-profile item in Combat's lane, NOT on Combat's ai.ts seam fix.** Weapons reproduced the
  kicker hover exactly and then showed it cannot apply to the Nightborn: `guardShare = profile.guard ?? 1` gates it, and
  `guard: 0` occurs in exactly one opponent's three profiles (`src/moves.ts:503-505`, the guardless goblin). The Nightborn's
  `guard:` is the directional-guard object, a different key, so his share defaults to 1 and `hover` is 0. The estoc hold is a
  product decision — accept the trident row and resolve the flip test's membership pair, or change the Nightborn's profile.
  The seam fix does have a second customer Combat may not have counted: the `knife vs goblin hard: kick only` 3/24 row, whose
  mechanism is that same 1.45 m park.
- **#446 CI cost: DONE by the Auditer lane as #507 (`quality/ci-skip-docs`), reported READY to Strategy** — zero-row diffs skip the matrix and the browser gates behind one green "release rows (none for this diff)" job, per-PR concurrency, cancel-on-close. It was unstarted on me; do not pick it up. Original statement of the problem: the workflow runs the full release matrix on docs-only pushes and keeps runs
  queued for closed PRs, starving trunk's own run. Fix is to skip the matrix when `release-rows-for.mjs` returns zero rows and
  cancel in-progress runs on PR close. `gh run cancel` on queued runs mostly does not take.
- **#490 (Brief 18, the Plague Doctor) is unowned.** The Executioner lane correctly refused it — Dom widened them to the
  Knight only. Strategy to place it.
- **The bare Knight reads as nobody** (Executioner, #502): shoulder/height 0.367 in kit to 0.246 stripped, and none of the
  bare outline is his. Open proposal for Dom: one non-takeable silhouette feature in the bare build.
- **CLOSED, not open — the stripped-identity question was dissolved by Strategy, and correctly.** I had escalated it as a
  binary for Dom (identity moves onto the body, or the brief says stripped means generic). Both horns assumed a stripped state
  exists in the game; none does. Take-one removes at most one piece per kill, the opponent respawns kitted, and a grade is a
  MATERIAL variant on a shared mesh, not a different mesh (`src/grades.ts` states this as its premise) — so a Recruit's scrap
  Body piece carries the same outline as the Origin one. Ruling: **the gate is in-kit at every rung; the bare pass is
  informational, recorded beside the in-kit number, never a bar.** Every launch character's Recruit-2 are her two
  identity-carrying slots (Knight, Plague Doctor, Witch: Helmet + Body; Shieldmaiden A: Body + Helmet). A body-level identity
  feature is a per-character taste call for the owner, not a rule. The two failures the Executioner and Pitborn lanes measured
  were real and the measurement stands — the bar was wrong, not the finding. My §6 gate-satisfied ruling is consistent with
  this and stands; that lane builds.
- Mine also: the SCOPE.md broadcast to the lanes once #492 lands.

**Gotchas.**
- **Check the file before writing the type.** I drafted a `grade` type and sent it to Combat without opening `src/grades.ts`.
  It already existed, `Grade` was already taken there for the material triple, and my draft would not have compiled.
- **`OPPONENTS` at `src/moves.ts:513` is DERIVED from `ROSTER`.** Adding `grade` there type-checks and never reaches the
  recipes. `grades.ts:19`'s own comment says `OPPONENTS.grade.house`, so the wrong name is already on trunk.
- **A unit rule is not a sign rule.** Addendum C's "whole points" means integers, never `1.15`; Brief 19:49's signed delta
  stands. Paperdoll totals unsigned, kill-screen take signed. I relayed the addendum as superseding the sign and two lanes
  built to it.
- **Relayed premises cost more than they save.** Four lanes corrected me tonight — Combat (the knife is next, not the
  cleaver, and #419 does not sequence them), Character Main (scope is `warrior.glb` only; I mis-routed three items),
  Weapons (the >=2 margin was already met; rebasing buys nothing, empty sim diff across 22 commits), Web (#475 draws no
  number at all). Each was a claim I passed on without opening the file.
- **A valid background is not a valid mask, and a measured number can still measure the wrong thing.** The hole figure went
  20,677 px -> 9,644 -> **6,973 (3.5 % of the mask)** as two lanes checked each other; the first counted the figure's own
  negative space as a defect. Ask what the number was measured against.
- **The 80 % coverage rule is not a silhouette measure.** `tests/loot.test.ts` compares the loot draw's mesh surface area in
  m² against the PLAYER's own draws in that slot; it is a test that runs when the draw exists, not something checkable from a
  reference or a mask. I instructed a lane to measure it off a mask, and #471 §5a asserted the hauberk "clears comfortably —
  but it is measured, not asserted" when nothing had been measured. Fixed at `06eaec3`.
- **Every silhouette figure published before 2026-09-23 is withdrawn, in both directions.** Thresholded silhouettes fuse an arm
  into the torso where a hand rests on a thigh, polished plate sits at the backdrop's own luminance, and one lane's bare panels
  were rendered with the arms held out. Corrected off u2net mattes: three men inside 0.014, candidates 0.043 apart. Quote these.
- A branch checked out in another worktree cannot be checked out here. Commit via `hash-object`/`commit-tree` and push the
  sha, rather than reaching into that worktree.

## Lead handoff — 2026-09-22 17:45 (restart)
**Now.** Live == trunk == c7d942a, empty deploy queue (Deploy's receipt: 33/33, DEPLOY_EXIT=0, 17:40). Nothing of mine mid-flight.

**Done since the 16:25 entry.** Merged #431 #432 #433 #434 #436 #437 #438 #441 #442 #443 #445. Two live owner fixes shipped: the kill-link screen (PLAY NOW, no whole-fight button, no raw banner) and the kill-screen loot panel with its action row out of the thumb zone. Also: hits −25 % measured properly (the bus compressor was eating the cuts), the Pitborn sash out of LOOT with a coverage rule that fails any `replace` piece under 80 % of what it hides, the grade material table, and a CI guard that fails any sim change without a RECORD_VERSION bump.

**Reverted.** #435 (lorarii wearing guard.glb) — merged on its four PR jobs, broke 9 release rows at deploy because the model was fetched on the boot path. Reverted as #442. Owner has since overruled "capsules on the phone tier": the models ship, the roster check is taught that guard.glb is an arena asset (its size governed by the existing `guard` budget row, 231,620 B packed), loading still deferred past first paint. World re-lands.

**Open.** World: lorarii re-land. Auditer: the match-session split (move-only into src/match.ts, Career/Daily/Replay/Practice, reward-rule table test) and #446, the file→release-row CI job — ruled: curated boot-path subset (rows 02, 29, 31, one finisher-preview, 13–14), not all 30. Weapons: remaining flips batched behind ONE RECORD_VERSION bump. Gore: blood-conform re-land. Mine: Brief 14 grade record on OPPONENTS — `grade: { level, tier, kit, epithet, house, profile? }`, type owned by src/grades.ts, offer derived from it, "never less dressed than base" as the last guard.

**Gotchas added today.** The four PR gate jobs do not include the release matrix — for boot-path changes, run row 02 locally before merging. Memory is keyed by folder: verify the key resolves to the worktree you restart in, copy never move. A background publish script needs `set -euo pipefail` and a non-empty sha check. Batch git/gh/curl reads: each command re-reads the whole session context.

## Lead handoff — 2026-09-22 16:25 (context restart, Strategy rule v3)
**Now.** Nothing of mine is mid-flight. Deploys were blocked all afternoon because every deploy of trunk failed quiet-one rows 16/21/26;
#432 fixed that at the source and is merged, and the deploy session has a watcher that publishes the trunk tip on its own. Live was
adb8ddd at 16:07 (my curl); trunk is 632dbbf.

**Done today (this stretch, all merged on the gate: quality + base + both browser jobs SUCCESS, zero red).** #417 #422 #423 audio levels;
#421 migration 0010 (guest-share hygiene, applied and verified live: cron job active, share_limits unreadable, guest_key outside the
select grant, 30-day retention); #418 loot v2 armour draws; #425 regenerated loot layers; #415 paperdoll wears the gear; #420 glass
combat buttons; #424 endgame-HUD gate made deterministic; #426 PLAY NOW on a shared fight + tests/record-version-guard.test.ts; #428 the
arena guard model; #427 the kill-screen Take-one panel; #429 estoc-parked docs; #430 lorarii capsules; #432 loot action row into
`#actions`; #433 hit gains .3; #431 cleaver docs.

**Open.** #434 (Multi Chars: pitborn.Body dropped + rebuilt loot.glb + executed coverage test) and #435 (Visuals: the lorarii wear
guard.glb) — both mine to merge on green. Finishers & Gore are on the blood-conform branch (marks measured 0.4–0.5 cm proud, down from
0.9–5.8 cm; two open faults stated honestly: Nightborn cape MISS frames, one head-slot mark). Brief 14 is mine to start: the grade record
on `OPPONENTS` — `grade: { level, tier, kit, epithet, house, profile? }` — with the kill-screen offer derived from it (Dom 16:00), and the
"never less dressed than base" guard as the last line regardless of data.

**Gotchas.**
- The merge gate is mine, not CI's: `MERGEABLE, red=0` only means no conflict and nothing failed *yet*. Wait for all four jobs.
- A failing check may be reporting a real defect. I told Deploy to teach the quiet-one check around the loot panel's tap; Web design was
  right that the panel's buttons sat where the first post-kill touch lands, so a player stopping the arena tour would decline their loot
  by accident. Reverse fast and say so.
- Parking a PR parks its documentation with it: Weapons' estoc write-up lived inside a draft PR and never reached trunk. Findings go in
  their own docs PR off trunk (#429, #431).
- A green suite is not a safe number (estoc close 1.19-1.21 passed both axes by tie-break) and a green perf run may have measured the
  wrong thing (Visuals' first frame-times never fetched guard.glb). Ask what the number was measured against.
- Hosted migrations apply on an explicit "apply NNNN" relay, never on a merge event (Deploy's rule since 0010).

## Beta plan v3 lead stack — 2026-09-21/22 (owner: "go do it - always listen to the strategy dev")
Built as one stack, each PR on the last, merged to trunk in order by the deploy session: #321 blade seam (`bladePathsByRig[rig][weapon][kind]`,
`RigId` on every ROSTER entry, strict lookup); #323 warhammer as the second player weapon (`PLAYER_WEAPONS_OFFERED`); #324 short kill
links (`fight_records` table + `/?r=<id>` route, record v2 carries the weapon; #326's refused-version test moved to version 9 and the
replay fixtures re-recorded with `weapon` in META); #325 autopsy wiring (src/autopsy.ts cause/habit lines on the death screen and under
the journal row); #327 daily warden (src/daily.ts: `daily_fight()` seed, one attempt per UTC day, board in the journal; migration 0003
with pgcrypto created in the file, Backend's future-day guard + column-limited select via #354); #330 loot data (src/loot.ts LOOT table
incl. the Goblin's two pieces, drop per opponent per career sub-rank, owned/equipped/taken provenance on the profile and the cloud row,
migration 0004; Backend's RLS coverage #355 with the check pinned to UTC); #342 account autosave (no Save/Load buttons, every profile
persist fires `frankendom:profile` and the account module syncs; "Signed in · saved to your account"); #349 loot on the rig and in the
journal (characters.ts `loadLoot` + actor `wear`: each loot.glb piece bound to the player's skeleton with his Body draw's bindMatrix,
`replace` pieces hide his own slot draws, a helmet hides hair, palette materials take his textured one by name; scene.ts fetches
loot.glb only once the rigs are in and the worn set is non-empty, readiness never waits; main.ts fills the paperdoll slots and the
five-tile rack in Web design's brief-9 row shape, Wear / Store under the drop line). Evidence per PR in its body: quality:stop, the
harness (tests/graphics.test.ts, whose seeded profile id is now valid), tests/loot-wear.test.ts on the shipped GLBs, a Playwright probe
of the built tree (fight ready before the loot response). Also this night: #332 kill-link gate row; #368 jpegtran via a temp file with
a 60 s kill (deploy #71's hour-long wedge); #371 re-landed Combat's reach fix on trunk after #358 had merged into its lead base branch.
Open on the lead: deterministic trig in the sim (arm64/x64 digest drift, root-caused), "Daily #n" display +1, docs for #257–#324 in
this file, `quality.yml` counter gate still `required: false`.

## Release check 9 (polearm-browser-check) became checks 9–12; everything after renumbered +3 — 2026-09-21
Lead's deploy-speed ask: check 9 failed on ubuntu-latest on wall-clock waits. `scripts/polearm-browser-check.mjs` now boots on real
time and then owns page time through `scripts/lib/harness-clock.mjs` (walk-in, orbit settle, fight frames and both predicates advance
by `run()`/`until()`); no assertion dropped; needs the frame-clock resync (#265) or the sim froze under `page.clock`. Runner receipts:
1704 s serial (run 35537212537, cancelled by the 30-min job cap during upload), 1595 s with the two opponents side by side (run
35542553950; receipt wallMs desktop 1099/1144 s for 397/398 frames, phone 403/448 s for 315 — the GPU process serialises pages, so
parallelism was removed again). A view is 315–400 fixed-step frames at ~1.2–1.4 s each on software GL; 945 of the 1,424 frames sit
between "Draw sword" and the warden's first polearm clip (game behaviour, not the harness). So `.quality-gate.json` lists the check
once per view — `--opponents executioner|veteran --screens desktop|phone`, checks 9–12 — and every later release check index moved
+3 (deploy notes, runner-v2 duration ordering and `ci-trusted-checks.mjs` are index-keyed; trust is per exact sha, so it self-heals).
A narrowed run writes `receipt-<opponent>-<screen>.json`; the receipt carries `deviceScaleFactor`, `wallMs` and per-frame `pageMs`
(CI renders receipts at DPR 1, `HARNESS_DPR` overrides; pixels were not the cost). PR #267.

## Arena cam after the kill — lead implementation, 2026-09-20 (owner: "after 5 seconds it does the different angles, views")
camera.ts `TOUR`: five seconds after a finish begins (the finisher's push-in and side reveal have settled) the rig drifts — a slow orbit
around the fallen (one lap per 40 s) that breathes in and out (5.2 ± 1.3 m) and rises toward a wider view (1.6 → 3.2 m; lower on the
player's own death), looking at the fallen (corpse–head midpoint after a decapitation), blended in over 3 s from wherever the camera
stands so there is no jump, clamped to the colonnade, looping until Rematch. Never a cut. A touch on the arena (`canvas` pointerdown →
`view.stopTour()`) hands the camera back for that finish; a rematch forgets the stop. No tour on a draw or under reduced motion.
Tuning is the Visuals and World lane's from here (path, timings in `TOUR`). Evidence: tests/camera.test.ts arena-cam test (orbit rate,
no-cut, breathing/rising bounds, look, lower on a loss, touch stop, draw/still hold, rematch reset, edge clamp); 332 tests, eslint src.

## Strike circle retired — lead implementation, 2026-09-20 (owner: "I tried both and prefer buttons"; one grammar = every control feature built and tested once)
The thumb cluster is the one touch layout. Gone: the v8 strike circle (input.ts ring8 handlers, `gestures.ts` + its test), the
Controls chip in the journal Settings tab and its scheme cycling in main.ts, the `ring8` HUD relabelling, the `data-gestures=ring8`
CSS block (the cluster block stays; index.html carries `data-gestures="cluster"` statically). trial.ts keeps one tally instead of a
per-scheme card (`frankendom.controls.v1` migrates: an old `{ scheme, card: { cluster, ring8 } }` loads as its cluster tally, the
ring's numbers are dropped); the AFK marker `frankendom.fight.v1` is `{ opponent }` only. browser-check no longer cycles Controls:
one `layoutClean('cluster')` pass (44 px targets, no overlaps) at both phone sizes. Directional guard (five sides, owner 2026-09-20)
is built on the buttons next. Evidence: 327 tests, eslint src, build + budget PASS; CI browser gate on the PR.

## Tabbed Field Journal wiring — lead implementation, 2026-09-20 (owner: "get it live")
On top of the design lane's markup/CSS (529bb6d, rebased onto trunk): the blood toggle is gone — `#blood-mode` button removed, its
red/dark/off cycling removed from main.ts, gore always on (the renderer keeps `BloodMode` for a later setting); hit-stop chip sits in
the Arena tab (design's markup, no JS change); test tools stay visible under Settings. Gates learned the tabs: browser-check and
quiet-one click `label[for=journal-tab-settings]` before #controls-mode / #finisher-select, roster-browser-check clicks
`label[for=journal-tab-arena]` before #opponent-select; browser-check's blood-mode cycle and quiet-one's dark/off cycling under
--blood-check are retired (the finisher's own blood assertions still run). Evidence recorded in PR #228.

## Browser gates on a harness clock, in CI — lead implementation, 2026-09-20 (owner: "do this please, it's important")
`scripts/lib/harness-clock.mjs`: after boot the gate installs Playwright's page.clock (paused) and advances page time 16 ms per frame;
`browser-check.mjs` and `counter-browser-check.mjs` replaced every wall-clock wait (parry 430 ms after the tell, riposte 350 ms,
kick reach, journal pause) with harness-time waits; the damage float (900 ms on the real animation timeline) is recorded by an
observer as it appears. Assertions and the game are unchanged. Proof on the GPU-less VPS build box (root@49.12.7.18,
/opt/frankendom-build, Node 22, load ~1) where the old gate failed at the riposte: combat gate passed (guard 440 ms after the
tell, parry, riposte 24, dmg "24", kick completed, controls cycle, no-WebGL fallback), counter gate passed (24/24/30).
`.github/workflows/quality.yml` gains a `browser` job running both gates on every PR/push to trunk. Still on deploy.sh only:
the other release checks (roster, estoc, polearm, quiet-one, account, creature…) until each moves onto the harness clock.

## Beta scorecard — lead implementation, 2026-09-20 (owner: "yes do it")
`src/scorecard.ts`: fights, wins, losses per opponent, saved on this device (`frankendom.scorecard.v1`); "left" counts inside
losses — the AFK catch-up death and the closed-page loss (the `frankendom.fight.v1` marker now carries the opponent id) are
losses flagged left; a draw is a fight only. The journal shows a table (`#scorecard-table`: one row per offered rung + "All
fights"; losses read "2 (1 left)" when walk-aways happened); the per-scheme control-trial dump stays but only under the debug
toggle. Device-local for the beta; a later pass can sync it with the account like career marks.
Evidence: tsc + eslint clean; scorecard unit tests; graphics harness (AFK death → veteran row 1/0/1 left 1; stale marker →
goblin row at boot; rendered table rows checked); harness Element now mirrors DOM `append(...)`/`replaceChildren`. Browser
gate left to CI per the one-deployer rule (deploy #13 in flight).

## Opponent picker shows live rungs only — lead implementation, 2026-09-20 (owner)
The journal's opponent picker is built from `LADDER` (held recipes filtered out) instead of every `ENCOUNTERS` entry greyed as
"(on hold)": Minotaur, Wraith, Werewolf and Skeleton no longer appear in the beta menu at all (they stay valid ids, so saved
encounters still fall back). The beta list is Veteran, Pitborn, Goblin, Nightborn, Executioner, Dwarf. Roles as of today: the
former lead is the deploy/GitHub/CI dev; this lane is lead implementation (features, integration, add/remove); character dev
builds bodies; the design/web dev designs only and hands designs to implementation.
Evidence: tsc + eslint clean; graphics/roster/ladder tests 37/37 (picker test updated); build + audit 0 + budget PASS
(20,820,778 gzip of 32 MB, per fight 8,821,562 of 12 MB with the Dwarf). Full `npm test` and `test:browser` deferred until the
deploy dev posts FREE (load-gated deploy in progress); receipts go on the PR.

## Ordered lead cleanup — 2026-09-19 (PR #171)
Owner requested readability, existing-recipe cleanup, obsolete QA retirement, then reliability/product gaps.
The main/scene TypeScript syntax trees and parsed CSS rules were preserved while unpacking dense formatting.
Input/audio tests retain their behavioral requirements across formatting; missing-event and touch-rule mutations fail.
Equipment defaults now live in appearance presets; Veteran/Executioner rebuilds are byte-identical to baseline.
Retired the rejected procedural pilot generator/check (508 source lines). Actual shipped-creature integrity and
browser gates remain, including both rigs and 250 sampled poses.

Startup now preserves the original renderer exception and stack while retaining the friendly fallback. The regression
fails before the change and passes after it; actual Chromium with WebGL disabled verifies the original error and disabled
combat. Audio e867 is integrated, including Draw-only bell behavior. All 24 configured commands passed on 17218e6:
291 tests, typecheck/lint/audit, gameplay/recovery/layout, finishers, account/database, audio and creature checks.
Independent clean Node 22 and real PostgreSQL checks also pass. The subsequent review-record edits were documentation/comments only.
The final pre-merge check then found published weapons revision 68ccdf2. It is integrated with its new creature-weapon
pose gate retained; the combined 25-command contract is revalidated before publication. Release-window coordination
is explicit in AGENTS.md so every active lane is included before the lead reserves the shared GPU/release window.
Deployment and public verification receipts are maintained under artifacts/cleanup/ and PR #171; served release.json
identifies the published revision. GitHub's hosted job was billing-blocked before start; it is not reported green.

The owner permits up to 12 MB per fight when needed; the separate 32 MB distribution cap is unchanged.
Release-specific Sentry triage and remaining acceptance: docs/reliability-audit.md. Physical-phone and external-player
validation remain unpassed. Career practice-win award policy awaits owner confirmation; no rank ledger or end-game
system was added. The shared automatic hook's 420-second ceiling is shorter than this 1,111-second full suite;
all commands were run directly without deleting checks or altering shared enforcement.

## Google account integration — lead, 2026-09-19 (live e5339e9, PR #152)
Owner requested Google login/Supabase with controls inside Field Journal. Added a lazy account SDK, PKCE login,
explicit cloud save/load of name and practice opponent, session sign-out, revision conflict checks and owner-only RLS.
Sign-in never overwrites device/cloud data; explicit load restarts practice. Career marks/results remain outside this
client-editable table. No combat, renderer or input code changed. Details/setup: docs/account-integration.md.

Integrated evidence at 30b5e48 (trunk 714e969): npm run quality passed 263/263, lint/typecheck/build/audit/budget
and gameplay browser; all nine additional completion commands passed. CI 35436347273 passed. Enabled account build:
8,486,798 bytes gzip per fight / 10 MB. Account browser uses controlled provider responses with the real SDK;
it does not prove live Google configuration. Screenshots/logs/receipts: artifacts/account/integrated-{0..9}.log,
browser-receipt.json, mobile-guest.png, mobile-signed-in.png and desktop-menu.png. Runtime addition: 161 lines.

Dedicated free project rxbewmzmovelckzoosss created by owner in Mumbai. Applied the checked-in migration via psql
with TLSv1.3 and verify-full using the official Supabase CA. Hosted transaction tested both users' own save/read,
cross-user read/write denial, anonymous denial, immutable ownership/revision, stale saves and constraints;
rolled back both test users and saves (zero profile rows remain). Receipt: artifacts/account/hosted-rls-receipt.txt.
Hosted site URL and exact /?account=return redirect saved and verified in dashboard. Public REST read without a user
session returns 401/42501 as intended. Ignored public production configuration and exact-origin CSP are prepared;
The exact Supabase origin is now installed in the Frankendom nginx CSP (backup retained); nginx -t and public header checks pass.

Failure ledger: F1 callback fixture wrote its PKCE verifier without SDK JSON encoding; corrected fixture and reruns pass.
F2 logout-failure test expected a retained session; verified current SDK deliberately clears local credentials even when
remote revoke fails. Corrected regression requires cleared tokens/cloud controls and failed-read retry; passes.
F3 world integration documentation conflict resolved preserving both lanes; combined quality and CI pass.
F4 Safari multiline SQL entry was unreliable; nothing executed, switched to exact-file psql migration.
F5 system CA rejected the pooler certificate; official dashboard CA with verify-full fixed it (TLS not weakened).
F6 focused test was invoked with absent tsx loader; corrected to this repo's native node --test runner: 3/3 pass.
F7 / review F1: adding the exact Supabase CSP origin in 51597f8 invalidated the old three-source monitoring
assertion. Its local/CI failure supersedes the earlier runtime pass for that revision. Updated the test to pin all four
sources exactly (self, blob, the specific Sentry and Supabase origins); added the configured release success case.
Focused monitoring/config checks pass 4/4. Full contract rerun logs: artifacts/account/review-f1/{0..9}.log;
check the latest PR152 CI before integration. No wildcard, assertion removal or runtime behavior change.
Two-pass review covered ownership/concurrency/retry and mobile/desktop placement/guest startup. No new background task.

Activation: owner approved Google credential creation. Dedicated Google project principal-zoo-509110-v0 has a web
OAuth client with frankendom.com origin and https://rxbewmzmovelckzoosss.supabase.co/auth/v1/callback. Secret saved
only in Supabase; public settings confirms Google enabled. Email/password provider disabled. Public privacy page
added at /privacy.html and linked inside the journal. Google is In production with only OpenID/email/profile scopes.
Production CSP and all public assets were verified on live e5339e9. PR #152 merged after exact-head and merge CI;
all 12 configured commands and deployment quality passed (269 tests). Actual Safari Google sign-in, save, reload,
cloud restore and sign-out passed against the real services. Phone-size guest menu checks passed; physical-phone
login and separate-device recovery remain unmeasured. Authoritative receipt: lead checkout
`artifacts/account/live/RECEIPT.md` and PR #152 body. These supersede the earlier activation-pending notes.
Calibre untouched.

## Season 1 scope and material cleanup — lead, 2026-09-19
Owner chose Recruit → Origin as the complete Season 1 core, with the RPG endgame built after launch. Canonical scope is
in GAME_SPEC.md; docs/progression-direction.md records future choices, persistence/result boundaries, migrations,
release checks and lane ownership. No stat rebalance, build allocation, inventory, purchases or backend is implemented
by this change. Recoverable identity/career persistence and physical/external-player gates still precede a progression launch.

Code-quality review: the earlier roster foundation already fixed scattered weapon defaults and health reporting. This
pass moves repeated warrior material values into one offline palette, preserving existing appearance and the Executioner's
matte overrides. Broad main/input splitting and a new item framework were rejected as churn without a current requirement.
All six fighters' four material constructors and final material GLB output compare byte-for-byte with the pre-change code,
both with and without authored maps (12 cases). This is material-pipeline equivalence, not a full geometry rebuild.
Source art needed for a complete UAL2 rebuild is absent in the lead source directory; shipped GLBs remain unchanged.
Local validation at the initial base: npm run quality passed (250 tests, lint/typecheck/build/audit, budget and browser);
roster and Split Crown completion checks passed. Evidence: artifacts/lead-quality/. Lead reported integrated 251/251 full quality and roster/Split Crown/estoc/counter completion gates PASS; #148 CI passed and merged as 0c7b03f. Included in the world lane combined release; live receipts pending in artifacts/world/polish-notes.
Two-pass review: preset identity/isolation and unchanged simulation/input; then authored-map precedence, dye retention,
matte overrides and browser/render/persistence gates. No new runtime dependency or module added.

## Roster foundations — lead, 2026-09-19
Owner approved the GPT Pro content-reuse direction. Work on `lead/opponent-catalogue`, based on d383b66.
One typed recipe catalogue supplies identities, bodies, archetype references and weapon defaults. All five serialized combat definitions deep-equal the pre-change baseline; combat, timings, rigs and introductory order are preserved. Executioner default build resolves to scythe; shelved estoc still resolves to its shipped sword until the weapons lane activates it.
Encounter selection is separate from optional career marks. Existing guest ID/name and legacy opponent rung survive migration; saves retain a legacy alias for safe rollback. No marks are awarded and no server persistence/recovery is claimed. Scorecard now uses actual fighter health ceilings.
Ownership and the two-opponent/six-opponent sequence: docs/roster-pipeline.md. Estoc PR #142 and Run Through alignment remain their lanes' work, not included here.

Current-task verification ledger:
- F1: camera tests rejected the initial Vite-only asset glob. Replaced with Node-compatible URL construction; camera 3/3 pass.
- F2: graphics harness lacked the new real catalogue module. Wired it into the harness without changing assertions; 27/27 pass.
- F3: shared browser gate confused enemy kick HUD text with the player's kick. Actor/target events and exact HP reconciliation replace the 335 ms text guess. Enemy counters alone cannot pass; bounded attempts require an accepted, completed player kick. Full quality browser run passed with actor 0 AttackStarted → AttackMissed, no page errors; repeated/public verification pending.
- F4: new roster browser harness initially used the software headless-shell path and stalled; stopped only that owned browser and matched the shared gate's real Chromium executable. Corrected roster browser rerun passed all five opponents, two rigs per route, save migration and zero page errors.
- Focused catalogue/profile/ladder/scorecard: 12/12 pass; rollback migration separately 5/5. Full final npm run quality passed: 248/248, lint/typecheck/build/audit and browser; 8,361,205-byte per-fight budget. Release receipts pending.
- Sentry inspected: FRANKENDOM-A is an unresolved texture failure on old release 9587019 (2026-09-18); current catalogue checks do not prove that historic issue fixed. Load/GPU issues stay open. Hardware/external-player gates unchanged.

## Rename: Origins Arena — 2026-09-17 (lead, owner's call)
The owner named the place **Origins Arena** (the world lane's three proposals — The Ashpit · Worldsedge · The Bonehollow — are
declined; REQUESTS #1 closed). *Ashcourt / The Old Keep* is retired everywhere player-facing: the place block reads
THE PROVING GROUND / Origins Arena (the eyebrow inherits the retired brand subtitle), the HUD opponent is ARENA WARDEN
(mobile label "Warden" unchanged; ladder rungs still override dynamically), the brand line and `<title>` carry the locked
game title **Frankendom: Origins**, and the stale "courtyard" strings ("Enter the arena", the WebGL fallback and recovery
messages, the loading line, the noscript) now say arena — the browser gate's two matching references and the audio
reverb's comment/function name (`courtyard` → `arena`, the impulse itself unchanged) moved with them. No runtime,
asset or behaviour change beyond strings. Gate + browser gate green on the branch.

## Arena seam for the world lane — 2026-09-17 (lead)
The courtyard moved out of `scene.ts` into `src/arena.ts` behind `buildArena(scene)`; `scene.ts` keeps lights, fog, tone
mapping, camera, the fighters, the target marker (its brass is the threat tell and is no longer shared with the banners) and
effects. `arena.update(dt, events)` runs each frame (0 dt while frozen) so the lane can hang crowd/banner reactions on the
event stream; `arena.dispose()` removes it. `tests/arena.test.ts` is the contract: play radius = sim RADIUS, no vertex above
the floor inside the play circle, no vertex between 0.5 and 6 m inside the camera clamp (11.5 m), a boundary ring at the
play radius, update/dispose, and a cost baseline (263 meshes = draw calls before merging, 4,424 triangles) — mutations
placing a pillar in the circle or moving the bays to 11 m are caught. Visual no-op proven at a static settled state:
0.00 % pixels changed portrait and landscape (artifacts/camera-ab, ignored); the fight-moment capture differs only by camera
settle timing. Gate 197/197 + browser gate passed. CI (`.github/workflows/quality.yml`, quality:ci on push/PR to trunk) was
added earlier today by another session (477f2c3) and is green. Brief handed to the owner for the world lane.

## Opponent ladder — 2026-09-16 (lead/shell)
Veteran → Pitborn. `src/ladder.ts` (LADDER order, `opponentFor`, `won`, `nextAfter`); the device profile gains an optional validated
`ladder` rung; `main.ts` picks the opponent from the rung (URL `?opponent=` still overrides for the harness), labels the HUD for a
non-Veteran, and after a clean win the Rematch button reads "Next: the Pitborn" — pressing it saves the rung and reloads so the next
rig loads; a loss or draw keeps the rung and offers a rematch (recorded as before). Goblin and Nightborn append to LADDER when they land.
Evidence: 182/182 gate; a draw-counts-as-win mutation caught; real-browser check (artifacts/ladder-check.mjs, ignored): fresh device
= ASHCOURT WARDEN/150, rung=pitborn = THE PITBORN/190 on his rig, a loss = "Rematch" with the rung kept, no page errors. The win→Next
→reload path is covered by the pure rules and the shell wiring, not by a scripted real-browser win. Harness note: the graphics
harness's default profile id 'test' fails the profile's 8-char rule and always boots a fresh guest; tests that need saved state pass a
valid id.

## Origins direction recorded in GAME_SPEC — 2026-09-15
Docs-only. GAME_SPEC.md now carries the owner-locked title (Frankendom: Origins), setting line, pitch, simplicity rule, art direction with the materials rule (retiring the ESO/Black Desert references), Origins list, opponent roster order, collection loops, five-stat model, locational deaths and NOT NOW additions, written to sit consistently with the 2026-09-15 Souls-slice principles (four principal controls, skill wins mismatches / builds win margins, readable brutality). Closes the character lane's REQUESTS.md #1. No runtime, asset or test change; quality gate on this tree: 94/94 tests, build, 0 vulnerabilities, budget PASS (fight-ready 6.57 MB raw / 3.44 MB gzip against the 5 MB limit — headroom is now ~1.5 MB after character pass v1). Stale uncommitted graphics-test edit from 2026-09-13 was saved to ignored artifacts/stale-graphics-framing-test-2026-09-13.patch and discarded; primary checkout fast-forwarded to the live revision.

## First release audit — 2026-09-13
- Runtime: Node 25.8.1 for local tooling; pinned Three.js 0.186.0, Vite 8.3.0, TypeScript. One production dependency. Browser needs WebGL2.
- Pass 1 (code/state): pure movement and bounded collision, normalized diagonals, input clearing on blur/visibility/cancel, textContent for guest names, storage failure handling, separated rendering. No secrets, engine physics, backend or unrequested combat.
- Pass 2 (behavior): guest name survived browser reload; rendered 390x844 and 844x390 controls fit without horizontal overflow; pointer-pad circling and release, camera toggle, journal and live renderer reviewed. Desktop rendering approximately 60 fps / p95 17–18 ms during these checks, not a five-minute phone benchmark.
- Regression found: clamping camera inside colonnade initially cropped the player at maximum separation. Raised locked-camera framing with distance. Projection tests now exercise near contact and all boundary angles across portrait/landscape; both capsule endpoints stay within the frame. Transient camera motion still requires human comfort testing.
- Automated: 11 tests, including 20,000 seeded movement inputs replayed twice, typecheck, ESLint, production build, full dependency audit (zero known vulnerabilities), shell syntax and payload budget. Three isolated mutations (diagonal speed, boundary clamp, guest write) were all caught by tests.
- Build payload approximately 140 KB gzip / 557 KB raw. Vite warns about a >500 KB raw JS chunk; intentional single fight-ready bundle avoids an unnecessary split. Measured total compressed payload is far below 5 MB.
- Live regression: the initial Nginx try_files accepted explicit files but returned 404 for /. Browser and HTTP checks caught it. Added directory/index resolution; deploy now compares both the public homepage and revision response byte-for-byte with the local build.
- Release fallback: macOS rsync rejected numeric chmod syntax on the first transfer; switched to portable symbolic modes. The failed attempt did not switch the live symlink. GitHub CLI account display was stale; verified the actual authenticated owner through the API before creating the private repository.
- Tooling: greenfield first write had no search corpus. Three Semble searches ran once code existed (movement, persistence, input/camera). No .codegraph exists; not indexed without owner decision. Early automatic hook dependency discovery failed before repository initialization; project-local tsc/ESLint are installed and actual checks now pass.
- Browser QA used CUA in-app browser. Viewport tests are not touch hardware tests. Real multitouch simultaneous run/move, OS interruptions, GPU context loss and unsupported-GPU entry are code-reviewed but not fully exercised on devices. Guest corrupted/blocked storage is covered by unit tests.
- HTTPS provisioned for apex and www using existing VPS ACME account and renewal timer. Isolated Nginx virtual host only; existing unrelated Nginx warning existed before this work. No Sentry project is configured for this new prototype.

## Run / release
- Local: npm ci; npm run dev. Verify: npm run quality.
- Initial hosting: bash scripts/provision.sh (frankendom.com only).
- Release from a clean committed checkout: bash scripts/deploy.sh. It validates, transfers only built assets, and atomically switches the site symlink. Public /release.json records the exact source revision.
- Rollback: on VPS, cd /var/www/frankendom; ln -sfn "$(readlink previous)" next; mv -Tf next current. Verify public /release.json after switching. Each source revision retains its own static release directory.
- Remote source: private DomLynch/RPG-game repository (previous origin preserved as legacy); verify local/remote HEAD and /release.json on every close-out.
- No recurring background agent or automatic development task is installed. The static site remains available between sessions.

## Still gated
- Physical iPhone 12 / Pixel 6 performance, five-minute sessions and independent player usability remain required before a validated combat-gate decision; owner authorized the bounded first-hit development slice below.
- A humanoid rig and four movement clips are implemented in the character pass below. Full combat animation coverage, online combat, recoverable identity and RPG progression remain deferred.

## Monitoring and code discovery - 2026-09-13
- Authorized addition: pinned @sentry/browser 10.74.0, the second runtime dependency, for production error reporting. No gameplay changes, tracing, session replay or session tracking; request, user, extra and breadcrumb fields are removed before sending.
- Sentry project: na-wnr/frankendom. Build connection setting is in ignored .env.production.local (mode 600); .env.example documents setup. This is a public browser ingest key, never a management credential. Release script refuses an absent/non-HTTPS DSN and stamps errors with the committed SHA.
- Two new regression tests cover disabled configuration, selected integrations and real SDK event serialization/privacy. Browser auto-capture and live ingestion must be checked on release; unit tests alone do not prove ingestion.
- CodeGraph index is local/ignored, not a runtime dependency. Semble and CodeGraph are complementary discovery/structure tools; Sentry supplies runtime error evidence. Do not equate telemetry ingestion with validated gameplay.
- Release validation caught CSP blocking Sentry: the site now allows only its explicit HTTPS ingest origin, with a regression assertion and deployment configuration check. Browser auto-capture reached HTTP 200 after the fix; remote event lookup is a separate required verification. Total quality suite: 14 passing tests, typecheck/lint/build/audit/budget pass. Desktop/mobile renders were checked with blocked telemetry; software-rendered browser timing is not a phone-performance benchmark.

## Claude feedback integration and release checkpoint — 2026-09-13
- Claude's scoped commit 64a5b26 landed before mobile commit eab6860: the 1.8–2.2m warden dead band is already fixed and its stationary-guard regression passes. The earlier concurrent files were committed by that session; the shared checkout was subsequently verified clean. No duplicate implementation.
- Stale notices reproduced with a failing real-simulation regression. Two-second fixed-tick notice age now refreshes at both player/enemy contacts, including repeated identical results. Only display expires: result remains available for riposte, whiff AI and renderer feedback. Death/rematch and incoming/guard/chain priority retained. Reviewed early returns, pause semantics and repeated events.
- Three focused Semble searches plus CodeGraph impact covered result producers, HUD priority and regression helpers. CodeGraph synced after edits. Full configured gate: 53/53 tests, ESLint, typecheck/build, zero runtime vulnerabilities, payload budget pass. Existing 10,000/16,000-frame seeded state replays cover deterministic order; pre-fix code fails the new notice regression. ast-grep unavailable on PATH; no disputed graph edge or profiling symptom requiring unrelated diagnostics.
- Browser review: compact 375x812 view, combat approach/damage/defeat and full-width rematch render correctly with no horizontal overflow. Prior 844x390/1280x800 checks verify landscape/desktop. Physical phone performance/audio evaluation remains outstanding.
- Deployment blocked: configured scripts/deploy.sh passed its isolated quality gate, then public SSH 49.12.7.18:22 returned Connection refused (also on retry); saved-key Tailscale 100.96.74.1:22 timed out. HTTPS release.json remains HTTP200 at 58821417391576c257c61d10041c1ebd9197bb73. No claim these updates are live. Sentry search for that production release returned no grouped issues; this does not validate the unpublished changes. Resume configured deployment and public asset/service/browser checks when SSH is reachable. Evidence logs/receipt remain under ignored artifacts/.

## End-of-fight timing hook for the HUD — 2026-09-22 (lead; the overlay layout is Visuals and World's)
Owner (2026-09-22, via Strategy): end-of-fight text and buttons must not sit over the fallen body; text appears only once the
finisher camera has settled and fades while the arena cam tours. This PR exposes the timing, nothing else. `view.finishPhase()`
returns `{ settled, touring, age }`: `settled` is a latch on the camera rig (src/camera.ts `SETTLE`) that turns true once the finish is
1.5 s old and the drawn camera has moved slower than 0.02 m/s for 0.4 s, and stays true until the finish clears; `touring` is the
arena cam (from `TOUR.delay`, 5 s); `age` is seconds since the finish began. Measured settle times on this rig (tests/camera.test.ts):
plain death 1.52 s, opened 2.47 s (3.07 s big), decapitation 2.53 s, quietOne 2.87 s, splitCrown 4.13 s, runThrough 4.18 s — the two
long finishers leave ~0.8 s of still frame before the tour. `view.fallenRect()` is the fallen rig's bones (plus the severed head's box)
projected to CSS pixels and padded 24 px, for the gate "no HUD element intersects the body at settle time"; null outside a finish,
on a draw, or before the rigs are in. The graphics harness stubs both.
