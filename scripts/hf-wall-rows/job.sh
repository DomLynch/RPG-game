#!/usr/bin/env bash
# The T4 wall-row job (scripts/hf-wall-rows.mjs launch). Runs inside an HF Job on image mcr.microsoft.com/playwright:v1.62.1-noble with a
# GPU flavor. Clones the public repo at SHA, builds it, and runs the release rows NOT in SKIP through scripts/release-checks.mjs exactly as
# the Mac does (same script, WIDTH-wide, the row's own retry-once-alone). Nothing here changes a release script: the only tweak is a
# wrapper around the Chromium binaries that PREPENDS the GPU flags (a row's own args still win). The Mac reads stdout: the HEAD/TREE line,
# one RECEIPT line per row, the COST line last; a BLOCKER line means it stopped early and nothing is trusted.
# env: SHA (full), SKIP (rows the Mac keeps, comma list), WIDTH (row width), VITE_* (the three public client keys, as secrets)
set -uo pipefail
say() { echo "=== $* ==="; }
t0=$(date +%s)

say "PROBE host"
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader 2>&1 | head -2; nproc; node -v

say "SETUP"
export DEBIAN_FRONTEND=noninteractive
# jpegtran: the lossless texture plugin in vite.config.mjs; ffmpeg: arena-audio-check and the clip rows; the GL libs for the probe.
apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq git ffmpeg libvulkan1 libegl1 libjpeg-turbo-progs >/dev/null 2>&1; echo "apt exit $? jpegtran=$(command -v jpegtran || echo MISSING)"
id pwuser >/dev/null 2>&1 || useradd -m pwuser
work=/home/pwuser/rows; mkdir -p "$work"; chown -R pwuser "$work"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/ms-playwright}"

# Every Chromium binary Playwright can launch gets the flags in front of its own args.
wrap() {
  local flags="$1" bin
  for bin in "$PLAYWRIGHT_BROWSERS_PATH"/chromium-*/chrome-linux*/chrome "$PLAYWRIGHT_BROWSERS_PATH"/chromium_headless_shell-*/chrome-*/headless_shell "$PLAYWRIGHT_BROWSERS_PATH"/chromium_headless_shell-*/chrome-*/chrome-headless-shell; do
    [[ -e "$bin" || -e "$bin.real" ]] || continue
    [[ -e "$bin.real" ]] || mv "$bin" "$bin.real"
    printf '#!/bin/sh\nexec "%s.real" %s "$@"\n' "$bin" "$flags" > "$bin"; chmod 755 "$bin"
  done
}

su pwuser -c "cd $work && git clone -q https://github.com/DomLynch/RPG-game.git repo && cd repo && git checkout -q --detach $SHA" || { say "BLOCKER clone failed"; exit 10; }
cd "$work/repo"
# The checkout is pwuser's and this shell is root: git refuses a "dubious ownership" repo silently (the first smoke run printed an empty
# HEAD/TREE line and receipts with no tree). Mark it safe once; every receipt below carries the tree this reads.
git config --global --add safe.directory "$work/repo"
say "HEAD $(git rev-parse HEAD) TREE $(git rev-parse 'HEAD^{tree}')"
su pwuser -c "cd $work/repo && npm ci --no-audit --no-fund >/tmp/npm-ci.log 2>&1"; echo "npm ci exit $?"; tail -2 /tmp/npm-ci.log

say "PROBE WebGL"
cat > .gl-probe.mjs <<'EOF'
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true }), p = await b.newPage();
console.log(await p.evaluate(() => { const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return 'NO WEBGL CONTEXT'; const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); }));
await b.close();
EOF
chown pwuser .gl-probe.mjs
probe() { su pwuser -c "cd $work/repo && PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH timeout 90 node .gl-probe.mjs" 2>&1 | head -1; }
chosen=""
for flags in "--ignore-gpu-blocklist --enable-gpu --use-gl=angle --use-angle=vulkan --enable-features=Vulkan" "--ignore-gpu-blocklist --enable-gpu --use-gl=angle --use-angle=gl-egl" "--ignore-gpu-blocklist --enable-gpu --use-gl=egl"; do
  wrap "$flags"; renderer=$(probe); echo "[$flags] -> $renderer"
  if echo "$renderer" | grep -qiE 'nvidia|tesla|geforce|rtx| t4|l4|a10' && ! echo "$renderer" | grep -qiE 'swiftshader|llvmpipe|software'; then chosen="$flags"; break; fi
done
rm -f .gl-probe.mjs
[[ -n "$chosen" ]] || { say "BLOCKER no hardware WebGL (every flag set rendered in software)"; say "COST seconds=$(( $(date +%s) - t0 ))"; exit 11; }
say "GPU OK: $chosen"

say "BUILD"
printf 'VITE_SENTRY_DSN=%s\nVITE_SUPABASE_URL=%s\nVITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "${VITE_SENTRY_DSN:-}" "${VITE_SUPABASE_URL:-}" "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" > .env.production.local
chown pwuser .env.production.local; chmod 600 .env.production.local
b0=$(date +%s)
su pwuser -c "cd $work/repo && VITE_SENTRY_RELEASE=$SHA npm run build >/tmp/build.log 2>&1"; build=$?
echo "build exit $build in $(( $(date +%s) - b0 ))s"; [[ $build -eq 0 ]] || { tail -20 /tmp/build.log; say "BLOCKER build failed"; say "COST seconds=$(( $(date +%s) - t0 ))"; exit 12; }

say "ROWS (width ${WIDTH:-4}, on the Mac: $SKIP)"
r0=$(date +%s)
su pwuser -c "cd $work/repo && PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH RELEASE_CHECK_CONCURRENCY=${WIDTH:-4} RELEASE_CHECKS_SKIP=$SKIP RELEASE_CHECKS_SKIP_SOURCE=the-Mac node scripts/release-checks.mjs > /tmp/rows.log 2>&1"; rows=$?
wall=$(( $(date +%s) - r0 ))
echo "rows exit $rows in ${wall}s"
grep -E '(Release|Extended) check|Retrying|Not retrying' /tmp/rows.log
# One receipt per row this job ran, bound to the tree it built (rows-lib parseRowsLog: the LAST line for a row is its result).
tree=$(git rev-parse 'HEAD^{tree}')
node --input-type=module -e '
import { readFileSync } from "node:fs"; import { parseRowsLog } from "./scripts/vps-shadow/rows-lib.mjs";
const tree = process.argv[1], { rows } = parseRowsLog(readFileSync("/tmp/rows.log", "utf8"));
for (const r of rows) if (r.status !== "trusted") console.log(`=== RECEIPT ${JSON.stringify({ index: r.index, status: r.status === "pass" ? 0 : (r.exit ?? 1), seconds: r.seconds, attempts: r.attempts, tree })} ===`);' "$tree"
say "BEGIN failing row tails"
for n in $(grep -oE 'Release check [0-9]+/[0-9]+ (FAILED|CEILING)' /tmp/rows.log | grep -oE 'check [0-9]+' | grep -oE '[0-9]+' | sort -un); do
  for f in artifacts/release-checks/$(printf '%02d' "$n")-*.log; do [[ -e "$f" ]] && { echo "--- $f"; tail -25 "$f" | cut -c1-400; }; done
done
say "END failing row tails"
say "COST seconds=$(( $(date +%s) - t0 )) rows_wall=${wall}"
