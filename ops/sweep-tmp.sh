#!/usr/bin/env bash
# Daily sweep of the VPS /tmp: removes top-level DIRECTORIES that are older than SWEEP_AGE_HOURS (24) in every file and have no open handle. Logs df before/after
# and each removal. Never touches: /tmp/claude-* (live sessions), dot-dirs, systemd-private-*, symlinks (find -type d never lists them), plain files, or anything outside SWEEP_ROOT (so never /opt or /mnt).
#   bash ops/sweep-tmp.sh [--dry-run]       env: SWEEP_ROOT (default /tmp), SWEEP_AGE_HOURS (24), LSOF (lsof; a test stub)
set -euo pipefail
root=${SWEEP_ROOT:-/tmp}
hours=${SWEEP_AGE_HOURS:-24}
lsof_bin=${LSOF:-lsof}
dry=${1:-}
[[ $hours =~ ^[0-9]+$ ]] && (( hours >= 1 )) || { echo "sweep-tmp: SWEEP_AGE_HOURS must be an integer >= 1, got '$hours'"; exit 2; }
root=$(cd "$root" && pwd -P)
case $root in /|/opt|/opt/*|/mnt|/mnt/*|/home|/home/*|/root|/root/*|/etc|/etc/*|/usr|/usr/*|/var|/var/*) echo "sweep-tmp: refusing root $root"; exit 2;; esac
df_line() { df -h "$root" | tail -n 1; }
echo "sweep-tmp: $(date -u +%FT%TZ) root=$root age>=${hours}h ${dry:+(dry run)}"
echo "sweep-tmp: df before: $(df_line)"
removed=0
while IFS= read -r -d '' dir; do
  name=${dir#"$root"/}
  case $name in claude-*|.*|systemd-private-*) continue;; esac
  [[ -d $dir ]] || continue
  if [[ -n $(find "$dir" -mmin "-$((hours * 60))" -print -quit 2>/dev/null) ]]; then continue; fi    # something inside changed within the window
  if [[ -n $("$lsof_bin" +D "$dir" 2>/dev/null | head -n 2 | tail -n 1) ]]; then echo "sweep-tmp: keep $name (open handle)"; continue; fi
  size=$(du -sk "$dir" 2>/dev/null | cut -f1 || echo 0)
  if [[ $dry == --dry-run ]]; then echo "sweep-tmp: would remove $name ($((size / 1024)) MiB)"; else rm -rf -- "$dir"; echo "sweep-tmp: removed $name ($((size / 1024)) MiB)"; fi
  removed=$((removed + 1))
done < <(find "$root" -mindepth 1 -maxdepth 1 -type d -print0)
echo "sweep-tmp: ${removed} dir(s) ${dry:+would be }removed"
echo "sweep-tmp: df after: $(df_line)"
