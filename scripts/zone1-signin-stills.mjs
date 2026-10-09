// 375-wide still of the Zone 1 top HUD with the Sign in link: prints its box (the 44 px tap target, Web 2026-10-09).
// Usage: node scripts/zone1-signin-stills.mjs <built origins-preview dist> <out dir>   (software GL is fine: it is a layout check)
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
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => [...document.querySelectorAll('a')].some((a) => a.textContent === 'Sign in'), null, { timeout: 240000 });
  await page.waitForTimeout(6000);
  console.log(JSON.stringify(await page.evaluate(() => { const r = [...document.querySelectorAll('a')].find((a) => a.textContent === 'Sign in').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })));
  await page.screenshot({ path: path.join(out, 'signin.png'), clip: { x: 0, y: 0, width: 375, height: 200 }, timeout: 240000 });
} finally { await browser.close(); server.close(); }
