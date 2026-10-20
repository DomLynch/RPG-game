// Zone 1 load timing at 375x812 on the Mac's real GPU (HEADED=1; headless Chromium here is software GL and never reaches zone ready): per run, first playable (the load cover
// lifts: #cover.lifted) and [zone ready] (window.__zoneReady.atMs, which on K5s+ also waits for modelsDrawn), both in ms from navigation start.
// Env: URL (live by default) or URLS="a=<url>,b=<url>" to interleave builds run after run (a, b, a, b ...), RUNS (3, per build), HEADED=1, GL=swiftshader.
import { chromium } from 'playwright';
const targets = process.env.URLS ? process.env.URLS.split(',').map((s) => s.split(/=(.*)/s).slice(0, 2)) : [['live', process.env.URL || 'https://frankendom.com/zone1/']];
const RUNS = +(process.env.RUNS || 3);
const browser = await chromium.launch({ headless: process.env.HEADED !== '1', args: process.env.GL === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
const runs = [];
for (let i = 0; i < RUNS; i++) for (const [name, url] of targets) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__t = { playable: null };
    const poll = () => { const c = document.getElementById('cover'); if (c && c.classList.contains('lifted') && window.__t.playable == null) window.__t.playable = Math.round(performance.now()); if (window.__t.playable == null) setTimeout(poll, 20); };
    poll();
  });
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'presence=0&run=' + Date.now() + i, { waitUntil: 'commit' });
  try {
    await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000, polling: 100 });
    runs.push({ name, ...(await page.evaluate(() => ({ playableMs: window.__t.playable, zoneReadyMs: window.__zoneReady.atMs, programs: window.__zoneReady.programs }))) });
  } catch (e) { runs.push({ name, fail: String(e).slice(0, 120), playableMs: await page.evaluate(() => window.__t?.playable).catch(() => null) }); }
  await ctx.close();
}
await browser.close();
const median = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const medians = Object.fromEntries(targets.map(([name]) => [name, { playableMs: median(runs.filter((r) => r.name === name).map((r) => r.playableMs)), zoneReadyMs: median(runs.filter((r) => r.name === name).map((r) => r.zoneReadyMs)) }]));
console.log(JSON.stringify({ runs, medians }));
