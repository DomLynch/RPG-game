import { webkit, devices } from 'playwright';
const port = process.argv[2];
const b = await webkit.launch();
const p = await (await b.newContext({ ...devices['iPhone 15'] })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await p.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window); window.__rafCalls = 0;   // every game callback, counted when it runs
  window.requestAnimationFrame = (cb) => raf((t) => { window.__rafCalls++; cb(t); });
  window.__frames = []; let last = 0; const rec = (t) => { if (last) window.__frames.push([t, t - last]); last = t; raf(rec); }; raf(rec);   // my own recorder, on the original rAF (not counted)
  window.__inf = []; new MutationObserver(() => { window.__inf.push([performance.now(), document.body.classList.contains('infight')]); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
});
await p.goto(`http://127.0.0.1:${port}/preview/origins/?region=1&wolf&worldfight`, { waitUntil: 'load' }); await p.waitForTimeout(16000);
const rate = async (ms) => p.evaluate((ms) => new Promise((res) => { const c0 = window.__rafCalls, t0 = performance.now(); setTimeout(() => res({ cps: Math.round(((window.__rafCalls - c0) / ((performance.now() - t0) / 1000)) * 10) / 10 }), ms); }), ms);
const r = { baselineRaf: await rate(3000) };
const mobs0 = await p.evaluate(() => window.originsPreview.mobs().mobs); const w1 = mobs0.find((m) => m.id === 'wolves-1');
r.wolves1Before = { x: w1.x, z: w1.z, drawn: w1.drawn, height: w1.height };
await p.evaluate(([x, z]) => window.originsPreview.place(x + 3, z, 0), [w1.x, w1.z]); await p.waitForTimeout(6000);
// sample for violations: wolves-1 drawn while body.infight
await p.evaluate(() => { window.__viol = []; window.__vis = []; window.__sample = setInterval(() => { const inf = document.body.classList.contains('infight'); if (!inf) return; const m = window.originsPreview.mobs().mobs; const w = m.find((x) => x.id === 'wolves-1'); window.__vis.push(m.filter((x) => /wolf/i.test(x.body) && x.drawn).length); if (w && w.drawn) window.__viol.push(performance.now()); }, 100); });
const tap = await p.evaluate(() => { const t = performance.now(); const ok = window.originsPreview.tapMob('wolves-1'); return { t, ok }; });
r.tap = tap;
await p.waitForFunction(() => document.body.classList.contains('infight'), null, { timeout: 60000 }).catch(() => { r.infightNeverSet = true; });
await p.waitForTimeout(4000);
const posA = await p.evaluate(() => window.originsPreview.mobs().mobs.filter((m) => /wolf/i.test(m.body)).map((m) => [m.id, m.x, m.z]));
await p.waitForTimeout(10000);
const posB = await p.evaluate(() => window.originsPreview.mobs().mobs.filter((m) => /wolf/i.test(m.body)).map((m) => [m.id, m.x, m.z]));
r.moved = posA.map(([id, x, z]) => { const q = posB.find((v) => v[0] === id); return { id, d: q ? Math.round(Math.hypot(q[1] - x, q[2] - z) * 100) / 100 : null }; });
r.duringRaf = await rate(3000);
const data = await p.evaluate(() => ({ frames: window.__frames, inf: window.__inf, viol: window.__viol.length, visMax: Math.max(0, ...window.__vis), visSamples: window.__vis.length }));
const infT = (data.inf.find((e) => e[1]) || [])[0]; r.engageAt = infT ?? null; r.tapToInfightMs = infT ? Math.round(infT - tap.t) : null;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? Math.round(s[Math.floor(s.length / 2)] * 10) / 10 : null; };
const slice = (t0, t1) => data.frames.filter(([t]) => t >= t0 && t < t1).map(([, d]) => d);
if (infT) { const before = slice(tap.t - 5000, tap.t), around = slice(tap.t - 1000, infT + 2000), during = slice(infT, infT + 5000);
  r.frameMs = { medianBefore: med(before), medianDuring: med(during), worstAroundEngage: Math.round(Math.max(...around) * 10) / 10, worst5After: Math.round(Math.max(...during) * 10) / 10, framesBefore: before.length, framesDuring: during.length }; }
r.foeDrawnWhileInfightSamples = data.viol; r.wolfModelsVisibleMax = data.visMax; r.infightSamples = data.visSamples;
await p.evaluate(() => clearInterval(window.__sample));
await p.screenshot({ path: '/tmp/gate-infight.png' });
const leave = p.locator('#leave'); const vis = await leave.isVisible().catch(() => false); r.leaveVisible = vis; if (vis) await leave.click(); else await p.evaluate(() => document.getElementById('leave')?.click());
await p.waitForTimeout(5000);
r.afterLeaveInfight = await p.evaluate(() => document.body.classList.contains('infight')); r.afterLeaveRaf = await rate(3000);
r.errors = errors;
console.log(JSON.stringify(r, null, 1)); await b.close(); console.log('DONE');
