// Zone 1 goblin-pair still at 375x812, WebKit, fight camera: the closest pit-goblin + cinder-scavenger pair in one frame, "ready" (hero 7 m off,
// facing the pair's midpoint) and "fight" (tapMob the nearer one, two heavy presses). Records each mob's name/body and the page's fit stats
// (originsPreview.debug().fit, #3268's hook) so the "no visible change" claim has numbers beside the frame.
// Usage: PW_ROOT=<repo with playwright> node pair-still.mjs <outDir> "<url>" <tag> [pairNear=pit.?goblin] [pairFar=scavenger]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { webkit } = require('playwright');
const [OUT, URL, TAG, RE_A = 'pit.?goblin', RE_B = 'scavenger'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const log = { url: URL, tag: TAG, at: new Date().toISOString(), frames: [], errors: [] };
const browser = await webkit.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const page = await ctx.newPage();
page.on('pageerror', (e) => log.errors.push(String(e).slice(0, 200))); page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text().slice(0, 200)); });
await page.goto(URL + (URL.includes('?') ? '&' : '?') + `v=pr${Date.now()}`, { waitUntil: 'commit' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.length > 0, null, { timeout: 240000, polling: 500 });
await page.waitForTimeout(4000);
const hideHint = () => page.evaluate(() => { for (const el of document.querySelectorAll('body *')) if (el.children.length === 0 && (el.textContent ?? '').startsWith('Left stick walks')) el.hidden = true; }).catch(() => {});
const shot = async (name, note) => { await hideHint(); await page.waitForTimeout(200); const f = `${OUT}/${TAG}-${name}-375.jpg`; await page.screenshot({ path: f, type: 'jpeg', quality: 88 }); log.frames.push({ name, file: f, note }); console.log('frame', name, note); };
const mobs = await page.evaluate(() => originsPreview.mobs().mobs.map((m) => ({ id: m.id, name: m.name ?? null, body: m.body ?? null, kind: m.kind ?? m.spec?.id ?? null, level: m.level ?? null, x: m.x, z: m.z })));
log.mobsSample = mobs.slice(0, 6);
const match = (m, re) => new RegExp(re, 'i').test(`${m.id} ${m.name} ${m.kind}`);
const A = mobs.filter((m) => match(m, RE_A)), B = mobs.filter((m) => match(m, RE_B));
console.log('candidates', RE_A, A.length, RE_B, B.length, 'of', mobs.length);
if (!A.length || !B.length) { log.note = `no pair: ${RE_A}=${A.length} ${RE_B}=${B.length}; mob ids: ${[...new Set(mobs.map((m) => m.id.replace(/-\d+$/, '')))].join(',')}`; console.log(log.note); }
else {
  let best = null; for (const a of A) for (const b of B) { const d = Math.hypot(a.x - b.x, a.z - b.z); if (!best || d < best.d) best = { a, b, d }; }
  if (best.d > 25) {   // the kinds keep their own ground (74 m apart in Zone 1): one frame per kind instead, same spot and camera on both sides
    log.note = `nearest pair ${best.d.toFixed(1)} m apart, beyond one frame: one frame per kind`; console.log(log.note);
    const h0 = await page.evaluate(() => ({ x: originsPreview.pos.x, z: originsPreview.pos.z }));
    const nearest = (list) => [...list].sort((p, q) => Math.hypot(p.x - h0.x, p.z - h0.z) - Math.hypot(q.x - h0.x, q.z - h0.z))[0];
    for (const [tag, m] of [['pit-goblin', nearest(A)], ['scavenger', nearest(B)]]) {
      await page.evaluate((p) => originsPreview.place(p.x, p.z + 6, Math.PI), m); await page.waitForTimeout(5000);
      const fit = await page.evaluate(() => { const d = originsPreview.debug?.(); return d?.fit ?? null; }).catch(() => null);
      const render = await page.evaluate(() => { const r = originsPreview.renderInfo?.(); return r && { triangles: r.triangles, calls: r.calls }; }).catch(() => null);
      await shot(`${tag}-ready`, `${m.id} (${m.name}), hero 6 m south facing it`);
      await page.evaluate((id) => originsPreview.tapMob(id), m.id);
      await page.waitForFunction(() => !!originsPreview.combat?.().target, null, { timeout: 12000, polling: 250 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.evaluate(() => originsPreview.press('heavy')); await page.waitForTimeout(600); await page.evaluate(() => originsPreview.press('heavy')); await page.waitForTimeout(500);
      const target = await page.evaluate(() => originsPreview.combat?.().target?.id ?? null).catch(() => null);
      await shot(`${tag}-fight`, `tapMob ${m.id}, two heavy presses; target ${target}`);
      log.frames[log.frames.length - 1].fit = fit; log.frames[log.frames.length - 1].render = render; log.frames[log.frames.length - 1].target = target;
    }
    writeFileSync(`${OUT}/${TAG}-pair-summary.json`, JSON.stringify(log, null, 2)); await browser.close(); process.exit(0);
  }
  const mx = (best.a.x + best.b.x) / 2, mz = (best.a.z + best.b.z) / 2;
  // stand 7 m south of the midpoint looking north (heading PI as in the other scripts), the pair spread left/right of the lens
  const dx = best.a.x - best.b.x, dz = best.a.z - best.b.z; const len = Math.hypot(dx, dz) || 1;   // the pair's axis
  const nx = -dz / len, nz = dx / len;   // a perpendicular to the pair's axis
  const hx = mx + nx * 7, hz = mz + nz * 7; const heading = Math.atan2(mx - hx, mz - hz);
  log.pair = { a: best.a, b: best.b, apartM: +best.d.toFixed(1), hero: { x: +hx.toFixed(1), z: +hz.toFixed(1), heading: +heading.toFixed(2) } };
  console.log('pair', JSON.stringify(log.pair));
  await page.evaluate(([x, z, h]) => originsPreview.place(x, z, h), [hx, hz, heading]); await page.waitForTimeout(5000);
  log.fitReady = await page.evaluate(() => { const d = originsPreview.debug?.(); return d?.fit ?? null; }).catch(() => null);
  log.renderReady = await page.evaluate(() => { const r = originsPreview.renderInfo?.(); return r && { triangles: r.triangles, calls: r.calls }; }).catch(() => null);
  await shot('pair-ready', `${best.a.id} + ${best.b.id}, ${best.d.toFixed(1)} m apart, hero 7 m off the midpoint`);
  const near = [best.a, best.b].sort((p, q) => Math.hypot(p.x - hx, p.z - hz) - Math.hypot(q.x - hx, q.z - hz))[0];
  await page.evaluate((id) => originsPreview.tapMob(id), near.id);
  await page.waitForFunction(() => !!originsPreview.combat?.().target, null, { timeout: 12000, polling: 250 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => originsPreview.press('heavy')); await page.waitForTimeout(600); await page.evaluate(() => originsPreview.press('heavy')); await page.waitForTimeout(500);
  log.fightState = await page.evaluate(() => ({ target: originsPreview.combat?.().target?.id ?? null })).catch(() => null);
  await shot('pair-fight', `tapMob ${near.id}, two heavy presses; target ${log.fightState?.target}`);
  log.fitFight = await page.evaluate(() => { const d = originsPreview.debug?.(); return d?.fit ?? null; }).catch(() => null);
}
writeFileSync(`${OUT}/${TAG}-pair-summary.json`, JSON.stringify(log, null, 2));
await browser.close();
