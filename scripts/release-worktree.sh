#!/usr/bin/env bash
# Release pipelining (Dom 2026-10-12): each candidate runs scripts/deploy.sh in its OWN checkout, so N+1 builds dist/, writes artifacts/ and
# its HF ledger while N publishes from another. This picks the checkout for one candidate and prints its path:
#   bash scripts/release-worktree.sh <candidate full sha>     ->  cd "$(bash scripts/release-worktree.sh <sha>)" && bash scripts/deploy.sh
# A slot is free when no live deploy.sh run (scripts/lib/deploy-lock.sh run files) has its cwd there. A missing slot is created as a
# detached worktree of this repo; a dirty one is refused, never cleaned. The untracked .env*.local files the build reads (VITE_SENTRY_DSN)
# are copied from this checkout when the slot lacks them, and node_modules is (re)installed only when package-lock.json changed.
# Env: RELEASE_SLOTS (space-separated paths; default ~/Developer/frankendom-deploy and ~/Developer/frankendom-deploy-2), DEPLOY_LOCK /
# DEPLOY_RUNS_DIR (as deploy.sh), RELEASE_WORKTREE_INSTALL (the install command, default "npm ci --no-audit --no-fund").
set -euo pipefail
sha="${1:-}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "release-worktree: needs a full 40-hex candidate sha" >&2; exit 2; }
here=$(git rev-parse --show-toplevel)
git cat-file -e "$sha^{commit}" 2>/dev/null || git fetch -q origin 2>/dev/null || true
git cat-file -e "$sha^{commit}" 2>/dev/null || { echo "release-worktree: $sha is not in this repo (push and fetch the candidate)" >&2; exit 2; }
source "$(dirname "$0")/lib/deploy-lock.sh"
busy() {   # a live deploy run is using this path
  local file pid
  for file in "$DEPLOY_RUNS_DIR"/*.json; do
    [[ -e "$file" ]] || continue
    pid=$(deploy_pid_of "$file")
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null && grep -qF "\"cwd\":\"$1\"" "$file" && return 0
  done
  return 1
}
# Stacked candidates only (deploy-lock.sh, the publish order): N+1 must contain every candidate still in flight, or whichever publishes
# second is refused as diverged/superseded and its changes wait for a re-cut. Cut N+1 on N's trunk merge commit.
for file in "$DEPLOY_RUNS_DIR"/*.json; do
  [[ -e "$file" ]] || continue
  pid=$(deploy_pid_of "$file"); [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null || continue
  inflight=$(sed -n 's/.*"revision":"\([0-9a-f]*\)".*/\1/p' "$file")
  [[ -z "$inflight" || "$inflight" == "$sha" ]] && continue
  git merge-base --is-ancestor "$inflight" "$sha" 2>/dev/null || { echo "release-worktree: $sha does not contain in-flight $inflight (pid $pid); cut N+1 on N's merge commit" >&2; exit 1; }
done
slot=""
for candidate in ${RELEASE_SLOTS:-$HOME/Developer/frankendom-deploy $HOME/Developer/frankendom-deploy-2}; do
  busy "$candidate" && continue
  slot="$candidate"; break
done
[[ -n "$slot" ]] || { echo "release-worktree: every slot has a deploy in flight (${RELEASE_SLOTS:-the two defaults}); wait for one to publish" >&2; exit 1; }
if [[ ! -e "$slot/.git" ]]; then
  git worktree add -q --detach "$slot" "$sha" >&2
else
  [[ -z "$(git -C "$slot" status --porcelain --untracked-files=no)" ]] || { echo "release-worktree: $slot has tracked changes; refusing (clean it by hand)" >&2; exit 1; }
  git -C "$slot" checkout -q --detach "$sha" >&2
fi
for env_file in "$here"/.env*.local; do
  [[ -e "$env_file" && ! -e "$slot/$(basename "$env_file")" ]] && cp "$env_file" "$slot/"
done
lock_sha=$(git -C "$slot" hash-object package-lock.json 2>/dev/null || echo none)
if [[ "$(cat "$slot/node_modules/.release-lock-sha" 2>/dev/null)" != "$lock_sha" ]]; then
  echo "release-worktree: installing node_modules in $slot (package-lock.json changed)" >&2
  (cd "$slot" && bash -c "${RELEASE_WORKTREE_INSTALL:-npm ci --no-audit --no-fund}" >&2)
  mkdir -p "$slot/node_modules" && printf '%s' "$lock_sha" > "$slot/node_modules/.release-lock-sha"
fi
echo "$slot"
