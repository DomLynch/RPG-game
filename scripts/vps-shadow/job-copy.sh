#!/usr/bin/env bash
# A VPS job copy of the game repo that shares its objects with one reference mirror (Dom + Hooks Dev, 2026-10-19).
#   job-copy.sh --init-reference          once: clone the reference mirror (about 4 GB, kept up to date by every copy below)
#   job-copy.sh <lane>-<job> <branch|sha> a checkout at that ref in /opt/frankendom-shadow/work/<lane>-<job>, detached, origin = GitHub
# Why: a plain `git clone` per job puts a full 4 GB .git inside every 5.5 GB copy. 331 copies of that filled the 301 GB root disk and then the 1 TB storage box that the sweep archives to.
# With --reference the copy holds only the working tree (about 1.3 GB with node_modules) and borrows the history from the mirror, so the copy is about four times smaller and still a normal clone:
# `git fetch`, commit and push go to GitHub as always, and vps-scratch-sweep removes it like any other copy.
# The mirror is never pruned or garbage-collected (gc.auto 0, gc.pruneExpire never): the copies depend on its objects. Never run `git gc --prune` or `git fetch --prune` there.
# Not for the shared node_modules in bn-trunk: a copy installs its own (Lead 2026-10-16).
set -euo pipefail
URL=${JOB_COPY_URL:-https://github.com/DomLynch/RPG-game.git}
REF_DIR=${JOB_COPY_REFERENCE:-/opt/frankendom-reference.git}
ROOT=${JOB_COPY_ROOT:-/opt/frankendom-shadow/work}
die() { echo "job-copy: $*" >&2; exit 2; }

if [ "${1:-}" = "--init-reference" ]; then
  [ "$#" = 1 ] || die "--init-reference takes no other argument"
  [ ! -e "$REF_DIR" ] || die "the reference mirror already exists at $REF_DIR"
  git clone -q --mirror "$URL" "$REF_DIR"
  git --git-dir="$REF_DIR" config gc.auto 0
  git --git-dir="$REF_DIR" config gc.pruneExpire never
  echo "$REF_DIR"
  exit 0
fi

[ "$#" = 2 ] || die "usage: job-copy.sh <lane>-<job> <branch|sha>   (or --init-reference)"
name=$1; ref=$2
[[ "$name" =~ ^[a-z0-9][a-z0-9._-]{1,60}$ ]] || die "the name must be lowercase letters, digits, . _ - (2 to 61 characters): $name"
case "$name" in *..*) die "no .. in the name: $name";; esac
[ -n "$ref" ] && [ "${ref#-}" = "$ref" ] || die "the ref must not be empty or start with -"
[ -d "$REF_DIR" ] || die "no reference mirror at $REF_DIR: run job-copy.sh --init-reference once"
dest="$ROOT/$name"
[ ! -e "$dest" ] || die "$dest already exists"

mkdir -p "$ROOT"
exec 9>"$REF_DIR/.job-copy.lock"; flock 9
git --git-dir="$REF_DIR" fetch -q origin
flock -u 9

git clone -q --reference "$REF_DIR" --no-checkout "$URL" "$dest"
target=$(git -C "$dest" rev-parse --verify -q "origin/$ref^{commit}" || git -C "$dest" rev-parse --verify -q "$ref^{commit}" || true)
if [ -z "$target" ]; then rm -rf -- "${dest:?}"; die "no such branch or commit: $ref"; fi
git -C "$dest" checkout -q --detach "$target"
echo "$dest"
