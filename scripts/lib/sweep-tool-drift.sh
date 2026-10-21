# Source me. sweep_tool_drift <revision>: compares the sha256 of ops/vps-scratch-sweep at the live revision with the tool installed on the VPS (/usr/local/sbin/vps-scratch-sweep) and prints ONE line:
#   OK    sweep-tool: installed == ops/vps-scratch-sweep at <rev8> (<sha8>)
#   WARN  sweep-tool drift: ops/vps-scratch-sweep at <rev8> is <sha8>, installed is <sha8>; reinstall by hand (docs/state/backend.md "SWEEP TOOL INSTALL"); the release is not failed and nothing is installed
#   WARN  sweep-tool: could not read <the repo file | the installed file>; ...
# It NEVER fails the release and NEVER installs: the install of a delete tool is a deliberate hand step (Lead 2026-10-21). Always returns 0.
# Env (tests): SWEEP_DRIFT_REMOTE_CMD replaces the ssh read of the installed file (prints "<sha256>  <path>" like sha256sum); SWEEP_DRIFT_REPO_CMD replaces `git show` (prints the file); SWEEP_DRIFT_OFF=1 skips.
_sdrift_sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1; else shasum -a 256 | cut -d' ' -f1; fi; }
sweep_tool_drift() {
  local rev=$1 root repo installed repo_cmd remote_cmd tmp
  [ "${SWEEP_DRIFT_OFF:-}" = 1 ] && return 0
  root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
  repo_cmd=${SWEEP_DRIFT_REPO_CMD:-"git -C '$root' show '$rev:ops/vps-scratch-sweep'"}
  remote_cmd=${SWEEP_DRIFT_REMOTE_CMD:-"ssh -o BatchMode=yes -o ConnectTimeout=8 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 -i '$HOME/.ssh/binance_futures_tool' root@49.12.7.18 sha256sum /usr/local/sbin/vps-scratch-sweep"}
  tmp=$(mktemp "${TMPDIR:-/tmp}/sweep-drift.XXXXXX") || tmp=""   # a file, not $(...): command substitution strips the trailing newline and the hash would never match
  repo=""; if [ -n "$tmp" ] && bash -c "$repo_cmd" >"$tmp" 2>/dev/null && [ -s "$tmp" ]; then repo=$(_sdrift_sha <"$tmp"); fi   # an empty read is unreadable, not a hash
  [ -z "$tmp" ] || rm -f "$tmp"
  installed=""; if [ -n "$repo" ]; then installed=$(bash -c "$remote_cmd" 2>/dev/null | cut -d' ' -f1 | grep -E '^[0-9a-f]{64}$' | head -n 1) || installed=""; fi   # no ssh unless the repo side read
  if [ -z "$repo" ]; then echo "WARN sweep-tool: could not read ops/vps-scratch-sweep at ${rev:0:8}; drift not checked (the release is not failed)"
  elif [ -z "$installed" ]; then echo "WARN sweep-tool: could not read /usr/local/sbin/vps-scratch-sweep on the VPS; drift not checked (the release is not failed)"
  elif [ "$repo" != "$installed" ]; then echo "WARN sweep-tool drift: ops/vps-scratch-sweep at ${rev:0:8} is ${repo:0:8}, installed is ${installed:0:8}; reinstall by hand (docs/state/backend.md \"SWEEP TOOL INSTALL\"); the release is not failed and nothing is installed"
  else echo "OK sweep-tool: installed == ops/vps-scratch-sweep at ${rev:0:8} (${repo:0:8})"; fi
  return 0
}
