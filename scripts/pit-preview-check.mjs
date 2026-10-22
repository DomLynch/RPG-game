// Does a published Pit preview show its layout (not plain Zone 1)? Opens <url>?pitlayout=<layout> at 375 wide on the Mac's GPU, stands the hero at the yard and on the Champion floor, and reads the ground under him: the layout's floor is 4.4 m below the rim, plain Zone 1 is flat.
//   CHROME=<Chrome app> node scripts/pit-preview-check.mjs <base url, e.g. https://frankendom.com/preview/pit-layouts/> <out dir>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const [baseUrl, out] = process.argv.slice(2);
if (!baseUrl || !out) throw new Error('usage: pit-preview-check.mjs <base url> <out dir>');
fs.mkdirSync(out, { recursive: true });
const FLOOR = { bowl: [0, 4, 0], spiral: [0, 3, 0] }, YARD = { bowl: [0, 47, Math.PI], spiral: [0, 36, Math.PI] };
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = [];
try {
  for (const layout of ['bowl', 'spiral']) {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    await page.goto(`${baseUrl}?pitlayout=${layout}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview, null, { timeout: 300000 });
    await page.waitForTimeout(12000);
    const renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
    await page.evaluate(([x, z, h]) => window.originsPreview.place(x, z, h), YARD[layout]); await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(out, `live-${layout}-yard-375.png`) });
    await page.evaluate(([x, z, h]) => window.originsPreview.place(x, z, h), FLOOR[layout]); await page.waitForTimeout(2500);
    const floor = await page.evaluate(() => window.originsPreview.camPos?.() ?? null);
    await page.screenshot({ path: path.join(out, `live-${layout}-floor-375.png`) });
    results.push({ layout, renderer, hasLayout: !!floor && floor.hero < -4, heroGroundAtFloor: floor?.hero ?? null, errors });
    await page.context().close();
  }
  fs.writeFileSync(path.join(out, 'live-check.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
