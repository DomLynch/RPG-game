#!/usr/bin/env bash
# bash scripts/mac-rows-early.sh <candidate full sha>: the Mac-only rows (row-placement.mjs MAC_ROWS: WebKit, rows 2 and 44) of one release candidate,
# started at the CUT instead of at the end of deploy.sh (Strategy + Lead 2026-10-12). Run by the train's publisher every tick (it exits at once when
# there is nothing to do); safe by hand. One run at a time (its own lock), in its OWN checkout (~/Developer/frankendom-macrows, never a release slot),
# under deploy.sh's Mac-rows lock (scripts/lib/deploy-lock.sh), so it never overlaps a deploy's local rows. Writes the tree-bound receipt
# scripts/lib/mac-rows-early.mjs reads; deploy.sh trusts the rows that passed, by tree. Env: PRELAUNCH_DIR, MAC_ROWS_DIR, MAC_ROWS_INSTALL, MAC_ROWS_RUN (tests).
set -uo pipefail
sha="${1:-}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "mac-rows-early: needs a full 40-hex candidate sha" >&2; exit 2; }
here=$(cd "$(dirname "$0")/.." && pwd)
state="${PRELAUNCH_DIR:-$HOME/.claude/state/pre-launch}"; mkdir -p "$state"
[[ -e "$state/$sha.macrows.json" ]] && { echo "mac-rows-early: $sha already has a receipt"; exit 0; }
lock="$state/mac-rows-early.lock"
if ! mkdir "$lock" 2>/dev/null; then
  holder=$(cat "$lock/pid" 2>/dev/null || true)
  if [[ -n "$holder" ]] && kill -0 "$holder" 2>/dev/null; then echo "mac-rows-early: a run is in flight (pid $holder)"; exit 0; fi
  rm -rf "$lock"; mkdir "$lock" || exit 0
fi
echo "$$" > "$lock/pid"
running="$state/$sha.macrows.running"
source "$here/scripts/lib/deploy-lock.sh"
trap 'deploy_lock_release_held 2>/dev/null; rm -rf "$lock" "$running"' EXIT
deploy_lock_release_held() { local d; for d in $DEPLOY_LOCKS_HELD; do deploy_lock_drop "$d"; done; }
dir="${MAC_ROWS_DIR:-$HOME/Developer/frankendom-macrows}"
git -C "$here" cat-file -e "$sha^{commit}" 2>/dev/null || git -C "$here" fetch -q origin || true
git -C "$here" cat-file -e "$sha^{commit}" 2>/dev/null || { echo "mac-rows-early: $sha not in this repo" >&2; exit 1; }
if [[ ! -e "$dir/.git" ]]; then git -C "$here" worktree add -q --detach "$dir" "$sha" >&2 || exit 1
else
  [[ -z "$(git -C "$dir" status --porcelain --untracked-files=no)" ]] || { echo "mac-rows-early: $dir has tracked changes; refusing" >&2; exit 1; }
  git -C "$dir" checkout -q --detach "$sha" >&2 || exit 1
fi
for env_file in "$here"/.env*.local; do [[ -e "$env_file" && ! -e "$dir/$(basename "$env_file")" ]] && cp "$env_file" "$dir/"; done
lock_sha=$(git -C "$dir" hash-object package-lock.json 2>/dev/null || echo none)
if [[ "$(cat "$dir/node_modules/.release-lock-sha" 2>/dev/null)" != "$lock_sha" ]]; then
  (cd "$dir" && bash -c "${MAC_ROWS_INSTALL:-npm ci --no-audit --no-fund}" >&2) || exit 1
  mkdir -p "$dir/node_modules" && printf '%s' "$lock_sha" > "$dir/node_modules/.release-lock-sha"
fi
tree=$(git -C "$dir" rev-parse "$sha^{tree}")
# The running marker is written only once the rows lock is ours: a deploy.sh holding that lock must never wait on a run that is waiting on it.
revision="$sha"; deploy_lock_wait "$DEPLOY_ROWS_LOCK" "Mac rows (early, ${sha:0:9})" || exit 1
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '{"pid":%d,"sha":"%s","tree":"%s","started":"%s"}\n' "$$" "$sha" "$tree" "$started" > "$running"
rows=$(cd "$dir" && node scripts/lib/mac-rows-early.mjs rows)
checks="$state/$sha.macrows.checks.json"; rm -f "$checks"
echo "mac-rows-early: ${sha:0:9} rows $rows in $dir, started $started"
( cd "$dir" && export RELEASE_CHECKS_ONLY="$rows" RELEASE_CHECKS_RECEIPT="$checks" RELEASE_CHECKS_LOG_DIR="$state/$sha.macrows-logs" RELEASE_CHECK_CONCURRENCY=1 \
  && bash -c "${MAC_ROWS_RUN:-npm run build >/dev/null && node scripts/release-checks.mjs}" )
rc=$?
(cd "$dir" && node scripts/lib/mac-rows-early.mjs record "$sha" "$tree" "$checks" "$started" "$rc")
exit 0
