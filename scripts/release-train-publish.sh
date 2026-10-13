#!/usr/bin/env bash
# The release train's PUBLISHER (Dom via Strategy + Lead, 2026-10-12: no operator turn in the loop). launchd runs it on the Mac every 2 min
# (ops/launchd/com.frankendom.release-train.plist); safe to run by hand. One tick:
#   1. stopped (~/.claude/state/release-train.stopped) or held (deploy_hold: a deploy is running or someone holds the box) -> nothing;
#   2. its own lock (a mkdir dir with the pid; a dead holder is broken) -> no double publish, even if launchd overlaps a long run;
#   3. the OLDEST open release-* candidate with the candidate:pass label AND an "Auditor|Lead: PASS @<head>" comment, every check green and unit-ci,
#      quality and release-checks present and green (scripts/release-train.mjs pick, on each candidate's FULL `gh pr view` check list) -> nothing if none;
#   4. no live deploy.sh run (deploy-lock.sh run files), deploy_hold created atomically holding this pid, trunk FAST-FORWARDED to the candidate sha (the
#      only write to trunk; trunk == the audited commit, so N+1, cut on N, still contains trunk), then scripts/deploy.sh in a release checkout
#      (scripts/release-worktree.sh) under deploy.sh's own locks, FRANKENDOM_RELEASE=1;
#   5. "Published <trunk sha>" in the log -> remove deploy_hold, comment the Published line on the candidate, close candidates live now contains.
# Any failure STOPS the train: deploy_hold stays, release-train.stopped holds the reason, ONE comment on the candidate, and the notify hook
# (RELEASE_TRAIN_NOTIFY: a command given the message as $1, e.g. Deploy's messenger; macOS notification otherwise). A person restarts it by
# removing both files. It runs from its OWN checkout (~/Developer/frankendom-train, detached on trunk, moved to origin/trunk each tick), never from a
# release slot: release-worktree.sh rewrites those. The body is one { } block, so bash has parsed all of it before the tick's checkout moves the file.
# Under launchd (Lead 2026-10-12): macOS TCC keeps the job out of ~/Desktop, so the repo, its release slot (RELEASE_SLOTS, default
# ~/Developer/frankendom-train-deploy, a worktree of the clone) and its Mac-rows checkout (MAC_ROWS_DIR) must not be worktrees of the ~/Desktop repo:
# scripts/release-train-setup.sh makes the standalone clone; a tick refuses (exit 1, no git call, no hold) when any of them is one (scripts/lib/train-layout.sh).
# Dry run (`--dry-run`, or the file $STATE/release-train.dry-run): the tick reads git and GitHub, picks and verifies, logs "DRY RUN: would publish …",
# and writes nothing (no hold, push, deploy or comment; a stopped/held box is reported, not obeyed). Deploy's proof: touch the file, launchctl kickstart.
# Env: RELEASE_TRAIN_STATE, RELEASE_TRAIN_REPO (default ~/Developer/frankendom-train), RELEASE_TRAIN_ENV (sourced before
# deploy.sh, default $STATE/release-train.env: Deploy's usual DEPLOY_* settings), RELEASE_TRAIN_DEPLOY / RELEASE_TRAIN_WORKTREE (tests).
set -uo pipefail
{
state="${RELEASE_TRAIN_STATE:-$HOME/.claude/state}"
hold="$state/deploy_hold"; stopped="$state/release-train.stopped"; lock="$state/release-train.lock"
repo="${RELEASE_TRAIN_REPO:-$HOME/Developer/frankendom-train}"
trunk="${TRUNK_BRANCH:-codex/01a09a76/task-1}"
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) release-train: $*"; }
mkdir -p "$state"
dry=""; { [ "${1:-}" = --dry-run ] || [ -e "$state/release-train.dry-run" ]; } && dry=1
export RELEASE_SLOTS="${RELEASE_SLOTS:-$HOME/Developer/frankendom-train-deploy}" MAC_ROWS_DIR="${MAC_ROWS_DIR:-$HOME/Developer/frankendom-train-macrows}"
source "$(dirname "$0")/lib/train-layout.sh" || { log "no scripts/lib/train-layout.sh beside $0"; exit 1; }
for path in "$repo" $RELEASE_SLOTS "$MAC_ROWS_DIR"; do why=$(train_checkout_ok "$path") || { log "refusing to run: $why"; exit 1; }; done
skip() { if [ -n "$dry" ]; then log "DRY RUN: $*; going on"; else log "$*"; exit 0; fi; }   # a reason to do nothing this tick (a dry run reports it and reads on)
[ -e "$stopped" ] && skip "stopped ($(head -n 1 "$stopped")); remove $stopped and $hold to restart"
# The Mac-only rows start at the CUT (Strategy + Lead 2026-10-12): the oldest open candidate without a receipt gets scripts/mac-rows-early.sh in the
# background (one run at a time, its own checkout MAC_ROWS_DIR, the train's, checked above; under deploy.sh's Mac-rows lock); deploy.sh trusts the rows
# that passed for that tree. A dry run only says which candidate it would start.
early_dir="${PRELAUNCH_DIR:-$state/pre-launch}"
early=$(gh pr list --state open --base "$trunk" --limit 50 --json headRefName,headRefOid,createdAt \
  --jq '[.[] | select(.headRefName | startswith("release-"))] | sort_by(.createdAt) | .[].headRefOid' 2>/dev/null \
  | while read -r c; do [ -e "$early_dir/$c.macrows.json" ] || { echo "$c"; break; }; done)
if [ -n "$early" ] && [ -n "$dry" ]; then log "DRY RUN: would start mac rows (early) for ${early:0:9} in $MAC_ROWS_DIR"
elif [ -n "$early" ] && [ -d "$repo" ]; then
  ( cd "$repo" && PRELAUNCH_DIR="$early_dir" nohup ${RELEASE_TRAIN_MAC_ROWS:-bash scripts/mac-rows-early.sh} "$early" >> "$state/mac-rows-early.log" 2>&1 & )
  log "mac rows (early) for ${early:0:9}: started or already running (log $state/mac-rows-early.log)"
fi
deploy_running() {   # a live deploy.sh run (scripts/lib/deploy-lock.sh: the in-flight marker and one file per run), hand-run or ours
  local f p
  for f in "${DEPLOY_LOCK:-$state/deploy_in_flight.json}" "${DEPLOY_RUNS_DIR:-$state/deploy_runs}"/*.json; do
    [ -e "$f" ] || continue
    p=$(sed -n 's/.*"pid":\([0-9]*\).*/\1/p' "$f" | head -n 1)
    [ -n "$p" ] && kill -0 "$p" 2>/dev/null && { echo "$p"; return 0; }
  done
  return 1
}
if [ -e "$hold" ]; then   # held by a person (no pid), by a live publisher, or STALE: a publisher killed mid-publish (its pid is dead, no stopped file)
  hp=$(head -n 1 "$hold" 2>/dev/null | tr -cd '0-9')
  if [ -n "$hp" ] && ! kill -0 "$hp" 2>/dev/null; then
    log "STALE deploy_hold: publisher pid $hp is dead and the train is not stopped; check the last publish, then remove $hold"
    [ -n "$dry" ] || [ -e "$hold.stale-told" ] || { touch "$hold.stale-told"; [ -n "${RELEASE_TRAIN_NOTIFY:-}" ] && $RELEASE_TRAIN_NOTIFY "release-train: stale deploy_hold (publisher pid $hp dead)" || true; }
  fi
  skip "deploy_hold present: a deploy is running or the box is held"
fi
if p=$(deploy_running); then skip "deploy.sh is running (pid $p)"; fi
if [ -z "$dry" ]; then   # a dry run writes nothing, not even the lock
  if ! mkdir "$lock" 2>/dev/null; then
    holder=$(cat "$lock/pid" 2>/dev/null || true)
    if [ -n "$holder" ] && kill -0 "$holder" 2>/dev/null; then log "a publish is in flight (pid $holder)"; exit 0; fi
    log "breaking a dead lock (pid ${holder:-?})"; rm -rf "$lock"; mkdir "$lock" || exit 0
  fi
  echo "$$" > "$lock/pid"
  trap 'rm -rf "$lock"' EXIT
fi
cd "$repo" || { log "no repo at $repo"; exit 1; }
if [ -z "$(git status --porcelain --untracked-files=no)" ]; then git fetch -q origin && git switch -q --detach "origin/$trunk" || log "could not move $repo to origin/$trunk; using $(git rev-parse --short HEAD)"; else log "$repo is dirty: not moved"; fi

# Judge each candidate on its FULL check list: `gh pr list` returns at most 100 checks per PR, and a candidate has 150+, so the list cut quality/quality and
# release-checks/summary off DL #2431 (169 checks) and `pick` never chose it (2026-10-13: PASS + candidate:pass from 00:29Z, nothing published).
# Oldest first; the first that passes the gate on its own `gh pr view` is the pick (forward-only, as before).
cands=$(gh pr list --state open --base "$trunk" --label candidate:pass --limit 50 --json number,headRefName,headRefOid,createdAt \
  --jq '[.[] | select(.headRefName | startswith("release-"))] | sort_by(.createdAt) | .[] | "\(.number) \(.headRefOid)"') || { log "gh pr list failed; next tick"; exit 0; }
pick=""
while read -r n listed; do
  [ -n "$n" ] || continue
  view=$(gh pr view "$n" --json number,headRefName,baseRefName,headRefOid,createdAt,isDraft,labels,statusCheckRollup,comments) || { log "gh pr view #$n failed; next tick"; exit 0; }
  pick=$(printf '[%s]' "$view" | node scripts/release-train.mjs pick) || { log "pick failed on #$n; next tick"; exit 0; }
  [ -n "$pick" ] && break
  log "#$n @${listed:0:9} not publishable on its full check list: $(printf '%s' "$view" | node scripts/release-train.mjs verify "$listed")"   # why, for the log
done <<< "$cands"
[ -n "$pick" ] || { log "no candidate with candidate:pass, a PASS at its head and green unit-ci/quality/release-checks"; exit 0; }
read -r pr sha draft <<< "$pick"
# `gh pr list` returns at most 100 checks per PR (CQ #2342: 144 via `gh pr view`, exactly 100 via list): re-read THIS candidate's full rollup and re-check the gate.
if ! why=$(gh pr view "$pr" --json number,headRefName,baseRefName,headRefOid,createdAt,isDraft,labels,statusCheckRollup,comments | node scripts/release-train.mjs verify "$sha"); then
  log "#$pr @${sha:0:9} not publishable on its full check list: ${why:-gh pr view failed}; next tick"; exit 0
fi
[ -n "$dry" ] && { log "DRY RUN: would publish #$pr @${sha:0:9} (repo $repo at $(git rev-parse --short HEAD); slots $RELEASE_SLOTS); nothing written"; exit 0; }
log "publishing #$pr @${sha:0:9}"

stop() {   # $1 = reason: the train stays stopped until a person removes both files
  local why="release-train STOPPED at #$pr @${sha:0:9}: $1"
  printf '%s\n%s\n' "$why" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$stopped"
  log "$why"
  gh pr comment "$pr" --body "$why. deploy_hold is kept and the train is stopped: fix it, then remove \`$stopped\` and \`$hold\` on the Mac." >/dev/null 2>&1 || true
  if [ -n "${RELEASE_TRAIN_NOTIFY:-}" ]; then $RELEASE_TRAIN_NOTIFY "$why" || true
  elif command -v osascript >/dev/null 2>&1; then osascript -e "display notification \"${why//\"/}\" with title \"Frankendom release train\"" || true; fi
  exit 1
}
if p=$(deploy_running); then log "deploy.sh is running (pid $p)"; exit 0; fi   # again, right before the hold: the pick took network time
( set -o noclobber; echo "$$" > "$hold" ) 2>/dev/null || { log "deploy_hold appeared meanwhile"; exit 0; }
git fetch -q origin || stop "git fetch failed"
git cat-file -e "$sha^{commit}" 2>/dev/null || stop "candidate $sha not fetched"
git merge-base --is-ancestor "origin/$trunk" "$sha" || stop "trunk moved outside the train: the candidate does not contain origin/$trunk; nothing pushed, re-cut on trunk"
[ "$draft" = draft ] && { gh pr ready "$pr" >/dev/null || stop "gh pr ready failed"; }
git push -q origin "$sha:refs/heads/$trunk" || stop "the fast-forward of $trunk to $sha was refused (trunk moved?); nothing deployed"
git fetch -q origin || stop "git fetch after the fast-forward failed"
rev=$(git rev-parse "origin/$trunk") || stop "no origin/$trunk"
[ "$rev" = "$sha" ] || stop "trunk is $rev after the fast-forward, not the audited $sha: not deploying an unchecked commit"
dir=$(${RELEASE_TRAIN_WORKTREE:-bash scripts/release-worktree.sh} "$rev") || stop "no release checkout for $rev"
logf="$state/release-train-${rev:0:8}.log"
envf="${RELEASE_TRAIN_ENV:-$state/release-train.env}"
log "deploy.sh $rev in $dir (log $logf)"
( cd "$dir" && { [ -r "$envf" ] && set -a && . "$envf" && set +a; true; } && FRANKENDOM_RELEASE=1 ${RELEASE_TRAIN_DEPLOY:-bash scripts/deploy.sh} ) > "$logf" 2>&1
rc=$?
[ "$rc" -eq 0 ] || stop "deploy.sh exit $rc ($(tail -n 1 "$logf" | cut -c1-200)); log $logf"
grep -q "^Published $rev" "$logf" || stop "deploy.sh exited 0 without a Published $rev line; log $logf"
rm -f "$hold" "$hold.stale-told"
summary=$(sed -n "/^Published $rev/,\$p" "$logf" | head -n 40)
gh pr comment "$pr" --body "$(printf 'release-train: published #%s as trunk %s.\n\n```\n%s\n```' "$pr" "$rev" "$summary")" >/dev/null 2>&1 || true
# Older candidates live now contains are superseded (forward-only publish): close them with a pointer.
gh pr list --state open --base "$trunk" --limit 50 --json number,headRefName,headRefOid --jq '.[] | select(.headRefName | startswith("release-")) | "\(.number) \(.headRefOid)"' 2>/dev/null \
  | while read -r n h; do git merge-base --is-ancestor "$h" "$rev" 2>/dev/null && gh pr close "$n" --comment "release-train: superseded, live $rev (#$pr) contains it." >/dev/null 2>&1; done
log "published #$pr as $rev"
exit 0
}
