#!/usr/bin/env bash
# The animation-rate LOD's tests and its 375 clip as ONE job, for a CPU box (HF cpu-upgrade, software GL; the VPS when it is free): node scripts/gpu-run.mjs <sha> -- bash scripts/character/anim-lod-cpu-job.sh
# Prints the tests' pass/fail counts and writes artifacts/anim-lod/{tests.log,anim-lod.mp4}; the PNG frames are deleted once the clip is joined.
set -uo pipefail
mkdir -p artifacts/anim-lod
node --test tests/remote-crowd.test.ts tests/preview-rules.test.ts tests/frame-governor.test.ts > artifacts/anim-lod/tests.log 2>&1 || echo "TESTS-FAILED"
grep -E '^# (tests|pass|fail)|^not ok' artifacts/anim-lod/tests.log || tail -20 artifacts/anim-lod/tests.log
command -v ffmpeg >/dev/null || { apt-get update -qq && apt-get install -y -qq ffmpeg > /dev/null; }
node scripts/character/anim-lod-clip.mjs artifacts/anim-lod 240
rm -rf artifacts/anim-lod/frames
ls -la artifacts/anim-lod
