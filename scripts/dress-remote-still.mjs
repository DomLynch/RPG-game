// Two actors dressed through dressRemote, 375 wide (scripts/dress-remote-still.html on a vite dev server). Usage: node scripts/dress-remote-still.mjs <out dir>   (GL: software on the VPS; the GPU job passes its own flags)
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const out = path.resolve(process.argv[2] ?? 'artifacts/dress-remote');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/scripts/dress-remote-still.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 560 }, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
  await page.screenshot({ path: path.join(out, 'two-dressed.png') });
  const result = await page.evaluate(() => window.result);
  console.log('result:', JSON.stringify(Object.values(result).map((r) => ({ worn: Object.keys(r.worn).join(','), missing: r.missing, cold: r.cold }))));
  console.log('errors:', errors.length, errors.slice(0, 3));
} finally { await browser.close(); await server.close(); }
