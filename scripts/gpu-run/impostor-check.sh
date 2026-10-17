#!/usr/bin/env bash
# The far-tier checks in the T4 job's own clone: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/impostor-check.sh
# The unit test, the origins type check, the origins lint, the as-data gate; every check runs, the exit code is 1 if any failed.
set -uo pipefail
fail=0
run() { echo "== $*"; "$@" 2>&1 | tail -12; [[ ${PIPESTATUS[0]} -eq 0 ]] || { echo "FAILED: $*"; fail=1; }; }
run node --test tests/remote-tiers.test.ts tests/preview-rules.test.ts
run npm run -s typecheck:origins
run npm run -s typecheck:tests
run npm run -s lint:origins
run npm run -s check:as-data -- --gate
exit $fail
