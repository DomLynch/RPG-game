# Sourced by deploy.sh. The T4 wall-row box (Lead's brief 2026-09-30, Dom's yes via Strategy): the wall-clock browser rows of this release
# run as ONE Hugging Face job (t4-medium, 4-wide, scripts/hf-wall-rows.mjs) launched right after preflight so it overlaps the quality gate;
# at the release-rows step the Mac trusts only the rows whose receipt says exit 0 for the deployed TREE and runs everything else itself
# (WebKit rows, row 22 while it is held, any T4-failed row — which then gets the Mac's own retry-once-alone — and every row when the job
# never ran, timed out or errored). test:all and publish never leave the Mac.
# HF_WALL_ROWS: 0 (DEFAULT until the shadow side-by-side is in a Published line, Strategy 2026-09-30) | on | shadow (the job runs and its receipts are tabled, but the Mac runs every row — the first live use) | 0 (today's
# behaviour, the kill switch). Cost: one line per run from hf-wall-rows.mjs (~$0.10 at $0.60/h for ~10 min). The HF token is the hf CLI's own.

# Fail safe: only the exact strings `on` and `shadow` enable the T4; unset, 0 and anything else (a typo, "1", "true") is off, and an
# unknown value is named once so a mistyped deploy command cannot silently trust rows (Lead 2026-09-30).
# The deploy's clock for collect's wait budget (waitBudget: inside DEPLOY_CEILING_S with 20 min kept for the Mac); sourced right after
# deploy-ceiling.sh, so this is the ceiling's own start to within a second.
: "${HF_WALL_ROWS_DEPLOY_T0:=$(date +%s)}"
hf_state="${HF_WALL_ROWS_STATE:-artifacts/hf-wall-rows/state}"   # the launcher's state file; its receipt is ${hf_state}.json

hf_wall_rows_mode() { case "${HF_WALL_ROWS:-0}" in on) echo on;; shadow) echo shadow;; 0|"") echo off;; *) echo "hf-wall-rows: HF_WALL_ROWS=${HF_WALL_ROWS} is not on, shadow or 0: treated as off" >&2; echo off;; esac; }

hf_wall_rows_launch() {
  hf_job=""
  [[ "$(hf_wall_rows_mode)" != off ]] || { echo 'hf-wall-rows: off (HF_WALL_ROWS=0); every row runs on the Mac'; return 0; }
  command -v hf >/dev/null 2>&1 || { echo 'hf-wall-rows: no hf CLI on this Mac; every row runs on the Mac'; return 0; }
  hf_job=$(node scripts/hf-wall-rows.mjs launch "$revision") || { hf_job=""; echo 'hf-wall-rows: launch failed; every row runs on the Mac'; return 0; }
  echo "hf-wall-rows: job $hf_job launched for $revision (mode $(hf_wall_rows_mode))"
}

# Waits for the job (bounded: HF_WALL_ROWS_WAIT_MAX_S, inside the deploy ceiling) and appends the trusted rows to trusted_checks.
hf_wall_rows_apply() {
  [[ -n "${hf_job:-}" ]] || return 0
  hf_trusted=$(HF_WALL_ROWS_DEPLOY_T0="$HF_WALL_ROWS_DEPLOY_T0" DEPLOY_CEILING_S="${DEPLOY_CEILING_S:-}" node scripts/hf-wall-rows.mjs collect || true)
  if [[ "$(hf_wall_rows_mode)" == shadow ]]; then echo "hf-wall-rows: shadow run — the T4 vouches for [$hf_trusted]; the Mac runs every row anyway"; return 0; fi
  [[ -n "$hf_trusted" ]] || return 0
  # The Published line names the receipt tree (from the launcher's receipt), and a row CI and the T4 both proved is listed once.
  hf_tree=$(grep -oE '"tree": *"[0-9a-f]{40}"' "${hf_state}.json" 2>/dev/null | head -1 | grep -oE '[0-9a-f]{40}' || true)
  trusted_checks=$(printf '%s' "${trusted_checks:+$trusted_checks,}$hf_trusted" | tr ',' '\n' | awk 'NF && !seen[$0]++' | paste -sd, -)
  trust_source="$trust_source + T4 job $hf_job (rows $hf_trusted; receipt tree=${hf_tree:-unknown})"
}

# After the Mac's rows: the per-row side-by-side (Mac result/time, T4 result/time, tree match, trusted or why not).
hf_wall_rows_table() { [[ -n "${hf_job:-}" ]] && node scripts/hf-wall-rows.mjs table || true; }

# On any exit before collect: a job still running would finish on its own (45-min cap) but is cancelled so an aborted deploy pays nothing more.
hf_wall_rows_cancel() { [[ -n "${hf_job:-}" && ! -s "${hf_state}.json" ]] && hf jobs cancel "$hf_job" >/dev/null 2>&1 || true; }
