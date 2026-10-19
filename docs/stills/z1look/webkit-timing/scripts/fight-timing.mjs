// WebKit fight-only timing: a CONNECTED duel with the cave troll (combat().target set, blows landing), A vs B, N interleaved runs.
// Usage: node fight-timing.mjs <outDir> "<urlA>" <labelA> "<urlB>" <labelB> [runs=3] [maxLoad=6]
// Per run: fresh WebKit, wait for creatures, place 9 m south of the nearest cave troll, tapMob; if the engine has no target within 12 s,
// step to 2.5 m and press; once the target is set, 4 heavy presses then 8 s of rAF deltas while pressing heavy every 1.5 s; records the
// target id, the troll's health before/after (combat().fighters) and a frame (run 1).
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
const sampleFramesWhilePressing = (page, ms) => page.evaluate((ms) => new Promise((res) => { const d = []; let last = performance.now(); const end = last + ms; let nextPress = last + 1500; const f = (t) => { d.push(t - last); last = t; if (t >= nextPress) { try { originsPreview.press('heavy'); } catch {} nextPress = t + 1500; } if (t < end) requestAnimationFrame(f); else res(d.slice(1)); }; requestAnimationFrame(f); }), ms);
const fighters = (page) => page.evaluate(() => { const c = originsPreview.combat(); const t = c.target; return { target: t?.id ?? null, hero: c.hero && { hp: c.hero.hp ?? c.hero.health ?? null }, foes: (c.fighters ?? []).map((f) => ({ id: f.id, hp: f.hp ?? f.health ?? null })).slice(0, 3), trace: (c.trace ?? []).length }; }).catch((e) => ({ error: String(e).slice(0, 100) }));
const run = async (url, label, idx, frame) => {
  const load = await waitLoad();
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  await page.goto(url + (url.includes('?') ? '&' : '?') + `v=f${Date.now()}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.length > 0, null, { timeout: 240000, polling: 100 });
  await sleep(3000);
  const troll = await page.evaluate(() => { const h = originsPreview.pos, ms = originsPreview.mobs().mobs.filter((m) => m.body === 'cave-troll'); ms.sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z)); const m = ms[0]; return m && { id: m.id, x: m.x, z: m.z }; });
  await page.evaluate((t) => originsPreview.place(t.x, t.z + 9, Math.PI), troll); await sleep(5000);
  await page.evaluate((id) => originsPreview.tapMob(id), troll.id);
  let how = 'tapMob';
  let engaged = await page.waitForFunction(() => !!originsPreview.combat?.().target, null, { timeout: 12000, polling: 250 }).then(() => true).catch(() => false);
  if (!engaged) { const at = await page.evaluate((id) => { const m = originsPreview.mobs().mobs.find((q) => q.id === id); return { x: m.x, z: m.z }; }, troll.id); await page.evaluate((a) => originsPreview.place(a.x, a.z + 2.5, Math.PI), at); await sleep(800); await page.evaluate(() => originsPreview.press('heavy')); how = 'tapMob, then stepped to 2.5 m and pressed'; engaged = await page.waitForFunction(() => !!originsPreview.combat?.().target, null, { timeout: 8000, polling: 250 }).then(() => true).catch(() => false); }
  const before = await fighters(page);
  for (let i = 0; i < 4; i++) { await page.evaluate(() => originsPreview.press('heavy')); await sleep(350); }
  if (frame) await page.screenshot({ path: `${OUT}/${label}-webkit-duel-375.jpg`, type: 'jpeg', quality: 88 });
  const fight = stats(await sampleFramesWhilePressing(page, 8000));
  const after = await fighters(page);
  const info = await page.evaluate(() => { const r = originsPreview.renderInfo?.(); return r && { triangles: r.triangles, calls: r.calls }; }).catch(() => null);
  if (frame) await page.screenshot({ path: `${OUT}/${label}-webkit-duel-end-375.jpg`, type: 'jpeg', quality: 88 });
  await browser.close();
  const r = { label, run: idx, loadBefore: +load.toFixed(2), how, engaged, before, after, fight, render: info, errors: [...new Set(errors)].slice(0, 4) };
  console.log(JSON.stringify(r)); return r;
};
const results = [];
for (let i = 1; i <= +RUNS; i++) { results.push(await run(URL_A, LABEL_A, i, i === 1)); results.push(await run(URL_B, LABEL_B, i, i === 1)); }
writeFileSync(`${OUT}/fight-timing.json`, JSON.stringify(results, null, 2));
for (const l of [LABEL_A, LABEL_B]) { const rs = results.filter((r) => r.label === l); console.log(l, 'engaged', rs.map((r) => r.engaged).join('/'), '| fight fps', rs.map((r) => r.fight?.fps).join('/'), 'p95 ms', rs.map((r) => r.fight?.p95).join('/'), 'max', rs.map((r) => r.fight?.max).join('/')); }
