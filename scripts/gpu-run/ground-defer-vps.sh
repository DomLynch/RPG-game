#!/usr/bin/env bash
# VPS job: capture --prio 3 char bash /srv/dev-jobs/char-webp/ground-defer-vps.sh <branch sha with this script>
# Builds trunk and the branch under /srv/dev-jobs/char-webp (own node_modules in repo/, worktrees link to it for the build only) and runs scripts/ground-defer-proof.mjs on each.
set -euo pipefail
SHA="${1:?branch sha}"
cd /srv/dev-jobs/char-webp/repo
git fetch -q origin char/loot-defer char/probe-ground-defer codex/01a09a76/task-1
git checkout -q -f "$SHA"
BASE=$(git merge-base "$SHA" origin/codex/01a09a76/task-1)
for T in before after; do
  if [ $T = before ]; then REF=$BASE; else REF=$SHA; fi
  W=/srv/dev-jobs/char-webp/wt-$T
  [ -d "$W" ] && git worktree remove --force "$W"
  git worktree add -q --detach "$W" "$REF"
  ln -s /srv/dev-jobs/char-webp/repo/node_modules "$W/node_modules"
  (cd "$W" && npx vite build --config origins/preview/vite.config.mjs > "/srv/dev-jobs/char-webp/b-$T.log" 2>&1) || { tail -20 "/srv/dev-jobs/char-webp/b-$T.log"; exit 1; }
done
mkdir -p /srv/dev-jobs/char-webp/out2
for T in before after; do node scripts/ground-defer-proof.mjs /srv/dev-jobs/char-webp/wt-$T $T /srv/dev-jobs/char-webp/out2; done
echo "base $BASE"
