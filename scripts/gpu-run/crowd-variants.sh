#!/usr/bin/env bash
# TEST ONLY (never merged): 40 walking remote heroes at 4x CPU on the T4 with different row overrides, in ONE job (job-to-job vsync snapping makes cross-job comparisons unsafe).
# Patches applied here, in the job's own checkout: previewRule reads globalThis.__rules first; the harness sets it from env RULES via addInitScript and records renderer.info.calls/triangles.
set -euo pipefail
node -e "
const fs = require('fs');
let p = fs.readFileSync('origins/preview/preview-rules.ts', 'utf8');
p = p.replace('export const previewRule = (id: (typeof NAMED)[number]): number => PREVIEW_RULES.find((r) => r.id === id)!.value;', 'export const previewRule = (id: (typeof NAMED)[number]): number => ((globalThis as unknown as { __rules?: Record<string, number> }).__rules?.[id]) ?? PREVIEW_RULES.find((r) => r.id === id)!.value;');
if (!p.includes('__rules')) throw Error('previewRule anchor missing');
fs.writeFileSync('origins/preview/preview-rules.ts', p);
let h = fs.readFileSync('scripts/origins-crowd-fps.mjs', 'utf8');
h = h.replace(\"page.on('pageerror'\", \"if (process.env.RULES) await page.addInitScript((r) => { window.__rules = r; }, JSON.parse(process.env.RULES)); page.on('pageerror'\");
h = h.replace('res.programsAdded = ', 'res.info = await page.evaluate(() => { const r = window.originsPreview.renderInfo(); return { calls: r.calls, triangles: r.triangles }; }); res.programsAdded = ');
if (!h.includes('process.env.RULES') || !h.includes('res.info')) throw Error('harness anchor missing');
fs.writeFileSync('scripts/origins-crowd-fps.mjs', h);
"
npx vite build --config origins/preview/vite.config.mjs --minify false > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
run() { name="$1"; rules="$2"; counts="$3"; echo "=== VARIANT $name $rules"; SERVE=1 PROFILE=1 COUNTS="$counts" MODES=walk THROTTLE=4 WINDOW=6000 RULES="$rules" OUT="artifacts/crowd-var/$name" node scripts/origins-crowd-fps.mjs || true; }
run base '{}' 0,40
run allcheap '{"remoteFullCount":0,"remoteAdaptFullCount":0}' 40
run allfull '{"remoteFullCount":40,"remoteAdaptFullCount":40,"remoteAdaptSlowMs":100000}' 40
run cheap8 '{"remoteFullCount":0,"remoteAdaptFullCount":0,"remoteCheapEvery":8}' 40
run range10 '{"remoteFullCount":0,"remoteAdaptFullCount":0,"remoteAnimRange":10}' 40
echo VARIANTS-DONE
