// 375-wide stills of Zone 1 (?region=1&worldfight) for STAB (#1957): ready idle, mid-fight (engaged), then a stab pressed (window.originsPreview.combat press('thrust')) and shot mid-swing.
// Usage: node scripts/zone1-stab-stills.mjs <built origins-preview dist> <out dir>   (software GL is fine: it is a layout check)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const [dist, out] = process.argv.slice(2), root = process.cwd();
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${path.resolve(dist)}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await (process.env.ENGINE === 'webkit' ? webkit.launch() : chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }));
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`), timeout: 240000 });
  await shot('idle');
  const info = await page.evaluate(() => { const ms = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); let best = null; for (const m of ms) { const near = ms.filter((o) => Math.hypot(o.x - m.x, o.z - m.z) <= 9); if (!best || near.length > best.near.length) best = { m, near }; } const c = best.near.reduce((a, o) => ({ x: a.x + o.x / best.near.length, z: a.z + o.z / best.near.length }), { x: 0, z: 0 }); return { n: best.near.length, ids: best.near.map((o) => o.id), c }; });
  console.log('cluster:', JSON.stringify(info));
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [info.c.x, info.c.z]);
  await page.waitForFunction(() => document.body.classList.contains('infight'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot('joined');
  console.log('fighters:', JSON.stringify(await page.evaluate(() => window.originsPreview.combat().fighters)).slice(0, 700));
  console.log('hero:', JSON.stringify(await page.evaluate(() => window.originsPreview.combat().hero)).slice(0, 200));
  console.log('errors:', errors.length, errors.slice(0, 2));
} finally { await browser.close(); server.close(); }
