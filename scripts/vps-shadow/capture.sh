#!/usr/bin/env bash
# The VPS stills-box lock (Lead 2026-09-30: ONE frame-stepped capture at a time; light jobs may run alongside at nice 15).
# Installed at /opt/frankendom-shadow/bin/capture. Every capture on the box runs THROUGH it, from the lane's own work dir:
#   capture <lane> <command…>     take the lock (waits up to CAPTURE_WAIT_S, default 3600), run the command under nice 15 / ionice idle, release
#   capture --status              who holds the lock, since when, and the queue order Lead set
#   capture --queue               the order alone
# The lock is a flock on /opt/frankendom-shadow/capture.lock, so a killed capture releases it by itself; the holder file is for humans.
set -euo pipefail
home="${SHADOW_HOME:-/opt/frankendom-shadow}"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$home/ms-playwright}"   # a non-interactive `ssh frankvps capture …` reads no .bashrc
lock="$home/capture.lock"; holder="$home/capture.holder"
queue="$home/capture.queue"   # Lead's order, one line each; edit by hand when Lead changes it
if [[ "${1:-}" == "--queue" ]]; then cat "$queue" 2>/dev/null || echo "no queue file"; exit 0; fi
if [[ "${1:-}" == "--status" ]]; then
  if exec 9<>"$lock" && flock -n 9; then echo "capture lock: FREE"; else echo "capture lock: HELD — $(cat "$holder" 2>/dev/null || echo unknown)"; fi
  echo "load $(cut -d' ' -f1-3 /proc/loadavg)"; echo "queue (Lead's order):"; cat "$queue" 2>/dev/null || echo "  none"; exit 0
fi
lane="${1:?usage: capture <lane> <command…> | --status | --queue}"; shift
[[ $# -gt 0 ]] || { echo "capture: nothing to run"; exit 2; }
exec 9<>"$lock"
if ! flock -n 9; then
  echo "capture: lock held by $(cat "$holder" 2>/dev/null || echo unknown); waiting up to ${CAPTURE_WAIT_S:-3600}s (one capture at a time, Lead's order)"
  flock -w "${CAPTURE_WAIT_S:-3600}" 9 || { echo "capture: gave up waiting"; exit 75; }
fi
printf '%s since %s pid %d in %s: %s\n' "$lane" "$(date -u +%FT%TZ)" $$ "$PWD" "$*" > "$holder"
echo "capture: $lane holds the lock from $(date -u +%TZ) (nice 15, ionice idle)"
status=0
nice -n 15 ionice -c3 "$@" || status=$?
echo "released by $lane at $(date -u +%FT%TZ) (exit $status)" > "$holder"
echo "capture: released at $(date -u +%TZ), exit $status"
exit $status
