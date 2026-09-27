// Load-time probe (Lead 2026-09-27: the per-fight byte cap is re-derived from MEASURED load time). A fresh guest on a 393x852
// mobile page, cache disabled, one CDP network profile per run: seconds from navigation start to #attack-button enabled (the
// page is playable) and to #art-status empty (both rigs in), with the encoded bytes finished at each point (the sum of
// Network.loadingFinished encodedDataLength). "Enter the arena" is tapped once the page is playable (the release rows' order). Read-only against the site: a
// guest profile lives in the page's own localStorage. RUNS per profile, the median reported; a fit of seconds against the
// ideal wire time (MB * 8 / Mbps) splits download cost from the time left at 0 bytes (parse, decode, shader compile).
// Usage: [QA_URL=https://frankendom.com/] [RUNS=3] node scripts/load-probe.mjs [out.json]
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const target = process.env.QA_URL || 'https://frankendom.com/', runs = Number(process.env.RUNS || 3), out = process.argv[2] || 'artifacts/load-probe.json';
const PROFILES = [
  { name: 'unthrottled', mbps: 0, latency: 0 },
  { name: '9 Mbps / 85 ms', mbps: 9, latency: 85 },
  { name: '4 Mbps / 100 ms', mbps: 4, latency: 100 },
];
const MB = 1048576;

async function once(browser, profile) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.route('**/*sentry.io/**', (r) => r.abort());
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (profile.mbps) {
    const bytesPerSecond = (profile.mbps * 1e6) / 8;
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.latency, downloadThroughput: bytesPerSecond, uploadThroughput: bytesPerSecond });
  }
  let bytes = 0, files = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; files += 1; });
  const t0 = Date.now(), at = () => ({ s: +((Date.now() - t0) / 1000).toFixed(2), mb: +(bytes / MB).toFixed(2), files });
  await page.goto(target, { waitUntil: 'commit', timeout: 120000 });
  // One poll loop stamps each point the first time it holds, so art-ready is timed on its own and never waits on the Enter tap
  // (run 36304481723: Playwright's tap waited ~12 s for the welcome card to settle, which the art stamp then carried).
  // Enter is clicked in the page (no actionability wait) as soon as the page is playable. `pageS` is the page's own
  // performance.now() at the stamp (navigation start = 0), the figure the ?perf=1 readout uses on the phone.
  const stamps = {};
  const deadline = Date.now() + 240000;
  while (!(stamps.playable && stamps.art && stamps.entered)) {
    if (Date.now() > deadline) throw new Error(`load-probe: not ready in 240 s: ${JSON.stringify(stamps)}`);
    const st = await page.evaluate(() => ({
      now: performance.now(),
      playable: document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false',
      art: document.querySelector('#art-status')?.textContent === '',
      welcome: !!document.querySelector('#welcome') && !document.querySelector('#welcome').hidden,
    })).catch(() => null);
    if (st) {
      for (const k of ['playable', 'art']) if (st[k] && !stamps[k]) stamps[k] = { ...at(), pageS: +(st.now / 1000).toFixed(2) };
      if (st.playable && st.welcome && !stamps.enterClicked) { stamps.enterClicked = at(); await page.evaluate(() => document.querySelector('#name-form button[type="submit"]')?.click()); }
      if (st.playable && !st.welcome && !stamps.entered) stamps.entered = at();
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  const { playable, art } = stamps, enterAt = stamps.enterClicked ?? stamps.entered;
  await context.close();
  return { enter: enterAt, playable, art };
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const browser = await chromium.launch({ headless: true });
const report = { target, runs, at: new Date().toISOString(), ua: '', profiles: [] };
try {
  report.ua = await (await browser.newPage()).evaluate(() => navigator.userAgent);
  for (const profile of PROFILES) {
    const samples = [];
    for (let i = 0; i < runs; i++) { const r = await once(browser, profile); samples.push(r); console.log(profile.name, i + 1, JSON.stringify(r)); }
    const m = (point, key) => median(samples.map((r) => r[point][key]));
    report.profiles.push({ ...profile, samples, median: Object.fromEntries(['enter', 'playable', 'art'].map((p) => [p, { s: m(p, 's'), mb: m(p, 'mb') }])) });
  }
  // Least squares over the throttled medians: art seconds = c + k * ideal wire seconds (MB * 8 / Mbps). k near 1 means the
  // throttle is the cost; c is what is left at 0 bytes. Seconds per MB at each profile = k * 8 / Mbps.
  const pts = report.profiles.filter((p) => p.mbps).flatMap((p) => ['playable', 'art'].map((point) => ({ point, x: (p.median[point].mb * 8) / p.mbps, y: p.median[point].s })));
  for (const point of ['playable', 'art']) {
    const ps = pts.filter((p) => p.point === point), n = ps.length, sx = ps.reduce((a, p) => a + p.x, 0), sy = ps.reduce((a, p) => a + p.y, 0);
    const k = (n * ps.reduce((a, p) => a + p.x * p.y, 0) - sx * sy) / (n * ps.reduce((a, p) => a + p.x * p.x, 0) - sx * sx), c = (sy - k * sx) / n;
    report[`fit_${point}`] = { k: +k.toFixed(3), c: +c.toFixed(2), secondsPerMB: Object.fromEntries(report.profiles.filter((p) => p.mbps).map((p) => [p.name, +((k * 8) / p.mbps).toFixed(2)])) };
  }
} finally {
  await browser.close();
  await fs.mkdir(out.replace(/\/[^/]+$/, ''), { recursive: true });
  await fs.writeFile(out, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ medians: report.profiles.map((p) => ({ profile: p.name, ...p.median })), fit_playable: report.fit_playable, fit_art: report.fit_art }, null, 2));
