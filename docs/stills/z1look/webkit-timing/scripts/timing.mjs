// WebKit timing of Zone 1 at 375 wide: first-playable and frame time, A (live) vs B (local build), N interleaved runs each.
// Usage: node timing.mjs <outDir> "<urlA>" <labelA> "<urlB>" <labelB> [runs=3] [maxLoad=6]
// Per run (fresh WebKit browser): navigate; t_ready = first moment originsPreview.mobs() lists creatures (the page is drawing the zone);
// t_cover = the load cover's own atMs if it reports one; then 8 s of rAF frame deltas idle at the start, then 9 m from the cave troll,
// tapMob + 4 heavy presses, 8 s of rAF deltas in the fight. Waits for the Mac 1-min load to drop under maxLoad before every run.
// Safari frames (start + troll fight) are taken in the first run of each side. Hooks used: mobs, place, tapMob, press, cover, renderInfo.
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
const run = async (url, label, idx, frames) => {
  const load = await waitLoad();
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  const t0 = Date.now();
  await page.goto(url + (url.includes('?') ? '&' : '?') + `v=t${t0}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.length > 0, null, { timeout: 240000, polling: 100 });
  const ready = await page.evaluate(() => ({ now: performance.now(), cover: originsPreview.cover?.() ?? null, nav: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd ?? null }));
  const idle = stats(await sampleFrames(page, 8000));
  const info1 = await page.evaluate(() => { const r = originsPreview.renderInfo?.(); return r && { triangles: r.triangles, calls: r.calls, programs: r.programs, textures: r.textures }; }).catch(() => null);
  if (frames) { await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) if (el.children.length === 0 && (el.textContent ?? '').startsWith('Left stick walks')) el.hidden = true; }); await page.screenshot({ path: `${OUT}/${label}-webkit-start-375.jpg`, type: 'jpeg', quality: 88 }); }
  const troll = await page.evaluate(() => { const h = originsPreview.pos, ms = originsPreview.mobs().mobs.filter((m) => m.body === 'cave-troll'); ms.sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z)); const m = ms[0]; return m && { id: m.id, x: m.x, z: m.z }; });
  let fight = null, info2 = null;
  if (troll) {
    await page.evaluate((t) => originsPreview.place(t.x, t.z + 9, Math.PI), troll); await sleep(5000);
    await page.evaluate((id) => originsPreview.tapMob(id), troll.id);
    const engaged = await page.waitForFunction(() => !!originsPreview.combat?.().target, null, { timeout: 12000, polling: 250 }).then(() => true).catch(() => false);   // the engine has a target: the troll walked into reach
    await sleep(1500);
    for (let i = 0; i < 4; i++) { await page.evaluate(() => originsPreview.press('heavy')); await sleep(350); }
    var fightState = await page.evaluate(() => ({ engaged: !!originsPreview.combat?.().target, target: originsPreview.combat?.().target?.id ?? null }));
    fightState.engagedBeforePress = engaged;
    if (frames) await page.screenshot({ path: `${OUT}/${label}-webkit-troll-fight-375.jpg`, type: 'jpeg', quality: 88 });
    fight = stats(await sampleFrames(page, 8000));
    info2 = await page.evaluate(() => { const r = originsPreview.renderInfo?.(); return r && { triangles: r.triangles, calls: r.calls, programs: r.programs, textures: r.textures }; }).catch(() => null);
  }
  await browser.close();
  const r = { label, run: idx, url, loadBefore: +load.toFixed(2), readyMs: Math.round(ready.now), domContentLoadedMs: ready.nav && Math.round(ready.nav), cover: ready.cover, idle, fight, fightState: typeof fightState === 'undefined' ? null : fightState, renderIdle: info1, renderFight: info2, errors: [...new Set(errors)].slice(0, 4) };
  console.log(JSON.stringify(r)); return r;
};
const results = [];
for (let i = 1; i <= +RUNS; i++) { results.push(await run(URL_A, LABEL_A, i, i === 1)); results.push(await run(URL_B, LABEL_B, i, i === 1)); }
writeFileSync(`${OUT}/timing.json`, JSON.stringify(results, null, 2));
const side = (l) => results.filter((r) => r.label === l);
for (const l of [LABEL_A, LABEL_B]) { const rs = side(l); console.log(l, 'ready ms', rs.map((r) => r.readyMs).join('/'), '| idle fps', rs.map((r) => r.idle?.fps).join('/'), 'p95 ms', rs.map((r) => r.idle?.p95).join('/'), '| fight fps', rs.map((r) => r.fight?.fps).join('/'), 'p95 ms', rs.map((r) => r.fight?.p95).join('/')); }
