// Do any shader programs link when a loot item FIRST DRAWS after [zone ready] on a phone? Run from a built checkout root: node loot-draw-programs.mjs <label>
// ready: names at [zone ready]; settled: names once loot.glb has arrived and its async compile had 60 s (software GL); drawn: names 20 s after a loot item (item:starter.goblin-scrap-cap) is put on the ground in view.
// newPrograms at the first loot draw = drawn minus settled (must be []).
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
  await page.addInitScript(() => { const st = window.setTimeout.bind(window); window.setTimeout = (f, ms, ...a) => (ms === 30000 ? 0 : st(f, ms, ...a)); });   // software GL reaches ready after the 30 s groundDeferMax backstop; drop that timer so the gate on [zone ready] runs
  let lootAt = -1; const t0 = Date.now(); page.on('requestfinished', (r) => { if (/loot[-.][^/]*\.glb/.test(r.url())) lootAt = Date.now() - t0; });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 480000, polling: 1000 });
  const names = () => page.evaluate(() => window.originsPreview.renderInfo().programNames);
  const ready = await names();
  await page.waitForTimeout(60000);
  const settled = await names();
  await page.evaluate(() => { const p = window.originsPreview.pos; window.originsPreview.ground.show('loot-proof', 'item:starter.goblin-scrap-cap', p.x, p.z + 2.5); });
  await page.waitForTimeout(20000);
  const drawn = await names();
  const diff = (a, b) => b.filter((n) => !a.includes(n));
  console.log(`${label} loot.glb finished ${lootAt >= 0 ? 'yes' : 'NO'}; programs: at ready ${ready.length}, settled ${settled.length}, after a loot item draws ${drawn.length}`);
  console.log(`${label} linked between ready and settled (the async compile): ${JSON.stringify(diff(ready, settled))}`);
  console.log(`${label} NEW PROGRAMS AT THE FIRST LOOT DRAW: ${JSON.stringify(diff(settled, drawn))}; page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
} finally { await browser.close(); server.close(); }
