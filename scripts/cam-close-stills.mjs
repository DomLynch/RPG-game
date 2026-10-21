// Zone 1 fight camera with a CLOSE foe at 375x812 (Web's live audit: the over-shoulder camera puts the hero's body over a foe at melee range): the hero is placed DIST m (default 1.4) south of a camp creature, a light press starts the fight, the camera eases in, and fight.png is taken
// once it has settled; camView() (the lens the page applies) is printed. Usage: node scripts/cam-close-stills.mjs <built origins-preview dist> <out dir>   env: DIST=1.4  WAIT=5000  PIT_GL=1 (software GL)
/* global process, console, window, document */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2), DIST = +(process.env.DIST || 1.4), WAIT = +(process.env.WAIT || 5000); fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(path.resolve(dist), u.replace(/^\/preview\/origins\//, '')); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.statusCode = 404; res.end(); return; } res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
try {
  // VIEW=1366x1024 (iPad landscape; the iPad Safari UA is sent for any width over 700) overrides the 375x812 phone
  const [vw, vh] = (process.env.VIEW || '375x812').split('x').map(Number), IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const page = await (await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, ...(Math.min(vw, vh) > 700 ? { userAgent: IPAD_UA } : {}) })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 300000 }); await page.waitForTimeout(4000);
  const id = await page.evaluate(() => { const all = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); return (all.find((m) => /scaveng|goblin|wolf|boar/.test(m.id)) ?? all[0]).id; });
  const near = () => page.evaluate(([i, d]) => { const m = window.originsPreview.mobs().mobs.find((q) => q.id === i); if (m) window.originsPreview.place(m.x, m.z - d, 0); }, [id, DIST]);
  await near(); await page.waitForTimeout(1500);
  for (let t = 0; t < 8 && !(await page.evaluate(() => document.body.classList.contains('infight'))); t++) { await near(); await page.evaluate(() => window.originsPreview.press('light')); await page.waitForTimeout(1200); }
  await page.waitForTimeout(WAIT);
  const view = await page.evaluate(() => ({ infight: document.body.classList.contains('infight'), size: [innerWidth, innerHeight], dpr: devicePixelRatio, cam: window.originsPreview.camView() }));
  console.log(JSON.stringify({ id, DIST, ...view }));
  await page.screenshot({ path: path.join(out, 'fight.png') });
} finally { await browser.close(); server.close(); }
