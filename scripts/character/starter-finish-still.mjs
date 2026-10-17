// The starter items' finish rows on the hero at 375 wide (scripts/character/starter-finish-still.html on a vite dev server, software GL). Usage: node scripts/character/starter-finish-still.mjs <out dir> [sword|kit]
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const out = path.resolve(process.argv[2] ?? 'artifacts/starter-finish'), set = process.argv[3] ?? 'sword';
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/scripts/character/starter-finish-still.html?set=${set}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 560 }, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
  for (const v of ['front', 'close', 'side']) { await page.evaluate((view) => window.view(view), v); await page.screenshot({ path: path.join(out, `starter-${set}-${v}.png`) }); }
  console.log('result:', JSON.stringify(await page.evaluate(() => window.result)), 'errors:', errors.length, errors.slice(0, 3));
} finally { await browser.close(); await server.close(); }
