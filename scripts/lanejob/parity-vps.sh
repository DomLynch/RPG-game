#!/bin/bash
# parity-vps.sh [--ssh CMD] [--root DIR] [--shim PATH] [--ref REV] [REPO_DIR]: does the lanejob that the VPS actually runs match a commit? (Auditor on #2332, 2026-10-12: the same gap as #2304,
# a merged lanejob.sh or VPS_MAX_LOAD1 change that never reached /usr/local/bin/lanejob.) Compares the sha256 of scripts/lanejob/lanejob.sh and scripts/lib/waterfall.mjs at REV (default HEAD)
# of REPO_DIR with DIR/current/... on the VPS, and checks that the shim PATH still execs DIR/current. Prints `DIFF <file>` per mismatch and a final
# `lanejob parity installed=<sha> ref=<sha> diffs=<n>`; exit 1 if diffs > 0. CMD is the remote runner (default: ssh as root to the storage box); tests pass a local stub.
set -u
ssh_cmd="${PARITY_SSH:-ssh -o BatchMode=yes -o ConnectTimeout=8 -i $HOME/.ssh/binance_futures_tool root@49.12.7.18}"
root=/opt/frankendom/lanejob; shim=/usr/local/bin/lanejob; ref=HEAD
while [ $# -gt 0 ]; do case "$1" in --ssh) ssh_cmd=$2; shift 2 ;; --root) root=$2; shift 2 ;; --shim) shim=$2; shift 2 ;; --ref) ref=$2; shift 2 ;; *) break ;; esac; done
repo=${1:-$(cd "$(dirname "$0")/../.." && pwd)}
sum() { if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1; else shasum -a 256 | cut -d' ' -f1; fi; }
n=0
for f in scripts/lanejob/lanejob.sh scripts/lib/waterfall.mjs; do
  want=$(git -C "$repo" show "$ref:$f" 2>/dev/null | sum)
  got=$($ssh_cmd "cat '$root/current/$f' 2>/dev/null" | sum)
  [ "$want" = "$got" ] || { echo "DIFF $f"; n=$((n+1)); }
done
last=$($ssh_cmd "tail -n 1 '$shim' 2>/dev/null")
[ "$last" = "exec $root/current/scripts/lanejob/lanejob.sh \"\$@\"" ] || { echo "DIFF $shim (not the shim that execs $root/current)"; n=$((n+1)); }
echo "lanejob parity installed=$($ssh_cmd "readlink '$root/current' 2>/dev/null") ref=$(git -C "$repo" rev-parse "$ref") diffs=$n"
[ "$n" -eq 0 ]
