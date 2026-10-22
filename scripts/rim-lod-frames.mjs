// Same-job frame-time read of the Zone 1 rim: the hero at a few spots along the world's edge, requestAnimationFrame deltas for SECS seconds each (375 wide, dpr 3, ?crowd=0), p50 / p95 / max and the share over 33 ms.
// Run it twice against the same dev server with the palisade `lod` rows off and on (origins/world/building-skins.json) and compare the pairs; absolute numbers mean nothing (Mac M5), only the pair does.
//   BASE=http://localhost:5199 CHROME=<Chrome app> LABEL=lod-on node scripts/rim-lod-frames.mjs <out json>      (POS="x,z,heading;..." overrides the spots; SECS=8)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const out = process.argv[2], base = process.env.BASE ?? 'http://localhost:5199', secs = Number(process.env.SECS ?? 8), label = process.env.LABEL ?? 'run';
if (!out) throw new Error('usage: rim-lod-frames.mjs <out json>');
const spots = (process.env.POS ?? 'corner-ne=-48,-24,0;corner-nw=-156,-24,0;corner-se=-48,84,0;corner-sw=-156,84,0;centre=-102,30,0;north-edge=-102,-26,0').split(';').filter(Boolean).map((s) => { const [n, at] = s.split('='); return [n, at.split(',').map(Number)]; });
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const receipt = { label, renderer: null, spots: [] };
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  await page.addInitScript(() => { window.__scenes = []; window.__THREE_DEVTOOLS__ = new EventTarget(); window.__THREE_DEVTOOLS__.addEventListener('observe', (e) => { if (e.detail?.isScene) window.__scenes.push(e.detail); }); });
  await page.goto(`${base}/preview/origins/?region=1&presence=0&daynight=0&crowd=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview, null, { timeout: 300000 });
  await page.waitForTimeout(12000);
  receipt.renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  for (const [name, [x, z, h]] of spots) {
    await page.evaluate(([px, pz, ph]) => window.originsPreview.place(px, pz, ph), [x, z, h]);
    await page.waitForTimeout(4000);
    const d = await page.evaluate((ms) => new Promise((resolve) => { const t = []; let last = performance.now(); const end = last + ms; const tick = (now) => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else resolve(t.slice(2)); }; requestAnimationFrame(tick); }), secs * 1000);
    // the triangles the kit's instanced meshes draw this frame (count x the geometry's triangles), full bodies and far bodies apart, and what ALL placements would cost drawn full (the trunk-style estimate)
    const tris = await page.evaluate(() => { const o = { full: 0, far: 0, all: 0, byNode: {} }; for (const s of window.__scenes) s.traverse((m) => { if (!m.isInstancedMesh || !/^goblin_/.test(m.name)) return; const g = m.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3, far = m.name.endsWith('__far'), n = m.count; if (m.name.endsWith('__shadow')) return; o[far ? 'far' : 'full'] += n * t; o.byNode[m.name] = { count: n, tris: t }; }); o.drawn = o.full + o.far; for (const [k, v] of Object.entries(o.byNode)) { const base = k.endsWith('__far') ? o.byNode[k.slice(0, -5)] : v; o.noLod = (o.noLod ?? 0) + v.count * (base ? base.tris : v.tris); } return o; });   // noLod: the same drawn instances if every one drew its full body
    d.sort((a, b) => a - b);
    const q = (p) => Math.round(d[Math.min(d.length - 1, Math.floor(d.length * p))] * 10) / 10;
    receipt.spots.push({ name, frames: d.length, p50: q(0.5), p95: q(0.95), max: Math.round(d[d.length - 1] * 10) / 10, over33: Math.round((d.filter((v) => v > 33).length / d.length) * 1000) / 10, tris });
  }
  fs.writeFileSync(out, JSON.stringify(receipt, null, 1));
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); }
