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
