// Before/after stills at 375x812: `--url https://frankendom.com/` (before = live) or `--dist <dir>` (after = the head's build served locally). A normal career fight (Enter the arena, Fight): ready idle, then mid-fight after a few STRIKE presses.
/* global process, console, document */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import zlib from 'node:zlib';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const DIST = arg('dist', ''), URLARG = arg('url', ''), OUT = arg('out', 'out'), TAG = arg('tag', 'after');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
let srv, origin = URLARG;
if (!URLARG) {
  srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(DIST, p), data; try { data = await fs.readFile(file); } catch { file = path.join(DIST, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); origin = `http://127.0.0.1:${srv.address().port}/`;
}
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 240000 });
  { const enter = page.getByRole('button', { name: 'Enter the arena' }); await enter.waitFor({ timeout: 240000 }).catch(() => {}); if (await enter.isVisible().catch(() => false)) await enter.click({ timeout: 120000 }); }
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 240000, polling: 250 });
  await page.getByRole('button', { name: 'Fight', exact: true }).click({ timeout: 60000 });
  await page.waitForTimeout(2500);
  const info = async () => page.evaluate(() => ({ skill2Hidden: document.querySelector('#skill2-button')?.hidden ?? null, skill2Label: document.querySelector('#skill2-button')?.dataset.mobile ?? null, layoutA: !!document.getElementById('touch-zones'), stance: !!document.getElementById('stance-panel') && getComputedStyle(document.getElementById('stance-panel')).display !== 'none' }));
  await page.screenshot({ path: `${OUT}/${TAG}-ready.jpg`, type: 'jpeg', quality: 88 });
  const ready = await info();
  const box = await page.locator('#attack-button').boundingBox();
  for (let i = 0; i < 4; i++) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up(); await page.waitForTimeout(450); }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${TAG}-fight.jpg`, type: 'jpeg', quality: 88 });
  const mid = await info();
  const result = { tag: TAG, origin, ready, mid };
  await fs.writeFile(`${OUT}/${TAG}.json`, JSON.stringify(result, null, 1)); console.log(JSON.stringify(result));
  await context.close();
} finally { await browser.close(); srv?.close(); }
