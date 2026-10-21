// Phone-tier perf probe for Zone 1 (Web & UI, 2026-10-21; Dom: "seems a bit slow still" on his phone). One run = a fresh phone context (iPhone UA, coarse pointer, touch, DPR 3), load, then a scripted
// 5 s idle, 30 s walk (a real touch drag on the joystick) and 15 s fight (real taps on STRIKE), reporting load (first playable, MB), frame times per phase, long tasks, renderer.info, and a CPU profile
// (self + inclusive ms per function) per phase. It never calls mobs().debug() during a phase (that call was the old Zone 1 lag).
//   node scripts/phone-perf-probe.mjs <out dir> <mode: live | local> [--dist <built origins-preview>] [--throttle 1,4] [--orient portrait,landscape] [--profile]
// live = https://frankendom.com/zone1/ (load + frames as a player gets them: minified, on the wire); local = a built dist served here (an unminified build gives named functions for --profile).
/* global process, console, window, document, performance, navigator, PerformanceObserver, requestAnimationFrame */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2), out = argv[0], mode = argv[1], opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i > 0 ? argv[i + 1] : d; };
const dist = opt('dist', null), THROTTLES = opt('throttle', '1').split(',').map(Number), ORIENTS = opt('orient', 'portrait,landscape').split(','), PROFILE = argv.includes('--profile');
const SIZE = { portrait: [390, 844], landscape: [844, 390] }, UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IDLE_MS = 5000, WALK_MS = 30000, FIGHT_MS = 15000;
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.wasm': 'application/wasm' };
let base = 'https://frankendom.com', close = async () => {};
if (mode === 'local') {
  const root = process.cwd(), roots = [['/preview/origins/', `${path.resolve(dist)}/`]];
  for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots.push([`/${d}/`, `${root}/public/${d}/`]);
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
    for (const [p, r] of roots) { if (!u.startsWith(p)) continue; const f = path.join(r, u.slice(p.length) || 'index.html'); if (fs.existsSync(f)) { hit = fs.statSync(f).isDirectory() ? path.join(f, 'index.html') : f; if (fs.existsSync(hit)) break; hit = null; } }
    if (!hit) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`; close = () => new Promise((r) => server.close(r));
}
const URL_ = mode === 'live' ? `${base}/zone1/?presence=0` : `${base}/preview/origins/?region=1&worldfight&presence=0`;   // presence=0: a probe must not appear to players on the live site
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? ['--autoplay-policy=no-user-gesture-required'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
const frameStats = (rows) => { const d = rows.map((r) => r[1]); return { n: d.length, medianMs: q(d, 0.5), p95Ms: q(d, 0.95), p99Ms: q(d, 0.99), maxMs: d.length ? +Math.max(...d).toFixed(1) : null, fpsMedian: d.length ? +(1000 / q(d, 0.5)).toFixed(1) : null, over33: d.filter((x) => x > 33.4).length, over50: d.filter((x) => x > 50).length }; };
// A CPU profile → self ms and inclusive ms per "function file:line", from the sampled stacks.
const digest = (prof) => {
  const nodes = new Map(prof.nodes.map((n) => [n.id, n])), parent = new Map();
  for (const n of prof.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const key = (n) => { const f = n.callFrame; return `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop()}:${f.lineNumber + 1}`; };
  const self = new Map(), incl = new Map(), file = new Map(); let total = 0;
  prof.samples.forEach((id, i) => {
    const dt = (prof.timeDeltas[i] || 0) / 1000; total += dt;
    const n = nodes.get(id); const k = key(n); self.set(k, (self.get(k) || 0) + dt);
    const fn = (n.callFrame.url || '(native)').split('/').pop(); file.set(fn, (file.get(fn) || 0) + dt);
    const seen = new Set(); for (let cur = id; cur !== undefined; cur = parent.get(cur)) { const kk = key(nodes.get(cur)); if (!seen.has(kk)) { seen.add(kk); incl.set(kk, (incl.get(kk) || 0) + dt); } }
  });
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, +v.toFixed(0)]);
  const idle = (self.get('(idle) :1') || 0) + (self.get('(program) :1') || 0);
  return { totalMs: +total.toFixed(0), idleMs: +idle.toFixed(0), busyMs: +(total - idle).toFixed(0), topSelf: top(self, 25), topInclusive: top(incl, 40), byFile: top(file, 12) };
};
const results = [];
for (const orient of ORIENTS) for (const thr of THROTTLES) {
  const [w, h] = SIZE[orient], label = `${mode}-${orient}-x${thr}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA });
  const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page), errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  // Lead's lead (Characters: on a real GPU with a phone UA [zone ready] never fired, "warmup stuck player"): when does __zoneReady / [zone ready] fire in this cell, and what does the page say about the warm-up?
  const navAt = { t: Date.now() }, said = [], readyLog = { atMs: null };
  page.on('console', (m) => { const t = m.text(); if (/\[zone ready\]/.test(t) && readyLog.atMs === null) readyLog.atMs = Date.now() - navAt.t; if (/warm|stuck|zone ready|compile|context|lost|webgl/i.test(t) && said.length < 25) said.push(`${Date.now() - navAt.t} ms ${m.type()}: ${t.slice(0, 200)}`); });
  await page.addInitScript(() => {
    window.__perf = { fr: [], lt: [], ph: 'load' }; let last = performance.now();
    const loop = (t) => { window.__perf.fr.push([window.__perf.ph, t - last]); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lt.push([window.__perf.ph, Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch { /* no longtask API */ }
  });
  await cdp.send('Network.enable'); let bytes = 0, requests = 0; cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength || 0; requests++; });
  if (thr > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: thr });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  const run = { label, mode, orient, size: [w, h], throttle: thr };
  try {
    const t0 = Date.now(); navAt.t = t0; await page.goto(URL_, { waitUntil: 'commit' });
    // Wait for the hooks, then for the settle (hero + kit) OR [zone ready], at most 240 s; a cell where neither comes is reported as such and the walk/fight are still measured.
    await page.waitForFunction(() => !!window.originsPreview, null, { timeout: 240000, polling: 200 });
    await page.waitForFunction(() => window.originsPreview?.settledAt?.() >= 0 || !!window.__zoneReady, null, { timeout: 240000, polling: 200 }).catch(() => { run.settleTimeout = true; });
    run.load = await page.evaluate(() => ({ settledAtMs: window.originsPreview.settledAt(), cover: window.originsPreview.cover(), zoneReady: !!window.__zoneReady, zoneReadyDetail: window.__zoneReady ? JSON.stringify(window.__zoneReady).slice(0, 200) : null, fcpMs: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1), wallMs: Math.round(performance.now()) }));
    run.load.zoneReadyLogAtMs = readyLog.atMs;
    run.load.wallSinceGotoMs = Date.now() - t0; run.load.mbBeforeReady = +(bytes / 1048576).toFixed(2); run.load.requests = requests;
    run.load.longTasksDuringLoad = await page.evaluate(() => { const l = window.__perf.lt.filter((x) => x[0] === 'load'); return { n: l.length, over50: l.filter((x) => x[2] > 50).length, totalMs: l.reduce((a, x) => a + x[2], 0), maxMs: Math.max(0, ...l.map((x) => x[2])) }; });
    run.env = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'), e = c?.getExtension('WEBGL_debug_renderer_info'); const cv = document.querySelector('canvas'); return { gl: e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a', coarse: matchMedia('(pointer: coarse)').matches, dpr: devicePixelRatio, canvas: cv ? [cv.width, cv.height] : null, ua: /iPhone/.test(navigator.userAgent) }; });
    const phase = async (name, ms, drive) => {
      await page.evaluate((n) => { window.__perf.ph = n; }, name);
      if (PROFILE) await cdp.send('Profiler.start');
      await drive(ms);
      if (PROFILE) { const { profile } = await cdp.send('Profiler.stop'); (run.profile ||= {})[name] = digest(profile); }
      const info = await page.evaluate(() => window.originsPreview.renderInfo?.() ?? null).catch(() => null);
      const rows = await page.evaluate((n) => window.__perf.fr.filter((r) => r[0] === n), name);
      const lts = await page.evaluate((n) => window.__perf.lt.filter((x) => x[0] === n), name);
      (run.phases ||= {})[name] = { frames: frameStats(rows), longTasks: { n: lts.length, over50: lts.filter((x) => x[2] > 50).length, totalMs: lts.reduce((a, x) => a + x[2], 0), top: [...lts].sort((a, b) => b[2] - a[2]).slice(0, 5).map((x) => x[2]) }, render: info && { calls: info.calls, triangles: info.triangles, programs: info.programs } };
    };
    await page.waitForTimeout(1500);
    await phase('idle', IDLE_MS, (ms) => page.waitForTimeout(ms));
    // Walk: a real touch held on the joystick, dragged round a small circle (so the hero keeps walking and the camera turns).
    const stickAt = await page.evaluate(() => { const b = document.getElementById('joystick').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2, b.width / 2]; });
    const p0 = await page.evaluate(() => ({ x: window.originsPreview.pos.x, z: window.originsPreview.pos.z }));
    await phase('walk', WALK_MS, async (ms) => {
      const [cx, cy, r] = stickAt, t1 = Date.now() + ms; let a = 0;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
      while (Date.now() < t1) { a += 0.05; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + Math.cos(a) * r * 0.7, y: cy + Math.sin(a) * r * 0.7, id: 1 }] }); await page.waitForTimeout(40); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    });
    const p1 = await page.evaluate(() => ({ x: window.originsPreview.pos.x, z: window.originsPreview.pos.z }));
    run.walkMovedM = +Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1);
    // Fight: stand by the nearest drawn creature, then tap STRIKE about twice a second.
    const engaged = await page.evaluate(async () => {
      const ms = window.originsPreview.mobs().mobs.filter((m) => m.drawn), p = window.originsPreview.pos;
      const m = ms.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; if (!m) return { ok: false, drawn: 0 };
      window.originsPreview.place(m.x, m.z - 2.5, 0); for (let i = 0; i < 40 && !document.body.classList.contains('infight'); i++) await new Promise((r) => setTimeout(r, 250));
      if (!document.body.classList.contains('infight')) window.originsPreview.tapMob(m.id);
      return { ok: true, drawn: ms.length, id: m.id };
    });
    run.fight = engaged; await page.waitForTimeout(2000);
    const atk = await page.evaluate(() => { const b = document.getElementById('attack-button').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
    await phase('fight', FIGHT_MS, async (ms) => { const t1 = Date.now() + ms; while (Date.now() < t1) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: atk[0], y: atk[1], id: 2 }] }); await page.waitForTimeout(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(440); } });
    run.fightInfight = await page.evaluate(() => document.body.classList.contains('infight'));
  } catch (e) { run.error = String(e).slice(0, 300); }
  run.zoneReadyByEnd = await page.evaluate(() => !!window.__zoneReady).catch(() => null); run.zoneReadyLogAtMs = readyLog.atMs; run.console = said;
  run.errors = errors; results.push(run);
  fs.writeFileSync(path.join(out, `${label}.json`), JSON.stringify(run, null, 1));
  const ph = run.phases || {}, f = (n) => ph[n]?.frames, l = run.load || {};
  console.log(`PERF ${label} gl=${run.env?.gl?.slice(0, 40)} coarse=${run.env?.coarse} | load: settled ${l.settledAtMs} ms, fcp ${l.fcpMs}, ${l.mbBeforeReady} MB/${l.requests} req, loadLT>50 ${l.longTasksDuringLoad?.over50} | ` + ['idle', 'walk', 'fight'].map((n) => `${n}: med ${f(n)?.medianMs} p95 ${f(n)?.p95Ms} p99 ${f(n)?.p99Ms} fps ${f(n)?.fpsMedian} LT>50 ${ph[n]?.longTasks.over50} calls ${ph[n]?.render?.calls} tris ${ph[n]?.render?.triangles}`).join(' | ') + ` | zoneReady at-load ${l.zoneReady} by-end ${run.zoneReadyByEnd} logged@${run.zoneReadyLogAtMs} ms${run.settleTimeout ? ' SETTLE-TIMEOUT' : ''} stuck-lines ${said.filter((x) => /stuck/i.test(x)).length}` + (run.error ? ` | ERROR ${run.error}` : '') + ` | moved ${run.walkMovedM} m, errors ${errors.length}`);
  await ctx.close();
}
await browser.close(); await close();
fs.writeFileSync(path.join(out, 'all.json'), JSON.stringify(results));
