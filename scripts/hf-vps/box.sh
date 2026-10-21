#!/usr/bin/env bash
# Runs ON the VPS, sent over ssh by scripts/hf-vps/bin/hf (never installed, so it always matches the checkout). This is the only file that reads the
# Hugging Face token (Dom 2026-10-21): it is read into HF_TOKEN below, passed to the one hf process, and never echoed, logged or put on a command line.
# Protocol on stdin (all base64, one item per line): N, then N hf arguments, then the contents of a --secrets-file ("" if none).
# Beside the plain pass-through it keeps a VPS-side ledger of the jobs it starts (${LEDGER_DIR}/<sha>.ledger, lines "<job id> <timeout seconds> <epoch>"),
# so the box can clean up without the Mac:
#   - `jobs run` whose ssh dropped before the id reached the Mac (HUP/PIPE/TERM while hf ran, or a write that fails): the job is cancelled, the ledger line
#     is moved to ${LEDGER_DIR}/dropped.log, and nothing is left running that nobody knows about;
#   - `jobs cancel <id>` removes the ledger line (the .ledger file becomes .done when empty);
#   - every `jobs run` first reaps ledger jobs still live past their own timeout + REAP_SLACK_S (HF's own cap, as a second lock).
# Env (tests only): HF_VPS_TOKEN_FILE, HF_VPS_HF (the hf binary), HF_VPS_LEDGER_DIR, HF_VPS_REAP_SLACK_S.
set -uo pipefail
TOKEN_FILE="${HF_VPS_TOKEN_FILE:-/root/.hf/token}"
HF="${HF_VPS_HF:-/usr/local/bin/hf}"
LEDGER_DIR="${HF_VPS_LEDGER_DIR:-/srv/dev-jobs/hf-vps-ledger}"
REAP_SLACK_S="${HF_VPS_REAP_SLACK_S:-300}"

dec() { printf '%s' "$1" | base64 -d; }
IFS= read -r n || exit 64
[[ "$n" =~ ^[0-9]+$ ]] || exit 64
args=()
for ((i = 0; i < n; i++)); do IFS= read -r line || exit 64; args+=("$(dec "$line"; printf x)"); args[-1]="${args[-1]%x}"; done
IFS= read -r secrets_b64 || secrets_b64=""

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
if [[ -n "$secrets_b64" ]]; then
  ( umask 077; dec "$secrets_b64" > "$tmp/secrets.env" )
  for ((i = 0; i < ${#args[@]}; i++)); do [[ "${args[i]}" == "--secrets-file" ]] && args[i+1]="$tmp/secrets.env"; done
fi
[[ -r "$TOKEN_FILE" ]] || { echo "hf-vps: no token file on this box" >&2; exit 70; }
HF_TOKEN="$(cat "$TOKEN_FILE")"; export HF_TOKEN
mkdir -p "$LEDGER_DIR"

secs() { local v="$1"; case "$v" in *h) echo $(( ${v%h} * 3600 ));; *m) echo $(( ${v%m} * 60 ));; *s) echo "${v%s}";; ''|*[!0-9]*) echo 0;; *) echo "$v";; esac; }
arg_after() { local k="$1" j; for ((j = 0; j < ${#args[@]} - 1; j++)); do [[ "${args[j]}" == "$k" ]] && { echo "${args[j+1]}"; return; }; done; }
env_arg() { local j; for ((j = 0; j < ${#args[@]} - 1; j++)); do [[ "${args[j]}" == "--env" && "${args[j+1]}" == "$1="* ]] && { echo "${args[j+1]#*=}"; return; }; done; }
ledger_drop() { local id="$1" f; for f in "$LEDGER_DIR"/*.ledger; do [[ -f "$f" ]] || continue; grep -q "^$id " "$f" || continue; grep -v "^$id " "$f" > "$f.new" || true; if [[ -s "$f.new" ]]; then mv "$f.new" "$f"; else rm -f "$f.new"; mv "$f" "${f%.ledger}.done"; fi; done; }

reap() {   # live jobs past their own timeout + slack: cancel (the box's second lock behind HF's own --timeout)
  local f id t at now; now=$(date +%s)
  for f in "$LEDGER_DIR"/*.ledger; do
    [[ -f "$f" ]] || continue
    while read -r id t at; do
      [[ "$id" =~ ^[0-9a-f]{24}$ ]] || continue
      if (( now > at + t + REAP_SLACK_S )); then "$HF" jobs cancel "$id" >/dev/null 2>&1; echo "$(date -u +%FT%TZ) $id reaped past timeout+slack" >> "$LEDGER_DIR/dropped.log"; ledger_drop "$id"; fi
    done < "$f"
  done
}

if [[ "${args[0]:-}" == "jobs" && "${args[1]:-}" == "run" ]]; then
  reap
  # A GPU job launched while a CPU job (any lane's) is live: say so, and log it beside the ledger (Lead + Strategy 2026-10-21: HF CPU jobs were cancelled twice when a gpu-run
  # settled next to them; cause under confirmation). GPU_WITH_CPU_INFLIGHT=warn (default) | refuse (exit 75); the row is scripts/lib/hf-submit.json gpuWithCpuInflight.
  if [[ "$(arg_after --flavor)" == t4-* ]]; then
    cpu_live=$("$HF" jobs ps --format json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((Array.isArray(j)?j:[]).filter(x=>/^cpu/.test(x.flavor||"")&&/^(RUNNING|STARTING|PENDING|SCHEDULING|QUEUED)$/.test(x.status?.stage||"")).map(x=>x.id).join(","))}catch{}})')
    if [[ -n "$cpu_live" ]]; then
      echo "$(date -u +%FT%TZ) $(arg_after --flavor) launch for $(env_arg SHA) with CPU job(s) in flight: $cpu_live (mode ${GPU_WITH_CPU_INFLIGHT:-warn})" >> "$LEDGER_DIR/inflight.log"
      echo "hf-vps: WARN a GPU job is being launched while CPU job(s) are in flight: $cpu_live (logged in $LEDGER_DIR/inflight.log)" >&2
      if [[ "${GPU_WITH_CPU_INFLIGHT:-warn}" == "refuse" ]]; then echo "hf-vps: refusing (gpuWithCpuInflight=refuse)" >&2; exit 75; fi
    fi
  fi
  dropped=0; trap 'dropped=1' HUP PIPE TERM
  "$HF" "${args[@]}" > "$tmp/out" 2> "$tmp/err"; rc=$?
  id=$(grep -oE 'Job started with ID: [0-9a-f]{24}' "$tmp/out" | grep -oE '[0-9a-f]{24}' | head -1)
  if [[ -n "$id" ]]; then
    sha=$(env_arg SHA); [[ "$sha" =~ ^[0-9a-f]{7,40}$ ]] || sha=nosha
    echo "$id $(secs "$(arg_after --timeout)") $(date +%s)" >> "$LEDGER_DIR/$sha.ledger"
    if (( dropped )); then
      "$HF" jobs cancel "$id" >/dev/null 2>&1; echo "$(date -u +%FT%TZ) $id cancelled: ssh dropped before the id reached the Mac (cancel exit $?)" >> "$LEDGER_DIR/dropped.log"; ledger_drop "$id"; exit "$rc"
    fi
  fi
  cat "$tmp/err" >&2; cat "$tmp/out"; printed=$?   # a dead ssh makes the write fail (SIGPIPE/EPIPE): the id never reached the Mac, so nobody will cancel it
  if [[ -n "$id" ]] && { (( dropped )) || (( printed != 0 )); }; then "$HF" jobs cancel "$id" >/dev/null 2>&1; echo "$(date -u +%FT%TZ) $id cancelled: ssh dropped while the id was printed" >> "$LEDGER_DIR/dropped.log"; ledger_drop "$id"; fi
  exit "$rc"
fi

if [[ "${args[0]:-}" == "jobs" && "${args[1]:-}" == "cancel" ]]; then
  "$HF" "${args[@]}"; rc=$?
  (( rc == 0 )) && ledger_drop "${args[2]:-}"
  exit "$rc"
fi

rm -rf "$tmp"; exec "$HF" "${args[@]}"
