#!/usr/bin/env bash
# Keep KEEP releases under ROOT/releases: whatever `current` and `previous` point to always, then the newest others up to KEEP; remove the rest.
# "Newest" is directory mtime (ls -t): rsync -a in deploy.sh stamps each release dir with dist/'s mtime (set while deploy.sh builds and stamps it), so order = deploy order.
# Runs on the VPS: ssh host bash -s -- /var/www/frankendom 5 [--dry-run] < scripts/lib/prune-releases.sh
# Releases share unchanged files by hardlink (deploy.sh --link-dest), so "frees" is du(all) - du(kept), not the sum of the pruned dirs.
set -euo pipefail
root=$(cd "$1" && pwd -P)
keep=$2
dry=${3:-}
[[ $keep =~ ^[0-9]+$ ]] && (( keep >= 2 )) || { echo "prune: KEEP must be an integer >= 2, got '$keep'"; exit 2; }
cd "$root"
cur=$(readlink -f current 2>/dev/null || true)
prev=$(readlink -f previous 2>/dev/null || true)
[[ -n $cur && -d $cur && $cur == "$root/releases/"* ]] || { echo "prune: current does not resolve into $root/releases, nothing pruned"; exit 3; }
kept=() drop=()
others=$(( keep - 1 ))  # slots left for releases other than current/previous
[[ -n $prev && -d $prev && $prev != "$cur" && $prev == "$root/releases/"* ]] && others=$(( others - 1 ))
n=0
while IFS= read -r name; do
  [[ $name =~ ^[0-9a-f]{40}$ ]] || continue  # only revision dirs; anything else under releases/ is left alone
  path="$root/releases/$name"
  [[ -d $path && ! -L $path ]] || continue  # only real dirs: removing a symlinked release could dangle current/previous through it
  if [[ $path == "$cur" || $path == "$prev" ]]; then kept+=("releases/$name")
  elif (( n < others )); then kept+=("releases/$name"); n=$((n + 1))
  else drop+=("releases/$name"); fi
done < <(ls -1t releases)
all_k=$(du -sk releases | cut -f1)
kept_k=$(du -skc "${kept[@]}" | tail -n 1 | cut -f1)
echo "prune: ${#kept[@]} kept (current + previous + newest others, KEEP=$keep), ${#drop[@]} to remove, frees ~$(( (all_k - kept_k) / 1024 )) MiB of $(( all_k / 1024 )) MiB"
(( ${#drop[@]} )) || exit 0
if [[ $dry == --dry-run ]]; then
  printf 'prune: would remove %s\n' "${drop[@]}"
  exit 0
fi
rm -rf -- "${drop[@]}"
echo "prune: removed ${#drop[@]}"
