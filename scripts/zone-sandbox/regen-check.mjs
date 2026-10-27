// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: node scripts/zone-sandbox/regen-check.mjs <outDir> "<url>" <seconds> still   // hurt 80, stand still, health every 5 s
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
import { launchBrowser } from '../lib/harness-browser-launch.mjs';
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [OUT, URL, TOTAL, MODE] = process.argv.slice(2);   // MODE: still (stand still) | walk
const browser = await launchBrowser(chromium, { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
await page.goto(URL + `&v=rg${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs.some((x) => x.loadout) && originsPreview.pose().actor, null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(5000);
const hp = () => page.evaluate(() => { const h = originsPreview.combat().hero; return { h: Math.round(h.health * 10) / 10, max: h.max, s: Math.round(h.stamina) }; });
const near = await page.evaluate(() => originsPreview.combat().fighters.filter((f) => f.id !== 'me').map((f) => Math.hypot(f.x - originsPreview.pos.x, f.z - originsPreview.pos.z)).sort((a, b) => a - b)[0]);
console.log('nearest creature at the start spot (m):', near?.toFixed(1));
await page.evaluate(() => originsPreview.hurt(80));   // a known hurt: 80 of 150
const start = await hp(); console.log('hurt to', JSON.stringify(start));
await page.screenshot({ path: `${OUT}/regen-hurt.png` });
const series = [[0, start.h, start.s]]; const t1 = Date.now(); let full = null;
while ((Date.now() - t1) / 1000 < Number(TOTAL) + 30) {
  if (MODE === 'walk') await page.evaluate(() => { originsPreview.pos.x += 0.0; });   // (walking is covered by the unit tests; the live check stands still)
  await page.waitForTimeout(5000); const s = await hp(), t = Math.round((Date.now() - t1) / 1000); series.push([t, s.h, s.s]);
  if (!full && s.h >= s.max - 0.5) { full = t; break; }
}
console.log('health over time (s:hp):', series.map(([t, h]) => `${t}:${h}`).join(' '));
console.log('full after', full, 's from', start.h, '/', start.max, '| stamina series', series.map(([, , s]) => s).join(','));
await page.screenshot({ path: `${OUT}/regen-after.png` });
console.log('page errors', errors.length);
await browser.close();
