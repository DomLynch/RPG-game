// Load/feel A/B of two builds on the real GPU (Dom 2026-10-20 17:2x: "very slow loading now, or glitchy"): zone = the Zone 1 preview page, pit = the main Pit page (sparring), 375x812.
// Per run (interleaved base, head, base, head ...): first playable, zone ready (zone only), then a 20 s window of walking plus one fight with every rAF gap (median / p5 fps), the long tasks (count, total, max) and page errors.
// Usage: node scripts/live-regress.mjs <zone|pit> <base checkout> <head checkout> [runs] [out json]. Each checkout is built already: zone = artifacts/origins-preview, pit = dist. REAL_GPU=1 for the machine's own GPU, CPU_RATE=4 for the throttle.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [mode, baseRoot, headRoot, runsArg, outFile] = process.argv.slice(2), RUNS = Number(runsArg || 3), RATE = Number(process.env.CPU_RATE || 1), WINDOW_MS = Number(process.env.WINDOW_MS || 20000);
if (!['zone', 'pit'].includes(mode) || !baseRoot || !headRoot) throw new Error('usage: live-regress.mjs <zone|pit> <base> <head> [runs] [out]');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wasm': 'application/wasm' };
async function serve(root) {
  const roots = mode === 'pit' ? { '/': path.join(root, 'dist') + '/' } : { '/preview/origins/': path.join(root, 'artifacts/origins-preview') + '/' };
  if (mode === 'zone') for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]); let hit = null, best = -1;
    for (const [p, r] of Object.entries(roots)) if (u.startsWith(p) && p.length > best) { best = p.length; hit = path.join(r, u.slice(p.length) || 'index.html'); }
    if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
    if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}
const sides = { base: await serve(baseRoot), head: process.env.HEAD_URL ? { server: { close() {} }, origin: '' } : await serve(headRoot) };   // HEAD_URL: the head side is a real URL (the live site, network included), not a local build
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const median = (a) => { const s = a.filter((x) => x !== null && x !== undefined).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };
const fps = (gap) => (gap ? Math.round(10 * 1000 / gap) / 10 : null);
const rows = [];
for (let i = 0; i < RUNS; i++) for (const side of ['base', 'head']) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' }), page = await ctx.newPage(), errors = [];   // phone tier needs a mobile UA and a coarse pointer (quality.ts)
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.route('**/*sentry.io/**', (route) => route.abort());
  if (RATE !== 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE }); }
  await page.addInitScript(() => { window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch { /* no long-task entries */ } });
  const t0 = Date.now();
  const url = side === 'head' && process.env.HEAD_URL ? process.env.HEAD_URL : mode === 'pit' ? `${sides[side].origin}/?opponent=veteran&spar=1&weapon=longsword&difficulty=1&skill=none` : `${sides[side].origin}/preview/origins/?region=1&zone=1&presence=0`;
  await page.goto(url, { waitUntil: 'load' });
  let playableMs = null, readyMs = null;
  if (mode === 'pit') {
    await page.waitForFunction(() => performance.getEntriesByType('mark').some((m) => m.name.startsWith('first-frame-') && m.name !== 'first-frame-begin') && !document.getElementById('art-status')?.textContent, null, { timeout: 240000, polling: 50 });
    playableMs = Date.now() - t0;
  } else {
    await page.waitForFunction(() => window.originsPreview?.cover?.().atMs != null, null, { timeout: 240000, polling: 50 }).catch(() => {});
    playableMs = await page.evaluate(() => window.originsPreview?.cover?.().atMs ?? null);
    await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000, polling: 100 }).catch(() => {});
    readyMs = await page.evaluate(() => window.__zoneReady?.atMs ?? null);
  }
  const longBefore = await page.evaluate(() => window.__long.length);
  await page.evaluate(() => { window.__gaps = []; let last = performance.now(); const tick = (t) => { window.__gaps.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); window.__w0 = performance.now(); });
  if (mode === 'pit') {
    await page.keyboard.down('KeyW'); const end = Date.now() + WINDOW_MS; while (Date.now() < end) { await page.keyboard.press('KeyF'); await new Promise((r) => setTimeout(r, 300)); } await page.keyboard.up('KeyW');
  } else {
    const walkEnd = Date.now() + WINDOW_MS * 0.6, keys = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
    for (let k = 0; Date.now() < walkEnd; k++) { await page.keyboard.down(keys[k % 4]); await new Promise((r) => setTimeout(r, 1500)); await page.keyboard.up(keys[k % 4]); }
    const m = await page.evaluate(() => { const x = window.originsPreview.mobs()?.mobs?.find((q) => q.drawn && q.body); return x && { id: x.id, x: x.x, z: x.z }; });
    if (m) { await page.evaluate((q) => { window.originsPreview.place(q.x, q.z - 2.5, 0); window.originsPreview.tapMob(q.id); }, m); const fightEnd = Date.now() + WINDOW_MS * 0.4; while (Date.now() < fightEnd) { await page.evaluate(() => window.originsPreview.press?.('light')); await new Promise((r) => setTimeout(r, 400)); } }
    else await new Promise((r) => setTimeout(r, WINDOW_MS * 0.4));
  }
  const gaps = (await page.evaluate(() => window.__gaps.slice(1))), long = await page.evaluate((n) => window.__long.slice(n), longBefore);
  const transferKB = await page.evaluate(() => Math.round(performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0) / 1024));
  rows.push({ run: i + 1, side, transferKB, playableMs, readyMs, medianFps: fps(median(gaps)), p5Fps: fps(pct(gaps, 0.95)), frames: gaps.length, maxGapMs: Math.round(Math.max(0, ...gaps)), longTasks: long.length, longTotalMs: long.reduce((a, t) => a + t.ms, 0), longMaxMs: Math.max(0, ...long.map((t) => t.ms)), errors });
  console.log(JSON.stringify(rows.at(-1)));
  await ctx.close();
}
const summary = {};
for (const side of ['base', 'head']) { const s = rows.filter((r) => r.side === side); summary[side] = Object.fromEntries(['transferKB', 'playableMs', 'readyMs', 'medianFps', 'p5Fps', 'maxGapMs', 'longTasks', 'longTotalMs', 'longMaxMs'].map((k) => [k, median(s.map((r) => r[k]))])); summary[side].errors = s.flatMap((r) => r.errors).length; }
console.log('SUMMARY', JSON.stringify({ mode, rate: RATE, summary }));
if (outFile) fs.writeFileSync(outFile, JSON.stringify({ mode, rate: RATE, rows, summary }, null, 2));
await browser.close(); for (const s of Object.values(sides)) s.server.close();
