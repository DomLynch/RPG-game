// The three dungeon kit nodes close up at 375 wide: front, quarter and side beside a 1.8 m stand-in (scripts/character/dungeon-kit-still.html on a vite dev server, software GL).
// Usage: node scripts/character/dungeon-kit-still.mjs <out dir> [node ...]   (default: cave_wall cave_doorway bone_pile)
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const out = path.resolve(process.argv[2] ?? 'artifacts/dungeon-kit'), nodes = process.argv.length > 3 ? process.argv.slice(3) : ['cave_wall', 'cave_doorway', 'bone_pile'];
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/scripts/character/dungeon-kit-still.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const node of nodes) {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 560 }, isMobile: true, hasTouch: true })).newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await page.goto(`${base}?node=${node}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.ready === true, null, { timeout: 240000 }).catch(() => { throw new Error(`not ready: ${errors.join(' | ')}`); });
    for (const v of ['front', 'quarter', 'side']) { await page.evaluate((view) => window.view(view), v); await page.screenshot({ path: path.join(out, `${node}-${v}.png`) }); }
    console.log('result:', JSON.stringify(await page.evaluate(() => window.result)), 'errors:', errors.length, errors.slice(0, 3));
    await page.close();
  }
} finally { await browser.close(); await server.close(); }
