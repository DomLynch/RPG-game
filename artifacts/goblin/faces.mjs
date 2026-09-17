// The opponent's faces sheet alone (the harness's faces() also needs the player): node artifacts/goblin/faces.mjs <enemy glb url> <out png>
import { createServer } from 'vite'; import { chromium } from 'playwright'; import fs from 'node:fs/promises';
const [enemy, out] = process.argv.slice(2);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' }); await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${server.resolvedUrls.local[0]}character-preview.html?enemy=${encodeURIComponent(enemy)}`);
await page.waitForFunction(() => window.__preview?.loaded || window.__preview?.error, null, { timeout: 90000 });
const data = await page.evaluate(() => __preview.faces());
await fs.writeFile(out, Buffer.from(data.split(',')[1], 'base64')); console.log(out);
await browser.close(); await server.close();
