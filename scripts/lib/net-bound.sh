# Bounded network calls, sourced by scripts/release-train-publish.sh and scripts/deploy.sh (macOS bash 3.2; perl is on macOS and on the
# CI runners, `timeout` is on neither the Mac nor a bare launchd PATH). 2026-10-15/16: inside the launchd-run train a `git fetch` hung 73 min,
# a `git push` 61 min and a `gh run view` 21 min while the same calls answered in under a second from an interactive shell; nothing above
# them noticed. Every git/gh call the train or deploy.sh makes goes through here, so a hang becomes a named stop in seconds.
#   net_bound SECONDS LABEL cmd...   run cmd in its own process group; at SECONDS kill the whole group, print
#                                    "net-bound: LABEL timed out after SECONDS s" to stderr, set NET_WHY to the same text, return 124.
#                                    The callee's own exit code passes through, except its own 124, which becomes 123 (124 = timed out, only).
#   net_git SECONDS op args...       git with http.lowSpeedLimit/Time via GIT_CONFIG_* (a stalled transfer aborts itself) under net_bound, label "git <op>".
#   net_gh  SECONDS cmd sub args...  gh under net_bound, label "gh <cmd> <sub>".
# Prompts are off (GIT_TERMINAL_PROMPT, GH_PROMPT_DISABLED): nobody can answer one in a launchd job. stdin is /dev/null for the call.
NET_WHY=
net_bound() {
  local secs=$1 label=$2; shift 2
  NET_WHY=
  GIT_TERMINAL_PROMPT=0 GH_PROMPT_DISABLED=1 perl -e '
    my ($secs, @cmd) = @ARGV;
    my $pid = fork(); die "fork: $!" unless defined $pid;
    if (!$pid) { setpgrp(0, 0); open(STDIN, "<", "/dev/null"); exec @cmd; exit 127; }
    $SIG{ALRM} = sub { kill "KILL", -$pid; waitpid($pid, 0); exit 124; };
    alarm $secs; waitpid($pid, 0); alarm 0;
    my $st = $?; my $code = $st & 127 ? 128 + ($st & 127) : $st >> 8;
    exit($code == 124 ? 123 : $code);
  ' "$secs" "$@"
  local rc=$?
  if [ "$rc" = 124 ]; then NET_WHY="$label timed out after ${secs}s"; echo "net-bound: $NET_WHY" >&2; fi
  return $rc
}
# The low-speed limits ride in git's environment, not in -c arguments: the command line stays exactly `git <op> args` (the train's tests,
# and anyone reading ps, match it). It sets GIT_CONFIG_COUNT outright, so a caller's own GIT_CONFIG_* is dropped for the call (no caller sets any).
net_git() {
  local secs=$1 op=$2; shift 2
  GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=http.lowSpeedLimit GIT_CONFIG_VALUE_0=1000 GIT_CONFIG_KEY_1=http.lowSpeedTime GIT_CONFIG_VALUE_1=60 \
    net_bound "$secs" "git $op" git "$op" "$@"
}
net_gh() { local secs=$1 a=$2 b=${3:-}; shift 1; net_bound "$secs" "gh $a $b" gh "$@"; }

# GitHub reachability for the VPS job runners (Strategy 2026-10-21): the box lost outbound TCP 443 to github.com for ~17 minutes (14:15 to 14:32) and a git/curl with no connect timeout sat the
# default 135 s per call. A job whose commit is already in the box's own object store never needs GitHub at all; one that does connects within 30 s or retries, then stops with a NAMED reason.
#   net_github_probe                 curl to github.com with a 30 s connect limit (NET_CONNECT_S) and a 45 s ceiling; 0 = reachable.
#   net_retry TRIES cmd...           run cmd up to TRIES times, NET_RETRY_SLEEP s * attempt apart (default 5); the last exit code passes through.
#   net_fetch_local_first DIR SHA [REFSPEC]   0 at once when DIR already holds SHA as a commit (no network). Otherwise up to 3 attempts of probe + `git fetch -q origin [REFSPEC]` (net_git, 180 s); a final failure
#                                    sets NET_WHY ("github.com unreachable ..." or the fetch's own) and returns 1. SHA may be empty or a ref name: then there is no local shortcut.
NET_CONNECT_S=${NET_CONNECT_S:-30}
net_github_probe() { curl -sS -o /dev/null --connect-timeout "$NET_CONNECT_S" --max-time $((NET_CONNECT_S + 15)) "${NET_PROBE_URL:-https://github.com}" < /dev/null 2>/dev/null; }
net_retry() {
  local tries=$1 i=1 rc=0; shift
  while :; do
    "$@"; rc=$?
    [ "$rc" = 0 ] && return 0
    [ "$i" -ge "$tries" ] && return "$rc"
    sleep $(( ${NET_RETRY_SLEEP:-5} * i )); i=$((i + 1))
  done
}
net_fetch_local_first() {
  local dir=$1 sha=${2:-} refspec=${3:-} i=1
  NET_WHY=
  if [ -n "$sha" ] && git -C "$dir" cat-file -e "$sha^{commit}" 2>/dev/null; then return 0; fi
  while [ "$i" -le 3 ]; do
    if ! net_github_probe; then NET_WHY="github.com unreachable (no connection in ${NET_CONNECT_S}s, attempt $i of 3)"
    elif (cd "$dir" && net_git 180 fetch -q origin $refspec); then NET_WHY=; return 0
    else NET_WHY="git fetch from origin failed or timed out (attempt $i of 3)"
    fi
    [ "$i" -lt 3 ] && sleep $(( ${NET_RETRY_SLEEP:-5} * i ))
    i=$((i + 1))
  done
  echo "net-bound: $NET_WHY" >&2; return 1
}
# net_remote_fetch_cmd REVISION [STORE]: the shell text deploy.sh runs ON THE BOX inside a clone (the writer install's /root/work-1880) to get REVISION, local first (Lead 2026-10-21): already there = no
# fetch; else from the box's own object store STORE (default /opt/frankendom-shadow/repo, no network); else GitHub, 3 attempts each behind a 30 s connect probe, `timeout 180` on the fetch. A final failure
# prints one line and exits 1, so the caller's "the site has not moved" stop runs in seconds instead of after a 135 s hang per call.
# net_remote_checkout_cmd REVISION [STORE] [ORIGIN_URL]: the checkout that follows it. /root/work-1880 is a BLOBLESS partial clone (remote.origin.promisor, blob:none): `git checkout` pulls the blobs the revision
# changes from the promisor remote (GitHub) one lazy fetch at a time ("could not fetch <oid> from promisor remote", Strategy 2026-10-21). First try with origin REWRITTEN to the box's own store (url.<store>.insteadOf:
# a plain `-c remote.origin.url=` is only appended to the list and ignored; the rewrite is what the lazy fetch honours; verified with the origin made unreachable). Only if the store lacks an object: GitHub, 3 attempts
# behind the 30 s probe, `timeout 180` on the checkout; a final failure prints one line and exits 1.
net_remote_checkout_cmd() {
  local rev=$1 store=${2:-/opt/frankendom-shadow/repo} url=${3:-https://github.com/DomLynch/RPG-game.git}
  printf '%s' "git -c 'url.$store.insteadOf=$url' checkout -q -f --detach '$rev' </dev/null 2>/dev/null || { got=0; for i in 1 2 3; do curl -sS -o /dev/null --connect-timeout 30 --max-time 45 https://github.com </dev/null 2>/dev/null && timeout 180 git checkout -q -f --detach '$rev' </dev/null && { got=1; break; }; [ \"\$i\" = 3 ] || sleep \$((i * 5)); done; [ \"\$got\" = 1 ] || { echo 'github.com unreachable or the checkout failed after 3 attempts' >&2; exit 1; }; }"
}
net_remote_fetch_cmd() {
  local rev=$1 store=${2:-/opt/frankendom-shadow/repo}
  printf '%s' "if git cat-file -e '$rev^{commit}' 2>/dev/null; then :; elif git -C '$store' cat-file -e '$rev^{commit}' 2>/dev/null && git fetch -q '$store' '$rev'; then :; else got=0; for i in 1 2 3; do curl -sS -o /dev/null --connect-timeout 30 --max-time 45 https://github.com </dev/null 2>/dev/null && timeout 180 git fetch -q origin '$rev' </dev/null && { got=1; break; }; [ \"\$i\" = 3 ] || sleep \$((i * 5)); done; [ \"\$got\" = 1 ] || { echo 'github.com unreachable or the fetch failed after 3 attempts' >&2; exit 1; }; fi"
}
