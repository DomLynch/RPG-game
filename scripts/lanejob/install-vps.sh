#!/bin/bash
# install-vps.sh [--root DIR] [--shim PATH] [REPO_DIR]: publish the lanejob release copy (Lead + Strategy, Dom fast-track 2026-10-12; hardened after Deploy B's review of #2332).
# Takes scripts/lanejob/lanejob.sh and scripts/lib/waterfall.mjs from REPO_DIR's COMMITTED HEAD (git show, never the working tree: a dirty file cannot install under a clean sha),
# stages them in DIR/.<sha>.tmp, checks the staged copy (bash -n, a VPS_MAX_LOAD1 line, and a --probe self-check that must answer would=...), moves it to DIR/<sha> (a differing
# existing DIR/<sha> is kept aside as DIR/.<sha>.bad-<stamp>), flips DIR/current with ln -sfn + mv -T, (re)writes the 3-line shim PATH that execs DIR/current/scripts/lanejob/lanejob.sh
# (a changed old shim or binary is kept as PATH.bak-<stamp>), and logs "lanejob installed <sha>". Modes: dirs 755, lanejob.sh 755, waterfall.mjs 644.
# NO caller yet: Deploy B wires `bash scripts/lanejob/install-vps.sh` into deploy.sh's publish step once this is on trunk. Until then run it by hand on the VPS as root,
# and prove the result with scripts/lanejob/parity-vps.sh (installed lanejob.sh + waterfall.mjs + shim against a commit), which the Auditor's parity walk and Deploy's step can run.
set -eu
root=/opt/frankendom/lanejob; shim=/usr/local/bin/lanejob
while [ $# -gt 0 ]; do case "$1" in --root) root=$2; shift 2 ;; --shim) shim=$2; shift 2 ;; *) break ;; esac; done
repo=${1:-$(cd "$(dirname "$0")/../.." && pwd)}
sha=$(git -C "$repo" rev-parse HEAD)
stage="$root/.$sha.tmp"; dest="$root/$sha"; stamp=$(date +%Y%m%d-%H%M%S)
install -d -m 755 "$root"
rm -rf "$stage"
install -d -m 755 "$stage/scripts/lanejob" "$stage/scripts/lib"
trap 'rm -rf "$stage"' EXIT
git -C "$repo" show "$sha:scripts/lanejob/lanejob.sh" > "$stage/scripts/lanejob/lanejob.sh" || { echo "install-vps: scripts/lanejob/lanejob.sh is not in $sha" >&2; exit 1; }
git -C "$repo" show "$sha:scripts/lib/waterfall.mjs" > "$stage/scripts/lib/waterfall.mjs" || { echo "install-vps: scripts/lib/waterfall.mjs is not in $sha" >&2; exit 1; }
chmod 755 "$stage/scripts/lanejob/lanejob.sh"; chmod 644 "$stage/scripts/lib/waterfall.mjs"
bash -n "$stage/scripts/lanejob/lanejob.sh" || { echo "install-vps: staged lanejob.sh does not parse" >&2; exit 1; }
grep -Eq '^export const VPS_MAX_LOAD1 = [0-9]+(\.[0-9]+)?;' "$stage/scripts/lib/waterfall.mjs" || { echo "install-vps: waterfall.mjs has no VPS_MAX_LOAD1 line" >&2; exit 1; }
mkdir "$stage/.no-locks" "$stage/.no-slots"   # empty: no marker, four free slots (the slot files are created by the probe's open)
probe=$(LANEJOB_LOAD=0 RELEASE_LOCK_DIR="$stage/.no-locks" LANEJOB_SLOTS="$stage/.no-slots" "$stage/scripts/lanejob/lanejob.sh" --probe true 2>/dev/null) || { echo "install-vps: staged --probe failed (rc $?)" >&2; exit 1; }
rm -rf "$stage/.no-locks" "$stage/.no-slots"
case "$probe" in would=vps|would=spill*) ;; *) echo "install-vps: staged --probe answered '$probe'" >&2; exit 1 ;; esac
if [ -e "$dest" ] || [ -L "$dest" ]; then
  if diff -rq "$stage" "$dest" >/dev/null 2>&1; then rm -rf "$stage"; else mv "$dest" "$root/.$sha.bad-$stamp"; mv -T "$stage" "$dest"; fi
else
  mv -T "$stage" "$dest"
fi
ln -sfn "$sha" "$root/.current.$$" && mv -T "$root/.current.$$" "$root/current"
tmp=$(mktemp "$(dirname "$shim")/.lanejob-shim.XXXXXX")
printf '#!/bin/sh\n# lanejob shim: the real script is the current release copy (scripts/lanejob/install-vps.sh)\nexec %s/current/scripts/lanejob/lanejob.sh "$@"\n' "$root" > "$tmp"
chmod 755 "$tmp"
if [ -e "$shim" ] && ! cmp -s "$tmp" "$shim"; then cp -p "$shim" "$shim.bak-$stamp"; fi
mv "$tmp" "$shim"
# root's HF spill needs a tools checkout at $HOME/.spill-tools (lanejob.sh spill()): a shallow trunk clone of the repo this install came from (Strategy 2026-10-26: it was missing, so root never spilled).
# Only on the real install (default --root, running as root, or an explicit --spill-tools DIR); best effort, an offline clone warns and never fails the install. Existing clones are left to spill() to refresh.
spill_tools=${SPILL_TOOLS:-}
[ -n "$spill_tools" ] || { [ "$root" = /opt/frankendom/lanejob ] && [ "$(id -u)" -eq 0 ] && spill_tools=/root/.spill-tools; }
if [ -n "$spill_tools" ] && [ ! -f "$spill_tools/scripts/vps-shadow/launch.mjs" ]; then
  origin=$(git -C "$repo" remote get-url origin 2>/dev/null || true)
  trunk=$(git -C "$repo" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' || true)
  if [ -n "$origin" ] && [ -n "$trunk" ] && rm -rf "$spill_tools.tmp" && git clone -q --depth 1 --branch "$trunk" "$origin" "$spill_tools.tmp" && [ -f "$spill_tools.tmp/scripts/vps-shadow/launch.mjs" ]; then
    rm -rf "${spill_tools:?}" && mv -T "$spill_tools.tmp" "$spill_tools" && echo "spill tools: $spill_tools at $(git -C "$spill_tools" rev-parse --short HEAD)"
  else
    rm -rf "$spill_tools.tmp"; echo "install-vps: WARNING could not create $spill_tools (origin '${origin##*@}', trunk '$trunk'); root's HF spill will say so" >&2
  fi
fi
echo "$(date -u +%FT%TZ) lanejob installed $sha" >>"${LANEJOB_LOG:-/var/log/lanejob.log}" 2>/dev/null || true
echo "lanejob installed $sha -> $shim"
