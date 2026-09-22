# Code quality lane (Auditer + fixer)

Worktree `~/Developer/frankendom-code-quality`, branches `quality/*`. Owns cross-lane guards, readability passes with equivalence receipts, and the 8/10 bar from the GPT audits (2026-09-22: architecture 8, readability 7.5, overall 7.5 on adab24a).

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
