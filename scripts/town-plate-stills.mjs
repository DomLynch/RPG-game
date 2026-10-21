// The Concord Exchange plate stills for Dom: the town page (no region) at 375 portrait and desktop, same spot and camera, into <out dir> with a receipt (renderer string).
//   BASE=http://127.0.0.1:5199 CHROME=<Chrome app> node scripts/town-plate-stills.mjs <out dir> [name]    (name = the file prefix, default plate; run once per build for before/after)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [out, prefix = 'plate'] = process.argv.slice(2), base = process.env.BASE ?? 'http://127.0.0.1:5199';
if (!out) throw new Error('usage: town-plate-stills.mjs <out dir> [prefix]');
fs.mkdirSync(out, { recursive: true });
const shapes = { '375': { width: 375, height: 812 }, desktop: { width: 1280, height: 720 } };
const [x, z, h] = (process.env.POS ?? '0,-36,0').split(',').map(Number);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const receipt = { renderer: null, shots: [], errors: [] };
try {
  for (const [name, viewport] of Object.entries(shapes)) {
    const ctx = await browser.newContext({ viewport, isMobile: name === '375', hasTouch: name === '375' }), page = await ctx.newPage();
    page.on('pageerror', (e) => receipt.errors.push(`${name}: ${String(e).slice(0, 200)}`));
    await page.goto(`${base}/preview/origins/?presence=0&daynight=0`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.place, null, { timeout: 240000 });
    await page.waitForTimeout(6000);
    await page.evaluate(([px, pz, ph]) => window.originsPreview.place(px, pz, ph), [x, z, h]);
    await page.evaluate(() => { for (const el of document.querySelectorAll('div,p,section')) if (el.children.length === 0 && /^Left stick walks/.test(el.textContent ?? '')) (el.closest('[class]') ?? el).style.display = 'none'; });
    await page.waitForTimeout(5000);
    receipt.renderer ??= await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
    const file = `${prefix}-${name}.png`; await page.screenshot({ path: path.join(out, file) }); receipt.shots.push({ name, file, pos: { x, z, h } });
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, `receipt-${prefix}.json`), JSON.stringify(receipt, null, 2));
  console.log('town-plate-stills ok', JSON.stringify(receipt));
} finally { await browser.close(); }
