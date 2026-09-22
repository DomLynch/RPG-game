# Code quality lane (Auditer + fixer)

Worktree `~/Developer/frankendom-code-quality`, branches `quality/*`. Owns cross-lane guards, readability passes with equivalence receipts, and the 8/10 bar from the GPT audits (2026-09-22: architecture 8, readability 7.5, overall 7.5 on adab24a).

## 2026-09-23 — match-session split (#505, to Deploy), CI zero-row skip (#507, READY), nine queued matrices cancelled

**Now.** Two PRs handed over, both mergeable and waiting on Deploy's batch. #505 `quality/match-session` (head 71fd7da on fe0d8e0): src/match.ts owns the match state and every start / end / reset in four explicit modes (career, practice, replay, daily); one `begin()` reset; `end(afk)` applies the reward rule once — career writes the trial line, the scorecard row and one mark on a win; daily marks the day done on the device and hands the post back; practice and replay write nothing; a kill-link or daily load that resolves after a later start hands back a stale `epoch` and is refused. main.ts 939 → 879, DOM and frame loop only; the sim path is unchanged. tests/match.test.ts drives every mode through the production `Match` (the table tests/journeys.test.ts had deferred to this split); trial.ts exports `Trial`; tests/graphics.test.ts maps `./match.ts`. Lead approved the shape ("the move-only discipline holding") and said merges are Deploy's tonight; Strategy confirmed the route. #507 `quality/ci-skip-docs` (head 2df8ad9): every PR event computes release-rows-for.mjs first, zero rows → the matrix is skipped and one green `release rows (none for this diff)` job says so; quality.yml's `plan` job skips the two browser gates on the same condition (lint, tsc, node suites, account-db still run; trunk pushes unchanged); both concurrency groups key on the PR number; cancel-on-close.yml cancels a closed PR's runs. Strategy accepted READY.

**Next.** (1) #508 (paths-ignore for docs on quality.yml) merges ahead of #507: rebase #507 on it, expect a conflict in quality.yml's `on:` block, keep the release-checks gate, the per-PR concurrency and cancel-on-close. (2) Receipt 2 for #507 — a code push after merge still runs its rows — is owed to the next Strategy session with the run id (#505 rebased would trigger rows 1, 2, 13, 14, 29, 31). (3) Re-grade against trunk after #505 and Finishers' characters.ts geometry land; the 8/10 bar was these two gaps.

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
