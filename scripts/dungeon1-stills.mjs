// The Dungeon 1 bowl (zone 7, /dungeon1/) at 375 wide: the yard start, then a few spots down the rings, for Dom. The page is a dev server or a served build run with the unlisted opt-in (VITE_UNLISTED_ZONES=1) while the zone is unlisted.
//   BASE=http://localhost:5199 CHROME=<Chrome app> node scripts/dungeon1-stills.mjs <out dir>      (POS="name=x,z,heading;..." overrides the spots; SOFT=1 software GL)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const out = process.argv[2], base = process.env.BASE ?? 'http://127.0.0.1:5199';
if (!out) throw new Error('usage: dungeon1-stills.mjs <out dir>');
fs.mkdirSync(out, { recursive: true });
const spots = (process.env.POS ?? 'terrace=0,29,3.1416;middle=0,19,3.1416;floor=0,8,3.1416;duel=24,48,3.1416').split(';').filter(Boolean).map((s) => { const [n, at] = s.split('='); return [n, at.split(',').map(Number)]; });
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined, args: process.env.SOFT ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const receipt = { renderer: null, shots: [], errors: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }), page = await ctx.newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.goto(`${base}/preview/origins/?region=1&zone=7&presence=0&daynight=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 });
  await page.evaluate(() => { for (const el of document.querySelectorAll('div,p,section')) if (el.children.length === 0 && /^Left stick walks/.test(el.textContent ?? '')) (el.closest('[class]') ?? el).style.display = 'none'; });
  await page.waitForTimeout(4000);
  receipt.renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  receipt.zoneName = await page.evaluate(() => document.title);
  await page.screenshot({ path: path.join(out, 'start-375.png') }); receipt.shots.push('start-375.png');
  for (const [name, [x, z, h]] of spots) {
    await page.evaluate(([px, pz, ph]) => window.originsPreview.place(px, pz, ph), [x, z, h]);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(out, `${name}-375.png`) }); receipt.shots.push(`${name}-375.png`);
  }
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 1));
  console.log('dungeon1-stills ok', JSON.stringify(receipt));
} finally { await browser.close(); }
