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
uptime                                                   # load < 30
df -h /                                                  # > 6 GB free; the watcher aborts the run below that
```

READY comes from Lead (or Strategy when Lead is absent). Standing READY: Strategy's state-doc PR at any head whose diff is only `docs/state/strategy.md`; code-quality docs while the diff stays under `docs/`. An owner lane's own "ready" is not a READY.

A PR whose push triggered release rows merges only with that run complete and green for its current head, or with the red row reproduced on the Mac and explained in the PR.

## 1. Merge

```bash
gh pr view N --json mergeable,headRefOid,baseRefName
gh pr merge N --merge --match-head-commit <FULL 40-char sha>
```

Base must be `codex/01a09a76/task-1`. Merge every READY + mergeable PR in Lead's order. Docs-only PRs ride along.

## 2. Gate the combined tree

```bash
cd ~/Developer/frankendom-deploy && git fetch -q origin && git switch -q --detach origin/codex/01a09a76/task-1
npm ci && npx tsc --noEmit -p . && npm run typecheck:tests && npm test
```

## 3. Launch

```bash
SHA8=$(git rev-parse --short=8 HEAD)
(nohup bash scripts/deploy.sh > ~/Developer/deploy-$SHA8.log 2>&1 &)
```

The script writes the lock, runs the release rows (41 today), stages CSP, flips `/var/www/frankendom/current`, and kills itself after DEPLOY_CEILING_S. While it runs, the hooks refuse other sessions' browser checks, tests and bakes. Never disable the guard.

## 4. Watch

Every 5 minutes, or on Strategy's check-in ask:

```bash
tail -5 ~/Developer/deploy-$SHA8.log
```

Report as "N/41 done (passed / CI-trusted), 0 failed". A failed row: read that row's line in the log, name the PR that changed its trigger files, tell Lead; do not re-run blind. If a row fails against another PR's change (the #850 vs #848 case), Lead picks which PR is reverted; you revert only that one.

## 5. Verify live (all five, every publish)

```bash
curl -s https://frankendom.com/release.json                     # revision = target sha
ssh <vps> readlink /var/www/frankendom/current                    # points at the new release dir
curl -s https://frankendom.com/ | cmp - dist/index.html           # served index = built index
curl -s https://frankendom.com/assets/<bundle>.js | grep -c 'rxbewmzmovelckzoosss.supabase.co'   # 1: not a guest-only build
grep -c 'v:<N>' <served bundle>                                   # current bundle version
```

Rollback: `scripts/rollback.sh` puts `previous` back live in seconds; `--dry-run` prints the swap. Rollback is Dom's or Strategy's call, never yours alone.

## 6. Post the Published line

One message to Lead and Strategy:

`Published <sha8> at <HH:MM> (+04): #N <title>, #M <title>. Verified release.json + index cmp + VPS current + supabase.co. Box FREE. Queue next: ...`

Then append the same line to `docs/state/deploy.md` on your docs branch.

## Rules

- Queue runs around the clock; launch whatever is READY + green whenever the box is free. No launch stops unless Dom names one.
- Between runs, merge READY docs-only PRs so they ride the next launch.
- A green PR sitting idle while the box is free is a defect; say so.
- Migrations: Backend reviews, you apply at the deploy that needs them, on Lead's or Strategy's relay (that relay is Dom's yes).
