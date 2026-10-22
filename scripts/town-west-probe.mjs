// Where the Exchange's west opening is: scans canStand along x = -19..-22 for z in -60..-10 on the plain Zone 1 page and prints the z ranges that let a body through (the passage onto the west road).
//   BASE=http://localhost:5199 CHROME=<Chrome app> node scripts/town-gate-probe.mjs
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const base = process.env.BASE ?? 'http://localhost:5199';
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  await page.goto(`${base}/preview/origins/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview, null, { timeout: 300000 });
  await page.waitForTimeout(8000);
  const rows = await page.evaluate(() => {
    const out = {};
    for (const x of [-12, -16, -19, -20, -22, -26, -40]) { const open = []; for (let z = -60; z <= -8; z += 0.5) if (window.originsPreview.canStand(x, z)) open.push(z); out[x] = open.length ? [open[0], open[open.length - 1], open.length] : null; }
    return out;
  });
  console.log(JSON.stringify(rows));
} finally { await browser.close(); }
