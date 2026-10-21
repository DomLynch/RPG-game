// Zone 2 (the Ash Reach) look stills for Dom: base + ?z2look=a|b|c, 375 portrait and desktop, same camera, into <out dir>, with a receipt (renderer string: say "real GPU" only when it is not SwiftShader).
//   BASE=http://127.0.0.1:5199 node scripts/zone2-look-stills.mjs <out dir>      (BASE = a dev server or a served build of origins/preview; CHROME=<executable> for the Mac's Chrome)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const out = process.argv[2], base = process.env.BASE ?? 'http://127.0.0.1:5199';
if (!out) throw new Error('usage: zone2-look-stills.mjs <out dir>');
fs.mkdirSync(out, { recursive: true });
const shapes = { '375': { width: 375, height: 812 }, desktop: { width: 1280, height: 720 } };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: process.env.SOFT ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const receipt = { renderer: null, shots: [], errors: [] };
try {
  for (const look of ['base', 'a', 'b', 'c']) for (const [name, viewport] of Object.entries(shapes)) {
    const ctx = await browser.newContext({ viewport, isMobile: name === '375', hasTouch: name === '375' }), page = await ctx.newPage();
    page.on('pageerror', (e) => receipt.errors.push(`${look}/${name}: ${String(e).slice(0, 200)}`));
    await page.goto(`${base}/preview/origins/?region=1&zone=2&presence=0&daynight=0${look === 'base' ? '' : `&z2look=${look}`}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 });
    const [x, z, h] = (process.env.POS ?? '-55,-118,0').split(',').map(Number);   // the same spot and heading in every shot: open ground with the creatures ahead
    await page.evaluate(([px, pz, ph]) => window.originsPreview.place(px, pz, ph), [x, z, h]);
    await page.evaluate(() => { for (const el of document.querySelectorAll('div,p,section')) if (el.children.length === 0 && /^Left stick walks/.test(el.textContent ?? '')) (el.closest('[class]') ?? el).style.display = 'none'; });   // the first-run tutorial banner covers the sky
    await page.waitForTimeout(4000);
    receipt.renderer ??= await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
    const file = `${look}-${name}.png`; await page.screenshot({ path: path.join(out, file) });
    receipt.shots.push({ look, name, file });
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log('zone2-look-stills ok', JSON.stringify(receipt));
} finally { await browser.close(); }
