// Zone 1's nearest kit boulder, read from the LIVE scene (no offline placement guesses): wait for the kit, take the instance of boulder_* nearest the hero's start, place the hero DIST m south of it facing it
// (heading 0 looks along +z), shoot. Usage: node scripts/boulder-live-stills.mjs <built origins-preview dist> <out dir>   env: VIEW=844x390 DIST=4 SETTLE=8000 PIT_GL=1
/* global process, console, window */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(path.resolve(dist), u.replace(/^\/preview\/origins\//, '')); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.statusCode = 404; res.end(); return; } res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
try {
  const [w, h] = (process.env.VIEW || '844x390').split('x').map(Number), DIST = +(process.env.DIST || 4);
  const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.kitNodes?.('boulder').length > 0, null, { timeout: 300000 });
  await page.waitForTimeout(3000);
  const near = await page.evaluate(() => { const p = window.originsPreview.pos, all = window.originsPreview.kitNodes('boulder'); all.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); return { start: [p.x, p.z], count: all.length, nearest: all[0] }; });
  await page.evaluate(([x, z, d]) => window.originsPreview.place(x, z - d, 0), [near.nearest.x, near.nearest.z, DIST]);
  await page.waitForTimeout(+(process.env.SETTLE || 8000));
  await page.screenshot({ path: path.join(out, 'boulder.jpg'), type: 'jpeg', quality: 88 });
  console.log(JSON.stringify({ size: [w, h], DIST, ...near }));
} finally { await browser.close(); server.close(); }
