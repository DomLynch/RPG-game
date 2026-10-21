// MEASUREMENT (web/fx-dpr, never merged): the fight at 375 wide at both pixel ratios, side by side, for Dom's eye (softness reads as "slow"). node scripts/gpu-run/dpr-stills.mjs <dist dir> <out dir>
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [, , dist, out] = process.argv, root = process.cwd();
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
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
const origin = `http://127.0.0.1:${server.address().port}`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? ['--autoplay-policy=no-user-gesture-required'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = {};
try {
  for (const [name, query] of [['default', ''], ['dpr1', '&dpr=1']]) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    await page.goto(`${origin}/preview/origins/?region=1&worldfight&presence=0${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 });
    await page.waitForTimeout(3000);
    const target = await page.evaluate(() => window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body)[0]);
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 3, 0), [target.x, target.z]); await page.waitForTimeout(2500);
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 1.4, 0), [target.x, target.z]); await page.waitForTimeout(1500);
    await page.evaluate((i) => window.originsPreview.tapMob(i), target.id); await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(out, `fight-375-${name}.jpg`), type: 'jpeg', quality: 85, timeout: 120000 });
    receipt[name] = { errors, canvas: await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; }), innerWidth: await page.evaluate(() => innerWidth), dpr: await page.evaluate(() => devicePixelRatio) };
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log('STILLS', JSON.stringify(receipt));
} catch (error) { console.error('dpr-stills ERROR', error); process.exitCode = 2; }
finally { await browser.close(); server.close(); }
