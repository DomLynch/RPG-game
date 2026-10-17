#!/usr/bin/env bash
# One T4 crowd run on a PR, branch or sha: scripts/crowd-t4.sh <PR number | branch | sha> [dressed] [--dry-run]
# Resolves the ref, makes the throwaway test branch world/crowd-fps-on-<short sha> (the ref's tree plus the crowd harness files from world/crowd-fps; NEVER merge it), pushes it, runs
#   node scripts/gpu-run.mjs <test sha> -- bash scripts/gpu-run/crowd-fps.sh [dressed]
# (0 / 8 / 16 / 40 players, idle and walking, 1x and 4x CPU, programs added after ready), then prints the table and writes a PR-comment body to $OUT (default /tmp/crowd-t4-<short>.md).
# `dressed` sets DRESS=1: the harness then needs originsPreview.dressRemote on the page (#2926's dress-remote.ts, not wired into main.ts yet) and stops with that message until it is.
# --dry-run: everything except the push and the gpu-run (no spend); prints the plan.
set -euo pipefail
REF="${1:?usage: scripts/crowd-t4.sh <PR number | branch | sha> [dressed] [--dry-run]}"; shift || true
DRESSED=""; DRY=0
for a in "$@"; do case "$a" in dressed|quick|ab|imp) DRESSED=$a;;   # DRESSED carries the wrapper's one mode word: dressed; quick (0 players at 4x only, about a minute, for bisecting); ab (this ref against trunk, alternating in ONE job, 0/16/40 walking at 4x: the within-job cost per figure)
 --dry-run) DRY=1;; *) echo "unknown arg $a" >&2; exit 2;; esac; done
git fetch -q origin
if [[ "$REF" =~ ^[0-9]+$ ]]; then SHA=$(gh pr view "$REF" --json headRefOid --jq .headRefOid); else SHA=$(git rev-parse --verify -q "origin/$REF" || git rev-parse --verify "$REF"); fi
SHORT=${SHA:0:9}; BR="world/crowd-fps-on-$SHORT"; OUT="${OUT:-/tmp/crowd-t4-$SHORT.md}"
MODEARGS="$DRESSED"; if [[ "$DRESSED" == "ab" ]]; then BASE=$(git rev-parse "${BASE_REF:-origin/codex/01a09a76/task-1}"); MODEARGS="ab $BASE"; fi   # ab: the base is trunk's head now; BASE_REF=<ref> measures against another tree
HARNESS=(scripts/origins-crowd-fps.mjs scripts/gpu-run/crowd-fps.sh)   # imp needs the ref's tree to carry origins/preview/remote-impostor-bench.ts (the ?impostors=N page)
HREF="${HARNESS_REF:-origin/world/crowd-fps}"   # where the harness files come from (#2931's branch; after it merges, set HARNESS_REF=origin/codex/01a09a76/task-1)
echo "ref $REF -> $SHA; test branch $BR; harness from $HREF; mode ${DRESSED:-undressed}"
WT=$(mktemp -d); trap 'git worktree remove --force "$WT" >/dev/null 2>&1 || true' EXIT
git worktree add -q --detach "$WT" "$SHA"
( cd "$WT" && git checkout -q "$HREF" -- "${HARNESS[@]}" && git commit -qm "TEST ONLY, do not merge: crowd harness on $SHORT" && git rev-parse HEAD > "$WT/.test-sha" )
TEST=$(cat "$WT/.test-sha")
if [[ $DRY -eq 1 ]]; then echo "DRY RUN: would push $BR at $TEST and run: node scripts/gpu-run.mjs $TEST --timeout 30m -- bash scripts/gpu-run/crowd-fps.sh $MODEARGS"; exit 0; fi
( cd "$WT" && git push -q -f origin "HEAD:refs/heads/$BR" )
LOG=$(mktemp); node scripts/gpu-run.mjs "$TEST" --timeout 30m -- bash scripts/gpu-run/crowd-fps.sh $MODEARGS 2>&1 | tee "$LOG" | grep -E "^gpu-run: (job|hf-cost)|crowd-fps:" || true
JOB=$(grep -oE "job [0-9a-f]{24}" "$LOG" | head -1 | cut -d' ' -f2)
if [[ "$DRESSED" == "imp" ]]; then node scripts/crowd-imp-table.mjs "artifacts/gpu-run/$JOB/artifacts/crowd-fps" "$SHORT" "$JOB" "$OUT"; echo "comment body: $OUT   (post with: gh pr comment <PR> --body-file $OUT)"; exit 0; fi
if [[ "$DRESSED" == "ab" ]]; then node scripts/crowd-ab-table.mjs "artifacts/gpu-run/$JOB/artifacts/crowd-fps" "$SHORT" "${BASE:0:9}" "$JOB" "$OUT"; echo "comment body: $OUT   (post with: gh pr comment <PR> --body-file $OUT)"; exit 0; fi
R=$(ls -d artifacts/gpu-run/"$JOB"/artifacts/crowd-fps/receipt.json 2>/dev/null || true)
[[ -n "$R" ]] || { echo "no receipt (job ${JOB:-none}); see $LOG" >&2; exit 1; }
node -e '
const [r, sha, job, out] = process.argv.slice(1), d = require(require("path").resolve(r)), fs = require("fs");
const cell = (c) => `${c.meanMs ?? "?"} (p95 ${c.p95Ms})`; const key = (c) => `${c.throttle}|${c.n}`; const m = new Map();
for (const c of d.results) { const k = key(c); m.set(k, { ...(m.get(k) || {}), [c.mode]: c, n: c.n, t: c.throttle }); }
let md = `T4 crowd table on **${sha}** (HF job ${job}, harness #2931). Mean frame ms (p95 ms), idle / walking; a regression row only (Strategy 2026-10-17: never median fps; the gate is the iPhone check by Dom: 16 dressed at 60, 30 dressed >= 30). Programs added after ready: ${d.results.reduce((a, c) => a + (c.programsAdded?.length || 0), 0)} across ${d.results.length} cases; run errors: ${d.results.filter((c) => c.fail).length}. Compare the crowd cost inside one job (N players minus 0 players), not one empty-zone number across jobs.\n\n| players | 1x | 4x CPU |\n|---|---|---|\n`;
for (const n of [...new Set(d.results.map((c) => c.n))]) { const g = (t) => { const e = m.get(`${t}|${n}`); return e ? `${e.idle ? cell(e.idle) : "-"} / ${e.walk ? cell(e.walk) : "-"}` : "-"; }; md += `| ${n} | ${g(1)} | ${g(4)} |\n`; }
fs.writeFileSync(out, md); console.log(md);' "$R" "$SHORT" "${JOB}" "$OUT"
echo "comment body: $OUT   (post with: gh pr comment <PR> --body-file $OUT)"
