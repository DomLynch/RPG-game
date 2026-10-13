#!/usr/bin/env bash
# free-space.sh <min GiB> [path]: prints the df line and exits 1 when fewer than <min GiB> are free on path's volume (default the Data volume; Lead 2026-10-13: the Mac disk filled
# to 100% under finished candidate trees, ENOSPC in every shell). The cut and the release train refuse to start a candidate under 20 GiB. When it refuses it names the five biggest dirs to clear: the candidate trees in session scratchpads (<tmp>/claude-501/*/*/scratchpad/*) and the other top-level dirs of <tmp>
# (Lead 2026-10-13). Env (tests): FREE_SPACE_KIB sets the available KiB, FREE_SPACE_TMP the tmp dir.
min="${1:?usage: free-space.sh <min GiB> [path]}" path="${2:-/System/Volumes/Data}"
[[ -e "$path" ]] || path=/
line=$(df -h "$path" | tail -n 1)
avail_kib="${FREE_SPACE_KIB:-$(df -k "$path" | awk 'NR==2 { print $4 }')}"
echo "free space on $path: $line"
if (( avail_kib / 1048576 < min )); then
  echo "free-space: $(( avail_kib / 1048576 )) GiB free is under the $min GiB minimum; biggest dirs to clear (finished candidate trees first, never another lane's live work):" >&2
  tmp="${FREE_SPACE_TMP:-/private/tmp}"
  du -k -d 5 "$tmp" 2>/dev/null | awk -v t="$tmp" '{ p=$2; sub("^" t "/", "", p); n=gsub("/", "/", p); if ((n == 4 && p ~ /^claude-501\/.*\/scratchpad\//) || (n == 0 && p != "claude-501" && p != $2)) printf "%d %.1fG %s\n", $1, $1/1048576, $2 }' | sort -rn | head -n 5 | cut -d' ' -f2- | sed 's/^/  /' >&2
  exit 1
fi
