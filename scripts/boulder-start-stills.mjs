// Zone 1's start view and a fight beside the first drawn creature (Web's flow, scripts/landscape-check.mjs on web/evidence-pit-gfx-k6h, where the flat olive boulder cluster shows bottom-left at 844x390):
// walk.jpg at the start, then the hero is placed 3 m and 1.4 m south of the first drawn creature, a tap starts the fight, fight.jpg. Used for the boulder tint before/after.
// Usage: node scripts/boulder-start-stills.mjs <built origins-preview dist> <out dir>   env: VIEW=844x390 PIT_GL=1 (software GL)
/* global process, console, window */
import { launchBrowser } from './lib/harness-browser-launch.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(path.resolve(dist), u.replace(/^\/preview\/origins\//, '')); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.statusCode = 404; res.end(); return; } res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await launchBrowser(chromium, { args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
try {
  const [w, h] = (process.env.VIEW || '844x390').split('x').map(Number);
  // Web's harness for docs/evidence/zone-landscape/after-844x390.jpg (message 10-20 22:5x): this URL, an iPhone Safari UA, the first drawn Cinder scavenger, the hero 2.5 m short of it, heading 0; the kit's phone thinning follows the UA
  const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900, ...(w < 900 ? { userAgent: IPHONE_UA } : {}) })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 300000 }); await page.waitForTimeout(5000);
  const target = await page.evaluate(() => { const l = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.model); return l.find((m) => /scavenger/i.test(m.name ?? m.id)) ?? l[0]; });
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [target.x, target.z]); await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, 'walk.jpg'), type: 'jpeg', quality: 85 });
  await page.evaluate((i) => window.originsPreview.tapMob(i), target.id); await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(out, 'fight.jpg'), type: 'jpeg', quality: 85 });
  console.log(JSON.stringify({ target: target.id, x: target.x, z: target.z, size: [w, h] }));
} finally { await browser.close(); server.close(); }
