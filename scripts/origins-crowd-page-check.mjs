// Checks the on-phone crowd page (?crowd=N, origins/preview/crowd-demo.ts): loads Zone 1 at 375x812 touch with ?crowd=N, waits for [zone ready] and for the fps readout, and asserts it shows N drawn
// figures; saves a still and the readout text. Usage: SERVE=1 OUT=/tmp/crowd-page N=16 node scripts/origins-crowd-page-check.mjs (build first: `npx vite build --config origins/preview/vite.config.mjs`).
// On the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/crowd-page.sh
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { chromium } from 'playwright';
const OUT = process.env.OUT || '/tmp/crowd-page', N = +(process.env.N || 16); fs.mkdirSync(OUT, { recursive: true });
const root = process.cwd(), roots = { '/preview/origins/': path.join(root, 'artifacts/origins-preview') + '/' };   // the same static server as scripts/origins-crowd-fps.mjs
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots['/' + d + '/'] = root + '/public/' + d + '/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.ktx2': 'image/ktx2' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null; for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', mime[path.extname(hit)] || 'application/octet-stream'); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: process.env.GL === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage(), errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
let hud = null, fail = null;
try {
  await page.goto(`http://127.0.0.1:${srv.address().port}/preview/origins/?region=1&crowd=${N}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 });
  await page.waitForFunction(() => /median/.test(document.body.innerText), null, { timeout: 60000 });
  await page.waitForTimeout(8000);
  hud = await page.evaluate(() => [...document.querySelectorAll('div')].map((d) => d.textContent).find((t) => /^crowd \d+/.test(t ?? '')) ?? null);
  await page.screenshot({ path: `${OUT}/crowd-${N}.png` });
  if (!hud || !new RegExp(`drawn ${N}\\b`).test(hud)) fail = `readout did not show ${N} drawn: ${hud}`;
} catch (e) { fail = String(e).slice(0, 300); }
fs.writeFileSync(`${OUT}/crowd-page.json`, JSON.stringify({ n: N, hud, errors, fail }, null, 2));
console.log(JSON.stringify({ n: N, hud, errors, fail })); await browser.close(); srv.close(); if (fail) process.exit(1);
