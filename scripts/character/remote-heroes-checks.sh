#!/bin/bash
# The remote-heroes PR's CPU checks on an HF CPU job (node scripts/vps-shadow/launch.mjs job <sha40> --lane char -- bash scripts/character/remote-heroes-checks.sh):
# the warm-plan and preview-rules tests, both type checks, the as-data gate and the unit suite. One line per step with its exit code; every failing test is named.
failing() { grep -E "^\s*not ok " "$1" | head -${2:-40} | cut -c1-200; }
node --test origins/preview/warm-plan.test.ts tests/preview-rules.test.ts > /tmp/t-targeted.log 2>&1; echo "targeted=$?"; failing /tmp/t-targeted.log; grep -E "^# (pass|fail)" /tmp/t-targeted.log
grep -B2 -A12 -E "^\s*not ok " /tmp/t-targeted.log | head -40 | cut -c1-220
npx tsc --noEmit -p . 2>&1 | tail -4; echo "tsc=${PIPESTATUS[0]}"
npm run typecheck:origins 2>&1 | tail -4; echo "origins-tsc=${PIPESTATUS[0]}"
npm run check:as-data -- --gate 2>&1 | tail -2 | cut -c1-200; echo "as-data-gate=${PIPESTATUS[0]}"
node --test --test-skip-pattern="\[slow\]" tests/*.test.ts > /tmp/t-suite.log 2>&1; echo "unit-suite=$?"; grep -E "^# (tests|pass|fail)" /tmp/t-suite.log; failing /tmp/t-suite.log 60
