#!/usr/bin/env bash
# The release train's PUBLISHER (Dom via Strategy + Lead, 2026-10-12: no operator turn in the loop). launchd runs it on the Mac every 2 min
# (ops/launchd/com.frankendom.release-train.plist); safe to run by hand. One tick:
#   1. stopped (~/.claude/state/release-train.stopped) or held (deploy_hold: a deploy is running or someone holds the box) -> nothing;
#   2. its own lock (a mkdir dir with the pid; a dead holder is broken) -> no double publish, even if launchd overlaps a long run;
#   3. the OLDEST open release-* candidate with candidate:pass and every check green (scripts/release-train.mjs pick) -> nothing if none;
#   4. touch deploy_hold, `gh pr merge --merge --match-head-commit` (the only write to trunk), trunk's tree must equal the candidate's,
#      then scripts/deploy.sh in a release checkout (scripts/release-worktree.sh) under deploy.sh's own locks, FRANKENDOM_RELEASE=1;
#   5. "Published <trunk sha>" in the log -> remove deploy_hold, comment the Published line on the candidate, close candidates live now contains.
# Any failure STOPS the train: deploy_hold stays, release-train.stopped holds the reason, ONE comment on the candidate, and the notify hook
# (RELEASE_TRAIN_NOTIFY: a command given the message as $1, e.g. Deploy's messenger; macOS notification otherwise). A person restarts it by
# removing both files. It runs from its OWN checkout (~/Developer/frankendom-train, detached on trunk, moved to origin/trunk each tick), never from a
# release slot: release-worktree.sh rewrites those. The body is one { } block, so bash has parsed all of it before the tick's checkout moves the file.
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
[ -e "$stopped" ] && { log "stopped ($(head -n 1 "$stopped")); remove $stopped and $hold to restart"; exit 0; }
[ -e "$hold" ] && { log "deploy_hold present: a deploy is running or the box is held"; exit 0; }
if ! mkdir "$lock" 2>/dev/null; then
  holder=$(cat "$lock/pid" 2>/dev/null || true)
  if [ -n "$holder" ] && kill -0 "$holder" 2>/dev/null; then log "a publish is in flight (pid $holder)"; exit 0; fi
  log "breaking a dead lock (pid ${holder:-?})"; rm -rf "$lock"; mkdir "$lock" || exit 0
fi
echo "$$" > "$lock/pid"
trap 'rm -rf "$lock"' EXIT
cd "$repo" || { log "no repo at $repo"; exit 1; }
if [ -z "$(git status --porcelain --untracked-files=no)" ]; then git fetch -q origin && git switch -q --detach "origin/$trunk" || log "could not move $repo to origin/$trunk; using $(git rev-parse --short HEAD)"; else log "$repo is dirty: not moved"; fi

pick=$(gh pr list --state open --base "$trunk" --label candidate:pass --limit 50 --json number,headRefName,baseRefName,headRefOid,createdAt,isDraft,labels,statusCheckRollup \
  | node scripts/release-train.mjs pick) || { log "gh pr list failed; next tick"; exit 0; }
[ -n "$pick" ] || { log "no candidate with candidate:pass and green checks"; exit 0; }
read -r pr sha draft <<< "$pick"
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
touch "$hold"
git fetch -q origin || stop "git fetch failed"
cand_tree=$(git rev-parse "$sha^{tree}" 2>/dev/null) || stop "candidate $sha not fetched"
git merge-base --is-ancestor "origin/$trunk" "$sha" || stop "trunk moved outside the train: the candidate does not contain origin/$trunk; nothing merged, re-cut on trunk"
[ "$draft" = draft ] && { gh pr ready "$pr" >/dev/null || stop "gh pr ready failed"; }
gh pr merge "$pr" --merge --match-head-commit "$sha" || stop "gh pr merge refused (head moved or not mergeable)"
git fetch -q origin || stop "git fetch after the merge failed"
rev=$(git rev-parse "origin/$trunk") || stop "no origin/$trunk"
[ "$(git rev-parse "$rev^{tree}")" = "$cand_tree" ] || stop "trunk $rev tree differs from the candidate's (something else landed): not deploying an unchecked tree"
dir=$(${RELEASE_TRAIN_WORKTREE:-bash scripts/release-worktree.sh} "$rev") || stop "no release checkout for $rev"
logf="$state/release-train-${rev:0:8}.log"
envf="${RELEASE_TRAIN_ENV:-$state/release-train.env}"
log "deploy.sh $rev in $dir (log $logf)"
( cd "$dir" && { [ -r "$envf" ] && set -a && . "$envf" && set +a; true; } && FRANKENDOM_RELEASE=1 ${RELEASE_TRAIN_DEPLOY:-bash scripts/deploy.sh} ) > "$logf" 2>&1
rc=$?
[ "$rc" -eq 0 ] || stop "deploy.sh exit $rc ($(tail -n 1 "$logf" | cut -c1-200)); log $logf"
grep -q "^Published $rev" "$logf" || stop "deploy.sh exited 0 without a Published $rev line; log $logf"
rm -f "$hold"
summary=$(sed -n "/^Published $rev/,\$p" "$logf" | head -n 40)
gh pr comment "$pr" --body "$(printf 'release-train: published #%s as trunk %s.\n\n```\n%s\n```' "$pr" "$rev" "$summary")" >/dev/null 2>&1 || true
# Older candidates live now contains are superseded (forward-only publish): close them with a pointer.
gh pr list --state open --base "$trunk" --limit 50 --json number,headRefName,headRefOid --jq '.[] | select(.headRefName | startswith("release-")) | "\(.number) \(.headRefOid)"' 2>/dev/null \
  | while read -r n h; do git merge-base --is-ancestor "$h" "$rev" 2>/dev/null && gh pr close "$n" --comment "release-train: superseded, live $rev (#$pr) contains it." >/dev/null 2>&1; done
log "published #$pr as $rev"
exit 0
}
