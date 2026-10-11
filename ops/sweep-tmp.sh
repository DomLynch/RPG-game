#!/usr/bin/env bash
# Daily sweep of the VPS /tmp: removes top-level DIRECTORIES that match an ALLOW-LIST of our own mktemp prefixes, are older than SWEEP_AGE_HOURS (24) in every file and have no open handle.
# Logs df before/after and each removal. Anything not on the allow-list stays (tmux-*, snap-private-tmp, claude-*, systemd-private-*, dot-dirs, plain files, symlinks, anything outside SWEEP_ROOT so never /opt or /mnt).
# Open handles come from ONE lsof snapshot per run (not one scan per dir); if lsof fails or returns nothing the run aborts (exit 3) and removes nothing.
#   bash ops/sweep-tmp.sh [--dry-run]       env: SWEEP_ROOT (default /tmp), SWEEP_AGE_HOURS (24), LSOF (lsof; a test stub)
set -euo pipefail
root=${SWEEP_ROOT:-/tmp}
hours=${SWEEP_AGE_HOURS:-24}
lsof_bin=${LSOF:-lsof}
dry=${1:-}
prefixes=(ci-trusted-checks ci-trust record-replay release-checks capture-gate capture-int rollback built-account merged-on-trunk shadow deploy-hf deploy-ceiling carry-previews full-age hf-wall-rows gpu-run gpu-art gpu-wrap verify-loot witch pr-base origins-pool hf-cleanup hf-slots-lock)
[[ $hours =~ ^[0-9]+$ ]] && (( hours >= 1 )) || { echo "sweep-tmp: SWEEP_AGE_HOURS must be an integer >= 1, got '$hours'"; exit 2; }
root=$(cd "$root" && pwd -P)
case $root in /|/opt|/opt/*|/mnt|/mnt/*|/home|/home/*|/root|/root/*|/etc|/etc/*|/usr|/usr/*|/var|/var/*) echo "sweep-tmp: refusing root $root"; exit 2;; esac
df_line() { df -h "$root" | tail -n 1; }
echo "sweep-tmp: $(date -u +%FT%TZ) root=$root age>=${hours}h ${dry:+(dry run)}"
echo "sweep-tmp: df before: $(df_line)"
snap=$(mktemp); trap 'rm -f "$snap"' EXIT
"$lsof_bin" -F n >"$snap" 2>/dev/null || true    # lsof exits 1 on harmless warnings; an empty snapshot is the failure
[[ -s $snap ]] || { echo "sweep-tmp: lsof failed or returned nothing, removing nothing"; exit 3; }
declare -A open_top=()
while IFS= read -r top; do open_top[$top]=1; done < <(sed -n "s|^n$root/\([^/]*\).*|\1|p" "$snap" | sort -u)
allowed() { local p; for p in "${prefixes[@]}"; do [[ $1 == "$p"-* ]] && return 0; done; return 1; }
removed=0
while IFS= read -r -d '' dir; do
  name=${dir#"$root"/}
  allowed "$name" || continue
  [[ -d $dir ]] || continue
  if [[ -n $(find "$dir" -mmin "-$((hours * 60))" -print -quit 2>/dev/null) ]]; then continue; fi    # something inside changed within the window
  if [[ -n ${open_top[$name]:-} ]]; then echo "sweep-tmp: keep $name (open handle)"; continue; fi
  size=$(du -sk "$dir" 2>/dev/null | cut -f1 || echo 0)
  if [[ $dry == --dry-run ]]; then echo "sweep-tmp: would remove $name ($((size / 1024)) MiB)"; else rm -rf -- "$dir"; echo "sweep-tmp: removed $name ($((size / 1024)) MiB)"; fi
  removed=$((removed + 1))
done < <(find "$root" -mindepth 1 -maxdepth 1 -type d -print0)
echo "sweep-tmp: ${removed} dir(s) ${dry:+would be }removed"
echo "sweep-tmp: df after: $(df_line)"
