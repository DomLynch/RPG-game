// The Concord Exchange plate stills for Dom: the town page (no region) at 375 portrait and desktop, same spot and camera, into <out dir> with a receipt (renderer string).
//   BASE=http://127.0.0.1:5199 CHROME=<Chrome app> node scripts/town-plate-stills.mjs <out dir> [prefix]    (prefix = the file prefix, default plate; run once per build for before/after; POS=x,z,heading to place the hero)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const [out, prefix = 'plate'] = process.argv.slice(2), base = process.env.BASE ?? 'http://127.0.0.1:5199';
if (!out) throw new Error('usage: town-plate-stills.mjs <out dir> [prefix]');
fs.mkdirSync(out, { recursive: true });
const shapes = { '375': { width: 375, height: 812 }, desktop: { width: 1280, height: 800 } };
const spot = process.env.POS ? process.env.POS.split(',').map(Number) : null;   // default: where the page puts the hero (the plaza)
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const receipt = { renderer: null, shots: [], errors: [] };
try {
  for (const [name, viewport] of Object.entries(shapes)) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: name === '375' ? 2 : 1, isMobile: name === '375', hasTouch: name === '375' }), page = await ctx.newPage();
    page.on('pageerror', (e) => receipt.errors.push(`${name}: ${String(e).slice(0, 200)}`));
    await page.goto(`${base}/preview/origins/`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview, null, { timeout: 300000 });
    await page.waitForTimeout(14000);
    if (spot) { await page.evaluate(([px, pz, ph]) => window.originsPreview.place(px, pz, ph), spot); await page.waitForTimeout(4000); }
    receipt.renderer ??= await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
    const pos = await page.evaluate(() => ({ ...window.originsPreview.pos }));
    const file = `${prefix}-${name}.png`; await page.screenshot({ path: path.join(out, file) }); receipt.shots.push({ name, file, pos });
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, `receipt-${prefix}.json`), JSON.stringify(receipt, null, 2));
  console.log('town-plate-stills ok', JSON.stringify(receipt));
} finally { await browser.close(); }
