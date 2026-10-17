#!/usr/bin/env bash
# TEST ONLY (never merged), round 2: (a) WHAT a drawn figure is made of (mesh names, counts, triangles) read from the scene, (b) the full-count curve with the governor OFF, all in ONE job.
set -euo pipefail
node -e "
const fs = require('fs');
let p = fs.readFileSync('origins/preview/preview-rules.ts', 'utf8');
p = p.replace('export const previewRule = (id: (typeof NAMED)[number]): number => PREVIEW_RULES.find((r) => r.id === id)!.value;', 'export const previewRule = (id: (typeof NAMED)[number]): number => ((globalThis as unknown as { __rules?: Record<string, number> }).__rules?.[id]) ?? PREVIEW_RULES.find((r) => r.id === id)!.value;');
if (!p.includes('__rules')) throw Error('previewRule anchor missing');
fs.writeFileSync('origins/preview/preview-rules.ts', p);
let m = fs.readFileSync('origins/preview/main.ts', 'utf8');
const k = '(window as unknown as { originsPreview: unknown }).originsPreview = {';
if (!m.includes(k)) throw Error('main anchor missing');
m = m.replace(k, '(window as unknown as { __scene: unknown }).__scene = scene;\n' + k);
fs.writeFileSync('origins/preview/main.ts', m);
let h = fs.readFileSync('scripts/origins-crowd-fps.mjs', 'utf8');
h = h.replace(\"page.on('pageerror'\", \"if (process.env.RULES) await page.addInitScript((r) => { window.__rules = r; }, JSON.parse(process.env.RULES)); page.on('pageerror'\");
h = h.replace('res.programsAdded = ', 'res.info = await page.evaluate(() => { const r = window.originsPreview.renderInfo(); return { calls: r.calls, triangles: r.triangles }; }); res.meshes = await page.evaluate(() => { const sc = window.__scene, by = {}; let figs = 0; sc.traverse((o) => { if (!o.isMesh || !o.visible) return; let vis = true; for (let n = o; n; n = n.parent) if (!n.visible) { vis = false; break; } if (!vis) return; const g = o.geometry, tris = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3, key = (o.isSkinnedMesh ? \"skin:\" : \"mesh:\") + (o.name || \"(unnamed)\") + (o.castShadow ? \" +shadow\" : \"\"); const e = by[key] ?? (by[key] = { n: 0, tris: 0 }); e.n++; e.tris += Math.round(tris); }); return Object.entries(by).sort((a, b) => b[1].tris - a[1].tris).slice(0, 25); }); res.programsAdded = ');
if (!h.includes('process.env.RULES') || !h.includes('res.meshes')) throw Error('harness anchor missing');
fs.writeFileSync('scripts/origins-crowd-fps.mjs', h);
"
npx vite build --config origins/preview/vite.config.mjs --minify false > /tmp/origins-build.log 2>&1 || { tail -20 /tmp/origins-build.log; exit 1; }
run() { name="$1"; rules="$2"; counts="$3"; echo "=== VARIANT $name $rules"; SERVE=1 COUNTS="$counts" MODES=walk THROTTLE=4 WINDOW=6000 RULES="$rules" OUT="artifacts/crowd-var/$name" node scripts/origins-crowd-fps.mjs || true; }
NOGOV='"remoteAdaptSlowMs":100000'
run mesh0 "{$NOGOV,\"remoteFullCount\":0,\"remoteAdaptFullCount\":0}" 0,40
run full4 "{$NOGOV,\"remoteFullCount\":4,\"remoteAdaptFullCount\":4}" 40
run full8 "{$NOGOV,\"remoteFullCount\":8,\"remoteAdaptFullCount\":8}" 40
run full16 "{$NOGOV,\"remoteFullCount\":16,\"remoteAdaptFullCount\":16}" 40
run full40 "{$NOGOV,\"remoteFullCount\":40,\"remoteAdaptFullCount\":40}" 40
echo VARIANTS2-DONE
