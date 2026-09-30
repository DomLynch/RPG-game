---
name: deploy-run
description: One release run on frankendom.com, Deploy lane only. Merge the READY PRs, launch scripts/deploy.sh, watch the rows, verify live, post the Published line. Use when Lead gives READY + GO or when the box is free and READY PRs are green.
---

# Deploy run (Deploy lane only)

One deployer, one Mac. Only the Deploy session runs this. Every other lane opens PRs and sends the sha.

## 0. Preconditions (all four, or do not launch)

```bash
date
curl -s https://frankendom.com/release.json
cat ~/.claude/state/deploy_in_flight.json 2>/dev/null   # must be absent, or pid dead / older than 45 min
pgrep -fl "codegraph sync"                               # must be empty; an orphaned sync drove load to 117 on 09-26 (Codex-side hook still unfixed)
uptime                                                   # load < 40 (Lead, 09-26 evening)
df -h /System/Volumes/Data                               # > 6 GB free; the Data volume filled at 22:5x 09-26; the watcher aborts below that
df -g /                                                  # >= 20 GB free, or do not launch (Strategy/Lead 09-30, after 4.6 GB free at 22:3x). First remedy: sweep /private/tmp/claude-501 scratch of CLOSED sessions older than 48 h (session id not in the app's open-session list); never an open session's scratch, never the current run's tree or a preview clone
```

READY comes from Lead (or Strategy when Lead is absent). Standing READY: Strategy's state-doc PR at any head whose diff is only `docs/state/strategy.md`; code-quality docs while the diff stays under `docs/`. An owner lane's own "ready" is not a READY.

A PR whose push triggered release rows merges only with that run complete and green for its current head, or with the red row reproduced on the Mac and explained in the PR.

## 1. Gate BEFORE merging (scratch worktree)

```bash
git fetch origin pull/N/head:refs/scratch/N                       # each READY PR
git worktree add --detach <scratch>/wt-run origin/codex/01a09a76/task-1
# in wt-run: git merge refs/scratch/N for each PR, in Lead's order
npm ci && npx eslint src && npx tsc --noEmit -p . && npm run typecheck:tests && npm test
```

eslint is required: eaef162e failed at 17:40 09-26 on an unused var that tsc passed. Base must be `codex/01a09a76/task-1`. Docs-only PRs ride along.

**Stacked pairs (one PR contains another), before the GO:** for each pair in the run, `git merge-base --is-ancestor <inner head> <outer head>` tells you whether the outer PR contains the inner one. If it does, either merge only the outer PR, or merge the inner PR first and then update the outer branch from trunk before the GO. After that, `git merge-base --all origin/codex/01a09a76/task-1 <outer head>` must print exactly one base. Two bases make GitHub refuse the second merge as "merge conflicts" even when a local `git merge-tree` is clean. Run W on 09-29 went half-merged this way (#1035 in, #1047 refused); the fix was a trunk merge on #1047 with its tree unchanged, then CI and a new GO.

## 2. Merge pinned, then prep the deploy folder

```bash
gh pr merge N --merge --match-head-commit <FULL 40-char sha>      # each PR, Lead's order
git fetch -q origin && git rev-parse 'origin/codex/01a09a76/task-1^{tree}'   # must equal the gated tree; stop if it differs
cd ~/Developer/frankendom-deploy && git fetch -q origin && git switch -q --detach origin/codex/01a09a76/task-1
npm ci && npx eslint src && npx tsc --noEmit -p .                 # no npm test here; it ran in the gate
```

## 3. Launch

```bash
SHA8=$(git rev-parse --short=8 HEAD)
touch ~/.claude/state/deploy_hold
(nohup bash scripts/deploy.sh > ~/Developer/deploy-$SHA8.log 2>&1 &)
```

Remove the hold when deploy.sh exits (a waiter: `while pgrep -f '^bash scripts/deploy.sh'; do sleep 20; done; rm -f ~/.claude/state/deploy_hold`).

The script writes the lock, runs the release rows (42 today), stages CSP, flips `/var/www/frankendom/current`, and kills itself after DEPLOY_CEILING_S. While it runs, the hooks refuse other sessions' browser checks, tests and bakes. Never disable the guard.

## 4. Watch

Every 5 minutes, or on Strategy's check-in ask:

```bash
tail -5 ~/Developer/deploy-$SHA8.log
```

Report as "N/42 done (passed / CI-trusted), 0 failed". A failed row: read that row's line in the log, name the PR that changed its trigger files, tell Lead; do not re-run blind. If a row fails against another PR's change (the #850 vs #848 case), Lead picks which PR is reverted; you revert only that one.

A row that fails on a page.goto/reload/screenshot Timeout at load > 60 is load, not the PR. The runner retries it once alone; if the retry also times out, re-run that row by hand at load < 30 against the same dist, then relaunch. Only an assertion failure goes to the PR owner.

To stop a run: `kill -TERM -<pgid>` of the deploy.sh process (`ps -o pgid= -p <pid>`), never pkill by name. Then kill the orphaned Playwright Chromes whose cwd is ~/Developer/frankendom-deploy, by pid. The lock clears on its own via the EXIT trap.

## 5. Verify live (all five, every publish)

```bash
curl -s https://frankendom.com/release.json                     # revision = target sha
ssh -o BatchMode=yes -i ~/.ssh/binance_futures_tool root@49.12.7.18 readlink /var/www/frankendom/current   # the new release dir
curl -s https://frankendom.com/ | cmp - dist/index.html           # served index = built index
B=$(grep -o 'assets/index-[^"]*\.js' dist/index.html)
curl -s https://frankendom.com/$B | grep -c 'rxbewmzmovelckzoosss.supabase.co'   # 1: not a guest-only build
curl -s https://frankendom.com/$B | grep -c 'v:<N>'                                 # current bundle version
```

Rollback: `scripts/rollback.sh` puts `previous` back live in seconds; `--dry-run` prints the swap. Rollback is Dom's or Strategy's call, never yours alone.

## 6. Post the Published line

One message to Lead and Strategy. The time is the log's "transfer + switch at HH:MM:SS" line, not the waiter's exit time:

`Published <sha8> at <HH:MM> (+04): #N <title>, #M <title>. Verified release.json + index cmp + VPS current + supabase.co. Box FREE. Queue next: ...`

Then append the same line to `docs/state/deploy.md` on your docs branch.

## Rules

- Queue runs around the clock; launch whatever is READY + green whenever the box is free. No launch stops unless Dom names one.
- Between runs, merge READY docs-only PRs so they ride the next launch.
- A green PR sitting idle while the box is free is a defect; say so.
- Migrations: Backend reviews, you apply at the deploy that needs them, on Lead's or Strategy's relay (that relay is Dom's yes). Apply ONE file BY NAME, never `supabase db push` / apply-all (held files sort earlier). Verify via pg_constraint (list_migrations is empty on hosted). If this session has no Supabase connector, say so; never hunt for keys.
