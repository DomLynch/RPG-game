// Stills of the bow sandbox (Combat, visual-pr-stills): the page at 375 wide in three deterministic frames, ready, mid-draw, arrow in flight (and just landed).
//   node scripts/bow-still.mjs --dist artifacts/bow-preview [--out artifacts/combat/bows] [--dpr 2]
/* global process, console, document, window, URL */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'artifacts/bow-preview'), OUT = arg('out', 'artifacts/combat/bows'), DPR = Number(arg('dpr', 2));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/preview\/bows/, ''); if (p === '/' || p === '') p = '/bow-preview.html';
  try { const data = await fs.readFile(path.join(DIST, p)); res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(data); } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${srv.address().port}/preview/bows/`;
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  await fs.rm(OUT, { recursive: true, force: true }); await fs.mkdir(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), meta = {};
  for (const still of ['ready', 'draw', 'flight', 'hit']) {
    const page = await context.newPage(); page.on('pageerror', (e) => console.log('pageerror:', e.message));
    await page.goto(`${origin}?still=${still}`); await page.waitForFunction(() => window.__bow !== undefined, null, { timeout: 120000, polling: 200 }); await page.waitForTimeout(600);
    meta[still] = await page.evaluate(() => window.__bow);
    await page.screenshot({ path: `${OUT}/${still}.jpg`, type: 'jpeg', quality: 92, animations: 'disabled' }); await page.close();
  }
  await fs.writeFile(`${OUT}/meta.json`, JSON.stringify({ viewport: '375x812', dpr: DPR, frames: meta }, null, 2));
  console.log(`bow stills -> ${OUT}`);
} finally { await browser.close(); srv.close(); }
