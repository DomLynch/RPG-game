#!/usr/bin/env bash
# The kit shadow / draw radius A/B on the T4, three arms inside ONE job (a T4's absolute timing differs between jobs; the triangle counts here do not, but the arms stay together anyway):
#   node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/kit-ab.sh [shadowRadius] [drawRadius]
# A = the kit-view.json rows (today), B = ?kitshadow=<shadowRadius>, C = ?kitshadow=<shadowRadius>&kitdraw=<drawRadius>. Per arm: scripts/frame-breakdown.mjs (the GL draws/triangles of one Zone 1 fight frame, ?crowd=0)
# and, for A and C, the 375x812 stills (ready idle + mid-fight, the combat camera) into artifacts/kit-ab/<arm>/.
set -euo pipefail
S="${1:-40}"; D="${2:-100}"
npx vite build --config origins/preview/vite.config.mjs > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
arm() {   # name, extra query
  echo "== arm $1 ($2)"
  node scripts/frame-breakdown.mjs artifacts/origins-preview "artifacts/kit-ab/$1" --query "&crowd=0$2" --topn 6 2>&1 | grep -E "^FRAME-BREAKDOWN|^  " | sed -E 's/renders=\[[^]]*\] //' | cut -c1-420
}
arm A ""
arm B "&kitshadow=$S"
arm C "&kitshadow=$S&kitdraw=$D"
for a in A C; do
  extra=""; [[ "$a" == C ]] && extra="&kitshadow=$S&kitdraw=$D"
  EXTRA="$extra" node scripts/combat-cam-stills.mjs "artifacts/kit-ab/$a-stills" portrait 2>&1 | tail -2 | cut -c1-200 || true
done
