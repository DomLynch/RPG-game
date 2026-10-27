// The Pit's better-graphics lift, before and after (visual-pr-stills + the cost read): the built main game (dist/) at 375x812, the sparring Pit page, with the lift (the default) and with ?gfx=0, N runs each INTERLEAVED.
// Per run: first playable (the load card gone: the first-frame mark exists and #art-status is empty), median and p5 fps over a fight window (the hero walks in and strikes), the WebGL programs linked after first playable (the lift must add none), page errors.
// The first run of each mode also writes a mid-fight still. REAL_GPU=1: the machine's own GPU (no software-GL flags); CPU_RATE=4: CDP CPU throttling. Usage: node scripts/pit-gfx-proof.mjs <out dir> [runs]
import { launchBrowser } from './lib/harness-browser-launch.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [out, runsArg] = process.argv.slice(2), RUNS = Number(runsArg || 3), RATE = Number(process.env.CPU_RATE || 1), root = process.cwd(), dist = path.join(root, 'dist'), WINDOW_MS = Number(process.env.WINDOW_MS || 15000);
if (!out) throw new Error('usage: pit-gfx-proof.mjs <out dir> [runs]');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = path.join(dist, u === '/' ? 'index.html' : u);
  if (fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser(chromium, { args: process.env.REAL_GPU === '1' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const BASE = '/?opponent=veteran&spar=1&weapon=longsword&difficulty=1&skill=none';
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };
const rows = [];
for (let i = 0; i < RUNS; i++) for (const mode of ['off', 'on']) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.route('**/*sentry.io/**', (route) => route.abort());
  if (RATE !== 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE }); }
  await page.addInitScript(() => { window.__links = 0; for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) { const p = C?.prototype; if (!p) continue; const f = p.linkProgram; p.linkProgram = function (pr) { window.__links++; return f.call(this, pr); }; } });
  const t0 = Date.now();
  await page.goto(`${origin}${BASE}${mode === 'off' ? '&gfx=0' : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => performance.getEntriesByType('mark').some((m) => m.name.startsWith('first-frame-') && m.name !== 'first-frame-begin') && !document.getElementById('art-status')?.textContent, null, { timeout: 240000, polling: 50 });
  const playableMs = Date.now() - t0, links0 = await page.evaluate(() => window.__links);
  await page.evaluate(() => { window.__gaps = []; let last = performance.now(); const tick = (t) => { window.__gaps.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.keyboard.down('KeyW');
  const end = Date.now() + WINDOW_MS; let still = false;
  while (Date.now() < end) { await page.keyboard.press('KeyF'); await new Promise((r) => setTimeout(r, 300)); if (!still && i === 0 && Date.now() > end - WINDOW_MS / 2) { still = true; await page.screenshot({ path: path.join(out, `pit-${mode}-375.png`) }); } }
  await page.keyboard.up('KeyW');
  const gaps = (await page.evaluate(() => window.__gaps.slice(1))), links1 = await page.evaluate(() => window.__links);
  const fpsOf = (g) => Math.round(10 * 1000 / g) / 10;
  rows.push({ run: i + 1, mode, playableMs, medianFps: fpsOf(median(gaps)), p5Fps: fpsOf(pct(gaps, 0.95)), frames: gaps.length, linksAfterPlayable: links1 - links0, errors });
  console.log(JSON.stringify(rows.at(-1)));
  await ctx.close();
}
const summary = {};
for (const mode of ['off', 'on']) { const s = rows.filter((r) => r.mode === mode); summary[mode] = { playableMs: median(s.map((r) => r.playableMs)), medianFps: median(s.map((r) => r.medianFps)), p5Fps: median(s.map((r) => r.p5Fps)), linksAfterPlayable: s.map((r) => r.linksAfterPlayable).join(','), errors: s.flatMap((r) => r.errors).length }; }
fs.writeFileSync(path.join(out, `results-rate${RATE}.json`), JSON.stringify({ rate: RATE, realGpu: process.env.REAL_GPU === '1', rows, summary }, null, 2));
console.log('SUMMARY', JSON.stringify({ rate: RATE, summary }));
await browser.close(); server.close();
