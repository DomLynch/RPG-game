#!/usr/bin/env bash
# VPS side of the release-row shadow pilot (Lead, Dom via Strategy 2026-09-30: stop the Mac being the release bottleneck).
# Runs the SAME release row set the Mac runs (.quality-gate.json release_commands through scripts/release-checks.mjs, 0 rows trusted)
# on a detached checkout of one sha, and writes a per-row pass/fail + duration JSON. It publishes nothing: deploy.sh is untouched and
# the Mac still publishes. Invoked by scripts/vps-shadow-rows.sh over ssh as the non-root row user (row 13's initdb refuses root),
# under `nice -n 15 ionice -c3` so it sits below everything else the VPS runs (the Duel relay lands there Sat 10-03).
#
# Layout (owned by the row user, SHADOW_HOME=/opt/frankendom-shadow):
#   repo/                  clone of the public repo, detached at the sha under test
#   env.production.local   the three public VITE_ keys (Sentry DSN, Supabase URL, publishable key); copied into repo/ as .env.production.local
#   ms-playwright/         PLAYWRIGHT_BROWSERS_PATH (chromium + webkit, installed by bootstrap, re-installed when package-lock changes)
#   runs/<sha>/<utc stamp>/ build.log, rows.log, logs/NN-*.log (each row's own output), rows.json, status; runs/<sha>/latest -> newest
# Usage: run-rows.sh <sha>     env: SHADOW_HOME, RELEASE_CHECK_CONCURRENCY (default 4, the Mac's), RELEASE_CHECK_CEILING_S
set -euo pipefail
sha="${1:?usage: run-rows.sh <sha>}"
home="${SHADOW_HOME:-/opt/frankendom-shadow}"
bin="$(cd "$(dirname "$0")" && pwd)"
export PLAYWRIGHT_BROWSERS_PATH="$home/ms-playwright"
export PG_BIN="${PG_BIN:-$(pg_config --bindir 2>/dev/null || true)}"
cd "$home/repo"
git fetch -q origin
full=$(git rev-parse --verify -q "$sha^{commit}") || { echo "unknown sha $sha"; exit 2; }
git checkout -q --detach "$full"
git reset -q --hard && git clean -fdq   # a scratch checkout: no lane work lives here; node_modules is ignored and stays
want_tree=$(git rev-parse "$full^{tree}"); [[ "$(git rev-parse HEAD^{tree})" == "$want_tree" ]] || { echo "tree mismatch at start"; exit 3; }
run="$home/runs/$full/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$run/logs"
ln -sfn "$run" "$home/runs/$full/latest"
echo running > "$run/status"
started=$(date -u +%Y-%m-%dT%H:%M:%SZ); wall0=$(date +%s)
echo "START shadow rows sha=$full user=$(id -un) nice=$(nice) load1=$(cut -d' ' -f1 /proc/loadavg) at $started"
# Dependencies only when the lockfile changed since the last install here (npm ci is minutes; the rows are the point).
lock_now=$(sha256sum package-lock.json | cut -c1-64)
if [[ "$(cat "$home/.lock-installed" 2>/dev/null || true)" != "$lock_now" ]]; then
  npm ci --no-audit --no-fund > "$run/npm-ci.log" 2>&1
  npx playwright install --with-deps chromium >> "$run/npm-ci.log" 2>&1   # --with-deps: a fresh container has none of chromium's system libraries (WebKit rows are never trusted from here, so webkit is not installed)
  echo "$lock_now" > "$home/.lock-installed"
fi
# A GPU box (t4-medium): plain Chromium falls back to SwiftShader (CPU rendering) there; only the Vulkan flags below reach the Tesla T4 (probe job 6ac902ac, 2026-10-09: default,
# --use-gl=egl and --use-angle=gl all printed "SwiftShader", this set printed "NVIDIA Tesla T4"). Rows launch the binary from chromium.executablePath(), so wrap it once here
# and every row gets the flags; the renderer is printed so the job log proves which one ran. No GPU (cpu-upgrade, the VPS): nothing changes.
if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1; then
  chrome=$(node -e 'process.stdout.write(require("playwright").chromium.executablePath())')
  if [[ -x "$chrome" && ! -e "$chrome.real" ]]; then
    mv "$chrome" "$chrome.real"
    printf '#!/bin/sh\nexec "%s.real" --use-angle=vulkan --enable-features=Vulkan --ignore-gpu-blocklist --disable-vulkan-surface "$@"\n' "$chrome" > "$chrome"; chmod +x "$chrome"
  fi
  echo "GPU: $(nvidia-smi -L | head -1)"
  renderer=$(node --input-type=module -e 'import { chromium } from "playwright"; const b = await chromium.launch({ headless: true, executablePath: chromium.executablePath() }); const p = await b.newPage(); console.log(await p.evaluate(() => { const g = document.createElement("canvas").getContext("webgl2"); const e = g && g.getExtension("WEBGL_debug_renderer_info"); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : "no webgl"; })); await b.close();' 2>&1 | tail -1)
  echo "RENDERER: $renderer"
  # On a GPU box a row that would run on SwiftShader fails loudly instead of silently running on the CPU and calling it a T4 result.
  [[ "$renderer" == *NVIDIA* ]] || { echo "RENDERER GUARD: expected an NVIDIA renderer on this GPU box, got '$renderer'"; exit 4; }
fi
# The three public VITE_ keys live on the VPS only; a fresh HF container has none, so the build runs without them (rows that need them fail loudly, they are never silently green).
[[ -f "$home/env.production.local" ]] && install -m 600 "$home/env.production.local" .env.production.local
export VITE_SENTRY_RELEASE="$full"
build_status=0
npm run build > "$run/build.log" 2>&1 || build_status=$?
rows_status=0
if [[ $build_status -eq 0 ]]; then
  # The exact Mac invocation (deploy.sh), with nothing trusted: every row runs here.
  # ROWS_ONLY="31,33" (a shard): every other row is skipped, so this receipt vouches for those rows only.
  skip=""; if [[ -n "${ROWS_ONLY:-}" ]]; then skip=$(ROWS_ONLY="$ROWS_ONLY" node -e 'const n = JSON.parse(require("fs").readFileSync(".quality-gate.json", "utf8")).release_commands.length, only = new Set(process.env.ROWS_ONLY.split(",").map(Number)); console.log(Array.from({ length: n }, (_, i) => i + 1).filter(i => !only.has(i)).join(","))'); fi
  # tee: the per-row "Release check N/M ..." lines also reach the job log, so a job that hits its --timeout still shows what finished (the file inside the container is lost with it).
  set +e; RELEASE_CHECKS_SKIP="$skip" RELEASE_CHECKS_SKIP_SOURCE= node scripts/release-checks.mjs 2>&1 | tee "$run/rows.log"; rows_status=${PIPESTATUS[0]}; set -e
  cp artifacts/release-checks/*.log "$run/logs/" 2>/dev/null || true
  cp artifacts/release-checks.json "$run/release-checks.json" 2>/dev/null || true
  # The job log carries only the per-row verdict lines; a failed row's own output stays in the container. Print its last 50 lines so a FAILED/CEILING row can be diagnosed from `hf jobs logs`.
  for script in $(grep -E 'FAILED|CEILING' "$run/rows.log" | grep -o 'scripts/[A-Za-z0-9_.-]*\.mjs' | sort -u); do
    for f in "$run"/logs/*"$(basename "$script" .mjs)"*.log; do [[ -f "$f" ]] && { echo "--- last 50 lines of $(basename "$f") (failed row output) ---"; tail -n 50 "$f"; echo "--- end $(basename "$f") ---"; }; done
  done
else
  echo "build failed (exit $build_status); no rows ran" > "$run/rows.log"
fi
ended=$(date -u +%Y-%m-%dT%H:%M:%SZ)
[[ "$(git rev-parse HEAD^{tree})" == "$want_tree" ]] || { echo "tree changed during the run; no receipt"; exit 5; }
node "$bin/rows-json.mjs" "$run" \
  --sha "$full" --tree "$(git rev-parse HEAD^{tree})" --started "$started" --ended "$ended" \
  --wall "$(( $(date +%s) - wall0 ))" --build-status "$build_status" --rows-status "$rows_status" \
  --node "$(node -v)" --playwright "$(node -p 'require("playwright/package.json").version')" \
  --load "$(cut -d' ' -f1-3 /proc/loadavg)" --dirty "$(git status --porcelain | wc -l | tr -d ' ')"
echo done > "$run/status"
echo "RECEIPT rows $(tr -d '\n' < "$run/rows.json")"   # read back from the job logs by scripts/vps-shadow/launch.mjs fetch
echo "END shadow rows sha=$full build=$build_status rows=$rows_status in $(( $(date +%s) - wall0 ))s -> $run/rows.json"
# The job exits 0 once it has printed its receipt: the receipt carries every row verdict (a FAIL or ceiling vetoes that row; the others still count), and deploy only trusts a COMPLETED job. A failed build is in buildStatus and trusts nothing.
exit 0
