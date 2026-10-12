#!/bin/bash
# lanejob-mac CMD ARGS... : the Mac middle tier (Strategy + Dom 2026-10-12; order vps -> mac -> hf-cpu -> hf-t4). Runs a CPU-only job on THIS Mac
# only when the VPS would queue or spill. Exit 75 = "not here, route it on" (tier line says why); 126 = refused; otherwise the job's exit code.
# Gates, all must pass: LANEJOB_NO_MAC unset; the VPS probe (`lanejob --probe`) says would=spill; 5-min load < 6 now and again after 60 s;
# no scripts/deploy.sh running; one Mac slot (a lock dir under the state dir); the job is CPU-only (no browser, full suite, build, Blender).
# Then: nice 15, 30 min cap (kill, exit 75 so the caller re-routes to hf-cpu). Logs `tier=mac ...` to <state>/lanejob-mac.log, then best-effort
# to the VPS /var/log/lanejob.log. macOS bash 3.2 compatible. Test overrides: LANEJOB_MAC_STATE/_LOAD/_PROBE/_RECHECK/_CAP/_NO_REMOTE_LOG/_DEPLOY_RE/_HOLD/_ROWS/_ROWS_RE.
[ $# -gt 0 ] || { echo "usage: lanejob-mac.sh [--gpu --] CMD ARGS..." >&2; exit 2; }
# --gpu -- CMD (Dom's word via Lead and the COO 2026-10-12, Deploy's gate): the Mac FIRST for release browser rows and stills (real GPU), no VPS probe.
# CMD must be a release_commands row of trunk's .quality-gate.json (LANEJOB_MAC_ROWS file overrides, for tests) or node scripts/*-still*.mjs /
# *-contact-sheet.mjs; refused while a Mac-only release row or a WebKit run is active. RELEASE_CHECK_CONCURRENCY=1, PIT_GL unset.
gpu=0
if [ "$1" = "--gpu" ]; then gpu=1; shift; [ "$1" = "--" ] && [ $# -gt 1 ] || { echo "usage: lanejob-mac.sh --gpu -- CMD ARGS..." >&2; exit 2; }; shift; fi
state="${LANEJOB_MAC_STATE:-$HOME/.claude/state}"; log="$state/lanejob-mac.log"; mkdir -p "$state"
ssh_vps="${LANEJOB_MAC_SSH:-ssh -o BatchMode=yes -o ConnectTimeout=5 -i $HOME/.ssh/binance_futures_tool root@49.12.7.18}"
deny='playwright|test:all|test:slow|test:browser|quality|release-check|build|blender|webkit|safari|iphone|simctl|meshopt|gltfpack'
note() {
  local line; line="$(date -u +%Y-%m-%dT%H:%M:%SZ) tier=$*"
  echo "$line" >> "$log"; echo "tier=$*" >&2
  [ -n "${LANEJOB_MAC_NO_REMOTE_LOG:-}" ] || printf '%s\n' "$line" | $ssh_vps 'cat >> /var/log/lanejob.log' >/dev/null 2>&1 || true
}
skip() { note "skip reason=$1"; exit 75; }
load1() { if [ -n "${LANEJOB_MAC_LOAD:-}" ]; then echo "$LANEJOB_MAC_LOAD"; else uptime | sed 's/.*load averages*: *//' | tr -d ',' | awk '{print $2}'; fi; }   # the 5-MINUTE average (Dom, via Lead 2026-10-12): a spike must not skip the Mac
busy() { awk -v l="$(load1)" 'BEGIN { exit !(l >= 6) }'; }

gpu_job_ok() {
  local a; for a in "$@"; do case "$a" in *..*) return 1 ;; esac; done   # same fence as the guard: no `..` anywhere
  if [ "$1" = node ]; then case "$2" in scripts/*-still*.mjs|scripts/*-stills.mjs|scripts/*-contact-sheet.mjs|./scripts/*-still*.mjs|./scripts/*-contact-sheet.mjs) shift 2; for a in "$@"; do printf '%s\n' "$a" | grep -Eq '^[A-Za-z0-9_.:=@/-]+$' || return 1; done; return 0 ;; esac; fi
  local rows; rows="$(if [ -n "${LANEJOB_MAC_ROWS:-}" ]; then cat "$LANEJOB_MAC_ROWS"; else git show refs/remotes/origin/HEAD:.quality-gate.json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const r of JSON.parse(s).release_commands)console.log(r.join(" "))})' 2>/dev/null; fi)"
  printf '%s\n' "$rows" | grep -Fxq -- "$*"
}
mac_row_running() { pgrep -f "${LANEJOB_MAC_ROWS_RE:-scripts/(roster-browser-check|audio-preview|arena-audio-check|sparring-browser-check|double-tap-browser-check|browser-replay-check|next-fight-black-check|pit-landscape-webkit)[.]mjs|--engine webkit}" >/dev/null 2>&1; }

[ -z "${LANEJOB_NO_MAC:-}" ] || skip off-switch
if [ $gpu = 1 ]; then
  gpu_job_ok "$@" || { echo "lanejob-mac: refused, --gpu takes only a release_commands row or a stills/contact-sheet script" >&2; exit 126; }
  ans="would=spill"   # Mac first: no VPS probe
elif printf '%s\n' "$*" | grep -Eiq "$deny"; then echo "lanejob-mac: refused, not a CPU-only job (browser, full suite, build, Blender stay on the VPS/HF)" >&2; exit 126
elif [ -n "${LANEJOB_MAC_PROBE:-}" ]; then ans="$($LANEJOB_MAC_PROBE "$@" 2>/dev/null)"
else ans="$($ssh_vps "sudo -u lanes -H /usr/local/bin/lanejob --probe $(printf '%q ' "$@")" 2>/dev/null)"; fi
case "$ans" in
  "would=spill reason=release-lock"*) skip release-in-flight ;;   # a VPS release marker (/run/frankendom-release)
  "would=spill"*) ;;
  "would=vps"*) skip vps-has-room ;;
  "would=refuse"*) echo "lanejob-mac: the VPS probe refuses this job" >&2; exit 126 ;;
  *) skip probe-failed ;;
esac
released() {   # Deploy's three signs of a release: deploy.sh running, ~/.claude/state/deploy_hold (touched before, removed after Published), live /root/deploy-runs on the VPS
  pgrep -f "${LANEJOB_MAC_DEPLOY_RE:-scripts/deploy\.sh}" >/dev/null 2>&1 && return 0
  [ -e "${LANEJOB_MAC_HOLD:-$HOME/.claude/state/deploy_hold}" ] && return 0
  [ -n "${LANEJOB_MAC_PROBE:-}${LANEJOB_MAC_NO_REMOTE_LOG:-}" ] && return 1
  [ -n "$($ssh_vps 'find /root/deploy-runs /run/frankendom-release -mindepth 1 -maxdepth 1 -mmin -90 2>/dev/null | head -1' 2>/dev/null)" ]
}
released && skip release-in-flight
[ $gpu = 1 ] && mac_row_running && skip mac-row-running
busy && skip "load=$(load1)"
lock="$state/lanejob-mac.slot"
if ! mkdir "$lock" 2>/dev/null; then
  old="$(cat "$lock/pid" 2>/dev/null)"
  if [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then skip slot-busy; fi
  rm -rf "$lock"; mkdir "$lock" 2>/dev/null || skip slot-busy
fi
echo $$ > "$lock/pid"; trap 'rm -rf "$lock"' EXIT
sleep "${LANEJOB_MAC_RECHECK:-60}"
busy && skip "load=$(load1) recheck"
released && skip release-in-flight
[ $gpu = 1 ] && mac_row_running && skip mac-row-running
note "mac slot=1 host=mac gpu=$gpu load=$(load1)"
if [ $gpu = 1 ]; then env -u PIT_GL RELEASE_CHECK_CONCURRENCY=1 nice -n 15 "$@" & job=$!; else nice -n 15 "$@" & job=$!; fi
( sleep "${LANEJOB_MAC_CAP:-1800}"; touch "$lock/capped"; kill -TERM "$job" 2>/dev/null; sleep 5; kill -KILL "$job" 2>/dev/null ) >/dev/null 2>&1 & dog=$!
wait "$job"; rc=$?
pkill -P "$dog" 2>/dev/null; kill "$dog" 2>/dev/null; wait "$dog" 2>/dev/null
[ -e "$lock/capped" ] && { note "mac cap=exceeded"; exit 75; }
exit "$rc"
