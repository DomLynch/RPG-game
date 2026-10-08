// 375-wide stills of Zone 1 (?region=1&worldfight) for the name-tag clamp (#1902): ready idle, then mid-fight (the foe engaged, the others still in view).
// Usage: node scripts/zone1-tags-stills.mjs <built origins-preview dist> <out dir>   (software GL is fine: it is a layout check)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

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
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`), timeout: 240000 });
  await shot('idle');
  const want = process.env.TAGS_TARGET || '';   // a creature id; default the first drawn one in id order, so before and after engage the same foe
  const target = await page.evaluate((id) => window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body).sort((a, b) => (a.id < b.id ? -1 : 1)).find((m) => !id || m.id === id), want);
  console.log('target:', target.id);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [target.x, target.z]);
  await page.waitForTimeout(20000);
  await page.evaluate((id) => window.originsPreview.tapMob(id), target.id);
  for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => window.originsPreview.duel()?.ready)) break; }
  await page.waitForTimeout(4000);
  await shot('fight');
  console.log('errors:', errors.length, errors.slice(0, 2));
} finally { await browser.close(); server.close(); }
