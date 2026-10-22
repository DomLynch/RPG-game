// Same-job frame-time read of the Zone 1 rim: the hero at a few spots along the world's edge, requestAnimationFrame deltas for SECS seconds each (375 wide, dpr 3, ?crowd=0), p50 / p95 / max and the share over 33 ms.
// Run it twice against the same dev server with the palisade `lod` rows off and on (origins/world/building-skins.json) and compare the pairs; absolute numbers mean nothing (Mac M5), only the pair does.
//   BASE=http://localhost:5199 CHROME=<Chrome app> LABEL=lod-on node scripts/rim-lod-frames.mjs <out json>      (POS="x,z,heading;..." overrides the spots; SECS=8)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const out = process.argv[2], base = process.env.BASE ?? 'http://localhost:5199', secs = Number(process.env.SECS ?? 8), label = process.env.LABEL ?? 'run';
if (!out) throw new Error('usage: rim-lod-frames.mjs <out json>');
const spots = (process.env.POS ?? 'north=0,-55,3.1416;west=-55,0,1.5708;east=55,0,-1.5708').split(';').filter(Boolean).map((s) => { const [n, at] = s.split('='); return [n, at.split(',').map(Number)]; });
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const receipt = { label, renderer: null, spots: [] };
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  await page.goto(`${base}/preview/origins/?region=1&presence=0&daynight=0&crowd=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview, null, { timeout: 300000 });
  await page.waitForTimeout(12000);
  receipt.renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  for (const [name, [x, z, h]] of spots) {
    await page.evaluate(([px, pz, ph]) => window.originsPreview.place(px, pz, ph), [x, z, h]);
    await page.waitForTimeout(4000);
    const d = await page.evaluate((ms) => new Promise((resolve) => { const t = []; let last = performance.now(); const end = last + ms; const tick = (now) => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else resolve(t.slice(2)); }; requestAnimationFrame(tick); }), secs * 1000);
    d.sort((a, b) => a - b);
    const q = (p) => Math.round(d[Math.min(d.length - 1, Math.floor(d.length * p))] * 10) / 10;
    receipt.spots.push({ name, frames: d.length, p50: q(0.5), p95: q(0.95), max: Math.round(d[d.length - 1] * 10) / 10, over33: Math.round((d.filter((v) => v > 33).length / d.length) * 1000) / 10 });
  }
  fs.writeFileSync(out, JSON.stringify(receipt, null, 1));
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); }
