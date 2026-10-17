// The far LOD beside the whole hero at 4 / 8 / 14 m, standing and walking, at 375 wide (scripts/character/far-lod-still.html on a vite dev server, software GL). Per distance and mode: the 375 frame and a crop at 4x (2x at 4 m).
// Usage: node scripts/character/far-lod-still.mjs <out dir> [sheathed|ready]
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const out = path.resolve(process.argv[2] ?? 'artifacts/far-lod'), pose = process.argv[3] ?? 'sheathed';
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/scripts/character/far-lod-still.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const crop = { 4: { x: 0, y: 40, width: 375, height: 420 }, 8: { x: 55, y: 190, width: 265, height: 240 }, 14: { x: 95, y: 250, width: 185, height: 140 } };
try {
  for (const mode of ['stand', 'walk']) {
    for (const d of [4, 8, 14]) {
      for (const scale of [1, d === 4 ? 2 : 4]) {
        const page = await (await browser.newContext({ viewport: { width: 375, height: 560 }, deviceScaleFactor: scale, isMobile: true, hasTouch: true })).newPage();
        const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
        await page.goto(`${base}?d=${d}&mode=${mode}&pose=${pose}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.ready === true, null, { timeout: 240000 }).catch(() => { throw new Error(`not ready: ${errors.join(' | ')}`); });
        if (scale === 1) { await page.screenshot({ path: path.join(out, `lod-${mode}-${d}m-375.png`) }); console.log(JSON.stringify(await page.evaluate(() => window.result)), 'errors', errors.length, errors.slice(0, 2)); }
        else await page.screenshot({ path: path.join(out, `lod-${mode}-${d}m-zoom.png`), clip: crop[d] });
        await page.close();
      }
    }
  }
} finally { await browser.close(); await server.close(); }
