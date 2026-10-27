#!/usr/bin/env bash
# One-time (and idempotent) setup of the release train's checkouts on the Mac, run BY HAND from any frankendom checkout (a Terminal can read ~/Desktop;
# the launchd job cannot: Lead 2026-10-12, no Full Disk Access). Makes ~/Developer/frankendom-train a STANDALONE clone of origin (never a worktree of
# the ~/Desktop repo), detached on trunk, with this checkout's .env*.local build files; then checks every path the launchd job touches
# (scripts/lib/train-layout.sh): the clone, its release slot (RELEASE_SLOTS, default ~/Developer/frankendom-train-deploy, created at the first publish
# as a worktree of the clone) and its early Mac-rows checkout (MAC_ROWS_DIR, default ~/Developer/frankendom-train-macrows). A path that is a worktree
# of a protected repo is refused and left in place: move it aside by hand (it may hold node_modules or local files), then run this again.
# Env: RELEASE_TRAIN_REPO, RELEASE_SLOTS, MAC_ROWS_DIR, TRUNK_BRANCH.
set -uo pipefail
here=$(git rev-parse --show-toplevel) || exit 1
source "$(dirname "$0")/lib/train-layout.sh" || exit 1
repo="${RELEASE_TRAIN_REPO:-$HOME/Developer/frankendom-train}"
trunk="${TRUNK_BRANCH:-codex/01a09a76/task-1}"
bad=0
if [ ! -e "$repo" ]; then
  url=$(git -C "$here" remote get-url origin) || { echo "release-train-setup: no origin remote in $here" >&2; exit 1; }
  mkdir -p "$(dirname "$repo")"
  git clone -q "$url" "$repo" && git -C "$repo" checkout -q --detach "origin/$trunk" || { echo "release-train-setup: could not clone $url into $repo" >&2; exit 1; }
  echo "release-train-setup: cloned $url into $repo (standalone), detached on origin/$trunk"
fi
for path in "$repo" ${RELEASE_SLOTS:-$HOME/Developer/frankendom-train-deploy} "${MAC_ROWS_DIR:-$HOME/Developer/frankendom-train-macrows}"; do
  why=$(train_checkout_ok "$path") || { echo "release-train-setup: REFUSED $why"; echo "  move it aside (mv \"$path\" \"$path.desktop-worktree\"; git -C <its repo> worktree prune), then run this again"; bad=1; }
done
[ "$bad" = 0 ] || exit 1
for env_file in "$here"/.env*.local; do
  [ -e "$env_file" ] && [ ! -e "$repo/$(basename "$env_file")" ] && cp "$env_file" "$repo/" && echo "release-train-setup: copied $(basename "$env_file") into $repo"
done
# The launchd job's `bash -lc` never reads ~/.zshenv, where HF_TOKEN lives: without it `hf jobs inspect` says "Not logged in", a finished T4 job reads as UNKNOWN and is
# cancelled as "no hardware" (Release HA, 22 rows fell to the Mac). The train's env file (sourced by release-train-publish.sh before deploy.sh) gets a REFERENCE to
# ~/.zshenv, never the token value; idempotent (the marker is the word zshenv), mode 600.
envf="${RELEASE_TRAIN_ENV:-${RELEASE_TRAIN_STATE:-$HOME/.claude/state}/release-train.env}"
if ! grep -q 'zshenv' "$envf" 2>/dev/null; then
  mkdir -p "$(dirname "$envf")" && cat >> "$envf" <<'EOF'
# HF_TOKEN lives only in ~/.zshenv, which launchd's `bash -lc` never reads (Release HA: finished T4 jobs cancelled as "no hardware"). The value is read from the dotfile, never copied here.
eval "$(grep '^export HF_TOKEN=' "$HOME/.zshenv")"
EOF
  chmod 600 "$envf" && echo "release-train-setup: wrote the HF_TOKEN reference (not the value) into $envf"
fi
echo "release-train-setup: layout OK: $repo is a standalone clone; slots ${RELEASE_SLOTS:-$HOME/Developer/frankendom-train-deploy}; Mac rows ${MAC_ROWS_DIR:-$HOME/Developer/frankendom-train-macrows}"
echo "  proof: touch ~/.claude/state/release-train.dry-run; launchctl kickstart gui/\$(id -u)/com.frankendom.release-train; tail ~/.claude/state/release-train.log; rm ~/.claude/state/release-train.dry-run"
