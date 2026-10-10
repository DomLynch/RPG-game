# Sourced by deploy.sh. The T4 wall-row box (Lead's brief 2026-09-30, Dom's yes via Strategy): the wall-clock browser rows of this release
# run as ONE Hugging Face job (t4-medium, 4-wide, scripts/hf-wall-rows.mjs) launched right after preflight so it overlaps the quality gate;
# at the release-rows step the Mac trusts only the rows whose receipt says exit 0 for the deployed TREE and runs everything else itself
# (WebKit rows, row 22 while it is held, any T4-failed row — which then gets the Mac's own retry-once-alone — and every row when the job
# never ran, timed out or errored). test:all and publish never leave the Mac.
# Always on (Dom 2026-10-09: "max out the VPS, the HF CPU and the T4"; flags deleted, the Mac-only list is the only config). The T4 guard
# (job.sh) refuses software WebGL, and every failure path (no hf CLI, launch error, no hardware in time, timeout, blocker) trusts nothing,
# so the Mac runs those rows: that is the fallback, not a switch. Cost: one line per run from hf-wall-rows.mjs (~$0.10 at $0.60/h for ~10 min).
# The deploy's clock for collect's wait budget (waitBudget: inside DEPLOY_CEILING_S with 20 min kept for the Mac); sourced right after
# deploy-ceiling.sh, so this is the ceiling's own start to within a second.
: "${HF_WALL_ROWS_DEPLOY_T0:=$(date +%s)}"
hf_state="${HF_WALL_ROWS_STATE:-artifacts/hf-wall-rows/state}"   # the launcher's state file; its receipt is ${hf_state}.json


# scripts/pre-launch.sh starts these jobs at candidate open: the same sha, so the same tree. Taken only when the state file names THIS revision and is under
# PRELAUNCH_MAX_AGE_S (default 4 h) old; anything else launches below as before. Trust is still decided per row from each receipt vs the deployed tree.
hf_wall_rows_prelaunched() {
  local file="${PRELAUNCH_DIR:-$HOME/.claude/state/pre-launch}/${revision}.wall"
  [[ -s "$file" ]] || return 1
  local ids
  ids=$(node -e 'try{const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const ok=s.sha===process.argv[2]&&Date.now()-s.launchedAt<Number(process.argv[3])*1000&&s.jobId;process.stdout.write(ok?String(s.jobId):"")}catch{}' "$file" "$revision" "${PRELAUNCH_MAX_AGE_S:-14400}") || return 1
  [[ -n "$ids" ]] || return 1
  mkdir -p "$(dirname "$hf_state")"; rm -f "${hf_state}.json"; cp "$file" "$hf_state"
  hf_job="$ids"
  echo "hf-wall-rows: reusing the pre-launched job(s) $hf_job for $revision"
}

hf_wall_rows_launch() {
  hf_job=""
  command -v hf >/dev/null 2>&1 || { echo 'hf-wall-rows: no hf CLI on this Mac; every row runs on the Mac'; return 0; }
  if hf_wall_rows_prelaunched; then
    hf_wall_planned=$(node -e 'try{process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).rows.join(","))}catch{}' "$hf_state" || true)
    echo "hf-wall-rows: job $hf_job launched at candidate open for $revision (rows ${hf_wall_planned:-none})"
    return 0
  fi
  hf_job=$(node scripts/hf-wall-rows.mjs launch "$revision" --skip "${placed_skip:-}") || { hf_job=""; echo 'hf-wall-rows: launch failed; every row runs on the Mac'; return 0; }
  hf_wall_planned=$(node -e 'try{process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).rows.join(","))}catch{}' "$hf_state" || true)
  echo "hf-wall-rows: job $hf_job launched for $revision (rows ${hf_wall_planned:-none})"
}

# Waits for the job (bounded: HF_WALL_ROWS_WAIT_MAX_S, inside the deploy ceiling) and appends the trusted rows to trusted_checks.
hf_wall_rows_apply() {
  [[ -n "${hf_job:-}" ]] || return 0
  hf_trusted=$(HF_WALL_ROWS_DEPLOY_T0="$HF_WALL_ROWS_DEPLOY_T0" DEPLOY_CEILING_S="${DEPLOY_CEILING_S:-}" node scripts/hf-wall-rows.mjs collect || true)
  [[ -n "$hf_trusted" ]] || return 0
  # The Published line names the receipt tree (from the launcher's receipt), and a row CI and the T4 both proved is listed once.
  hf_tree=$(grep -oE '"tree": *"[0-9a-f]{40}"' "${hf_state}.json" 2>/dev/null | head -1 | grep -oE '[0-9a-f]{40}' || true)
  trusted_checks=$(printf '%s' "${trusted_checks:+$trusted_checks,}$hf_trusted" | tr ',' '\n' | awk 'NF && !seen[$0]++' | paste -sd, -)
  trust_source="$trust_source + T4 job $hf_job (rows $hf_trusted; receipt tree=${hf_tree:-unknown})"
}

# After the Mac's rows: the per-row side-by-side (Mac result/time, T4 result/time, tree match, trusted or why not).
hf_wall_rows_table() { [[ -n "${hf_job:-}" ]] && node scripts/hf-wall-rows.mjs table || true; }

# On any exit before collect: a job still running would finish on its own (45-min cap) but is cancelled so an aborted deploy pays nothing more.
hf_wall_rows_cancel() { [[ -n "${hf_job:-}" && ! -s "${hf_state}.json" ]] || return 0; local id; for id in ${hf_job//,/ }; do hf jobs cancel "$id" >/dev/null 2>&1 || true; done; }   # hf_job: one id or several, comma-separated
