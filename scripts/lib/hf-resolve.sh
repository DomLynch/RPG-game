#!/usr/bin/env bash
# Prints the release rows the Hugging Face jobs proved for this exact TREE ("1,3,6", empty = trust nothing) on stdout; every message goes to stderr.
# Used twice: by vps_receipts_apply (scripts/lib/deploy-vps.sh) and, mid-pool, by release-checks.mjs for the wall rows deploy.sh launched on t4-medium
# (RELEASE_CHECKS_HF_RESOLVE), so the Mac starts its own rows at once and only waits for a job when it has nothing else left to run.
# Env: REVISION, VPS_RECEIPT_SHA (the candidate when it is not the revision), DEPLOY_HF_ROWS_JOBS="id,id", DEPLOY_HF_JOB_WAIT_S (per job, default 900).
set -uo pipefail
cd "$(dirname "$0")/../.."
revision="${REVISION:?REVISION is required}"
receipt_sha="${VPS_RECEIPT_SHA:-$revision}"
[[ "$receipt_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "vps-receipts: VPS_RECEIPT_SHA is not a 40-hex sha; every row runs here" >&2; exit 0; }
rm -rf "artifacts/vps-shadow/$receipt_sha"   # no stale local file is ever trusted: fetch fresh or trust nothing
for job in $(printf '%s' "${DEPLOY_HF_ROWS_JOBS:-}" | tr ',' ' '); do
  # A named job that is still RUNNING has no RECEIPT line yet (Release G: 4 T4 shards were fetched mid-run and 41 rows fell to the Mac): wait for it, up to DEPLOY_HF_JOB_WAIT_S (default 900).
  waited=0
  while stage=$(hf jobs inspect "$job" 2>/dev/null | node -e 'try{process.stdout.write(String([].concat(JSON.parse(require("fs").readFileSync(0,"utf8")))[0]?.status?.stage||""))}catch{}') && [[ "$stage" =~ ^(RUNNING|STARTING|PENDING|SCHEDULING)$ ]] && (( waited < ${DEPLOY_HF_JOB_WAIT_S:-900} )); do
    echo "vps-receipts: job $job is $stage; waiting ($waited s)" >&2; sleep 20; waited=$((waited + 20))
  done
  [[ "$stage" == COMPLETED ]] || echo "vps-receipts: job $job is '${stage:-unknown}' (not COMPLETED); its rows run here" >&2
  node scripts/vps-shadow/launch.mjs fetch "$job" "$receipt_sha" >&2 || echo "vps-receipts: no receipt from job $job; its rows run here" >&2
done
trust_err=$(mktemp)
trusted=$(node scripts/vps-receipt-trust.mjs "$revision" 2>"$trust_err" || true)
cat "$trust_err" >&2
# Rows no shard ran (the receipt lists them as UNASSIGNED) are not blocked: they run on the Mac, and the line below says so.
if grep -q 'UNASSIGNED rows' "$trust_err"; then echo "vps-receipts: rows no shard ran (list above) run on the Mac" >&2; fi
rm -f "$trust_err"
printf '%s' "$trusted"
