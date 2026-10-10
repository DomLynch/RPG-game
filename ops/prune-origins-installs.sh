#!/usr/bin/env bash
# Prunes the writer's install dirs: /opt/frankendom-origins/<8 hex> (not the 40-hex releases of scripts/lib/prune-releases.sh).
#   bash ops/prune-origins-installs.sh <opt dir> <newest others to keep> [<rollback sha8>] [--dry-run]
# Keeps `current`, the rollback target when given, and the newest others by mtime; removes the other real 8-hex dirs. Anything else under the dir is left alone.
set -euo pipefail
opt=$(cd "$1" && pwd -P); keep=$2; rollback=${3:-}; dry=${4:-}
[ "$rollback" = --dry-run ] && { dry=--dry-run; rollback=; }
[[ $keep =~ ^[0-9]+$ ]] || { echo "prune-origins: keep must be an integer, got '$keep'"; exit 2; }
cur=$(readlink -f "$opt/current" 2>/dev/null || true)
[[ -n $cur && -d $cur && $cur == "$opt/"* ]] || { echo "prune-origins: current does not resolve into $opt, nothing pruned"; exit 3; }
cd "$opt"; n=0; kept=() drop=()
while IFS= read -r name; do
  [[ $name =~ ^[0-9a-f]{8}$ ]] && [ -d "$name" ] && [ ! -L "$name" ] || continue
  if [ "$opt/$name" = "$cur" ] || [ "$name" = "$rollback" ]; then kept+=("$name")
  elif (( n < keep )); then kept+=("$name"); n=$((n + 1))
  else drop+=("$name"); fi
done < <(ls -1t)
echo "prune-origins: ${#kept[@]} kept (current, rollback ${rollback:-none}, newest $keep others), ${#drop[@]} to remove"
(( ${#drop[@]} )) || exit 0
if [ "$dry" = --dry-run ]; then printf 'prune-origins: would remove %s\n' "${drop[@]}"; exit 0; fi
rm -rf -- "${drop[@]}"; echo "prune-origins: removed ${#drop[@]}"
