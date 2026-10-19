// WebKit timing of Zone 1 at 375 wide for the Z1b deferred biome: first-playable, then the moment the deferred look (dome + camp kit +
// building models) has arrived, measured as the renderer's triangle count settling (stable for 3 s, polled every 250 ms, up to 90 s);
// then 8 s idle frame deltas and a "look after load" frame. A (live) vs B (local build), N interleaved runs. No fight here (fight-timing.mjs).
// Usage: node z1b-timing.mjs <outDir> "<urlA>" <labelA> "<urlB>" <labelB> [runs=3] [maxLoad=6]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { webkit } = require('playwright');
const [OUT, URL_A, LABEL_A, URL_B, LABEL_B, RUNS = '3', MAXLOAD = '6'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitLoad = async () => { for (let i = 0; i < 60; i++) { const l = loadavg()[0]; if (l < +MAXLOAD) return l; console.log(`load ${l.toFixed(1)} >= ${MAXLOAD}, waiting`); await sleep(20000); } return loadavg()[0]; };
const stats = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; if (!n) return null; const q = (p) => s[Math.min(n - 1, Math.floor(p * n))]; return { n, mean: +(s.reduce((x, y) => x + y, 0) / n).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[n - 1].toFixed(2), fps: +(1000 / (s.reduce((x, y) => x + y, 0) / n)).toFixed(1) }; };
const sampleFrames = (page, ms) => page.evaluate((ms) => new Promise((res) => { const d = []; let last = performance.now(); const end = last + ms; const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(d.slice(1)); }; requestAnimationFrame(f); }), ms);
const render = (page) => page.evaluate(() => { const r = originsPreview.renderInfo?.(); return r && { triangles: r.triangles, calls: r.calls, textures: r.textures, now: performance.now() }; }).catch(() => null);
const run = async (url, label, idx, frames) => {
  const load = await waitLoad();
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  const t0 = Date.now();
  await page.goto(url + (url.includes('?') ? '&' : '?') + `v=z${t0}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.length > 0, null, { timeout: 240000, polling: 100 });
  const ready = await page.evaluate(() => ({ now: performance.now(), cover: originsPreview.cover?.() ?? null, nav: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd ?? null }));
  // the cover lifts (first playable): poll the cover element until it is gone or marked lifted
  const lifted = await page.waitForFunction(() => { const c = document.getElementById('cover'); return !c || c.classList.contains('lifted'); }, null, { timeout: 120000, polling: 100 }).then(() => page.evaluate(() => { const c = originsPreview.cover?.(); return c && c.atMs > 0 ? c.atMs : performance.now(); })).catch(() => null);
  // the deferred look has arrived when the page's resource entries (GLBs, pictures) stop growing for 4 s; the triangle trace is kept beside it
  const trace = []; let settledAt = null, lastRes = -1, stableSince = null, resAtLift = null, resFinal = null, lastResEnd = null; const tStart = Date.now();
  while (Date.now() - tStart < 90000) { const r = await render(page); const res = await page.evaluate(() => { const e = performance.getEntriesByType('resource'); return { n: e.length, lastEnd: e.length ? Math.round(Math.max(...e.map((x) => x.responseEnd))) : 0, now: performance.now() }; }); if (resAtLift === null) resAtLift = res.n; if (r) trace.push([Math.round(r.now), r.triangles, res.n]); if (res.n !== lastRes) { lastRes = res.n; stableSince = res.now; lastResEnd = res.lastEnd; } else if (res.now - stableSince >= 4000) { settledAt = lastResEnd; resFinal = res.n; break; } await sleep(250); }
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').filter((x) => /\.(glb|jpg|jpeg|png|webp|ktx2)(\?|$)/.test(x.name)).map((x) => ({ name: x.name.replace(/^.*\/\/[^/]+/, '').slice(0, 70), start: Math.round(x.startTime), end: Math.round(x.responseEnd), kb: Math.round((x.transferSize || x.encodedBodySize || 0) / 1024) })));
  const idle = stats(await sampleFrames(page, 8000));
  const info = await render(page);
  if (frames) { await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) if (el.children.length === 0 && (el.textContent ?? '').startsWith('Left stick walks')) el.hidden = true; }); await page.screenshot({ path: `${OUT}/${label}-webkit-after-load-375.jpg`, type: 'jpeg', quality: 88 }); }
  await browser.close();
  const r = { label, run: idx, url, loadBefore: +load.toFixed(2), readyMs: Math.round(ready.now), domContentLoadedMs: ready.nav && Math.round(ready.nav), coverLiftedMs: lifted && Math.round(lifted), lookSettledMs: settledAt, resourcesAtLift: resAtLift, resourcesFinal: resFinal, lateResources: resources.filter((x) => x.start >= (lifted ?? 0) - 50), triangleTrace: trace.filter((_, i, a) => i === 0 || i === a.length - 1 || a[i][1] !== a[i - 1][1]), idle, render: info && { triangles: info.triangles, calls: info.calls, textures: info.textures }, errors: [...new Set(errors)].slice(0, 4) };
  console.log(JSON.stringify(r)); return r;
};
const results = [];
for (let i = 1; i <= +RUNS; i++) { results.push(await run(URL_A, LABEL_A, i, i === 1)); results.push(await run(URL_B, LABEL_B, i, i === 1)); }
writeFileSync(`${OUT}/z1b-timing.json`, JSON.stringify(results, null, 2));
for (const l of [LABEL_A, LABEL_B]) { const rs = results.filter((r) => r.label === l); console.log(l, 'ready ms', rs.map((r) => r.readyMs).join('/'), '| cover lifted ms', rs.map((r) => r.coverLiftedMs).join('/'), '| look settled ms', rs.map((r) => r.lookSettledMs).join('/'), '| idle fps', rs.map((r) => r.idle?.fps).join('/'), 'p95 ms', rs.map((r) => r.idle?.p95).join('/'), '| tri', rs.map((r) => r.render?.triangles).join('/')); }
