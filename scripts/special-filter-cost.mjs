// What The Price's canvas filter costs (Strategy 2026-10-01: p50/p95 frame time, special on vs off, 375 wide, 4x CPU throttle as the mid-phone stand-in; a CPU stand-in only, NOT a phone GPU).
// The same arena, the same 10 s each: the canvas's CSS filter cleared against the filter The Price applies at full strength (special-fx-boss.ts thePrice). A plain fight page, so no cast
// competes for the canvas style. `--gl swiftshader` (the VPS, default) or `--gl metal` (a Mac with a GPU).
//   node scripts/special-filter-cost.mjs --dist dist [--opponent witch] [--ms 10000] [--gl swiftshader]  → artifacts/special-filter-cost/cost.json + one line per row
/* global process, console, document, performance, requestAnimationFrame */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), OPPONENT = arg('opponent', 'witch'), MS = Number(arg('ms', 10000)), GL = arg('gl', 'swiftshader');
const FILTER = 'saturate(0.120) sepia(0.250) contrast(1.080)';   // the price at amount 1 (thePrice in special-fx-boss.ts)
const OUT = 'artifacts/special-filter-cost'; await fs.mkdir(OUT, { recursive: true });

async function serveDist(dir) {
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ktx2': 'image/ktx2' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}
const sample = (page, ms) => page.evaluate((ms) => new Promise((done) => {
  const stamps = [], end = performance.now() + ms;
  const tick = (t) => { stamps.push(t); if (t < end) requestAnimationFrame(tick); else {
    const dt = stamps.slice(1).map((v, i) => v - stamps[i]).sort((a, b) => a - b), n = dt.length, at = (q) => dt[Math.min(n - 1, Math.floor(n * q))];
    done({ frames: n, p50: +at(0.5).toFixed(2), p95: +at(0.95).toFixed(2), max: +dt[n - 1].toFixed(2), over50ms: dt.filter((v) => v > 50).length }); } };
  requestAnimationFrame(tick);
}), ms);

const server = await serveDist(DIST);
const args = GL === 'metal' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, args }), rows = [];
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), page = await context.newPage();
  page.setDefaultTimeout(180000); await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.goto(`${server.origin}/?opponent=${OPPONENT}`);
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
  if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).tap();
  await page.waitForFunction(() => document.querySelector('#welcome').hidden);
  const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(3000);
  for (const [label, filter] of [['filter off', ''], ['filter on (The Price at full)', FILTER], ['filter off (again)', ''], ['filter on (again)', FILTER]]) {
    await page.evaluate((f) => { document.getElementById('world').style.filter = f; }, filter); await page.waitForTimeout(1500);
    const row = { cpuThrottle: 4, gl: GL, state: label, ...await sample(page, MS) }; rows.push(row); console.log(JSON.stringify(row));
  }
} finally { await browser.close(); await server.close(); }
await fs.writeFile(`${OUT}/cost.json`, JSON.stringify({ note: '4x CPU throttle (CDP) at 375x812 touch dpr 2: a CPU stand-in, NOT a phone GPU', rows }, null, 1));
