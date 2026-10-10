# Sourced by deploy.sh. Item 3 (pull model): rows the VPS already proved for this exact TREE join the trusted list, so the Mac runs
# the rest. Always on (Dom 2026-10-09, flags deleted): no receipt for a row = the Mac runs it. The receipt comes from
# Hugging Face jobs launched before the deploy with scripts/vps-shadow/launch.mjs (unit|rows <sha>); DEPLOY_HF_ROWS_JOBS="id,id" and DEPLOY_HF_UNIT_JOB=id name them, and this
# step reads each RECEIPT line back (launch.mjs fetch), fresh. VPS_RECEIPT_SHA names the candidate when it is not the revision. Trust is decided by vps-receipt-trust.mjs, not here.
vps_receipts_apply() {
  local n
  vps_trusted=""   # global: the Published summary reads it
  local receipt_sha="${VPS_RECEIPT_SHA:-$revision}"
  [[ "$receipt_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "vps-receipts: VPS_RECEIPT_SHA is not a 40-hex sha; every row runs here"; return 0; }
  rm -rf "artifacts/vps-shadow/$receipt_sha"   # no stale local file is ever trusted: fetch fresh or trust nothing
  local job
  for job in $(printf '%s' "${DEPLOY_HF_ROWS_JOBS:-}" | tr ',' ' '); do
    # A named job that is still RUNNING has no RECEIPT line yet (Release G: 4 T4 shards were fetched mid-run and 41 rows fell to the Mac): wait for it, up to DEPLOY_HF_JOB_WAIT_S (default 900).
    local waited=0 stage
    while stage=$(hf jobs inspect "$job" 2>/dev/null | node -e 'try{process.stdout.write(String([].concat(JSON.parse(require("fs").readFileSync(0,"utf8")))[0]?.status?.stage||""))}catch{}') && [[ "$stage" =~ ^(RUNNING|STARTING|PENDING|SCHEDULING)$ ]] && (( waited < ${DEPLOY_HF_JOB_WAIT_S:-900} )); do
      echo "vps-receipts: job $job is $stage; waiting ($waited s)"; sleep 20; waited=$((waited + 20))
    done
    if [[ "$stage" != COMPLETED ]]; then   # the job's own status message ("Job timeout"), not just the stage
      local why; why=$(hf jobs inspect "$job" 2>/dev/null | node -e 'try{process.stdout.write(String([].concat(JSON.parse(require("fs").readFileSync(0,"utf8")))[0]?.status?.message||""))}catch{}') || why=""
      echo "vps-receipts: job $job is '${stage:-unknown}' (not COMPLETED), job message: ${why:-none}; its rows run here"
    fi
    node scripts/vps-shadow/launch.mjs fetch "$job" "$receipt_sha" || echo "vps-receipts: no receipt from job $job; its rows run here"
  done
  local trust_err; trust_err=$(mktemp)
  vps_trusted=$(node scripts/vps-receipt-trust.mjs "$revision" 2>"$trust_err" || true)
  cat "$trust_err"
  # An UNASSIGNED list (above, from vps-receipt-trust.mjs) is information, not a refusal: deploy.sh launches every shardable row itself before the
  # quality gate (launch.mjs cpu), so a row on it is a CI-trusted, out-of-scope, T4 or failed-launch row, and the Mac runs whatever is not trusted.
  rm -f "$trust_err"
  [[ -n "$vps_trusted" ]] || { echo "0 trusted from VPS receipts; every row not trusted by CI runs here"; return 0; }
  trusted_checks=$(printf '%s' "${trusted_checks:+$trusted_checks,}$vps_trusted" | tr ',' '\n' | awk 'NF && !seen[$0]++' | paste -sd, -)
  n=$(printf '%s' "$vps_trusted" | tr ',' '\n' | wc -l | tr -d ' ')
  trust_source="$trust_source + VPS receipts (rows $vps_trusted; tree-bound)"
  echo "$n trusted from VPS receipts: rows $vps_trusted"
}

# The quality step: a tree-bound unit-suite receipt (the HF job named by DEPLOY_HF_UNIT_JOB, read back by launch.mjs fetch) replaces the Mac's `npm test`/test:all.
# Prints "ok" (and the Mac skips its suite) or nothing (the Mac runs it, as before).
vps_unit_receipt_ok() {
  local receipt_sha="${VPS_RECEIPT_SHA:-$revision}"
  [[ "$receipt_sha" =~ ^[0-9a-f]{40}$ ]] || return 0
  rm -f "artifacts/vps-shadow/$receipt_sha/unit.json"   # fresh or nothing
  [[ -n "${DEPLOY_HF_UNIT_JOB:-}" ]] || return 0
  # Release R lost its unit receipt to a fetch whose error was thrown away. Three tries with backoff, every error in the deploy log (stderr: stdout is the "ok" the caller reads).
  local try err="" fetched=0
  for try in 1 2 3; do
    err=$(node scripts/vps-shadow/launch.mjs fetch "$DEPLOY_HF_UNIT_JOB" "$receipt_sha" 2>&1 >/dev/null) && { fetched=1; break; }
    echo "vps-receipts: unit receipt fetch $try/3 for job $DEPLOY_HF_UNIT_JOB failed: ${err:-no output}" >&2
    if (( try < 3 )); then sleep $(( try * ${DEPLOY_HF_FETCH_BACKOFF_S:-5} )); fi
  done
  (( fetched )) || echo "vps-receipts: unit receipt NOT fetched from job $DEPLOY_HF_UNIT_JOB after 3 tries (last error: ${err:-none printed}); the Mac runs its own suite" >&2
  node scripts/vps-receipt-trust.mjs "$revision" --unit || true
}
