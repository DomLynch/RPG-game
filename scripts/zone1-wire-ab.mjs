// Zone 1 world wiring evidence (#1845): 375-wide stills of the shipped state (relief + kit + day/night ON) and a frame-time A/B against
// ?relief=0&kit=0&daynight=0, same run, Chromium on software GL (the numbers are RELATIVE; the Mac WebKit row is the real-GPU reading).
// Serves artifacts/origins-preview (built here when missing). Output: $AB_OUT (default artifacts/zone1-wire-ab): *.jpg and receipt.json.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview'), out = process.env.AB_OUT || path.join(root, 'artifacts/zone1-wire-ab');
fs.mkdirSync(out, { recursive: true });
if (!fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 900_000 });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${built}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`, base = `${origin}/preview/origins/?region=1`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { origin, errors: [], stills: [], ab: {} };
const open = async (query) => {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(`${query}: ${String(e).slice(0, 200)}`));
  await page.goto(`${base}${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn), null, { timeout: 180000 });
  await page.waitForTimeout(8000);
  return page;
};
const still = async (page, name) => { await page.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 80 }); receipt.stills.push(name); };
const gaps = async (page, ms) => {
  await page.evaluate(() => { window.__g = []; let last = performance.now(); const tick = (t) => { window.__g.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.waitForTimeout(ms);
  const g = (await page.evaluate(() => window.__g.splice(0))).slice(1).sort((a, b) => a - b);
  return { frames: g.length, median: +g[g.length >> 1].toFixed(1), p95: +g[Math.floor(g.length * 0.95)].toFixed(1), max: +g[g.length - 1].toFixed(1) };
};
try {
  // Stills: the shipped state at 375 (spawn, the open field past the gate by day, and the far west by day and by night).
  for (const [tag, query, spots] of [['day', '', [['spawn', null], ['field', [0, 30]], ['west', [-70, 10]]]], ['night', '&hour=22', [['west', [-70, 10]], ['spawn', null]]]]) {
    const page = await open(query);
    for (const [name, at] of spots) { if (at) { await page.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), at); await page.waitForTimeout(6000); } await still(page, `${tag}-${name}`); }
    await page.context().close();
  }
  // A/B: frame gaps standing in the open field, ON vs all three kill switches, 5 windows each.
  for (const [tag, query] of [['on', ''], ['off', '&relief=0&kit=0&daynight=0']]) {
    const page = await open(query);
    await page.evaluate(() => window.originsPreview.place(0, 30, 0)); await page.waitForTimeout(6000);
    receipt.ab[tag] = [];
    for (let i = 0; i < 5; i++) receipt.ab[tag].push(await gaps(page, 8000));
    receipt.ab[tag + 'Calls'] = await page.evaluate(() => window.originsPreview.renderInfo?.()?.calls ?? null).catch(() => null);
    await page.context().close();
  }
} finally { await browser.close(); server.close(); }
const worst = (a) => Math.max(...a.map((w) => w.median));
receipt.summary = { onMedianMax: worst(receipt.ab.on), offMedianMax: worst(receipt.ab.off), onP95Max: Math.max(...receipt.ab.on.map((w) => w.p95)), offP95Max: Math.max(...receipt.ab.off.map((w) => w.p95)) };
fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 1));
console.log(JSON.stringify(receipt.summary), 'errors:', receipt.errors.length);
process.exit(receipt.errors.length ? 1 : 0);
