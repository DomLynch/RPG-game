#!/bin/bash
# lanejob-mac CMD ARGS... : the Mac middle tier (Strategy + Dom 2026-10-12; order vps -> mac -> hf-cpu -> hf-t4). Runs a CPU-only job on THIS Mac
# only when the VPS would queue or spill. Exit 75 = "not here, route it on" (tier line says why); 126 = refused; otherwise the job's exit code.
# Gates, all must pass: LANEJOB_NO_MAC unset; the VPS probe (`lanejob --probe`) says would=spill; load1 < 6 now and again after 60 s;
# no scripts/deploy.sh running; one Mac slot (a lock dir under the state dir); the job is CPU-only (no browser, full suite, build, Blender).
# Then: nice 15, 30 min cap (kill, exit 75 so the caller re-routes to hf-cpu). Logs `tier=mac ...` to <state>/lanejob-mac.log, then best-effort
# to the VPS /var/log/lanejob.log. macOS bash 3.2 compatible. Test overrides: LANEJOB_MAC_STATE/_LOAD/_PROBE/_RECHECK/_CAP/_NO_REMOTE_LOG/_DEPLOY_RE/_HOLD.
[ $# -gt 0 ] || { echo "usage: lanejob-mac.sh CMD ARGS..." >&2; exit 2; }
state="${LANEJOB_MAC_STATE:-$HOME/.claude/state}"; log="$state/lanejob-mac.log"; mkdir -p "$state"
ssh_vps="${LANEJOB_MAC_SSH:-ssh -o BatchMode=yes -o ConnectTimeout=5 -i $HOME/.ssh/binance_futures_tool root@49.12.7.18}"
deny='playwright|test:all|test:slow|test:browser|quality|release-check|build|blender|webkit|safari|iphone|simctl|meshopt|gltfpack'
note() {
  local line; line="$(date -u +%Y-%m-%dT%H:%M:%SZ) tier=$*"
  echo "$line" >> "$log"; echo "tier=$*" >&2
  [ -n "${LANEJOB_MAC_NO_REMOTE_LOG:-}" ] || printf '%s\n' "$line" | $ssh_vps 'cat >> /var/log/lanejob.log' >/dev/null 2>&1 || true
}
skip() { note "skip reason=$1"; exit 75; }
load1() { if [ -n "${LANEJOB_MAC_LOAD:-}" ]; then echo "$LANEJOB_MAC_LOAD"; else uptime | sed 's/.*load averages*: *//' | tr -d ',' | awk '{print $1}'; fi; }
busy() { awk -v l="$(load1)" 'BEGIN { exit !(l >= 6) }'; }

[ -z "${LANEJOB_NO_MAC:-}" ] || skip off-switch
if printf '%s\n' "$*" | grep -Eiq "$deny"; then echo "lanejob-mac: refused, not a CPU-only job (browser, full suite, build, Blender stay on the VPS/HF)" >&2; exit 126; fi
if [ -n "${LANEJOB_MAC_PROBE:-}" ]; then ans="$($LANEJOB_MAC_PROBE "$@" 2>/dev/null)"
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
  [ -n "${LANEJOB_MAC_PROBE:-}" ] && return 1
  [ -n "$($ssh_vps 'find /root/deploy-runs -mindepth 1 -maxdepth 1 -mmin -90 2>/dev/null | head -1' 2>/dev/null)" ]
}
released && skip release-in-flight
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
note "mac slot=1 load=$(load1)"
nice -n 15 "$@" & job=$!
( sleep "${LANEJOB_MAC_CAP:-1800}"; touch "$lock/capped"; kill -TERM "$job" 2>/dev/null; sleep 5; kill -KILL "$job" 2>/dev/null ) >/dev/null 2>&1 & dog=$!
wait "$job"; rc=$?
pkill -P "$dog" 2>/dev/null; kill "$dog" 2>/dev/null; wait "$dog" 2>/dev/null
[ -e "$lock/capped" ] && { note "mac cap=exceeded"; exit 75; }
exit "$rc"
