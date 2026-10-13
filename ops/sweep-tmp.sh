#!/usr/bin/env bash
# Daily sweep of the VPS /tmp: removes top-level DIRECTORIES that match an ALLOW-LIST of our own mktemp prefixes, are older than SWEEP_AGE_HOURS (24) in every file and have no open handle.
# Logs df before/after and each removal. Anything not on the allow-list stays (tmux-*, snap-private-tmp, claude-*, systemd-private-*, dot-dirs, plain files, symlinks, anything outside SWEEP_ROOT so never /opt or /mnt).
# Open handles come from ONE lsof snapshot per run (not one scan per dir); if lsof fails or returns nothing the run aborts (exit 3) and removes nothing.
# Also removes top-level FILES matching *dist*.tgz (the lane build archives) older than SWEEP_FILE_AGE_HOURS (48) with no open handle.
# Guards for dirs AND files (Lead 2026-10-13): never a symlink target (a symlink under SWEEP_LINK_SCAN points at it), never the never-touch list, never a name a capture holder/queue file
# mentions, and nothing at all while the release lock exists. Every real removal is appended to the manifest (path, bytes, mtime); --dry-run removes and writes nothing.
#   bash ops/sweep-tmp.sh [--dry-run]       env: SWEEP_ROOT (default /tmp), SWEEP_AGE_HOURS (24), SWEEP_FILE_AGE_HOURS (48), LSOF (lsof; a test stub),
#   SWEEP_MANIFEST, SWEEP_LINK_SCAN, SWEEP_HOLD_FILES, SWEEP_RELEASE_LOCK (test overrides)
set -euo pipefail
root=${SWEEP_ROOT:-/tmp}
hours=${SWEEP_AGE_HOURS:-24}
lsof_bin=${LSOF:-lsof}
file_hours=${SWEEP_FILE_AGE_HOURS:-48}
manifest=${SWEEP_MANIFEST:-/var/log/frankendom-tmp-sweep/removed-$(date -u +%Y%m%d).txt}
link_scan=${SWEEP_LINK_SCAN:-/opt/frankendom-shadow}
hold_files=${SWEEP_HOLD_FILES:-"/opt/frankendom-shadow/capture.holder* /opt/frankendom-shadow/capture.queue"}
release_lock=${SWEEP_RELEASE_LOCK:-/run/frankendom-release}
dry=${1:-}
never=(bn-trunk combat-t4 gambit expansion rank-job lanejobs)    # vps-heavy-jobs never-touch list plus the rank job and lanejob slots; claude-* and lanejob* are matched by prefix below
file_globs=('*dist*.tgz')
prefixes=(ci-trusted-checks ci-trust record-replay release-checks capture-gate capture-int rollback built-account merged-on-trunk shadow deploy-hf deploy-ceiling carry-previews full-age hf-wall-rows gpu-run gpu-art gpu-wrap verify-loot witch pr-base origins-pool hf-cleanup hf-slots-lock)
[[ $hours =~ ^[0-9]+$ ]] && (( hours >= 1 )) || { echo "sweep-tmp: SWEEP_AGE_HOURS must be an integer >= 1, got '$hours'"; exit 2; }
[[ $file_hours =~ ^[0-9]+$ ]] && (( file_hours >= 1 )) || { echo "sweep-tmp: SWEEP_FILE_AGE_HOURS must be an integer >= 1, got '$file_hours'"; exit 2; }
# The guard judges the root as given (before it is resolved, so a missing macOS path is still refused) AND as resolved, each without macOS's firmlink
# prefixes: there /home resolves to /System/Volumes/Data/home and /var, /etc and /tmp to /private/..., so a resolved-only match let /home through on the
# Mac (Lead 2026-10-13: a Mac-only red). Linux has neither prefix, so nothing changes there.
refuse_protected() {
  local seen=${1%/}; seen=${seen:-/}; seen=${seen#/System/Volumes/Data}; seen=${seen#/private}; seen=${seen:-/}
  case $seen in /|/opt|/opt/*|/mnt|/mnt/*|/home|/home/*|/root|/root/*|/etc|/etc/*|/usr|/usr/*|/var|/var/*|/System|/System/*|/Users|/Users/*|/Volumes|/Volumes/*) echo "sweep-tmp: refusing root $1"; exit 2;; esac
}
refuse_protected "$root"
root=$(cd "$root" && pwd -P)
refuse_protected "$root"
df_line() { df -h "$root" | tail -n 1; }
echo "sweep-tmp: $(date -u +%FT%TZ) root=$root age>=${hours}h ${dry:+(dry run)}"
echo "sweep-tmp: df before: $(df_line)"
snap=$(mktemp); trap 'rm -f "$snap"' EXIT
"$lsof_bin" -F n >"$snap" 2>/dev/null || true    # lsof exits 1 on harmless warnings; an empty snapshot is the failure
[[ -s $snap ]] || { echo "sweep-tmp: lsof failed or returned nothing, removing nothing"; exit 3; }
declare -A open_top=()
while IFS= read -r top; do open_top[$top]=1; done < <(sed -n "s|^n$root/\([^/]*\).*|\1|p" "$snap" | sort -u)
# Top-level names under the root that a symlink below link_scan points at (one hop, relative links resolved against the link's own dir): never swept.
declare -A linked_top=()
if [[ -d $link_scan ]]; then
  while IFS= read -r -d '' l; do
    t=$(readlink "$l" 2>/dev/null) || continue
    [[ $t == /* ]] || t=$(dirname "$l")/$t
    top=$(printf '%s\n' "$t" | sed -n "s|^$root/\([^/]*\).*|\1|p")
    [[ -n $top ]] && linked_top[$top]=1
  done < <(find "$link_scan" -maxdepth 4 -type l -print0 2>/dev/null)
fi
# Prints why a top-level name must stay, nothing when it may go.
guard() {
  local n=$1 p
  for p in "${never[@]}"; do [[ $n == "$p" ]] && { echo "never-touch list"; return; }; done
  [[ $n == claude-* || $n == lanejob* ]] && { echo "never-touch list"; return; }
  [[ -n ${linked_top[$n]:-} ]] && { echo "symlink target"; return; }
  # shellcheck disable=SC2086
  if cat $hold_files 2>/dev/null | grep -qF -- "$n"; then echo "capture lock"; return; fi
}
record() { # path: append path, bytes, mtime to the manifest (real removals only; call before the rm)
  local f=$1 m
  m=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo 0)
  mkdir -p "$(dirname "$manifest")"
  printf '%s\t%s\t%s\n' "$f" "$(du -sk "$f" 2>/dev/null | cut -f1 || echo 0)K" "$m" >> "$manifest"
}
allowed() { local p; for p in "${prefixes[@]}"; do [[ $1 == "$p"-* ]] && return 0; done; return 1; }
if [[ -e $release_lock ]]; then echo "sweep-tmp: release lock $release_lock present, removing nothing"; echo "sweep-tmp: df after: $(df_line)"; exit 0; fi
removed=0
while IFS= read -r -d '' dir; do
  name=${dir#"$root"/}
  allowed "$name" || continue
  [[ -d $dir ]] || continue
  if [[ -n $(find "$dir" -mmin "-$((hours * 60))" -print -quit 2>/dev/null) ]]; then continue; fi    # something inside changed within the window
  if [[ -n ${open_top[$name]:-} ]]; then echo "sweep-tmp: keep $name (open handle)"; continue; fi
  why=$(guard "$name"); if [[ -n $why ]]; then echo "sweep-tmp: keep $name ($why)"; continue; fi
  size=$(du -sk "$dir" 2>/dev/null | cut -f1 || echo 0)
  if [[ $dry == --dry-run ]]; then echo "sweep-tmp: would remove $name ($((size / 1024)) MiB)"; else record "$dir"; rm -rf -- "$dir"; echo "sweep-tmp: removed $name ($((size / 1024)) MiB)"; fi
  removed=$((removed + 1))
done < <(find "$root" -mindepth 1 -maxdepth 1 -type d -print0)
echo "sweep-tmp: ${removed} dir(s) ${dry:+would be }removed"
nfiles=0
while IFS= read -r -d '' f; do
  name=${f#"$root"/}
  ok=0; for g in "${file_globs[@]}"; do [[ $name == $g ]] && ok=1; done; (( ok )) || continue
  [[ -f $f && ! -L $f ]] || continue
  if [[ -n $(find "$f" -mmin "-$((file_hours * 60))" -print -quit 2>/dev/null) ]]; then continue; fi
  if [[ -n ${open_top[$name]:-} ]]; then echo "sweep-tmp: keep $name (open handle)"; continue; fi
  why=$(guard "$name"); if [[ -n $why ]]; then echo "sweep-tmp: keep $name ($why)"; continue; fi
  size=$(du -sk "$f" 2>/dev/null | cut -f1 || echo 0)
  if [[ $dry == --dry-run ]]; then echo "sweep-tmp: would remove file $name ($((size / 1024)) MiB)"; else record "$f"; rm -f -- "$f"; echo "sweep-tmp: removed file $name ($((size / 1024)) MiB)"; fi
  nfiles=$((nfiles + 1))
done < <(find "$root" -mindepth 1 -maxdepth 1 -type f -print0)
echo "sweep-tmp: ${nfiles} file(s) ${dry:+would be }removed"
echo "sweep-tmp: df after: $(df_line)"
