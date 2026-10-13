// The visual cost of a client-governor trip (src/fight/governor.ts), on record: the fight camera at 375x812, ready idle and mid-fight, BEFORE (the page as it plays) and AFTER the ladder is forced
// to its last lever (view.degrade('shadows') then 'crowd' through the ?debug __view), a sparring dummy so the fight is the same one.
// Usage: SERVE=<dist dir> OUT=<dir> node scripts/governor-trip-still.mjs   (REAL_GL=1 on a GPU machine: scripts/gpu-run.mjs). Writes <OUT>/{before,after}-{idle,mid}.png.
import fs from 'node:fs/promises'; import http from 'node:http'; import path from 'node:path'; import zlib from 'node:zlib';
import { chromium } from 'playwright';
const OUT = process.env.OUT || 'artifacts/governor-trip', DIST = process.env.SERVE || 'dist';
const QUERY = '?opponent=veteran&spar=1&weapon=longsword&difficulty=dummy&skill=none&yourSpecial=none&special=none&debug';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const root = path.resolve(DIST);
const srv = http.createServer(async (req, res) => {
  const asked = path.resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html')}`);
  if (asked !== root && !asked.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  let file = asked, data; try { data = await fs.readFile(file); } catch { file = path.join(root, 'index.html'); data = await fs.readFile(file); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'cache-control': 'no-store' }); res.end(zlib.gzipSync(data, { level: 6 }));
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ headless: true, args: process.env.REAL_GL ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
await fs.mkdir(OUT, { recursive: true });
const errors = [];
try {
  for (const state of ['before', 'after']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }), page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message)); await page.route('**/*sentry.io/**', (r) => r.abort());
    await page.goto(`${base}/${QUERY}`, { waitUntil: 'commit' });
    await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 300000, polling: 250 });
    await page.addStyleTag({ content: '#debug{display:none!important}' });
    if (state === 'after') await page.evaluate(() => { globalThis.__view.degrade('shadows'); globalThis.__view.degrade('crowd'); });
    await page.waitForTimeout(2500); await page.screenshot({ path: path.join(OUT, `${state}-idle.png`) });
    await page.click('#attack-button'); await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, `${state}-mid.png`) });
    await context.close();
  }
} finally { await browser.close(); srv.close(); }
if (errors.length) { console.log('pageerror:', errors.join(' | ')); process.exit(1); }
console.log('governor-trip-still: PASS (4 stills in', OUT + ')');
