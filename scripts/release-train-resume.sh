#!/usr/bin/env bash
# Resume a publish the release train STOPPED after its fast-forward (HL2, 2026-10-16: trunk == the audited sha and the PR reads "merged", but live is
# not the sha, so the tick has no open candidate to pick). The stop file names this command. Usage:
#   bash scripts/release-train-resume.sh <PR number> <candidate sha>
# Fix the cause, remove release-train.stopped and deploy_hold, then run it. It refuses unless origin/<trunk> IS the sha and live is NOT the sha; it takes
# deploy_hold with its own pid, runs deploy.sh the way the train does (the release slot, the train's env, FRANKENDOM_RELEASE=1), and removes the hold only
# on a "Published <sha>" line. A failure keeps the hold and writes release-train.stopped again. Env as the publisher: RELEASE_TRAIN_STATE,
# RELEASE_TRAIN_ENV, RELEASE_TRAIN_DEPLOY, RELEASE_TRAIN_WORKTREE; RELEASE_JSON_URL (default the live release.json) for tests.
set -uo pipefail
pr="${1:-}"; sha="${2:-}"
[[ "$pr" =~ ^[0-9]+$ && "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "usage: release-train-resume.sh <PR number> <40-hex candidate sha>" >&2; exit 2; }
state="${RELEASE_TRAIN_STATE:-$HOME/.claude/state}"; hold="$state/deploy_hold"; stopped="$state/release-train.stopped"
trunk="${TRUNK_BRANCH:-codex/01a09a76/task-1}"
[ -e "$stopped" ] && { echo "refusing: $stopped exists; remove it (and deploy_hold) after the fix" >&2; exit 1; }
git fetch -q origin || { echo "refusing: git fetch failed" >&2; exit 1; }
tip=$(git rev-parse "origin/$trunk") || exit 1
[ "$tip" = "$sha" ] || { echo "refusing: origin/$trunk is $tip, not $sha; this is not a resume, re-cut on trunk" >&2; exit 1; }
live=$(curl -s -m 8 "${RELEASE_JSON_URL:-https://frankendom.com/release.json}" | grep -oE '[0-9a-f]{40}' | head -n 1)
[ "$live" = "$sha" ] && { echo "refusing: $sha is already live" >&2; exit 1; }
( set -o noclobber; echo "$$" > "$hold" ) 2>/dev/null || { echo "refusing: $hold exists; a deploy is running or the box is held" >&2; exit 1; }
fail() { printf 'release-train RESUME of #%s @%s failed: %s\n%s\n' "$pr" "${sha:0:9}" "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$stopped"; echo "FAILED: $1 (hold and stop file kept)" >&2; exit 1; }
dir=$(${RELEASE_TRAIN_WORKTREE:-bash scripts/release-worktree.sh} "$sha") || fail "no release checkout for $sha"
logf="$state/release-train-${sha:0:8}.resume.log"; envf="${RELEASE_TRAIN_ENV:-$state/release-train.env}"
echo "deploy.sh $sha in $dir (log $logf)"
( cd "$dir" && { [ -r "$envf" ] && set -a && . "$envf" && set +a; true; } && FRANKENDOM_RELEASE=1 ${RELEASE_TRAIN_DEPLOY:-bash scripts/deploy.sh} ) > "$logf" 2>&1
rc=$?
[ "$rc" -eq 0 ] || fail "deploy.sh exit $rc ($(tail -n 1 "$logf" | cut -c1-200)); log $logf"
grep -q "^Published $sha" "$logf" || fail "deploy.sh exited 0 without a Published $sha line; log $logf"
rm -f "$hold" "$hold.stale-told"
summary=$(sed -n "/^Published $sha/,\$p" "$logf" | head -n 40)
gh pr comment "$pr" --body "$(printf 'release-train: RESUMED and published #%s as trunk %s.\n\n```\n%s\n```' "$pr" "$sha" "$summary")" >/dev/null 2>&1 || true
echo "Published $sha (resumed)"
