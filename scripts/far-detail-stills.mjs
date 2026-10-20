// Item C stills (phone tier, 375 at dpr 2): a rank-look creature at about 15 m with the far detail on vs off (?fardetail=0), and the pop check: the same creature one frame before and after the hero crosses the 14 m range.
// Usage: node scripts/far-detail-stills.mjs <built checkout root> <out dir>   (REAL_GPU=1 on the T4)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, out] = process.argv.slice(2);
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
const port = server.address().port;
async function session(label, query, steps) {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE, deviceScaleFactor: 2 })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${port}/preview/origins/?region=1&zone=1&presence=0${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 });
  // freeze nothing: wandering is part of the page. Pick the scavenger nearest the camp's middle and stand `d` metres south of it, facing it.
  const standAt = (d) => page.evaluate((dist) => { const ms = window.originsPreview.mobs().mobs.filter((m) => /scaveng/i.test(m.id)); const cx = ms.reduce((s, b) => s + b.x, 0) / ms.length, cz = ms.reduce((s, b) => s + b.z, 0) / ms.length; const t = ms.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0]; window.originsPreview.place(t.x, t.z - dist, 0); return t.id; }, d);
  const hidden = () => page.evaluate(() => window.originsPreview.mobs().meshesOf.filter((r) => r.rows.some((x) => /L\d+_Body/.test(x))).map((r) => r.rows.filter((x) => /L\d+_(Arms|Gloves|Greaves|Helmet)/.test(x) && x.includes('(hidden)')).length).join('/'));
  await steps({ page, standAt, hidden, shot: (name) => page.screenshot({ path: path.join(out, `${label}-${name}.png`), timeout: 240000 }) });
  if (errors.length) console.log(label, 'PAGEERRORS', errors.join(' | '));
  await page.context().close();
}
try {
  for (const [label, query] of [['on', ''], ['off', '&fardetail=0']]) {
    await session(label, query, async ({ page, standAt, hidden, shot }) => {
      await standAt(15); await page.waitForTimeout(6000);
      console.log(label, '15 m: pieces hidden each', await hidden()); await shot('15m');
    });
  }
  await session('pop', '', async ({ page, standAt, hidden, shot }) => {
    await standAt(16); await page.waitForTimeout(5000); console.log('pop 16 m: pieces hidden each', await hidden()); await shot('1-before-16m');
    await standAt(12); await page.waitForTimeout(150); console.log('pop 12 m +150 ms: pieces hidden each', await hidden()); await shot('2-after-12m-150ms');
    await page.waitForTimeout(1500); await shot('3-after-12m-1500ms');
  });
} finally { await browser.close(); server.close(); }
