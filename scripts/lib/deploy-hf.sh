# Sourced by deploy.sh. The T4 wall-row box (Lead's brief 2026-09-30, Dom's yes via Strategy): the wall-clock browser rows of this release
# run as ONE Hugging Face job (t4-medium, 4-wide, scripts/hf-wall-rows.mjs) launched right after preflight so it overlaps the quality gate;
# at the release-rows step the Mac trusts only the rows whose receipt says exit 0 for the deployed TREE and runs everything else itself
# (WebKit rows, row 22 while it is held, any T4-failed row — which then gets the Mac's own retry-once-alone — and every row when the job
# never ran, timed out or errored). test:all and publish never leave the Mac.
# HF_WALL_ROWS: on (default) | shadow (the job runs and its receipts are tabled, but the Mac runs every row — the first live use) | 0 (today's
# behaviour, the kill switch). Cost: one line per run from hf-wall-rows.mjs (~$0.10 at $0.60/h for ~10 min). The HF token is the hf CLI's own.

hf_wall_rows_mode() { case "${HF_WALL_ROWS:-on}" in 0|off|no) echo off;; shadow) echo shadow;; *) echo on;; esac; }

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
  hf_trusted=$(node scripts/hf-wall-rows.mjs collect || true)
  if [[ "$(hf_wall_rows_mode)" == shadow ]]; then echo "hf-wall-rows: shadow run — the T4 vouches for [$hf_trusted]; the Mac runs every row anyway"; return 0; fi
  [[ -n "$hf_trusted" ]] || return 0
  trusted_checks="${trusted_checks:+$trusted_checks,}$hf_trusted"
  trust_source="$trust_source + T4 job $hf_job (rows $hf_trusted)"
}

# After the Mac's rows: the per-row side-by-side (Mac result/time, T4 result/time, tree match, trusted or why not).
hf_wall_rows_table() { [[ -n "${hf_job:-}" ]] && node scripts/hf-wall-rows.mjs table || true; }

# On any exit before collect: a job still running would finish on its own (45-min cap) but is cancelled so an aborted deploy pays nothing more.
hf_wall_rows_cancel() { [[ -n "${hf_job:-}" && ! -s artifacts/hf-wall-rows/state.json ]] && hf jobs cancel "$hf_job" >/dev/null 2>&1 || true; }
