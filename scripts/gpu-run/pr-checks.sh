#!/usr/bin/env bash
# What a pull request runs on the T4 (.github/workflows/gpu-checks.yml): node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/pr-checks.sh
# Four checks, one after another in the one job (the build is the job's own): /zone1/ smoke, the open-once smoke (the Pit, /zone1/ and /zone/2/ each load with a
# stored sign-in against a stand-in writer), the Pit fight still at 375, and the Zone 1 pack stills at 375. Every check runs even if an earlier one failed; the exit
# code is 1 if any did, and a CHECK line per check carries its exit and seconds. Stills land in artifacts/gpu-run-stills/ and artifacts/pit/ (the runner brings them back).
set -uo pipefail
fail=0
check() {
  local name="$1" t0; shift; t0=$(date +%s)
  "$@"; local rc=$?
  echo "CHECK $name exit=$rc seconds=$(( $(date +%s) - t0 ))"
  [[ $rc -eq 0 ]] || fail=1
}
check zone1-smoke node scripts/origins-zone1-smoke.mjs
check open-once-smoke node scripts/open-once-smoke.mjs
check pit-fight-still node scripts/pit-fight-boots.mjs
check zone1-pack-stills bash scripts/gpu-run/arena-still.sh
exit $fail
