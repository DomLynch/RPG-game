# Sourced by deploy.sh. Item 3 (pull model): rows the VPS already proved for this exact TREE join the trusted list, so the Mac runs
# the rest. Always on (no switch: a receipt that is absent or not for this tree trusts nothing). The receipt comes from
# Hugging Face jobs launched before the deploy with scripts/vps-shadow/launch.mjs (unit|rows <sha>); DEPLOY_HF_ROWS_JOBS="id,id" and DEPLOY_HF_UNIT_JOB=id name them, and this
# step reads each RECEIPT line back (launch.mjs fetch), fresh. VPS_RECEIPT_SHA names the candidate when it is not the revision. Trust is decided by vps-receipt-trust.mjs, not here.
vps_receipts_apply() {
  local vps_trusted n
  # The wait / fetch / trust half is scripts/lib/hf-resolve.sh (also what release-checks.mjs runs mid-pool for the wall rows): trusted rows on stdout, messages on stderr.
  vps_trusted=$(REVISION="$revision" bash scripts/lib/hf-resolve.sh)
  [[ -n "$vps_trusted" ]] || { echo "0 trusted from VPS receipts; every row not trusted by CI runs here"; return 0; }
  hf_trusted_rows="$vps_trusted"
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
  node scripts/vps-shadow/launch.mjs fetch "$DEPLOY_HF_UNIT_JOB" "$receipt_sha" >/dev/null 2>&1 || true
  node scripts/vps-receipt-trust.mjs "$revision" --unit || true
}
