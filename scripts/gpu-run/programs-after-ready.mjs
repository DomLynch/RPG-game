// Which shader programs link AFTER [zone ready] on a phone tier page with no fight: the names at ready vs 120 s later (the deferred ground models' materials link when their items first draw). Run from a built checkout root (artifacts/origins-preview): node programs-after-ready.mjs <label>
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const label = process.argv[2] ?? 'tree', root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${built}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE })).newPage();
  await page.addInitScript(() => { const st = window.setTimeout.bind(window); window.setTimeout = (f, ms, ...a) => (ms === 30000 ? 0 : st(f, ms, ...a)); });   // software GL reaches ready after the 30 s groundDeferMax backstop; drop that timer so the gate on [zone ready] is what runs
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 480000, polling: 1000 });
  const atReady = await page.evaluate(() => window.originsPreview.renderInfo().programNames);
  await page.waitForTimeout(120000);
  const later = await page.evaluate(() => { const i = window.originsPreview.renderInfo(); return { names: i.programNames, keys: i.programKeys }; });
  const fresh = later.names.filter((n) => !atReady.includes(n));
  console.log(`${label} programs at ready ${atReady.length}, 120 s later ${later.names.length}, linked after ready: ${JSON.stringify(fresh.map((n) => `${n} ${later.keys?.[n] ?? ''}`.trim()))}`);
} finally { await browser.close(); server.close(); }
