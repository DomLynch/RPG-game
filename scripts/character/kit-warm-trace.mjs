// What the first kit's long tasks are made of (Lead 2026-10-17: parse or first program build?). Opens the built Origins preview (build it with `--minify false` so the functions have their names), starts a CDP CPU profile once the page has loaded,
// waits for [zone ready] and for the kit warm to finish, then lists, for each long task the warm recorded (remoteKitsWarm().longTasks, offsets from the warm's start = [zone ready]), the functions that held the main thread in that window:
// self time and inclusive time. Usage: node scripts/character/kit-warm-trace.mjs <dist>   (on the GPU job the software-GL flags are stripped by gpu-run).
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serveOriginsPreview } from '../lib/origins-preview-harness.mjs';

const dist = process.argv[2] ?? 'artifacts/origins-preview-trace';
if (!fs.existsSync(`${dist}/index.html`)) throw new Error(`no build at ${dist}`);
const { origin, close } = await serveOriginsPreview(dist);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.setDefaultTimeout(170000);
  await page.goto(`${origin}/preview/origins/?region=1&zone=1`, { waitUntil: 'load' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  const p0a = await page.evaluate(() => performance.now()); await cdp.send('Profiler.start'); const p0b = await page.evaluate(() => performance.now());
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 });
  await page.waitForFunction(() => window.originsPreview.remoteKitsWarm() !== null, null, { timeout: 120000 });
  const { profile } = await cdp.send('Profiler.stop');
  const warm = await page.evaluate(() => ({ kits: window.originsPreview.remoteKitsWarm(), ready: window.__zoneReady }));
  const base = warm.ready.atMs, start = (p0a + p0b) / 2;   // page ms of the profile's start; the warm began at [zone ready]
  const nodes = new Map(profile.nodes.map((n) => [n.id, n])), parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const label = (n) => `${n.callFrame.functionName || '(anonymous)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
  const times = []; let t = 0; for (const d of profile.timeDeltas) { t += d; times.push(start + t / 1000); }   // page ms of each sample
  console.log(`warm: failed ${warm.kits.failed}, warmed ${warm.kits.warmed}, maxLongTaskMs ${warm.kits.maxLongTaskMs}, long tasks ${JSON.stringify(warm.kits.longTasks)}; clock bracket ${(p0b - p0a).toFixed(1)} ms`);
  for (const lt of warm.kits.longTasks ?? []) {
    const lo = base + lt.at - 15, hi = base + lt.at + lt.ms + 15, self = new Map(), incl = new Map();
    for (let i = 0; i < profile.samples.length; i++) {
      if (times[i] < lo || times[i] > hi) continue;
      const dt = (profile.timeDeltas[i + 1] ?? profile.timeDeltas[i]) / 1000, id = profile.samples[i], seen = new Set();
      const leaf = label(nodes.get(id)); self.set(leaf, (self.get(leaf) ?? 0) + dt);
      for (let n = id; n !== undefined; n = parent.get(n)) { const l = label(nodes.get(n)); if (!seen.has(l)) { seen.add(l); incl.set(l, (incl.get(l) ?? 0) + dt); } }
    }
    const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([l, ms]) => `${ms.toFixed(1)} ms  ${l}`);
    console.log(`\nLONG TASK at ${lt.at} ms (${lt.ms} ms), window ${(lo - base).toFixed(0)}..${(hi - base).toFixed(0)} ms from ready\n  self:\n    ${top(self, 10).join('\n    ')}\n  inclusive:\n    ${top(incl, 14).join('\n    ')}`);
  }
  fs.mkdirSync('artifacts/kit-warm-trace', { recursive: true }); fs.writeFileSync('artifacts/kit-warm-trace/profile.cpuprofile', JSON.stringify(profile));
} finally { await browser.close(); await close(); }
