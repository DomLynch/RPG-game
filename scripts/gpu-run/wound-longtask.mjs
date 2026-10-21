// Longest main-thread task in a phone fight (375x812 iPhone UA, CPU x4), plus a wound still. node wound-longtask.mjs <build root> <label> <out dir> [rate]
// REAL_GPU=1 launches with the default (T4) GPU; otherwise software GL. Run from a checkout (public/ is served from cwd).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, label, outDir, rate = '4'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
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
const args = process.env.METAL === '1' ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : process.env.REAL_GPU === '1' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {} });
await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
await page.waitForFunction(() => window.originsPreview?.mobs?.()?.mobs?.length > 0, null, { timeout: 240000 });
const renderer = await page.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
console.log(`RENDERER ${label}: ${renderer}`);
await page.waitForTimeout(25000);
const standAt = (re, d) => page.evaluate(([src, dist]) => { const rx = new RegExp(src, 'i'); const ms = window.originsPreview.mobs().mobs.filter((m) => rx.test(m.id)); const cx = ms.reduce((s, b) => s + b.x, 0) / ms.length, cz = ms.reduce((s, b) => s + b.z, 0) / ms.length; const t = ms.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0]; window.originsPreview.place(t.x, t.z - dist, 0); return t.id; }, [re, d]);
const foe = await standAt('scaveng', 1.5); await page.waitForTimeout(1500);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(rate) });
await page.evaluate(() => { window.__lt.length = 0; });
await page.evaluate((id) => window.originsPreview.tapMob(id), foe);
for (let i = 0; i < 20; i++) {
  await page.evaluate(() => window.originsPreview.press?.('light'));
  await page.waitForTimeout(700);
  if (process.env.STILLS === '1' && (i === 9 || i === 12)) await page.screenshot({ path: path.join(outDir, `${label}-wound-${i}.jpg`), type: 'jpeg', quality: 82 });
}
await page.waitForTimeout(3000);
const lts = await page.evaluate(() => window.__lt);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const ds = lts.map(([, d]) => d).sort((a, b) => b - a);
console.log(`LONGTASK ${label}: count>=50ms ${ds.filter((d) => d >= 50).length} count>=100ms ${ds.filter((d) => d >= 100).length} max ${(ds[0] ?? 0).toFixed(0)} ms top5 ${ds.slice(0, 5).map((d) => d.toFixed(0)).join(',')} (rate ${rate})`);
await browser.close(); server.close();
