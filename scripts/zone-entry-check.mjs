// Where does each zone page open the hero? For each address (a path under the base, e.g. /preview/origins/?zone=2), opens it at 375 wide, waits for the page, and logs the zone id, the area name in the header, and where he stands (x, z). A listed zone's entry must be inside that zone.
//   BASE=http://localhost:5199 CHROME=<Chrome app> node scripts/zone-entry-check.mjs "/preview/origins/?zone=2" "/preview/origins/?zone=1" ...
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const base = process.env.BASE ?? 'http://localhost:5199', paths = process.argv.slice(2);
if (!paths.length) throw new Error('usage: zone-entry-check.mjs <path> [<path> ...]');
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const p of paths) {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
    await page.goto(`${base}${p}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview, null, { timeout: 300000 });
    await page.waitForTimeout(9000);
    const at = await page.evaluate(() => ({ ...window.originsPreview.pos, place: document.getElementById('place')?.textContent ?? null, title: document.title }));
    console.log(JSON.stringify({ path: p, x: +at.x.toFixed(4), z: +at.z.toFixed(4), place: at.place, title: at.title, errors }));
    await page.context().close();
  }
} finally { await browser.close(); }
