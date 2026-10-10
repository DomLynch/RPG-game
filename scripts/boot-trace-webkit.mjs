// Where one "Next fight" reload spends its time, in the engine the player has (WebKit on the Mac). Diagnostic, not a release row.
// Serves a built dist (vite build --outDir <dir>) with the live server's /assets cache header, loads the Pit page once cold, then reloads it N times
// (the "Next fight" press is a reload) and, per reload, reads: navigation timing, first paint, the longest requestAnimationFrame gap before ready (the
// stretch a screenshot, and a player, sees no new frame), the time spent inside WebGL compile/link/info-log/texture-upload calls, inside OffscreenCanvas
// getImageData (src/fight/rank-tint.ts), and when the page reports ready. Medians over the reloads are printed; the raw rows go to artifacts/boot-trace/webkit.json.
//   node scripts/boot-trace-webkit.mjs <dist dir> [reloads=5]
import { webkit } from 'playwright';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';

const [dist, count = '5'] = process.argv.slice(2), runs = Number(count);
if (!dist) { console.error('usage: node scripts/boot-trace-webkit.mjs <dist dir> [reloads]'); process.exit(2); }
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-b', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const root = path.resolve(dist), u = decodeURIComponent(req.url.split('?')[0]); let file = path.join(root, u);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }   // never serve outside the dist dir (`..`)
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  const headers = { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' };
  if (u.startsWith('/assets/')) headers['cache-control'] = 'max-age=31536000';   // as the live server does (deploy/frankendom.com.conf)
  res.writeHead(200, headers); createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = { version: 1, id: 'next-fight-fighter-0001', name: 'Wanderer', career: { victoryMarks: 5 }, loot: { owned: ['knight.Helmet', 'goblin.Boots'], equipped: { head: 'knight.Helmet' } } };
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await context.addInitScript((p) => {
  if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p));
  const gl = (window.__gl = {}), add = (k, ms) => { const e = (gl[k] ??= [0, 0]); e[0]++; e[1] += ms; };
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    for (const name of ['compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter', 'getProgramInfoLog', 'getShaderInfoLog', 'texImage2D', 'texSubImage2D', 'readPixels']) {
      const orig = C.prototype[name]; if (!orig) continue;
      C.prototype[name] = function (...a) { const t = performance.now(); try { return orig.apply(this, a); } finally { add(name, performance.now() - t); } };
    }
  }
  try { const P = OffscreenCanvasRenderingContext2D.prototype, g = P.getImageData; P.getImageData = function (...a) { const t = performance.now(); try { return g.apply(this, a); } finally { add('getImageData', performance.now() - t); } }; } catch { /* no OffscreenCanvas 2D */ }
  window.__raf = []; window.__ready = null; let last = performance.now();
  const tick = (now) => { window.__raf.push([Math.round(now), Math.round(now - last)]); last = now; if (window.__ready === null && document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false') window.__ready = Math.round(now); if (window.__ready === null || now < window.__ready + 300) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}, profile);
const page = await context.newPage();
page.setDefaultTimeout(120000);
const url = `${origin}/?opponent=goblin&debug=1`;
await page.goto(url); await page.waitForFunction(() => window.__ready !== null);   // cold: fills the HTTP cache like the player's first visit
const rows = [];
for (let i = 0; i < runs; i++) {
  await page.reload(); await page.waitForFunction(() => window.__ready !== null); await page.waitForTimeout(400);
  rows.push(await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0], paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]));
    const gaps = window.__raf.filter(([at]) => at <= window.__ready).map(([at, gap]) => ({ at, gap })).sort((a, b) => b.gap - a.gap);
    const glb = performance.getEntriesByType('resource').filter((r) => /\.glb/.test(r.name)).map((r) => ({ name: r.name.split('/').pop(), start: Math.round(r.startTime), end: Math.round(r.responseEnd) }));
    return { responseStart: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), fcp: paint['first-contentful-paint'] ?? null, ready: window.__ready, longestRafGap: gaps[0] ?? null, rafGapsOver100: gaps.filter((g) => g.gap > 100).length, gl: Object.fromEntries(Object.entries(window.__gl).map(([k, [c, ms]]) => [k, { calls: c, ms: Math.round(ms) }])), glb };
  }));
}
await fs.mkdir('artifacts/boot-trace', { recursive: true });
await fs.writeFile('artifacts/boot-trace/webkit.json', JSON.stringify(rows, null, 2));
const med = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const glKeys = [...new Set(rows.flatMap((r) => Object.keys(r.gl)))];
console.log(`boot-trace-webkit: ${runs} warm reloads of ${origin}/?opponent=goblin (medians, ms; WebKit headless on this Mac)`);
console.log(`  responseStart ${med(rows.map((r) => r.responseStart))}  DOMContentLoaded ${med(rows.map((r) => r.dcl))}  first-contentful-paint ${med(rows.map((r) => r.fcp))}  ready ${med(rows.map((r) => r.ready))}`);
console.log(`  longest rAF gap before ready ${med(rows.map((r) => r.longestRafGap?.gap))} (at ${med(rows.map((r) => r.longestRafGap?.at))}); gaps over 100 ms: ${med(rows.map((r) => r.rafGapsOver100))}`);
for (const k of glKeys) console.log(`  ${k}: ${med(rows.map((r) => r.gl[k]?.ms ?? 0))} ms in ${med(rows.map((r) => r.gl[k]?.calls ?? 0))} calls`);
for (const g of rows[0].glb) console.log(`  glb ${g.name}: ${med(rows.map((r) => r.glb.find((x) => x.name === g.name)?.end ?? null))} ms to parsed (start ${g.start})`);
await browser.close(); server.close();
