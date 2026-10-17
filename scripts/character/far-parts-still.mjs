// Far-figure parts at 4 / 8 / 14 m (scripts/character/far-parts-still.html on a vite dev server, software GL). Whole hero left, reduced right. Per distance: the 375 wide frame, and a 4x crop of the two figures (what a phone's pixels show, magnified).
// Usage: node scripts/character/far-parts-still.mjs <out dir> [hide regex]
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const out = path.resolve(process.argv[2] ?? 'artifacts/far-parts'), hide = process.argv[3] ?? 'PhotoEyes|PhotoTeeth|Steel|Heraldry|WrapBoots|LeatherBody';
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/scripts/character/far-parts-still.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const d of [4, 8, 14]) {
    for (const scale of [1, 4]) {
      const page = await (await browser.newContext({ viewport: { width: 375, height: 560 }, deviceScaleFactor: scale, isMobile: true, hasTouch: true })).newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
      await page.goto(`${base}?d=${d}&hide=${encodeURIComponent(hide)}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
      if (scale === 1) { await page.screenshot({ path: path.join(out, `far-${d}m-375.png`) }); console.log(`d=${d}`, JSON.stringify(await page.evaluate(() => window.result)), 'errors', errors.length); if (d === 4) console.log('parts', JSON.stringify(await page.evaluate(() => window.parts))); }
      else await page.screenshot({ path: path.join(out, `far-${d}m-zoom4.png`), clip: { x: 95, y: 130, width: 185, height: 280 } });
      await page.close();
    }
  }
} finally { await browser.close(); await server.close(); }
