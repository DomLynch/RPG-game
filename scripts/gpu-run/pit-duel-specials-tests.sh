#!/usr/bin/env bash
# CPU check for the Pit duel's specials PR on a runner (the Mac hook sends heavy runs off the Mac and the VPS was at load 22): node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/pit-duel-specials-tests.sh
set -uo pipefail
for f in tests/pit-duel-picked-specials.test.ts tests/specials-one-resolver.test.ts tests/record-version-guard.test.ts tests/sparring-player-special-runtime.test.ts tests/origins-duel-weapon.test.ts; do
  echo "== $f"; node --test "$f" 2>&1 | grep -E "^ℹ (tests|pass|fail)|^✖|AssertionError|Error:|expected|actual" | head -20
done
npx tsc --noEmit -p . 2>&1 | head -15
