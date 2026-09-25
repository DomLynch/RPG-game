#!/bin/zsh
# Runs only once the deploy lock is FREE (it waits for it first): witchfire test, commit + push #769, then the frame-stepped landed stills.
S=/private/tmp/claude-501/-Users-domininclynch-Desktop-Business-frankendom--claude-worktrees-pensive-goodall-2f90b0/b4d35bc8-416e-48b7-ac18-e4afc3911871/scratchpad
until [ ! -e ~/.claude/state/deploy_in_flight.json ]; do sleep 10; done
echo "FREE $(date -u +%H:%M:%SZ)"
cd $S/wt-witchfire
out=$(node --test tests/witchfire.test.ts 2>&1); code=$?
echo "$out" | grep -E "gout front|^ℹ (pass|fail)|AssertionError|✖" | head -8
if [ $code -eq 0 ]; then
  git add src/witchfire.ts tests/witchfire.test.ts && git commit -q -m "fix(world): Witch-fire gout reads as a jet: flame tongues, tighter cone, fire on the target at impact

Each flame draws as a 3-point tongue along its own velocity; the cone is
0.30 rad; gout flames are born along the jet, and on the impact tick along
the whole reach, so the hit frame shows the fire on the target. Flames born
in a hit-stop (dt 0) are drawn. The witchfire test prints the gout front.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push -q origin world/witchfire-v1 && echo "PUSHED $(git rev-parse --short HEAD)"
else echo "TEST FAILED: not pushed"; fi
cd $S && node stepped-stills.mjs $S/wt-witchfire scorch-replay.txt landed-v5 windup=435 hit=455 gout=459 embers=475 2>&1 | tail -2
echo "DONE $(date -u +%H:%M:%SZ)"
