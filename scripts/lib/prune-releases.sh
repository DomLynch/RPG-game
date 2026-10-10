#!/usr/bin/env bash
# Keep KEEP releases under ROOT/releases: whatever `current` and `previous` point to always, then the newest others up to KEEP; remove the rest.
# "Newest" is directory mtime (ls -t): rsync -a in deploy.sh stamps each release dir with dist/'s mtime (set while deploy.sh builds and stamps it), so order = deploy order.
# Runs on the VPS: ssh host bash -s -- /var/www/frankendom 5 [--dry-run] < scripts/lib/prune-releases.sh
# Writer installs: bash prune-releases.sh /opt/frankendom-origins 5 [--dry-run] origins -- the <8 hex> dirs sit directly under ROOT, `current` and `previous` are the symlinks beside them; same KEEP rule.
# Releases share unchanged files by hardlink (deploy.sh --link-dest), so "frees" is du(all) - du(kept), not the sum of the pruned dirs.
set -euo pipefail
root=$(cd "$1" && pwd -P)
keep=$2
dry=${3:-}
layout=${4:-releases}   # releases: ROOT/releases/<40 hex>; origins: ROOT/<8 hex>
if [[ $layout == origins ]]; then sub=. hex='^[0-9a-f]{8}$'; else sub=releases hex='^[0-9a-f]{40}$'; fi
[[ $keep =~ ^[0-9]+$ ]] && (( keep >= 2 )) || { echo "prune: KEEP must be an integer >= 2, got '$keep'"; exit 2; }
cd "$root"
cur=$(readlink -f current 2>/dev/null || true)
prev=$(readlink -f previous 2>/dev/null || true)
pre="$root/$sub/"; [[ $sub == . ]] && pre="$root/"
[[ -n $cur && -d $cur && $cur == "$pre"* ]] || { echo "prune: current does not resolve into $root/$sub, nothing pruned"; exit 3; }
kept=() drop=()
others=$(( keep - 1 ))  # slots left for releases other than current/previous
[[ -n $prev && -d $prev && $prev != "$cur" && $prev == "$pre"* ]] && others=$(( others - 1 ))
n=0
while IFS= read -r name; do
  [[ $name =~ $hex ]] || continue  # only revision dirs; anything else under releases/ is left alone
  path="$pre$name"
  [[ -d $path && ! -L $path ]] || continue  # only real dirs: removing a symlinked release could dangle current/previous through it
  if [[ $path == "$cur" || $path == "$prev" ]]; then kept+=("$sub/$name")
  elif (( n < others )); then kept+=("$sub/$name"); n=$((n + 1))
  else drop+=("$sub/$name"); fi
done < <(ls -1t "$sub")
all_k=$(du -skc "${kept[@]}" ${drop[@]+"${drop[@]}"} | tail -n 1 | cut -f1)  # portable (BSD du has no --exclude); ${drop[@]+..}: empty array under set -u on bash 3.2
kept_k=$(du -skc "${kept[@]}" | tail -n 1 | cut -f1)
echo "prune: ${#kept[@]} kept (current + previous + newest others, KEEP=$keep), ${#drop[@]} to remove, frees ~$(( (all_k - kept_k) / 1024 )) MiB of $(( all_k / 1024 )) MiB"
(( ${#drop[@]} )) || exit 0
if [[ $dry == --dry-run ]]; then
  printf 'prune: would remove %s\n' "${drop[@]}"
  exit 0
fi
rm -rf -- "${drop[@]}"
echo "prune: removed ${#drop[@]}"
