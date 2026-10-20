#!/bin/bash
# usage: rv84-run.sh <sha> <test files...>: check the pushed sha out in the combat-clips worktree, run just those test files on one spare core, print summary + failure heads.
D=/opt/frankendom-shadow/work/combat-clips
cd "$D" || exit 2
SHA=$1; shift
git fetch -q https://github.com/DomLynch/RPG-game.git combat/rv84-world-picked && git checkout -q -f "$SHA" || exit 2
git clean -fdq scripts/bow-power-still.mjs 2>/dev/null
taskset -c 14 nice -n 10 node --test "$@" > /tmp/rv84-run.log 2>&1
grep -E '^# (tests|pass|fail)' /tmp/rv84-run.log
awk '/^not ok/{p=1;n=0} p&&n<26{ if ($0 !~ /^\s+(duration_ms|type|failureType|code|name):/) print substr($0,1,260); n++ } n>=26{p=0}' /tmp/rv84-run.log
