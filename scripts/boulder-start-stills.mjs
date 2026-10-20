// Zone 1's start view and a fight beside the first drawn creature (Web's flow, scripts/landscape-check.mjs on web/evidence-pit-gfx-k6h, where the flat olive boulder cluster shows bottom-left at 844x390):
// walk.jpg at the start, then the hero is placed 3 m and 1.4 m south of the first drawn creature, a tap starts the fight, fight.jpg. Used for the boulder tint before/after.
// Usage: node scripts/boulder-start-stills.mjs <built origins-preview dist> <out dir>   env: VIEW=844x390 PIT_GL=1 (software GL)
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
  const [w, h] = (process.env.VIEW || '844x390').split('x').map(Number);
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 300000 }); await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(out, 'walk.jpg'), type: 'jpeg', quality: 85 });
  const target = await page.evaluate(() => window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body)[0]);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 3, 0), [target.x, target.z]); await page.waitForTimeout(2500);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 1.4, 0), [target.x, target.z]); await page.waitForTimeout(1500);
  await page.evaluate((i) => window.originsPreview.tapMob(i), target.id); await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(out, 'fight.jpg'), type: 'jpeg', quality: 85 });
  console.log(JSON.stringify({ target: target.id, size: [w, h] }));
} finally { await browser.close(); server.close(); }
