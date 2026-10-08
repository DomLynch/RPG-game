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
    node scripts/vps-shadow/launch.mjs fetch "$job" "$receipt_sha" || echo "vps-receipts: no receipt from job $job; its rows run here"
  done
  vps_trusted=$(node scripts/vps-receipt-trust.mjs "$revision" || true)
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
