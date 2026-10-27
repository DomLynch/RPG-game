set -euo pipefail; t0=$(date +%s); lap(){ echo "LAP $1 $(( $(date +%s) - t0 ))s"; }
W=${HFJOB_WORKDIR:-/w}
mkdir -p "$W" && cd "$W" && git init -q && git remote add origin "$HFJOB_REPO"
f=(); [ "$HFJOB_DEPTH" = 0 ] || f=(--depth "$HFJOB_DEPTH")
for i in 1 2 3; do timeout 120 git fetch -q "${f[@]}" origin "$HFJOB_SHA" && break; [ "$i" = 3 ] && { echo "hfjob: could not fetch $HFJOB_SHA from $HFJOB_REPO" >&2; exit 1; }; sleep $((i * 5)); done
git checkout -q --detach FETCH_HEAD; lap checkout
# tests may read a tag (V3's Gate 0 reads `git show v1-seed-...:file`): fetch the repo's tags too, shallow like the sha. Best effort: a repo with no tags is fine.
timeout 120 git fetch -q "${f[@]}" origin 'refs/tags/*:refs/tags/*' || echo "hfjob: could not fetch tags (continuing)" >&2; lap tags
if [ -f package-lock.json ]; then timeout 600 npm ci --no-audit --no-fund >/dev/null 2>&1 || { echo "hfjob: npm ci failed" >&2; exit 1; }; lap npm-ci; fi
echo "hfjob: running at $(git rev-parse --short HEAD): $(printf %s "$HFJOB_ARGV_B64" | base64 -d)"
exec bash -c "$(printf %s "$HFJOB_ARGV_B64" | base64 -d)"
