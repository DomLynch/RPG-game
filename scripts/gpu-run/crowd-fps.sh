#!/usr/bin/env bash
# Zone 1 crowd frame-rate on the T4 (launch gate S2): node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/crowd-fps.sh [profile]
# Builds the origins preview, then runs scripts/origins-crowd-fps.mjs (0 / 8 / 16 / 40 remote heroes, idle and walking, 1x and 4x CPU, 375x812 touch) against it; the receipt lands in
# artifacts/crowd-fps/receipt.json and comes back with the job. The build must carry #2929 (originsPreview.setOthers).
# `profile`: an UNMINIFIED build (real function names) and a CPU profile per case, 16 and 40 players walking at 1x and 4x; the top self-time functions are in each case's topSelfMs.
set -euo pipefail
if [[ "${1:-}" == "profile" ]]; then
  npx vite build --config origins/preview/vite.config.mjs --minify false > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
  SERVE=1 PROFILE=1 COUNTS=0,16,40 MODES=walk THROTTLE=1,4 OUT=artifacts/crowd-fps node scripts/origins-crowd-fps.mjs
elif [[ "${1:-}" == "ab" ]]; then
  # `ab <base sha>`: head and a base tree measured in THE SAME JOB (same host), alternating a1 b1 a2 b2, 0 / 16 / 40 players walking at 4x CPU; receipts in artifacts/crowd-fps/{a1,b1,a2,b2}/receipt.json
  # (a = this sha, b = the base). A host difference moves both trees; a build difference moves only one: scripts/crowd-ab-table.mjs reads them.
  BASE="${2:?ab needs the base sha}"; HERE="$PWD"
  git fetch -q --depth 1 origin "$BASE" && git worktree add -q --detach /tmp/base "$BASE" && ln -s "$HERE/node_modules" /tmp/base/node_modules
  npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build-a.log 2>&1 || { tail -20 /tmp/origins-build-a.log; exit 1; }
  (cd /tmp/base && npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build-b.log 2>&1) || { tail -20 /tmp/origins-build-b.log; exit 1; }
  for pass in 1 2; do
    SERVE=1 COUNTS=0,16,40 MODES=walk THROTTLE=4 OUT="$HERE/artifacts/crowd-fps/a$pass" node scripts/origins-crowd-fps.mjs || true
    (cd /tmp/base && SERVE=1 COUNTS=0,16,40 MODES=walk THROTTLE=4 OUT="$HERE/artifacts/crowd-fps/b$pass" node "$HERE/scripts/origins-crowd-fps.mjs") || true
  done
elif [[ "${1:-}" == "imp" ]]; then
  # `imp`: the impostor far tier (?impostors=N, origins/preview/remote-impostor-bench.ts) against the full figures (remote heroes through setOthers) in ONE job at 4x CPU, two passes of
  # none (the bare page), 40 impostors, 40 full figures, 100 impostors; receipts artifacts/crowd-fps/imp<pass>-{none,i40,f40,i100}/receipt.json; scripts/crowd-imp-table.mjs reads them.
  npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
  for pass in 1 2; do
    SERVE=1 COUNTS=0 MODES=walk THROTTLE=4 OUT="artifacts/crowd-fps/imp$pass-none" node scripts/origins-crowd-fps.mjs || true
    SERVE=1 COUNTS=0 MODES=walk THROTTLE=4 QS="&impostors=40" OUT="artifacts/crowd-fps/imp$pass-i40" node scripts/origins-crowd-fps.mjs || true
    SERVE=1 COUNTS=40 MODES=walk THROTTLE=4 OUT="artifacts/crowd-fps/imp$pass-f40" node scripts/origins-crowd-fps.mjs || true
    SERVE=1 COUNTS=0 MODES=walk THROTTLE=4 QS="&impostors=100" OUT="artifacts/crowd-fps/imp$pass-i100" node scripts/origins-crowd-fps.mjs || true
  done
elif [[ "${1:-}" == "quick1" ]]; then
  # `quick1`: the empty zone at 1x, one case, programs added after [zone ready] (their names are in the receipt): bisecting a post-ready compile.
  npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
  SERVE=1 COUNTS=0 MODES=idle THROTTLE=1 OUT=artifacts/crowd-fps node scripts/origins-crowd-fps.mjs
elif [[ "${1:-}" == "quick" ]]; then
  # `quick`: the empty zone at 4x CPU only (0 players, idle): one case, about a minute, for bisecting a frame-rate regression that needs no crowd.
  npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
  SERVE=1 COUNTS=0 MODES=idle THROTTLE=4 OUT=artifacts/crowd-fps node scripts/origins-crowd-fps.mjs
else
  npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
  # `dressed`: DRESS=1, the crowd wears a worn set through originsPreview.dressRemote (#2926's dress-remote.ts, once main.ts wires it); the harness stops with a clear message until then.
  SERVE=1 THROTTLE=1,4 DRESS="$([[ "${1:-}" == "dressed" ]] && echo 1 || true)" OUT=artifacts/crowd-fps node scripts/origins-crowd-fps.mjs
fi
