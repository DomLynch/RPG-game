# Deploy B (VPS) — state

## 2026-10-13 ~07:30 (+04) — LANE CLOSED (Dom 07:0x: one Deploy lane). Handover to Frankendom - Deploy. READ FIRST: the open PRs table, then the train.

**Open PRs (state read from gh at handover):**

| PR | Branch @ head | What | State / owed |
|---|---|---|---|
| #2441 | deploy-b/train-cancelled-at-cut @33d074ce9 | Release-train fix: why DL #2431 never published (see "the check read" below) | On trunk tip (DF3 d17d1c318). CI 30 pass / 0 fail. `auditor:ready`; Auditor PASS at head pending (their condition, rebase onto DF3 keeping both rules, is met). Not in DG #2443. |
| #2437 | deploy-b/mac-node-pin @c5c4e8246 | deploy.sh suite branches run under NODE_PIN v22.23.3 or stop | Lead PASS + release:go. **Before its first run on the Mac:** install node v22.23.3 once at ~/.frankendom/node-v22.23.3 (use_pinned_node prints the exact curl+shasum+tar command). |
| #2434 | deploy-b/mac-only-tests @8241e9c52 | Mac-only reds: sweep-tmp x3 + release-train-setup standalone clone (firmlink, /private, BSD touch); env fixes, no skips | On DF3, 27/0 VPS, fails-first. **Owes a Mac run** of tests/sweep-tmp.test.ts + tests/release-train-layout.test.ts in a quiet window (Lead: no override today). It supersedes DF3's test-only workaround 0044dd49a. |
| #2417 | deploy-b/relay-shard @31d41b19c | relay shards | `auditor:ready` (Auditor delta look); ships alone, quiet window. |

Already in the step-3 cut DG #2443 (ancestry checked): #2429 @e212c76c1, #2433 @87a268728. #2428 proof stopped (Dom: reviews are Auditor + Lead only).

**The train (Mac publisher):**
- plist: `ops/launchd/com.frankendom.release-train.plist` → ~/Library/LaunchAgents/, runs `~/Developer/frankendom-train/scripts/release-train-publish.sh` every 120 s; log `~/.claude/state/release-train.log`.
- Read a tick: `tail ~/.claude/state/release-train.log`; `launchctl print gui/$(id -u)/com.frankendom.release-train` (last exit, runs). Dry run: `touch ~/.claude/state/release-train.dry-run` + `launchctl kickstart …`; stop: `touch ~/.claude/state/release-train.stopped`.
- Gate: publish only a release-* candidate with `candidate:pass` AND a PASS at its head (passAt: trusted authors only, #2429) AND unit-ci / quality / release-checks green on its FULL check list.
- "not a git repository …/.git/worktrees/frankendom-train" in the log = ~/Developer/frankendom-train is a worktree of the ~/Desktop repo, which launchd cannot read (TCC). Fix: `bash scripts/release-train-setup.sh` once in a Terminal (standalone clone); the layout guard (scripts/lib/train-layout.sh) then refuses instead of failing in git.
- How #2441 changed the check read (scripts/release-train.mjs decisiveChecks + release-train-publish.sh pick):
  1. A CANCELLED attempt that never ran (< 10 s) is no verdict once the same workflow/name has any later attempt, even a skip (the cut's first runs cancel in 0 s under unexpanded matrix names). It sits beside #2421's orphanCancel (an `${{` placeholder, or a later green verdict job). FAILURE always decides; a cancel that ran stays red.
  2. The pick no longer trusts `gh pr list` (capped at 100 checks; DL had 169, so quality/summary vanished): it lists numbers oldest first, judges each candidate on its full `gh pr view`, and logs verify's reason when one isn't picked.

**CI gates Deploy B built (workflow files):**
- `.github/workflows/unit-ci.yml`: `static` runs first; `shard` needs static, the receipt needs shard. A feature PR runs it only with `auditor:ready` (adding the label starts it) or as a release-* candidate; any other label runs nothing.
- `.github/workflows/release-checks.yml`: on a pull request the row matrix runs ONLY for a release-* candidate (it counts as labelled). A label event (candidate:pass, release:go) is "not a request to run the rows": that is why CR #2347 showed zero rows (its real runs were cancelled by concurrency, and only label runs completed).
- `.github/workflows/quality.yml`: a feature PR's browser jobs wait for `auditor:ready`; adding it gets its own `-browser` group, so it never cancels the head's gate in flight.

**Gotchas:** trial-merge onto the newest release-* before any PASS; force-push only with `--force-with-lease=<branch>:<old sha>`; a frozen candidate's head is never pushed (re-cut instead); a `pkill -f` pattern that matches your own shell's command line kills that shell (exit 144).

**Branches:** the four above; nothing else half-done.
