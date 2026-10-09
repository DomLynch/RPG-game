#!/usr/bin/env bash
# The Mac side of the VPS capture queue (Lead 2026-10-09: the HF spill without an HF token on the VPS). Same arguments as capture, plus where:
#   scripts/capture-mac.sh [--host H] --dir <VPS work dir> [--prio 1..4] [--hf-ok] <lane> <command…>
# It runs `cd <dir> && capture --spill-to-caller …` on the VPS over ssh and streams it. The VPS still owns the queue, the load gate and the
# allow-list (scripts/vps-shadow/capture.sh spill_refusal). When a --hf-ok job reaches its spill point, capture leaves the queue and exits 76 with
# a `CAPTURE_SPILL log=… sha=… args=…` line; this wrapper then runs that sha + command as ONE Hugging Face cpu-upgrade job with this Mac's hf
# login (the v7 runner: Deploy's node:22 image, a public shallow fetch of the full sha, no secrets), streams its log, cancels it after
# CAPTURE_HF_QUIET_S of silence, and appends the result line to the VPS spill log. If the HF launch fails, the job goes back to the VPS queue
# (at the back, without --hf-ok). Bash 3.2 (macOS) safe.
set -uo pipefail
host="${CAPTURE_HOST:-frankvps}"; ssh_cmd="${CAPTURE_SSH:-ssh}"; dir=""
hf="${CAPTURE_HF:-hf}"; hf_quiet="${CAPTURE_HF_QUIET_S:-600}"; hf_poll="${CAPTURE_HF_POLL_S:-20}"; hf_timeout="${CAPTURE_HF_TIMEOUT:-40m}"; hf_rate="${CAPTURE_HF_RATE_PER_H:-0.03}"
opts=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) host="${2:?--host needs a value}"; shift 2 ;;
    --dir) dir="${2:?--dir needs a value}"; shift 2 ;;
    --prio) opts+=(--prio "${2:?--prio needs 1..4}"); shift 2 ;;
    --hf-ok) opts+=(--hf-ok); shift ;;
    *) break ;;
  esac
done
[[ -n "$dir" && $# -ge 2 ]] || { echo "usage: capture-mac.sh [--host H] --dir <VPS work dir> [--prio 1..4] [--hf-ok] <lane> <command…>" >&2; exit 2; }
lane=$1

remote() {   # capture on the VPS with these extra options; prints as it goes, keeps the output in $out_file, returns capture's exit
  local q="" a
  for a in "$@"; do q+=" $(printf '%q' "$a")"; done
  "$ssh_cmd" "$host" "cd $(printf '%q' "$dir") && capture$q" 2>&1 | tee "$out_file"
  return "${PIPESTATUS[0]}"
}
out_file=$(mktemp); trap 'rm -f "$out_file"' EXIT
status=0; remote --spill-to-caller ${opts[@]+"${opts[@]}"} "$@" || status=$?
spill=$(grep -m1 '^CAPTURE_SPILL ' "$out_file" || true)
[[ $status -eq 76 && -n "$spill" ]] || exit $status   # a job's own exit 76 has no CAPTURE_SPILL line

field() { sed -n "s/.* $1=\([^ ]*\).*/\1/p" <<<"$spill"; }
log=$(field log); sha=$(field sha); job=()
while IFS= read -r -d '' a; do job+=("$a"); done < <(printf '%s' "$(field args)" | { base64 --decode 2>/dev/null || base64 -D; })
[[ "$sha" =~ ^[0-9a-f]{40}$ && ${#job[@]} -gt 0 ]] || { echo "capture-mac: unreadable spill line: $spill" >&2; exit 1; }
cmd=$(printf '%q ' "${job[@]}")

script="set -e; apt-get update -qq >/dev/null; apt-get install -y -qq git ca-certificates libjpeg-turbo-progs >/dev/null; mkdir -p /work/repo; cd /work/repo; git init -q; git remote add origin https://github.com/DomLynch/RPG-game.git; git fetch -q --depth 1 origin $sha; git checkout -q --detach $sha; npm ci --no-audit --no-fund >/dev/null; echo \"capture-spill: \$(git rev-parse HEAD) $cmd\"; exec $cmd"
launch=$("$hf" jobs run --flavor cpu-upgrade --timeout "$hf_timeout" --detach node:22 bash -c "$script" 2>&1) || true
id=$(sed -n 's/.*Job started with ID: \([^[:space:]]*\).*/\1/p' <<<"$launch" | head -n 1)
if [[ -z "$id" ]]; then
  echo "capture-mac: the HF launch failed ($(head -c 200 <<<"$launch")); $lane's job goes back to the VPS queue" >&2
  back=(); for a in ${opts[@]+"${opts[@]}"}; do [[ "$a" == --hf-ok ]] || back+=("$a"); done   # keep --prio, drop --hf-ok: it cannot spill twice
  status=0; remote ${back[@]+"${back[@]}"} "$lane" "${job[@]}" || status=$?
  exit $status
fi
echo "capture-mac: $lane runs on Hugging Face job $id (cpu-upgrade): $cmd"
t0=$(date +%s); quiet_since=$t0; seen=0; stage="UNKNOWN"; why=""; status=1
while :; do
  sleep "$hf_poll"
  logs=$("$hf" jobs logs "$id" 2>/dev/null || true); n=$(printf '%s' "$logs" | grep -c '' || true)
  if (( n > seen )); then printf '%s\n' "$logs" | tail -n +"$((seen + 1))"; seen=$n; quiet_since=$(date +%s); fi
  stage=$("$hf" jobs inspect "$id" 2>/dev/null | sed -n 's/.*"stage": *"\([A-Z_]*\)".*/\1/p' | head -n 1)
  case "$stage" in COMPLETED) status=0; break ;; ERROR|CANCELED|CANCELLED|DELETED) break ;; esac
  if (( $(date +%s) - quiet_since >= hf_quiet )); then why=" quiet_cancel=${hf_quiet}s"; "$hf" jobs cancel "$id" >/dev/null 2>&1 || true; stage="CANCELED"; break; fi
done
secs=$(( $(date +%s) - t0 ))
line=$(printf '%s lane=%s hf_job=%s stage=%s%s run_s=%s cost_usd=%s sha=%s cmd=%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$lane" "$id" "${stage:-UNKNOWN}" "$why" "$secs" \
  "$(awk -v s="$secs" -v r="$hf_rate" 'BEGIN { printf "%.4f", s * r / 3600 }')" "$sha" "$cmd")
printf '%s\n' "$line" | "$ssh_cmd" "$host" "cat >> $(printf '%q' "$log")" || echo "capture-mac: could not append to $host:$log: $line" >&2
echo "capture-mac: Hugging Face job $id ended ${stage:-UNKNOWN}${why:+ (no output for ${hf_quiet}s)} after ${secs}s"
exit $status
