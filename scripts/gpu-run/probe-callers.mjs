// Who calls surfaceHit in a zone fight, and does bodyWounds.hit run? node probe-callers.mjs <build root> <phone|desktop>. Needs the PROBE-instrumented gore.ts (globalThis.__sh). Software GL is fine: this counts calls, it times nothing.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, mode = 'phone'] = process.argv.slice(2);
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp' };
const roots = { '/preview/origins/': `${root}/artifacts/origins-preview/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${process.cwd()}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext(mode === 'phone' ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
await page.waitForFunction(() => window.originsPreview?.mobs?.()?.mobs?.length > 0, null, { timeout: 480000 });
await page.waitForTimeout(25000);
const foe = await page.evaluate(() => { const rx = /scaveng/i; const ms = window.originsPreview.mobs().mobs.filter((m) => rx.test(m.id)); const cx = ms.reduce((s, b) => s + b.x, 0) / ms.length, cz = ms.reduce((s, b) => s + b.z, 0) / ms.length; const t = ms.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0]; window.originsPreview.place(t.x, t.z - 1.5, 0); return t.id; });
await page.waitForTimeout(2000);
await page.evaluate(() => { globalThis.__sh = undefined; });
await page.evaluate((id) => window.originsPreview.tapMob(id), foe);
for (let i = 0; i < 20; i++) { await page.evaluate((k) => window.originsPreview.press?.(k), i < 12 ? 'light' : 'heavy'); await page.waitForTimeout(700); }
await page.waitForTimeout(3000);
console.log(`CALLERS ${mode}:`, JSON.stringify(await page.evaluate(() => globalThis.__sh ?? null), null, 1));
await browser.close(); server.close();
