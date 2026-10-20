// Phone-tier 375 still of the densest creature camp, for #3463 (the phone draw cap): hero placed 2.5 m from the middle of the camp, how many creatures of the camp exist vs are drawn, one screenshot.
// Usage: node scripts/cap-still.mjs <built checkout root> <label> <out dir>   (REAL_GPU=1 on the T4; DEVICE unused: always the iPhone tier)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, label, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${root}/artifacts/origins-preview/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 });
  const camp = await page.evaluate(() => {
    const ms = window.originsPreview.mobs().mobs, near = (a) => ms.filter((b) => Math.hypot(a.x - b.x, a.z - b.z) < 8);
    const best = ms.map((m) => ({ m, group: near(m) })).sort((a, b) => b.group.length - a.group.length)[0];
    const g = best.group, x = g.reduce((s, b) => s + b.x, 0) / g.length, z = g.reduce((s, b) => s + b.z, 0) / g.length;
    window.originsPreview.place(x, z - 2.5, 0);
    return { size: g.length, x, z };
  });
  await page.waitForTimeout(6000);
  const counts = await page.evaluate((c) => { const ms = window.originsPreview.mobs().mobs; const within = ms.filter((m) => Math.hypot(m.x - c.x, m.z - c.z) < 8); return { campSize: within.length, campDrawn: within.filter((m) => m.drawn).length, drawnTotal: ms.filter((m) => m.drawn).length, aggro: ms.filter((m) => m.mode === 'aggro').length }; }, camp);
  await page.screenshot({ path: path.join(out, `${label}-camp.png`), timeout: 240000 });
  console.log(`STILL ${label} ${JSON.stringify({ ...camp, ...counts })}`);
} finally { await browser.close(); server.close(); }
