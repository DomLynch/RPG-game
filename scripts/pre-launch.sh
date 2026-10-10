#!/usr/bin/env bash
# Pre-launch the Hugging Face legs of a release at CANDIDATE OPEN, so they run while the candidate's CI runs and the previous release deploys
# (Strategy/Dom 2026-10-10: the 12-minute leg of a release is the T4 wall rows and the CPU receipt job, started only after the trunk merge).
#   bash scripts/pre-launch.sh <candidate full sha> [expected live sha]      run from any checkout that has the sha; the candidate branch must be pushed
# Writes two files in ${PRELAUNCH_DIR:-~/.claude/state/pre-launch}: <sha>.wall (the T4 launcher's state file) and <sha>.cpu ("id;rows" from launch.mjs cpu).
# deploy.sh takes them when the deployed revision is that exact sha (scripts/lib/deploy-hf.sh hf_wall_rows_launch, deploy-vps.sh prelaunched_cpu) and
# otherwise launches as before. Nothing here decides trust: a row is trusted only from a receipt bound to the deployed TREE (hf-wall-rows collect,
# vps-receipt-trust), so a pre-launch planned for a different scope can only cost a few cents or leave a row to the Mac.
set -euo pipefail
sha="${1:-}"; live="${2:-}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "pre-launch: needs a full 40-hex candidate sha" >&2; exit 2; }
dir="${PRELAUNCH_DIR:-$HOME/.claude/state/pre-launch}"; mkdir -p "$dir"
git cat-file -e "$sha^{commit}" 2>/dev/null || { echo "pre-launch: $sha is not in this checkout (fetch the candidate branch)" >&2; exit 2; }
# Rows out of scope against the revision that will be live when the candidate deploys: the same picker deploy.sh uses. Any doubt = plan every row.
skip=""
if [[ "$live" =~ ^[0-9a-f]{40}$ ]] && git merge-base --is-ancestor "$live" "$sha" 2>/dev/null; then
  skip=$(git diff --name-only "$live" "$sha" | node scripts/release-rows-for.mjs --deploy-skip --base "$live" 2>/dev/null) || skip=""
fi
echo "pre-launch: $sha, rows out of scope vs ${live:-none}: ${skip:-none}" >&2
rm -f "$dir/$sha.wall" "$dir/$sha.wall.json" "$dir/$sha.cpu"
# The public client keys the job builds with live in the deploy checkout's env file; the worktree has none.
export HF_WALL_ROWS_ENV_FILE="${HF_WALL_ROWS_ENV_FILE:-$HOME/Developer/frankendom-deploy/.env.production.local}"
wall=$(HF_WALL_ROWS_STATE="$dir/$sha.wall" node scripts/hf-wall-rows.mjs launch "$sha" --skip "$skip") || { wall=""; echo "pre-launch: T4 launch failed; deploy.sh will launch its own" >&2; rm -f "$dir/$sha.wall"; }
cpu=$(node scripts/vps-shadow/launch.mjs cpu "$sha" "$skip") || cpu=""
[[ -n "$cpu" ]] && printf '%s' "$cpu" > "$dir/$sha.cpu"
echo "pre-launch: T4 job(s) ${wall:-none}; CPU job ${cpu:-none}" >&2
