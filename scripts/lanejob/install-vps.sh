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
# hfjob (Strategy + Dom 2026-10-27): the repo-agnostic HF CPU command ships in the same release copy and gets its own shim next to lanejob's. A commit without it still installs lanejob.
hfjob=0
if git -C "$repo" cat-file -e "$sha:scripts/hfjob/hfjob.sh" 2>/dev/null; then
  install -d -m 755 "$stage/scripts/hfjob"
  git -C "$repo" show "$sha:scripts/hfjob/hfjob.sh" > "$stage/scripts/hfjob/hfjob.sh" && chmod 755 "$stage/scripts/hfjob/hfjob.sh" && bash -n "$stage/scripts/hfjob/hfjob.sh" || { echo "install-vps: staged hfjob.sh does not parse" >&2; exit 1; }
  hfjob=1
  # the standing-box files (inner.sh, boxes.py, box/*) and the data row they read ride along: hfjob finds them next to itself and in ../../data
  for f in $(git -C "$repo" ls-tree -r --name-only "$sha" -- scripts/hfjob data/hf-boxes.json); do
    install -d -m 755 "$stage/$(dirname "$f")"; git -C "$repo" show "$sha:$f" > "$stage/$f"; chmod 755 "$stage/$f"
  done
  [ ! -f "$stage/scripts/hfjob/boxes.py" ] || python3 -m py_compile "$stage/scripts/hfjob/boxes.py" || { echo "install-vps: staged boxes.py does not compile" >&2; exit 1; }
  rm -rf "$stage/scripts/hfjob/__pycache__"
fi
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
if [ "$hfjob" = 1 ]; then   # /usr/local/bin/hfjob (beside the lanejob shim), same shim shape, same backup rule
  hshim="$(dirname "$shim")/hfjob"
  tmp=$(mktemp "$(dirname "$shim")/.hfjob-shim.XXXXXX")
  printf '#!/bin/sh\n# hfjob shim: the real script is the current release copy (scripts/lanejob/install-vps.sh)\nexec %s/current/scripts/hfjob/hfjob.sh "$@"\n' "$root" > "$tmp"
  chmod 755 "$tmp"
  if [ -e "$hshim" ] && ! cmp -s "$tmp" "$hshim"; then cp -p "$hshim" "$hshim.bak-$stamp"; fi
  mv "$tmp" "$hshim"
  echo "hfjob installed -> $hshim"
  # the box job record's poller: a cron entry (path and open-jobs file are data rows) so a dead terminal or reboot never loses a box job. Only when the row exists and we are root.
  cronf=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("cronFile",""))' "$root/$sha/data/hf-boxes.json" 2>/dev/null || true)
  openf=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("openJobsFile",""))' "$root/$sha/data/hf-boxes.json" 2>/dev/null || true)
  if [ -n "$cronf" ] && [ -n "$openf" ] && [ "$(id -u)" = 0 ] && [ "$root" = /opt/frankendom/lanejob ] && [ -d "$(dirname "$cronf")" ]; then
    install -d -m 1777 "$(dirname "$openf")"
    printf '# hfjob box job record poller (scripts/lanejob/install-vps.sh): every minute, polls recorded box jobs and ledgers their end\n* * * * * root %s box-tick >/dev/null 2>&1\n' "$hshim" > "$cronf.tmp" && chmod 644 "$cronf.tmp" && mv "$cronf.tmp" "$cronf"
    echo "hfjob box-tick cron -> $cronf"
  fi
fi
echo "$(date -u +%FT%TZ) lanejob installed $sha" >>"${LANEJOB_LOG:-/var/log/lanejob.log}" 2>/dev/null || true
echo "lanejob installed $sha -> $shim"
