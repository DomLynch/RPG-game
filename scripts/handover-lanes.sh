#!/usr/bin/env bash
# Rebuilds docs/HANDOVER-GPT-lanes.md: the top (newest) entry of every lane's docs/state/*.md, taken from the lane's newest
# OPEN docs-state PR branch when one exists, else from trunk. Re-run after lanes push handoffs: bash scripts/handover-lanes.sh
set -euo pipefail
T=origin/codex/01a09a76/task-1
git fetch -q origin
out=docs/HANDOVER-GPT-lanes.md
{
  echo "# Lane handoffs — newest entry per lane (generated $(date '+%Y-%m-%d %H:%M %z') by scripts/handover-lanes.sh)"
  echo
  echo "Source per lane: the newest OPEN PR touching docs/state/<lane>.md if any, else trunk. Read the full file for history."
  for f in $(git ls-tree --name-only $T docs/state/ | grep '\.md$' | grep -v archive); do
    src=$T
    pr=$(gh pr list --state open --limit 50 --json number,headRefName,files --jq ".[]|select([.files[].path]|index(\"$f\"))|\"\(.number) \(.headRefName)\"" | head -1 || true)
    if [ -n "$pr" ]; then git fetch -q origin "${pr#* }" && src="origin/${pr#* }"; fi
    echo; echo "---"; echo; echo "## $(basename "$f" .md)  ·  source: ${pr:+PR #${pr%% *} }${src#origin/}"
    git show "$src:$f" | awk 'NR>1 && /^## /{n++} n==1{exit} /^## /{p=1} p' | cut -c1-900 | head -40 || true
  done
} > "$out"
echo "wrote $out ($(wc -l < "$out") lines)"
