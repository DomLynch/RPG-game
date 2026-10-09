#!/usr/bin/env bash
# The VPS stills-box lock (Lead 2026-09-30: ONE frame-stepped capture at a time; light jobs may run alongside at nice 15).
# Installed at /opt/frankendom-shadow/bin/capture. Every capture on the box runs THROUGH it, from the lane's own work dir:
#   capture [--prio N] <lane> <command…>   queue for the lock (lowest priority number first, then first come, first served; waits up to
#                                 CAPTURE_WAIT_S, default 3600), run the command
#                                 under nice 15 / ionice idle, release
#   capture --status              who holds the lock, since when, and the live queue with positions
#   capture --queue               the live queue alone
# v2 (Strategy 2026-10-01, Auditer): a plain `flock -w` let waiters win in no order and starved the longest waiter. Now every caller takes a
# ticket (a line "pid lane since" appended to capture.queue under a short flock on capture.queue.lock), takes the capture lock only when it is
# the HEAD of the queue, and removes its line on exit; a waiter that died leaves a line that the others prune by a /proc/<pid> check
# (not kill -0: lanes run as different users and kill -0 on another user's pid fails, which v2.0 read as dead and pruned a live ticket). The capture lock
# itself is still the flock on capture.lock, so a killed holder releases it by itself; capture.holder stays the human-readable holder line.
# v3 (Strategy 2026-10-01 21:0x, Dom: all 30 specials in 90 min): CAPTURE_SLOTS (default 3) jobs at once on the 16-core box. Slot 1 is the
# old capture.lock/capture.holder (so a v2 holder still counts); slots 2..N are capture.lock.N/capture.holder.N. Queue positions
# 1..SLOTS may take any free slot; FIFO otherwise unchanged. Captures are frame-stepped, so a busier box is slower, never different.
# A job that holds the lock longer than CAPTURE_WARN_S (default 600, the ≤10 min per job rule) gets a warning line; it is not killed.
# v4 (Lead + Strategy 2026-10-06, Auditer): CAPTURE_SLOTS default 2 (software-WebGL Chrome takes 3-10 cores each; 3 slots overloaded the 16 cores).
# Every job runs in its own session with a unique CAPTURE_JOB tag in its environment; when the job exits (its own timeout included) capture
# kills everything it left behind that still carries the tag (Characters' nightborn Chrome kept ~10 cores for 23 min after its 420 s timeout:
# the node parent died, the browser did not). Found by the tag in /proc/*/environ, not by process group: Playwright starts Chrome in its own
# session (spawn detached), so a group kill misses exactly the process that matters. A job still running is still only warned, never killed.
# v5 (Dom via the COO 2026-10-07: the shared queue had no priority): `--prio N` (or CAPTURE_PRIO), 1..4, default 3. The queue is served
# lowest number first; equal numbers stay first come, first served. Dom's scale: 1 a live bug Dom reported, 2 release-gating, 3 cosmetic or
# ordinary (the default), 4 cleanup compares. A ticket carries ` prio=N` at the end of its line; a line without it (a caller from before v5) is 3.
# A caller that omits --prio behaves exactly as before. Nothing preempts a job already holding a slot; priority only orders the waiters.
# v6 (Deploy 2026-10-08, after the OOM): the job runs through `lanejob` (lanejobs.slice: cores 4-15, MemoryMax=8G), as the live copy already did.
# v7 (Dom, Lead, Strategy via the COO 2026-10-09: load gate + Hugging Face spill):
#   - a job takes a slot only while the 5-minute load average is under CAPTURE_MAX_LOAD (default 12); otherwise it keeps its place and waits.
#   - `--hf-ok` (or CAPTURE_HF_OK=1) tags a job as safe to run elsewhere. Only a tagged job, still waiting after CAPTURE_SPILL_AFTER_S (default 300)
#     with the load STILL over the line at that moment, spills: once, to one Hugging Face cpu-upgrade job (width 1) in Deploy's runner image
#     (scripts/lib/vps-receipts.mjs JOB_IMAGE, the same shallow fetch of the full sha). If the load has cleared it keeps waiting for a VPS slot.
#   - a tagged job must be a unit test or typecheck (node --test on tests/ or origins/ files, npx tsc, npm test / test:all / typecheck:tests) from a
#     clean checkout, so nothing that touches the game server, Postgres, nginx, the deploy lock, a browser or a VPS-only folder can leave the box.
#     Anything else is told why and stays VPS-only. No hf login on this user also means VPS-only.
#   - the spilled job is cancelled after CAPTURE_HF_QUIET_S (default 600) without a new log line, and has its own --timeout (CAPTURE_HF_TIMEOUT, 40m).
#   - every spill appends one line to capture.spill.log: when, lane, HF job, stage, waited, load seen, run seconds, cost at CAPTURE_HF_RATE_PER_H.
set -euo pipefail
home="${SHADOW_HOME:-/opt/frankendom-shadow}"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$home/ms-playwright}"   # a non-interactive `ssh frankvps capture …` reads no .bashrc
lock="$home/capture.lock"; holder="$home/capture.holder"
queue="$home/capture.queue"; qlock="$home/capture.queue.lock"   # the live ticket queue: "pid lane since", head first
wait_s="${CAPTURE_WAIT_S:-3600}"; warn_s="${CAPTURE_WARN_S:-600}"; slots="${CAPTURE_SLOTS:-2}"; prio="${CAPTURE_PRIO:-3}"
max_load="${CAPTURE_MAX_LOAD:-12}"; loadavg="${CAPTURE_LOADAVG:-/proc/loadavg}"; spill_after="${CAPTURE_SPILL_AFTER_S:-300}"; hf_ok="${CAPTURE_HF_OK:-0}"
hf="${CAPTURE_HF:-hf}"; hf_quiet="${CAPTURE_HF_QUIET_S:-600}"; hf_poll="${CAPTURE_HF_POLL_S:-20}"; hf_timeout="${CAPTURE_HF_TIMEOUT:-40m}"; hf_rate="${CAPTURE_HF_RATE_PER_H:-0.03}"
spill_log="$home/capture.spill.log"
load5() { awk '{ print $2 }' "$loadavg"; }
load_ok() { awk -v l="$(load5)" -v m="$max_load" 'BEGIN { exit !(l + 0 < m + 0) }'; }
slot_lock() { [[ $1 -eq 1 ]] && echo "$lock" || echo "$lock.$1"; }
slot_holder() { [[ $1 -eq 1 ]] && echo "$holder" || echo "$holder.$1"; }

# Under the short queue lock: drop the tickets whose pid is gone, then print the queue (head first).
pruned_queue() {
  flock -w 10 "$qlock" bash -c '
    q="$1"; [[ -f "$q" ]] || exit 0
    live=""
    while IFS= read -r line; do
      pid="${line%% *}"
      [[ "$pid" =~ ^[0-9]+$ ]] && [[ -e "/proc/$pid" ]] && live+="$line"$'"'"'\n'"'"'
    done < "$q"
    printf "%s" "$live" > "$q"; printf "%s" "$live"' _ "$queue"
}
# The serving order: lowest prio first, ties in arrival (file) order. A line with no ` prio=N` (pre-v5) counts as 3.
served_queue() { pruned_queue | awk '{ p = 3; if (match($0, / prio=[1-4]$/)) p = substr($0, RSTART + 6, 1); printf "%s\t%09d\t%s\n", p, NR, $0 }' | sort -t $'\t' -k1,1n -k2,2n | cut -f3-; }
show_queue() {
  local n=0 line
  while IFS= read -r line; do [[ -n "$line" ]] || continue; n=$((n + 1)); printf '  %d. %s\n' "$n" "$line"; done < <(served_queue)
  [[ $n -gt 0 ]] || echo "  (empty)"
}
if [[ "${1:-}" == "--queue" ]]; then show_queue; exit 0; fi
if [[ "${1:-}" == "--status" ]]; then
  for k in $(seq 1 "$slots"); do
    if exec 9<>"$(slot_lock "$k")" && flock -n 9; then echo "capture slot $k: FREE"; else echo "capture slot $k: HELD — $(cat "$(slot_holder "$k")" 2>/dev/null || echo unknown)"; fi
    exec 9>&-
  done
  echo "load $(cut -d' ' -f1-3 "$loadavg") (a job starts only while the 5-min figure is under $max_load)"; echo "queue (lowest prio first, then first come, first served; the head holds or takes the lock next):"; show_queue; exit 0
fi
while [[ "${1:-}" == "--prio" || "${1:-}" == "--hf-ok" ]]; do
  if [[ "$1" == "--hf-ok" ]]; then hf_ok=1; shift; else prio="${2:-}"; shift 2 || { echo "capture: --prio needs a number 1..4"; exit 2; }; fi
done
[[ "$prio" =~ ^[1-4]$ ]] || { echo "capture: priority must be 1..4 (1 a live bug Dom reported, 2 release-gating, 3 default, 4 cleanup), got '$prio'"; exit 2; }
lane="${1:?usage: capture [--prio 1..4] [--hf-ok] <lane> <command…> | --status | --queue}"; shift
[[ $# -gt 0 ]] || { echo "capture: nothing to run"; exit 2; }

# --hf-ok is a claim; this checks it. Prints the reason a job may NOT spill (nothing = it may). Only unit tests and typechecks of a clean,
# committed checkout qualify: the HF box gets the sha and nothing else, so a job that needs the server, Postgres, nginx, the deploy lock,
# a browser or a VPS-only folder fails these patterns rather than running half-blind.
spill_refusal() {
  local a test_file='^(tests|origins)/[A-Za-z0-9_./-]+\.test\.(ts|mjs)$'
  for a in "$@"; do
    if [[ "$a" =~ (browser|webkit|playwright|chromium|safari|deploy|nginx|postgres|psql|initdb|migrat|publish|writer|ssh) ]]; then echo "'$a' names a browser, the server, the database or a release step"; return; fi
  done
  case "$1 ${2:-}" in
    "node --test")
      shift 2
      for a in "$@"; do [[ "$a" =~ ^--test-[a-z-]+=.+$ || "$a" =~ $test_file ]] || { echo "node --test takes only tests/ or origins/ *.test files and --test-*= options, not '$a'"; return; }; done ;;
    "npx tsc")
      shift 2
      while [[ $# -gt 0 ]]; do
        case "$1" in --noEmit) shift ;; -p) [[ "${2:-}" =~ ^tsconfig[a-z.]*\.json$ ]] || { echo "tsc -p takes a root tsconfig*.json"; return; }; shift 2 ;; *) echo "tsc takes only -p tsconfig*.json and --noEmit, not '$1'"; return ;; esac
      done ;;
    "npm test") [[ $# -eq 2 ]] || { echo "npm test takes no arguments here"; return; } ;;
    "npm run") [[ $# -eq 3 && "$3" =~ ^(test|test:all|typecheck:tests)$ ]] || { echo "npm run takes only test, test:all or typecheck:tests"; return; } ;;
    *) echo "only node --test, npx tsc, npm test and npm run test|test:all|typecheck:tests may spill"; return ;;
  esac
  git rev-parse --verify -q HEAD >/dev/null 2>&1 || { echo "$PWD is not a git checkout"; return; }
  [[ -z "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]] || { echo "the checkout has uncommitted changes (the HF box only gets the commit)"; return; }
  "$hf" auth whoami >/dev/null 2>&1 || echo "no Hugging Face login for $(id -un) on this box"
}
if [[ "$hf_ok" == 1 ]]; then
  why=$(spill_refusal "$@")
  if [[ -n "$why" ]]; then echo "capture: --hf-ok refused ($why); $lane's job stays on the VPS"; hf_ok=0; fi
fi

# The spill: one HF job in Deploy's runner image, its log streamed here, cancelled after hf_quiet seconds of silence. Prints one spill.log line.
run_on_hf() {
  local waited=$1 load_seen=$2 sha cmd script out id t0 stage="UNKNOWN" seen=0 quiet_since n logs status=1 why=""
  sha=$(git rev-parse HEAD); cmd=$(printf '%q ' "$@")
  script="set -e; apt-get update -qq >/dev/null; apt-get install -y -qq git ca-certificates libjpeg-turbo-progs >/dev/null; mkdir -p /work/repo; cd /work/repo; git init -q; git remote add origin https://github.com/DomLynch/RPG-game.git; git fetch -q --depth 1 origin $sha; git checkout -q --detach $sha; npm ci --no-audit --no-fund >/dev/null; echo \"capture-spill: \$(git rev-parse HEAD) $cmd\"; exec $cmd"
  out=$("$hf" jobs run --flavor cpu-upgrade --timeout "$hf_timeout" --detach node:22 bash -c "$script" 2>&1) || true
  id=$(sed -n 's/.*Job started with ID: \([^[:space:]]*\).*/\1/p' <<<"$out" | head -n 1)
  if [[ -z "$id" ]]; then echo "capture: the HF launch failed ($(head -c 200 <<<"$out")); $lane's job goes back to the VPS queue" >&2; return 99; fi
  leave_queue   # the VPS queue moves on now; the job is HF's
  echo "capture: $lane spilled to Hugging Face job $id (cpu-upgrade, load5 $load_seen after ${waited}s waiting): $cmd"
  t0=$(date +%s); quiet_since=$t0
  while :; do
    sleep "$hf_poll"
    logs=$("$hf" jobs logs "$id" 2>/dev/null || true); n=$(printf '%s' "$logs" | grep -c '' || true)
    if (( n > seen )); then printf '%s\n' "$logs" | tail -n +"$((seen + 1))"; seen=$n; quiet_since=$(date +%s); fi
    stage=$("$hf" jobs inspect "$id" 2>/dev/null | sed -n 's/.*"stage": *"\([A-Z_]*\)".*/\1/p' | head -n 1)
    case "$stage" in COMPLETED) status=0; break ;; ERROR|CANCELED|CANCELLED|DELETED) break ;; esac
    if (( $(date +%s) - quiet_since >= hf_quiet )); then why=" quiet_cancel=${hf_quiet}s"; "$hf" jobs cancel "$id" >/dev/null 2>&1 || true; stage="CANCELED"; break; fi
  done
  local secs=$(( $(date +%s) - t0 ))
  printf '%s lane=%s hf_job=%s stage=%s%s waited_s=%s load5=%s run_s=%s cost_usd=%s sha=%s cmd=%s\n' "$(date -u +%FT%TZ)" "$lane" "$id" "$stage" "$why" "$waited" "$load_seen" "$secs" \
    "$(awk -v s="$secs" -v r="$hf_rate" 'BEGIN { printf "%.4f", s * r / 3600 }')" "$sha" "$cmd" >> "$spill_log"
  echo "capture: Hugging Face job $id ended $stage${why:+ (no output for ${hf_quiet}s)} after ${secs}s"
  return $status
}

# Take a ticket; give it back on any exit (a kill -9 leaves it: the others prune it by the pid check).
ticket="$$ $lane since $(date -u +%FT%TZ) prio=$prio"
flock -w 10 "$qlock" bash -c 'printf "%s\n" "$2" >> "$1"' _ "$queue" "$ticket"
leave_queue() { flock -w 10 "$qlock" bash -c 'q="$1"; [[ -f "$q" ]] || exit 0; rest=$(grep -v "^$2 " "$q" || true); printf "%s\n" "$rest" | sed "/^$/d" > "$q"' _ "$queue" "$$" 2>/dev/null || true; }
job_tag=""
# Everything the job started that is still alive after it exited (same user, so /proc/<pid>/environ is readable): TERM, 3 s, KILL.
sweep_orphans() {
  [[ -n "$job_tag" ]] || return 0
  local pids; pids=$(grep -lszx "CAPTURE_JOB=$job_tag" /proc/[0-9]*/environ 2>/dev/null | cut -d/ -f3 | grep -vx "$$" || true)
  [[ -n "$pids" ]] || return 0
  echo "capture: $lane's job left $(echo $pids | wc -w) process(es) behind, killing them: $(ps -o comm= -p $(echo $pids | tr ' ' ',') 2>/dev/null | sort | uniq -c | tr -s ' \n' ' ')" >&2
  kill -TERM $pids 2>/dev/null || true; sleep 3; kill -KILL $pids 2>/dev/null || true
}
trap 'sweep_orphans; leave_queue' EXIT

started=$(date +%s); last_said=0; last_pos=0; myslot=0; spill_checked=0
try_slot() { local k; for k in $(seq 1 "$slots"); do exec 9<>"$(slot_lock "$k")"; if flock -n 9; then myslot=$k; return 0; fi; exec 9>&-; done; return 1; }
while :; do
  pos=0; n=0
  while IFS= read -r line; do [[ -n "$line" ]] || continue; n=$((n + 1)); [[ "${line%% *}" == "$$" ]] && pos=$n; done < <(served_queue)
  if [[ $pos -ge 1 && $pos -le $slots ]] && load_ok && try_slot; then break; fi   # within the first SLOTS of the queue AND the 5-min load is under the line AND a slot is free
  if [[ $pos -eq 0 ]]; then flock -w 10 "$qlock" bash -c 'printf "%s\n" "$2" >> "$1"' _ "$queue" "$ticket"; echo "capture: $lane's ticket was gone (pruned by mistake?); re-queued at the back"; fi
  now=$(date +%s)
  if [[ "$hf_ok" == 1 && $spill_checked -eq 0 ]] && (( now - started >= spill_after )); then
    spill_checked=1; seen_load=$(load5)
    if load_ok; then echo "capture: $lane has waited $((now - started))s but load5 $seen_load is under $max_load now: it stays on the VPS"
    else status=0; run_on_hf "$((now - started))" "$seen_load" "$@" || status=$?; [[ $status -eq 99 ]] || exit $status; fi
  fi
  if (( now - started >= wait_s )); then echo "capture: gave up waiting after ${wait_s}s at position $pos of $n"; exit 75; fi
  if [[ $pos -ne $last_pos ]] || (( now - last_said >= 60 )); then
    (( last_pos > 0 && pos > last_pos )) && echo "capture: $lane moved back from $last_pos to $pos: a higher-priority job joined the queue (prio $prio waits behind lower numbers)"
    h=$(cat "$holder" 2>/dev/null || echo unknown); [[ "$h" == released* ]] && h="free ($h); the head takes it next"
    echo "capture: lock $( [[ "$h" == free* ]] && echo "$h" || echo "held by $h"); $lane is $pos of $n in the queue, load5 $(load5) (starts under $max_load) (prio $prio; lowest first, then first come; waiting up to ${wait_s}s, $((now - started))s so far)"
    last_pos=$pos; last_said=$now
  fi
  sleep 2   # fd 9 is closed unless a slot was taken
done

holder="$(slot_holder "$myslot")"
printf '%s since %s pid %d in %s: %s\n' "$lane" "$(date -u +%FT%TZ)" $$ "$PWD" "$*" > "$holder"
echo "capture: $lane holds slot $myslot of $slots from $(date -u +%TZ) (nice 15, ionice idle)"
( exec 9>&-; sleep "$warn_s" && echo "capture: WARNING $lane has held the lock for ${warn_s}s (the rule is ≤10 min per job; split the job or hand the box on)" >&2 ) &
warner=$!
status=0
job_tag="capture-$$-$(date +%s)"
setsid env CAPTURE_JOB="$job_tag" nice -n 15 ionice -c3 lanejob "$@" 9>&- &   # own session + tag; the job and its children never hold the lock fd
job=$!
wait "$job" || status=$?
sweep_orphans
{ pkill -P "$warner"; kill "$warner"; wait "$warner"; } 2>/dev/null || true   # the warner AND its sleep: a leftover sleep held the caller's pipe open for 600 s (v4)
echo "released by $lane at $(date -u +%FT%TZ) (exit $status)" > "$holder"
echo "capture: released at $(date -u +%TZ), exit $status"
exit $status
