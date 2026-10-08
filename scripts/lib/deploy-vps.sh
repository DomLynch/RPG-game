# Sourced by deploy.sh. Item 3 (pull model): rows the VPS already proved for this exact TREE join the trusted list, so the Mac runs
# the rest. DEPLOY_VPS_RECEIPTS=on (opt-in; unset or anything else = off, every row as before). The receipt comes from
# scripts/vps-shadow-rows.sh <candidate sha> (run before the deploy); this step fetches it itself, fresh; VPS_RECEIPT_SHA names the candidate when it is not the revision.
vps_receipts_apply() {
  [[ "${DEPLOY_VPS_RECEIPTS:-}" == on ]] || return 0
  local vps_trusted n
  rm -rf "artifacts/vps-shadow/${VPS_RECEIPT_SHA:-$revision}"   # no stale local file is ever trusted: fetch fresh or trust nothing
  scripts/vps-shadow-rows.sh "${VPS_RECEIPT_SHA:-$revision}" --fetch || echo "vps-receipts: fetch failed; every row runs here"
  vps_trusted=$(node scripts/vps-receipt-trust.mjs "$revision" || true)
  [[ -n "$vps_trusted" ]] || { echo "0 trusted from VPS receipts; every row not trusted by CI runs here"; return 0; }
  trusted_checks=$(printf '%s' "${trusted_checks:+$trusted_checks,}$vps_trusted" | tr ',' '\n' | awk 'NF && !seen[$0]++' | paste -sd, -)
  n=$(printf '%s' "$vps_trusted" | tr ',' '\n' | wc -l | tr -d ' ')
  trust_source="$trust_source + VPS receipts (rows $vps_trusted; tree-bound)"
  echo "$n trusted from VPS receipts: rows $vps_trusted"
}
