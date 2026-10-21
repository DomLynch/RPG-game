// usage: node scripts/.stb.mjs <distDir> <outprefix> [query]   stance B stills: ready idle + mid-fight at 375x812
import { chromium } from 'playwright';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
const [dist, out, query = ''] = process.argv.slice(2);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.ktx2': 'image/ktx2' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = path.join(dist, u === '/' ? 'index.html' : u);
  if (fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!fs.existsSync(hit)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', mime[path.extname(hit)] || 'application/octet-stream'); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
await page.route('**/*sentry.io/**', (r) => r.abort());
await page.goto(`http://127.0.0.1:${srv.address().port}/${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap({ timeout: 120000 });
await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 240000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}-ready.png` });
console.log('panel', await page.evaluate(() => JSON.stringify([...document.querySelectorAll('#stance-panel [data-stance]')].map((b) => [b.dataset.stance, b.getAttribute('aria-pressed'), Math.round(b.getBoundingClientRect().top), Math.round(b.getBoundingClientRect().left), Math.round(b.getBoundingClientRect().width)]))));
if (process.env.TAP) { await page.locator(`#stance-panel [data-stance=${process.env.TAP}]`).tap(); await page.waitForTimeout(3000); await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 240000 }); await page.waitForTimeout(2000); await page.screenshot({ path: `${out}-picked.png` }); }
await page.getByRole('button', { name: 'Fight', exact: true }).tap(); await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}-fight.png` });
await browser.close(); srv.close();
