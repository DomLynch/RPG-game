# deploy-notes-only.sh: a release whose every changed path is under docs/ needs no unit-suite run (Lead 2026-10-11). Any other path,
# a missing live revision, a live revision that is not an ancestor, or an empty diff means no skip: prints "ok" only on a proven notes-only diff.
notes_only_release() {
  local live="$1" rev="$2" paths
  [[ "$live" =~ ^[0-9a-f]{40}$ ]] || return 0
  git merge-base --is-ancestor "$live" "$rev" 2>/dev/null || return 0
  paths=$(git diff --name-only "$live" "$rev") || return 0
  [[ -n "$paths" ]] || return 0
  grep -qvE '^docs/' <<<"$paths" || echo ok
}
