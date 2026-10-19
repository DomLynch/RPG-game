#!/bin/bash
# The remote-heroes PR's CPU checks on an HF CPU job (node scripts/vps-shadow/launch.mjs job <sha40> --lane char -- bash scripts/character/remote-heroes-checks.sh):
# the warm-plan and preview-rules tests, both tsc projects, the as-data gate and the unit suite. Prints one line per step with its exit code.
node --test origins/preview/warm-plan.test.ts tests/preview-rules.test.ts 2>&1 | tail -12
npx tsc --noEmit -p . 2>&1 | tail -4; echo "tsc=${PIPESTATUS[0]}"
npx tsc --noEmit -p origins 2>&1 | tail -4; echo "origins-tsc=${PIPESTATUS[0]}"
npm run check:as-data -- --gate 2>&1 | tail -4; echo "as-data-gate=${PIPESTATUS[0]}"
node --test --test-skip-pattern="\[slow\]" tests/*.test.ts 2>&1 | tail -14; echo "unit-suite=${PIPESTATUS[0]}"
