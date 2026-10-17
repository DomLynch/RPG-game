// One fort kit node close up at 375 wide (scripts/character/fort-piece-still.html on a vite dev server). Usage: node scripts/character/fort-piece-still.mjs <out dir> [node name] [kit file in public/world/kit]   (software GL)
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const out = path.resolve(process.argv[2] ?? 'artifacts/fort-piece'), node = process.argv[3] ?? 'goblin_totem', kitFile = process.argv[4] ?? 'goblin-fort-kit.glb';
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/scripts/character/fort-piece-still.html?node=${node}&kit=${kitFile}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 560 }, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
  for (const v of ['front', 'quarter', 'side']) { await page.evaluate((view) => window.view(view), v); await page.screenshot({ path: path.join(out, `${node}-${v}.png`) }); }
  console.log('result:', JSON.stringify(await page.evaluate(() => window.result)), 'errors:', errors.length, errors.slice(0, 3));
} finally { await browser.close(); await server.close(); }
