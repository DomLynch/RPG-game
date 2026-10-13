#!/usr/bin/env bash
# free-space.sh <min GiB> [path]: prints the df line and exits 1 when fewer than <min GiB> are free on path's volume (default the Data volume; Lead 2026-10-13: the Mac disk filled
# to 100% under finished candidate trees, ENOSPC in every shell). The cut and the release train refuse to start a candidate under 20 GiB. Env (tests): FREE_SPACE_KIB sets the available KiB.
min="${1:?usage: free-space.sh <min GiB> [path]}" path="${2:-/System/Volumes/Data}"
[[ -e "$path" ]] || path=/
line=$(df -h "$path" | tail -n 1)
avail_kib="${FREE_SPACE_KIB:-$(df -k "$path" | awk 'NR==2 { print $4 }')}"
echo "free space on $path: $line"
if (( avail_kib / 1048576 < min )); then echo "free-space: $(( avail_kib / 1048576 )) GiB free is under the $min GiB minimum" >&2; exit 1; fi
