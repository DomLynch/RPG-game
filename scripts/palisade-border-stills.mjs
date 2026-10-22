// Zone 1 drop-in still at 375 wide (the spot a new player appears on), for the palisade border cut: run once on trunk (before) and once on the branch (after) into different out dirs.
//   BASE=http://127.0.0.1:5199 CHROME=<Chrome app> node scripts/palisade-border-stills.mjs <out dir>      (POS=x,z,heading adds a second shot at that spot; SOFT=1 forces software GL)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const out = process.argv[2], base = process.env.BASE ?? 'http://127.0.0.1:5199';
if (!out) throw new Error('usage: palisade-border-stills.mjs <out dir>');
fs.mkdirSync(out, { recursive: true });
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined, args: process.env.SOFT ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const receipt = { renderer: null, shots: [], errors: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }), page = await ctx.newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.goto(`${base}/preview/origins/?region=1&zone=1&presence=0&daynight=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 });
  await page.evaluate(() => { for (const el of document.querySelectorAll('div,p,section')) if (el.children.length === 0 && /^Left stick walks/.test(el.textContent ?? '')) (el.closest('[class]') ?? el).style.display = 'none'; });
  await page.waitForTimeout(4000);
  receipt.renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  await page.screenshot({ path: path.join(out, 'drop-in-375.png') }); receipt.shots.push('drop-in-375.png');
  for (const spec of (process.env.POS ?? '').split(';').filter(Boolean)) {   // POS="east=-52,40,1.5708;north=-140,78,0": name=x,z,heading, one shot each
    const [name, at] = spec.includes('=') ? spec.split('=') : ['pos', spec], [x, z, h] = at.split(',').map(Number);
    await page.evaluate(([px, pz, ph]) => window.originsPreview.place(px, pz, ph), [x, z, h]);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(out, `${name}-375.png`) }); receipt.shots.push(`${name}-375.png`);
  }
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 1));
  console.log('palisade-border-stills ok', JSON.stringify(receipt));
} finally { await browser.close(); }
