// 375-wide stills of Zone 1 (?region=1&worldfight): the hero beside a boar, then the REAL slash / stab / heavy / kick buttons tapped and a still ~250 ms into each swing (per-attack clips, #1957 stack). WebKit, software-free.
// Usage: node scripts/zone1-swing-stills.mjs <built origins-preview dist> <out dir>   (software GL is fine: it is a layout check)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { webkit } from 'playwright';

const [dist, out] = process.argv.slice(2), root = process.cwd();
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
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
const browser = await webkit.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`), timeout: 240000 });
  await shot('idle');
  const t0 = await page.evaluate(() => window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body).sort((a, b) => (a.id < b.id ? -1 : 1))[0]);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 1.5, 0), [t0.x, t0.z]);
  await page.waitForTimeout(8000);
  const snap = () => page.evaluate(() => { const c = window.originsPreview.combat(); return { hero: c.hero.phase, hp: c.hero.health, foe: c.target && Math.round(c.target.health) }; });
  for (const [name, id] of [['slash', 'attack-button'], ['stab', 'thrust-button'], ['heavy', 'heavy-button'], ['kick', 'kick-button']]) {
    for (let i = 0; i < 100; i++) { if ((await snap()).hero === 'ready') break; await page.waitForTimeout(50); }
    await page.waitForTimeout(500);
    const [x, y] = await page.evaluate((i) => { const r = document.getElementById(i).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, id);
    await page.touchscreen.tap(x, y); await page.waitForTimeout(250);
    await shot(name); console.log(name, JSON.stringify(await snap()));
  }
  console.log('errors:', errors.length, errors.slice(0, 2));
} finally { await browser.close(); server.close(); }
