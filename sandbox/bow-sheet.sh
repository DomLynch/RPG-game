#!/usr/bin/env bash
# Build the sandbox from this checkout, serve it locally, shoot the four bow specials as a contact sheet (no publish; nothing leaves the box).
#   run on the VPS from the synced worktree:  capture --prio 3 sandbox bash sandbox/bow-sheet.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=/tmp/sbx-bow; rm -rf "$OUT"; mkdir -p "$OUT/site/preview"
SANDBOX_INFO="local bow build" npx vite build --config sandbox/vite.config.mjs --base /preview/sandbox/ --outDir "$OUT/site/preview/sandbox" --emptyOutDir >/dev/null
(cd "$OUT/site" && python3 -m http.server 8765 >/dev/null 2>&1 & echo $! > "$OUT/pid")
sleep 2
node scripts/special-weapon-sheet.mjs --weapon knife --bow 1 --base http://localhost:8765/preview/sandbox/ --out "$OUT/sheets" --wait 260 "$@" || echo "sheet exit $?"
kill "$(cat "$OUT/pid")" 2>/dev/null || true
ls -la "$OUT/sheets" 2>/dev/null
