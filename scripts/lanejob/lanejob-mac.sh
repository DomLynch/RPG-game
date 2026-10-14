#!/bin/bash
# lanejob-mac [--probe] [--gpu --] CMD ARGS... : the Mac tier, tried FIRST (Dom 2026-10-12, Strategy defect 3: order Mac -> VPS -> hf-cpu, hf-t4 only with --gfx).
# Runs a CPU-only job on THIS Mac when it is quiet. Exit 75 = "not here, route it on to lanejob (VPS), then hf-cpu" (tier line says why); 126 = refused;
# otherwise the job's exit code. Gates, one read each, all must pass: LANEJOB_NO_MAC unset; the job is not on the deny list (browser, full suite, build, Blender:
# a denied job skips the Mac); no release in flight (scripts/deploy.sh, deploy_hold, live VPS run dirs/release lock); the 5-MINUTE load average < 8 (Dom raised
# 6 to 8; a spike must not skip the Mac; no re-check); one Mac slot (a lock dir under the state dir). Then: nice 15, 30 min cap (kill, exit 75 so the caller
# re-routes). --probe CMD prints `would=mac` or `would=skip reason=<why>` (`would=refuse` for a --gpu form that is not allowed), runs nothing, takes no slot,
# writes no log. Logs `tier=mac ...` to <state>/lanejob-mac.log, then best-effort to the VPS /var/log/lanejob.log. macOS bash 3.2 compatible.
# Test overrides: LANEJOB_MAC_STATE/_LOAD/_CAP/_NO_REMOTE_LOG/_DEPLOY_RE/_HOLD/_ROWS/_ROWS_RE.
[ $# -gt 0 ] || { echo "usage: lanejob-mac.sh [--probe] [--gpu --] CMD ARGS..." >&2; exit 2; }
# --gpu -- CMD (Dom's word via Lead and the COO 2026-10-12, Deploy's gate): release browser rows and stills that need the real GPU.
# CMD must be a release_commands row of trunk's .quality-gate.json (LANEJOB_MAC_ROWS file overrides, for tests) or node scripts/*-still*.mjs /
# *-contact-sheet.mjs; refused while a Mac-only release row or a WebKit run is active. RELEASE_CHECK_CONCURRENCY=1, PIT_GL unset.
probe=0; [ "$1" = "--probe" ] && { probe=1; shift; [ $# -gt 0 ] || { echo "usage: lanejob-mac.sh --probe [--gpu --] CMD ARGS..." >&2; exit 2; }; }
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
busy() { awk -v l="$(load1)" 'BEGIN { exit !(l >= 8) }'; }

gpu_job_ok() {
  local a; for a in "$@"; do case "$a" in *..*|*[Ww]eb[Kk]it*) return 1 ;; esac; done   # same fence as the guard: no `..` anywhere
  if [ "$1" = node ]; then case "$2" in scripts/*-still.mjs|scripts/*-stills.mjs|scripts/*-still-*.mjs|scripts/*-stills-*.mjs|scripts/*-contact-sheet.mjs|./scripts/*-still.mjs|./scripts/*-stills.mjs|./scripts/*-still-*.mjs|./scripts/*-stills-*.mjs|./scripts/*-contact-sheet.mjs) shift 2; for a in "$@"; do printf '%s\n' "$a" | grep -Eq '^[A-Za-z0-9_.:=@-][A-Za-z0-9_.:=@/-]*$' || return 1; done; return 0 ;; esac; fi
  local rows; rows="$(if [ -n "${LANEJOB_MAC_ROWS:-}" ]; then cat "$LANEJOB_MAC_ROWS"; else git show refs/remotes/origin/HEAD:.quality-gate.json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const r of JSON.parse(s).release_commands)console.log(r.join(" "))})' 2>/dev/null; fi)"
  printf '%s\n' "$rows" | grep -Fxq -- "$*"
}
mac_row_running() { pgrep -f "${LANEJOB_MAC_ROWS_RE:-scripts/(roster-browser-check|audio-preview|arena-audio-check|sparring-browser-check|double-tap-browser-check|browser-replay-check|next-fight-black-check|pit-landscape-webkit)[.]mjs|--engine webkit}" >/dev/null 2>&1; }

released() {   # Deploy's three signs of a release: deploy.sh running, ~/.claude/state/deploy_hold (touched before, removed after Published), live /root/deploy-runs on the VPS
  pgrep -f "${LANEJOB_MAC_DEPLOY_RE:-scripts/deploy\.sh}" >/dev/null 2>&1 && return 0
  [ -e "${LANEJOB_MAC_HOLD:-$HOME/.claude/state/deploy_hold}" ] && return 0
  [ -n "${LANEJOB_MAC_NO_REMOTE_LOG:-}" ] && return 1
  [ -n "$($ssh_vps 'find /root/deploy-runs /run/frankendom-release -mindepth 1 -maxdepth 1 -mmin -90 2>/dev/null | head -1' 2>/dev/null)" ]
}
lock="$state/lanejob-mac.slot"
gate() {   # prints why the Mac cannot take this job now ("" = it can); no side effects
  [ -z "${LANEJOB_NO_MAC:-}" ] || { echo off-switch; return; }
  if [ $gpu = 1 ]; then gpu_job_ok "$@" || { echo refused-gpu; return; }
  elif printf '%s\n' "$*" | grep -Eiq "$deny"; then echo denied; return; fi
  released && { echo release-in-flight; return; }
  [ $gpu = 1 ] && mac_row_running && { echo mac-row-running; return; }
  busy && { echo "load=$(load1)"; return; }
  local old; old="$(cat "$lock/pid" 2>/dev/null)"
  [ -d "$lock" ] && [ -n "$old" ] && kill -0 "$old" 2>/dev/null && echo slot-busy
  return 0
}
why="$(gate "$@")"
if [ $probe = 1 ]; then
  case "$why" in "") echo "would=mac" ;; refused-gpu) echo "would=refuse" ;; *) echo "would=skip reason=$why" ;; esac
  exit 0
fi
if [ "$why" = refused-gpu ]; then echo "lanejob-mac: refused, --gpu takes only a release_commands row or a stills/contact-sheet script" >&2; exit 126; fi
[ -z "$why" ] || skip "$why"
if ! mkdir "$lock" 2>/dev/null; then
  old="$(cat "$lock/pid" 2>/dev/null)"
  if [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then skip slot-busy; fi
  rm -rf "$lock"; mkdir "$lock" 2>/dev/null || skip slot-busy
fi
echo $$ > "$lock/pid"; trap 'rm -rf "$lock"' EXIT
note "mac slot=1 host=mac gpu=$gpu load=$(load1)"
if [ $gpu = 1 ]; then env -u PIT_GL RELEASE_CHECK_CONCURRENCY=1 nice -n 15 "$@" & job=$!; else nice -n 15 "$@" & job=$!; fi
# the guard `kill -0` matters: killing the dog's sleep (below) lets the subshell run on, and it must not call a finished job capped
( sleep "${LANEJOB_MAC_CAP:-1800}"; kill -0 "$job" 2>/dev/null || exit 0; touch "$lock/capped"; kill -TERM "$job" 2>/dev/null; sleep 5; kill -KILL "$job" 2>/dev/null ) >/dev/null 2>&1 & dog=$!
wait "$job"; rc=$?
pkill -P "$dog" 2>/dev/null; kill "$dog" 2>/dev/null; wait "$dog" 2>/dev/null
[ -e "$lock/capped" ] && { note "mac cap=exceeded"; exit 75; }
exit "$rc"
