# Code quality lane (Auditer + fixer)

Worktree `~/Developer/frankendom-code-quality`, branches `quality/*`. Owns cross-lane guards, readability passes with equivalence receipts, and the 8/10 bar from the GPT audits (2026-09-22: architecture 8, readability 7.5, overall 7.5 on adab24a).

## 2026-09-23 (afternoon) — #567 iPhone half-canvas fix (READY), #556 loot-smoke wired (row 34), #534 fully green at c4bfb54

**Now — PRIORITY 1 for 2026-09-24 by 10:00 (Dom via Strategy via Lead, 2026-09-23 evening).** All ten opponents get six takeable armour pieces + weapon tomorrow (~40 new loot.glb draws on Nightborn's welded pipeline). Estimate loot.glb gzip at full six-piece sets from the current per-piece average on the weld PR (find it: Nightborn's open PR on the welded loot pipeline); caps are LOOT 2,000,000, TOTAL 40,000,000, PER_FIGHT 12,000,000 gzip (scripts/check-budget.mjs). If it will not fit, send Lead the number and open a one-line raise PR against trunk. Also check the loot-image / paperdoll budget row (scripts/loot-layers.mjs, tests/loot-layers.test.ts, and whatever check-budget counts for the thumbnails). Base facts for it (Lead's question, 2026-09-23 evening): check-budget measures DIST (scripts/check-budget.mjs `dist = argv[2] || 'dist'`) with zlib gzipSync level 6, never src and never gzip -9; the build's scripts/optimize-glb.mjs shrinks src/assets/loot.glb 5,066,536 B raw to dist/assets/loot-<hash>.glb 2,480,544 B raw = 1,327,597 gzip on trunk 9a7cb61's loot (Lead's 2,180,657 was src at -9; Character Main's 1,446,168 is another head, roster-v0). Measure the weld PR's own build the same way, then per-piece average × the new draw count.
Then the items below.

Three PRs with Deploy, none mine to merge: #534 `quality/match-session-3` head c4bfb54 (the match split; trunk b7bc78d merged in as a merge commit; every CI check and the local gate green; batch after Publish B). #567 `quality/viewport-layout-size` head 15d4e55 (Lead READY, batch after World's option C; option C also touches src/scene.ts, so on a conflict merge trunk in, no force-push). #556 (Web's loot smoke check) carries my commit 4e8c491: release row 34 plus its trigger rule; it lands after #552 and takes trunk before its row is green. #556 and #567 both append a row and insert a trigger rule above `src/**` in .quality-gate.json: whichever merges second needs a trivial rebase of that file.

**Next.** (0) Post-beta ticket (Lead, 2026-09-23): drop the held Season-2 creatures (minotaur / wraith / werewolf / skeleton) from dist; assets stay in the repo. (1) If Deploy reports a conflict on #567 or #534, merge trunk in and re-gate. (2) After #567 ships, the final receipt is Dom's iPhone: pinch, release, canvas stays full-screen. (3) Re-grade against trunk once #534 and Finishers' characters.ts geometry land. (4) browser-check.mjs and counter-browser-check.mjs still mask the shader-compile stall with a 120 s tap timeout; the #533 wait is the pattern.

**Done.**
- roster-v0 cd28ea4 (Strategy ruling via Lead): check-budget TOTAL 32 → 40 MB gzip, PER_FIGHT 12 MB unchanged, no test pins it; budget test 4/4, tsc clean.
- roster-v0 636ce4d (second Strategy ruling): check-budget LOOT 1.5 → 2 MB gzip (four characters' Recruit-2 pieces on shared Steel, ~130 KB each); TOTAL and PER_FIGHT unchanged; budget test 4/4, tsc clean; Executioner told (the Knight's loot was parked on it).
- #567: live bug on a50f22f (canvas in the top half after a page zoom, void below, HUD floating, camera far). Trigger: iOS Safari reports the zoomed VISUAL viewport in innerWidth/innerHeight; scene.ts resize() used them and renderer.setSize wrote inline px style. Fix: size from documentElement.clientWidth/Height, setSize(w, h, false), projections use the same numbers. Reproducer scripts/viewport-check.mjs (row 35): on trunk the emulated 2.5× zoom leaves the canvas 157×341 with inline style (fails); after, 393×852 with none (passes). Gate 526/524/0/2.
- #556: Web's loot-smoke-check wired as row 34 with a trigger rule above `src/**` repeating the boot-path six; the welcome tap now waits for the rigs and one painted frame (#533's stall). Passed all three steps on a local preview merged with #552.
- #534: fourth rebase of the day (over #535, #533, #538/#521, then #540/#537/#541), every time because merges landed between my push and Deploy's batch; main.ts is every lane's file.
- Deploy timing audit for Dom: 52dffed 3 min with 31 checks trusted; the other four today 21–50 min with 0–28 trusted, because trunk pushes cancel each other's receipts, the quality reuse needs an unmoved trunk, and lane gates loaded the box (load 40–70) during deploys. Solution proposed: one batch one tree (rebase the batch, full matrix on the head, merge when green), a pre-merge trusted-checks predictor (not built), keep the box clear during deploys.

**Open.**
- #534, #556, #567 merges (Deploy). Receipt 2 for #507 (a code push after merge still runs its rows) is satisfied by #534's pushes (rows 1, 2, 13, 14, 29, 31 ran on 1d69dc8 and c4bfb54); tell Strategy when asked.

**Gotchas.**
- iOS Safari: innerWidth/innerHeight are the visual viewport; never size a canvas from them. Emulate the report in Chromium with a defineProperty getter plus a resize event; WebKit is not installed for Playwright and Lead ruled it stays so.
- Web's branch is checked out in their worktree: work on a local branch from their head and push it to their ref as a fast-forward (`git push origin local:web/branch`).
- release-rows-for.mjs is first-match: a specific trigger rule must sit above `src/**` and repeat the six it would otherwise shadow.
- The deploy hook also blocks `npm run build` and `node scripts/*-check.mjs`; `git`, `gh`, `grep`, `node --check`, `release-rows-for.mjs` and single-file tests pass.

## 2026-09-23 (later) — #522 re-opened as #534 (to Deploy), check 32 root cause fixed (#533 LIVE), mergeLoot duplicate dropped

**Now.** #534 `quality/match-session-3` (head 1d69dc8 on dd1d968) is the match split alone, handed to Deploy: #522 had been closed unmerged, so Dom's morning check found the split absent from trunk. Rebased over #535, #533, #538 and #521; #521's loot Undo conflicted in main.ts and was resolved by hand (trunk's Undo logic kept over the match's own `lastDrop`; every reset path goes through `began()`, which now calls `hideLoot()` as #521 requires). Receipts on 1d69dc8: tsc clean; quality:stop 510 tests / 508 pass / 0 fail / 2 skipped; build ok; account-browser-check passed; CI quality + four browser gates green; release rows 1, 2, 13, 14, 29, 31 queued at hand-off. Merges with its release run green or a red row reproduced on the Mac.

**Next.** (1) If a release row on #534 goes red, reproduce it on the Mac before anyone re-runs it. (2) Re-grade against trunk once #534 and Finishers' characters.ts geometry land; the 8/10 bar was these two gaps. (3) browser-check.mjs and counter-browser-check.mjs still mask the shader-compile stall with a 120 s tap timeout; the #533 wait is the pattern to move them to (not urgent, they pass).

**Done.**
- #533 LIVE in dd1d968: CI check 32 (autopsy) failed every run with `locator.tap` timing out on "Enter the arena" after "done scrolling" and passed on a Mac. Root cause: the frame loop renders every frame; the rigs attach when scene.ts reports ready (`#art-status` empties) and the NEXT frame compiles every shader, which on the runner's software GL holds the main thread for tens of seconds, exactly when the check tapped (it waited only for `#attack-button`). Fix: wait for `#art-status === ''` and one painted frame (two rAFs) before the tap; no timeout change. Lead: "good root cause".
- The declined-history defect Lead's hold on #524 named (mergeLoot rebuilt only owned / equipped / taken, so absorbCloud dropped `declined` on every refresh): I wrote the fix and a regression test, then dropped both on Lead's order because Backend's #535 was already reviewed for it. #535 merged 86a928d; Lead confirmed it also keeps a refusals-only record. Rule learned: before fixing a defect another lane's hold names, check that lane's open PRs first.
- Live verified from release.json: c0b321c at 08:31Z, dd1d968 at 09:30Z.

**Open.**
- #534 merge (Deploy).
- Receipt 2 for #507 (a code push after merge still runs its rows) is still owed to Strategy; #534's push is that receipt once its rows complete (run on 1d69dc8).

**Gotchas.**
- A closed-unmerged PR's remote branch keeps its old head; pushing a rebase there is a force-push. Push under a new branch name and open a fresh PR instead.
- `gh pr view --json mergeable` can lag the push by a minute and report the old head; `git ls-remote` is the truth.
- Trunk moved three times in an hour this morning (#535, #533, #538/#521); rebase right before the gate, not after, or the receipts are for a stale head.
- The deploy hook blocks `npm run build` and `node scripts/*-check.mjs` too, not only test suites; `git`, `gh`, `grep`, `node --check` and `release-rows-for.mjs` pass.
- A scripts/ change triggers no release rows (`release-rows-for.mjs` → none); ask Deploy to run the row on the head.

## 2026-09-23 — match-session split (#505, to Deploy), CI zero-row skip (#507, READY), nine queued matrices cancelled

**Now.** Two PRs handed over, both mergeable and waiting on Deploy's batch. #505 `quality/match-session` (head 71fd7da on fe0d8e0): src/match.ts owns the match state and every start / end / reset in four explicit modes (career, practice, replay, daily); one `begin()` reset; `end(afk)` applies the reward rule once — career writes the trial line, the scorecard row and one mark on a win; daily marks the day done on the device and hands the post back; practice and replay write nothing; a kill-link or daily load that resolves after a later start hands back a stale `epoch` and is refused. main.ts 939 → 879, DOM and frame loop only; the sim path is unchanged. tests/match.test.ts drives every mode through the production `Match` (the table tests/journeys.test.ts had deferred to this split); trial.ts exports `Trial`; tests/graphics.test.ts maps `./match.ts`. Lead approved the shape ("the move-only discipline holding") and said merges are Deploy's tonight; Strategy confirmed the route. #507 `quality/ci-skip-docs` (head 2df8ad9): every PR event computes release-rows-for.mjs first, zero rows → the matrix is skipped and one green `release rows (none for this diff)` job says so; quality.yml's `plan` job skips the two browser gates on the same condition (lint, tsc, node suites, account-db still run; trunk pushes unchanged); both concurrency groups key on the PR number; cancel-on-close.yml cancels a closed PR's runs. Strategy accepted READY.

**Next.** (1) Done at 01:40: #507 rebased on #508's head e184744 (Strategy's order: #508 first); quality.yml's browser-gate plan job dropped as #508's paths-ignore covers docs, keeping the release-checks zero-rows gate, the per-PR concurrency and cancel-on-close; Deploy takes #508 then #507. If #508 is amended before merge, rebase again. (2) Receipt 2 for #507 — a code push after merge still runs its rows — is owed to the next Strategy session with the run id (#505 rebased would trigger rows 1, 2, 13, 14, 29, 31). (3) Re-grade against trunk after #505 and Finishers' characters.ts geometry land; the 8/10 bar was these two gaps.

**Done.**
- #505 receipts: quality:stop 470 pass / 0 fail / 2 skipped; tsc clean on the rebased head; account-browser-check passed (every Supabase call mocked); move-only removed-line check (every removed main.ts line is a renamed state reference or verbatim in match.ts); finisher-preview runThrough on the branch vs a detached trunk worktree at fe0d8e0 — 4 JSON receipts identical (commit field stripped), 11 of 11 PNG frames byte-identical, trunk-vs-trunk noise floor 0 px. CI quality green for 71fd7da; release-checks (rows 1, 2, 13, 14, 29, 31) queued behind the pool.
- #507 receipts: release-rows-for.mjs → `[]` for docs and reference images, the six rows for src/main.ts; three workflows parse; deploy.sh `quality_green` still needs both `quality` and `browser (combat)` success (a skipped gate is not green → full local gate); ci-trusted-checks reads only `check N` jobs; trunk is not branch-protected. #507's own run is the docs-only receipt (queued).
- Pool relief by hand, reversible: cancelled 9 queued release-checks runs whose PR diff triggers zero rows (#502 #490 #479 #506 #471 #498 #488 and two already complete); kept #505, #503 and trunk's. Queue 28 → 24.

**Open.**
- #505 and #507 merge (Deploy). #505 merges with its release run green for 71fd7da or a red row reproduced on the Mac (AGENTS.md).
- The hook-scripts session measured `browser (counter)` at ~9 min of a 10.8-min job and passing 6/6 on the runner today; the stale "not yet on this runner" comment on that matrix row (quality.yml) and whether to make it required are a follow-up, not in #507.

**Gotchas.**
- Node's strip-only TypeScript refuses constructor parameter properties (`constructor(readonly x)`): declare the fields.
- A new src module imported by main.ts must be added to the VM module map in tests/graphics.test.ts or 20 harness tests fail at import.
- A scripted fight from `initialPractice` starts sheathed four metres out: the thumb must draw (a light press while sheathed) and walk in before any battery strategy does anything; light spam beats the Veteran at normal on one seed in 200.
- The deploy hook blocks any command whose text names a test or preview script while deploy.sh runs, even a wait loop. Wait on `pgrep -f '^bash scripts/deploy\.sh$'`; other sessions' monitor loops match looser patterns and never exit.
- `gh run list --commit` matches only the full sha (the short one lists nothing).
- No image tooling on the Mac (no ImageMagick, PIL, pixelmatch): a 40-line zlib PNG differ in the scratchpad does the frame comparison; `cmp` for byte identity.

## 2026-09-22 — release matrix on PR pushes (#446), ai.ts/combat.ts line pass (#439 LIVE), match split assigned

**Now.** #446 `quality/release-checks-on-push` (head 1fc1a8d) open, Lead reviews: release-checks.yml runs the full matrix once on PR open and, on every later push, the rows the changed files trigger from `release_triggers` in .quality-gate.json (Lead's ruling: the curated boot-path six — roster 02, one finisher-preview, account 13–14, record-replay 29, kill-link 31 — on any src / index.html / public / style change; never the whole matrix per push, the pool is 20 runners). Every job checks out the branch head sha, not `refs/pull/N/merge`. The summary job is red on a PR when a row fails; AGENTS.md carries the merge rule. `node scripts/release-rows-for.mjs <files>` prints what a change triggers.

**Next (Lead (b), 17:38): the match-session split**, started in a fresh session per Dom's rule. Move-only: session state and the start / end / reset transitions out of src/main.ts (910 lines on c7d942a) into `src/match.ts` with explicit Career / Daily / Replay / Practice modes; main.ts wires DOM only; no renames beyond what the move forces. Receipts: preview-equivalence, account-browser-check (every Supabase call mocked in scripts/account-browser-check.mjs), a table-driven reward-rule test that pins "a practice rematch awards no loot and no mark" (today enforced only in main.ts; tests/journeys.test.ts notes the gap), tsc plus a sweep of html and scripts importers (#220). Lead reviews and merges.

**Done.**
- #439 (LIVE a98f327, deploy #104): src/ai.ts `M`/`F` → `self`/`opponent`, lines over 160 columns 54 → 17; src/combat.ts 26 → 13. Replay digest over 180 fights / 264,573 ticks identical before and after; `record-replay-check --strict` digestMatch true. tests/record-version-guard.test.ts re-pinned WITHOUT a RECORD_VERSION bump (a bump refuses every live kill link for a change that replays them identically); the pin comment states the receipt a re-pin needs. Combat approved on that receipt and said so.
- #435 root cause: its merged head never had a release run (the workflow fired only on open or label). Second defect found on #439's PR run: 18 of 32 rows "failed" in checkout because GitHub deleted the merge ref when the PR merged.
- Earlier today, all live: deploy guards (#378: merged-on-trunk, PR base check, deploy ceiling, child-process ratchet), audit fixes (#384: profileDiffers, save queue, truthful save line, record caps), journey tests (#402), sim boundary test (#407), moves.ts comment cleanup (#403).

**Open.**
- #446 review and merge (Lead). It is its own first test: the head's push triggers the boot-path six via the `.quality-gate.json` rule.
- The match split (above). The reward-rule test lands with it.
- Re-grade against trunk after the split and Finishers' characters.ts geometry land; the 8/10 bar is those two.

**Gotchas.**
- A formatting-only change to a sim file trips the version guard's byte hash: prove equivalence (replay digest over every opponent × profile × seeds, plus `record-replay-check --strict`) and re-pin without a bump; read the digest AFTER any version bump because record.ts is in the hashed set (Combat, #441).
- The deploy hook blocks any command containing test keywords while a deploy is in flight, even a single-file run; hash checks and `git show` are fine.
- Never touch ai.ts or combat.ts without asking Combat; Combat's Brief 13 may reach ai.ts lines 177–180 / 338–341 (the lorarii rules).
- eslint's config scopes globals to src/**: a new script must import `process`, `console`, `URL` from node modules to lint clean.
- Trunk's quality run is cancelled by the next trunk push (concurrency); that is by design, the deploy trusts checks by tree.
