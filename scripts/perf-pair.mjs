// Paired frame-time check of two deployed (or local) pages: node scripts/perf-pair.mjs <name=url> <name=url> ...  env: ROUNDS=3 VIEW=390x844 WARM=8000 SAMPLE=12000 PIT_GL=1 (software GL)
// Per round, each page in turn gets a FRESH browser (the same box, the same minute), loads Zone 1, waits until a creature is drawn, settles WARM ms, then samples requestAnimationFrame deltas for SAMPLE ms and reads
// the page's own renderInfo() (draw calls, triangles, programs). Prints one JSON line per run and a median-of-rounds summary per page. The hero stands where the page put him (the start), nobody fights.
/* global process, console, window */
import { chromium } from 'playwright';

const pages = process.argv.slice(2).map((a) => { const i = a.indexOf('='); return { name: a.slice(0, i), url: a.slice(i + 1) }; });
const ROUNDS = +(process.env.ROUNDS || 3), [w, h] = (process.env.VIEW || '390x844').split('x').map(Number), WARM = +(process.env.WARM || 8000), SAMPLE = +(process.env.SAMPLE || 12000);
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const med = (a) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };
const results = {};
for (let round = 0; round < ROUNDS; round++) {
  for (const p of pages) {
    const browser = await chromium.launch({ args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
    try {
      const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA })).newPage();
      const t0 = Date.now();
      await page.goto(p.url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 300000 });
      const readyMs = Date.now() - t0; await page.waitForTimeout(WARM);
      const r = await page.evaluate(async (ms) => {
        const gaps = []; let last = performance.now(); const end = last + ms;
        await new Promise((res) => { const tick = (t) => { gaps.push(t - last); last = t; if (t < end) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
        const info = window.originsPreview.renderInfo();
        return { gaps, calls: info.calls, triangles: info.triangles, programs: info.programs };
      }, SAMPLE);
      const g = r.gaps.slice(2), mean = g.reduce((s, x) => s + x, 0) / g.length, sorted = [...g].sort((a, b) => a - b);
      const row = { page: p.name, round, readyMs, frames: g.length, medianMs: +med(g).toFixed(2), meanMs: +mean.toFixed(2), p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2), calls: r.calls, triangles: r.triangles, programs: r.programs };
      console.log('RUN', JSON.stringify(row)); (results[p.name] ??= []).push(row);
    } catch (e) { console.log('RUN', JSON.stringify({ page: p.name, round, error: String(e).slice(0, 160) })); } finally { await browser.close(); }
  }
}
for (const [name, rows] of Object.entries(results)) console.log('SUMMARY', JSON.stringify({ page: name, runs: rows.length, medianMs: +med(rows.map((r) => r.medianMs)).toFixed(2), meanMs: +med(rows.map((r) => r.meanMs)).toFixed(2), p95Ms: +med(rows.map((r) => r.p95Ms)).toFixed(2), calls: med(rows.map((r) => r.calls)), programs: med(rows.map((r) => r.programs)), readyMs: med(rows.map((r) => r.readyMs)) }));
