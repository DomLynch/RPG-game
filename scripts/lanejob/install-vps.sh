#!/bin/bash
# install-vps.sh [--root DIR] [--shim PATH] [REPO_DIR]: publish the lanejob release copy (Lead + Strategy, Dom fast-track 2026-10-12).
# Copies scripts/lanejob/lanejob.sh and scripts/lib/waterfall.mjs of REPO_DIR (default: this checkout) into DIR/<sha>/scripts/{lanejob,lib}/ (root-owned, 755 dirs,
# 755 script, 644 waterfall.mjs), flips DIR/current to it atomically, (re)writes the 3-line shim PATH that execs DIR/current/scripts/lanejob/lanejob.sh (a changed
# old shim or binary is kept as PATH.bak-<stamp>), and logs "lanejob installed <sha>". deploy.sh's publish step calls it; run it by hand the same way.
set -eu
root=/opt/frankendom/lanejob; shim=/usr/local/bin/lanejob
while [ $# -gt 0 ]; do case "$1" in --root) root=$2; shift 2 ;; --shim) shim=$2; shift 2 ;; *) break ;; esac; done
repo=${1:-$(cd "$(dirname "$0")/../.." && pwd)}
sha=$(git -C "$repo" rev-parse HEAD)
for f in scripts/lanejob/lanejob.sh scripts/lib/waterfall.mjs; do [ -r "$repo/$f" ] || { echo "install-vps: $repo/$f missing" >&2; exit 1; }; done
grep -q '^export const VPS_MAX_LOAD1 = [0-9.]' "$repo/scripts/lib/waterfall.mjs" || { echo "install-vps: waterfall.mjs has no VPS_MAX_LOAD1 line" >&2; exit 1; }
dest="$root/$sha"
install -d -m 755 "$root" "$dest/scripts/lanejob" "$dest/scripts/lib"
install -m 755 "$repo/scripts/lanejob/lanejob.sh" "$dest/scripts/lanejob/lanejob.sh"
install -m 644 "$repo/scripts/lib/waterfall.mjs" "$dest/scripts/lib/waterfall.mjs"
ln -sfn "$sha" "$root/.current.$$" && mv -T "$root/.current.$$" "$root/current"
tmp=$(mktemp "$(dirname "$shim")/.lanejob-shim.XXXXXX")
printf '#!/bin/sh\n# lanejob shim: the real script is the current release copy (scripts/lanejob/install-vps.sh)\nexec %s/current/scripts/lanejob/lanejob.sh "$@"\n' "$root" > "$tmp"
chmod 755 "$tmp"
if [ -e "$shim" ] && ! cmp -s "$tmp" "$shim"; then cp -p "$shim" "$shim.bak-$(date +%Y%m%d-%H%M%S)"; fi
mv "$tmp" "$shim"
echo "$(date -u +%FT%TZ) lanejob installed $sha" >> "${LANEJOB_LOG:-/var/log/lanejob.log}" 2>/dev/null || true
echo "lanejob installed $sha -> $shim"
