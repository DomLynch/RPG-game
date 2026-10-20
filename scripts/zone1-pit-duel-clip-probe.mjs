// Which clip a SPECIAL 1 / SPECIAL 2 press plays in the Pit duel opened from Zone 1 ("Fight in the Pit", pit-duel.ts), a fresh guest, 375 wide, on a BUILT origins preview. REAL_GPU=1 for the T4.
// Usage: node scripts/zone1-pit-duel-clip-probe.mjs <built origins-preview dist> <out dir>. ?debug=1 exposes __view (pit-duel.ts) and __specials (the fx / cue counters).
/* global process, console, window, document, globalThis, performance */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [originsDist, out] = process.argv.slice(2), root = process.cwd();
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.wasm': 'application/wasm' };
const roots = [['/preview/origins/', `${path.resolve(originsDist)}/`]];
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots.push([`/${d}/`, `${root}/public/${d}/`]);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of roots) { if (!u.startsWith(p)) continue; const f = path.join(r, u.slice(p.length) || 'index.html'); if (fs.existsSync(f)) { hit = fs.statSync(f).isDirectory() ? path.join(f, 'index.html') : f; if (fs.existsSync(hit)) break; hit = null; } }
  if (!hit) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? ['--autoplay-policy=no-user-gesture-required'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage(), errors = [], results = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const sample = () => page.evaluate(() => ({ t: Math.round(performance.now()), clip: globalThis.__view?.playing?.() ?? null, fx: globalThis.__specials?.fx ?? null, cues: globalThis.__specials?.cues ?? null, one: document.querySelector('#skill-button')?.getAttribute('aria-disabled') ?? null, two: document.querySelector('#skill2-button')?.getAttribute('aria-disabled') ?? null, l1: document.querySelector('#skill-button')?.getAttribute('aria-label') ?? null, l2: document.querySelector('#skill2-button')?.getAttribute('aria-label') ?? null }));
try {
  await page.goto(`${base}/preview/origins/?region=1&debug=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.fight, null, { timeout: 300000 });
  await page.evaluate(() => { void window.originsPreview.fight(); });   // "Fight in the Pit" from Zone 1 (pit-duel.ts openDuel)
  await page.waitForSelector('#attack-button', { state: 'visible', timeout: 120000 });
  await page.locator('#attack-button').tap();
  await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-label') === 'Light attack', null, { timeout: 60000 });
  for (const [sel, name, key, lab] of [['#skill-button', 'SPECIAL 1', 'one', 'l1'], ['#skill2-button', 'SPECIAL 2', 'two', 'l2']]) {
    await page.waitForFunction((s) => document.querySelector(s)?.getAttribute('aria-disabled') === 'false', sel, { timeout: 9000 }).catch(() => {});   // the special's first cast is 2 s in (rows80); no longer: the legend foe kills an idle hero in seconds
    const before = await sample(); console.log(name, 'buttons before the press', JSON.stringify(before)); await page.locator(sel).tap({ timeout: 20000 }).catch((e) => console.log(name, 'tap failed', String(e).slice(0, 100)));
    const seen = [], shots = [];
    for (let k = 0; k < 70; k++) { await page.waitForTimeout(50); seen.push(await sample()); if (k === 3 || k === 10 || k === 18) { const f = path.join(out, `${name.replace(' ', '').toLowerCase()}-${String(k).padStart(2, '0')}.png`); await page.screenshot({ path: f }).catch(() => {}); shots.push(f); } }
    const row = { page: 'zone1 Fight in the Pit', slot: name, label: before[lab], accepted: seen.some((s) => s[key] === 'true'), clips: [...new Set(seen.map((s) => s.clip))], fx: [before.fx, seen.at(-1).fx], cues: [before.cues, seen.at(-1).cues], shots };
    results.push(row); console.log(JSON.stringify(row));
  }
} finally { fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify({ results, errors }, null, 1)); await browser.close(); server.close(); }
console.log('page errors', errors.length);
