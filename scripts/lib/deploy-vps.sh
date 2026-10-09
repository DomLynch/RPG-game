# Sourced by deploy.sh. Item 3 (pull model): rows the VPS already proved for this exact TREE join the trusted list, so the Mac runs
# the rest. DEPLOY_VPS_RECEIPTS=on (opt-in; unset or anything else = off, every row as before). The receipt comes from
# Hugging Face jobs launched before the deploy with scripts/vps-shadow/launch.mjs (unit|rows <sha>); DEPLOY_HF_ROWS_JOBS="id,id" and DEPLOY_HF_UNIT_JOB=id name them, and this
# step reads each RECEIPT line back (launch.mjs fetch), fresh. VPS_RECEIPT_SHA names the candidate when it is not the revision. Trust is decided by vps-receipt-trust.mjs, not here.
vps_receipts_apply() {
  [[ "${DEPLOY_VPS_RECEIPTS:-}" == on ]] || return 0
  local vps_trusted n
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
    [[ "$stage" == COMPLETED ]] || echo "vps-receipts: job $job is '${stage:-unknown}' (not COMPLETED); its rows run here"
    node scripts/vps-shadow/launch.mjs fetch "$job" "$receipt_sha" || echo "vps-receipts: no receipt from job $job; its rows run here"
  done
  local trust_err; trust_err=$(mktemp)
  vps_trusted=$(node scripts/vps-receipt-trust.mjs "$revision" 2>"$trust_err" || true)
  cat "$trust_err"
  # Every row must be in a shard or Mac-only (WebKit, real-clock). Unassigned shardable rows would run on a busy Mac for nothing: refuse before any check starts.
  if grep -q 'UNASSIGNED rows' "$trust_err" && [[ "${DEPLOY_ALLOW_UNASSIGNED:-}" != 1 ]]; then
    rm -f "$trust_err"; echo "vps-receipts: REFUSED: rows no shard ran (list above). Shard them (scripts/vps-shadow/launch.mjs rows <sha> <flavor> <rows>) or set DEPLOY_ALLOW_UNASSIGNED=1"; exit 1
  fi
  rm -f "$trust_err"
  [[ -n "$vps_trusted" ]] || { echo "0 trusted from VPS receipts; every row not trusted by CI runs here"; return 0; }
  trusted_checks=$(printf '%s' "${trusted_checks:+$trusted_checks,}$vps_trusted" | tr ',' '\n' | awk 'NF && !seen[$0]++' | paste -sd, -)
  n=$(printf '%s' "$vps_trusted" | tr ',' '\n' | wc -l | tr -d ' ')
  trust_source="$trust_source + VPS receipts (rows $vps_trusted; tree-bound)"
  echo "$n trusted from VPS receipts: rows $vps_trusted"
}

# The quality step: a tree-bound unit-suite receipt (the HF job named by DEPLOY_HF_UNIT_JOB, read back by launch.mjs fetch) replaces the Mac's `npm test`/test:all.
# DEPLOY_VPS_RECEIPTS=on only; prints "ok" (and the Mac skips its suite) or nothing (the Mac runs it, as before).
vps_unit_receipt_ok() {
  [[ "${DEPLOY_VPS_RECEIPTS:-}" == on ]] || return 0
  local receipt_sha="${VPS_RECEIPT_SHA:-$revision}"
  [[ "$receipt_sha" =~ ^[0-9a-f]{40}$ ]] || return 0
  rm -f "artifacts/vps-shadow/$receipt_sha/unit.json"   # fresh or nothing
  [[ -n "${DEPLOY_HF_UNIT_JOB:-}" ]] || return 0
  node scripts/vps-shadow/launch.mjs fetch "$DEPLOY_HF_UNIT_JOB" "$receipt_sha" >/dev/null 2>&1 || true
  node scripts/vps-receipt-trust.mjs "$revision" --unit || true
}
