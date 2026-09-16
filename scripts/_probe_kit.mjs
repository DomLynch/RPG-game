import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
const out = process.argv[2];
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' }); await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto(`${server.resolvedUrls.local[0]}character-preview.html`);
await page.waitForFunction(() => window.__preview?.loaded || window.__preview?.error, null, { timeout: 180000 });
const list = [['tunic front', 'Idle', 0, 'Head', .7, .25, -.05, [0, -.32, 0]], ['tunic back', 'Idle', 0, 'Head', .7, 3.0, -.05, [0, -.32, 0]], ['kilt', 'Idle', 0, 'Head', .6, .4, -.15, [0, -.75, 0]], ['baldric', 'Idle', 0, 'Head', .35, .6, .0, [.06, -.22, 0]],
  ['hem', 'Idle', 0, 'Head', .35, .3, -.2, [0, -.52, 0]], ['sandal', 'Idle', 0, 'Head', .35, .8, -.5, [.1, -1.45, 0]], ['whole front', 'Armed', 0, 'Head', 1.7, .3, 0, [0, -.65, 0]], ['whole back', 'Armed', 0, 'Head', 1.7, 3.1, 0, [0, -.65, 0]]];
const data = await page.evaluate(l => __preview.details(l), list);
await fs.writeFile(out, Buffer.from(data.split(',')[1], 'base64'));
await browser.close(); await server.close();
