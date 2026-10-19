// Zone stills at 375x812 (iPhone size), fight camera: for each named creature body, a fresh page, a "ready" frame with the hero 9 m off and a "fight" frame
// mid-exchange; plus a "start" frame (the horizon dome behind the start) and any extra SPOTS ("name:x:z:heading,..." in env) such as a camp.
// Usage: SPOTS="camp:-50:-396:0" node zone-stills.mjs <outDir> "<url>" <tag> [bodies=goblin,giant-salamander,cave-troll]
// Reads only the page's own browser-check hooks (originsPreview: mobs, place, tapMob, press, mobScreen, region, camView). Mac GPU via --use-angle=metal.
// The URL must carry presence=0 on the live site: presence warps a teleported hero back (main.ts onHello). The first-run hint box is hidden for the frames (presentation only).
// A salamander is engaged by standing 3 m off and pressing (tapMob on one starts a Pit duel instead); the others through tapMob, the page's own tap path.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [OUT, URL, TAG, BODIES = 'goblin,giant-salamander,cave-troll'] = process.argv.slice(2);
const SPOTS = (process.env.SPOTS ?? '').split(',').filter(Boolean).map((s) => { const [name, x, z, h] = s.split(':'); return { name, x: +x, z: +z, h: +h }; });
mkdirSync(OUT, { recursive: true });
const log = { url: URL, tag: TAG, at: new Date().toISOString(), frames: [], console: [] };
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const open = async () => {
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => log.console.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(URL + (URL.includes('?') ? '&' : '?') + `v=fr${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.length > 0, null, { timeout: 180000, polling: 1000 });
  await page.waitForTimeout(3000);
  return page;
};
const hideHint = (page) => page.evaluate(() => { for (const el of document.querySelectorAll('body *')) if (el.children.length === 0 && (el.textContent ?? '').startsWith('Left stick walks')) el.hidden = true; }).catch(() => {});
const shot = async (page, name, note) => { await hideHint(page); await page.waitForTimeout(200); const f = `${OUT}/${TAG}-${name}-375.jpg`; await page.screenshot({ path: f, type: 'jpeg', quality: 88 }); const cam = await page.evaluate(() => originsPreview.camView?.() ?? null).catch(() => null); const hero = await page.evaluate(() => ({ x: originsPreview.pos.x, z: originsPreview.pos.z, zone: originsPreview.region?.()?.zone?.name ?? null })).catch(() => null); log.frames.push({ name, file: f, note, cam, hero }); console.log('frame', name, note ?? '', JSON.stringify(hero)); };
const moveTo = (page, x, z, h) => page.evaluate(([x, z, h]) => originsPreview.place(x, z, h), [x, z, h]);
{ // 1. the start (the horizon dome behind the hero) and the extra spots
  const page = await open();
  log.zone = await page.evaluate(() => ({ region: originsPreview.region?.()?.zone ?? null, bodies: [...new Set(originsPreview.mobs().mobs.map((m) => m.body))], count: originsPreview.mobs().mobs.length, start: { x: originsPreview.pos.x, z: originsPreview.pos.z } }));
  console.log('zone', JSON.stringify(log.zone).slice(0, 400));
  await page.waitForTimeout(6000); await shot(page, 'start', 'hero at the start, 9 s after the page opened');
  for (const s of SPOTS) { await moveTo(page, s.x, s.z, s.h); await page.waitForTimeout(6000); await shot(page, s.name, `hero placed at ${s.x},${s.z} heading ${s.h}`); }
  await page.close();
}
for (const body of BODIES.split(',')) {   // 2. each creature on a fresh page (full health, no leftover fight)
  const page = await open();
  const pick = await page.evaluate((body) => { const h = originsPreview.pos, ms = originsPreview.mobs().mobs.filter((m) => m.body === body && !m.down && m.mode !== 'down'); if (!ms.length) return null; ms.sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z)); const m = ms[0]; return { id: m.id, x: m.x, z: m.z, name: m.name ?? null, mode: m.mode ?? null, loadout: m.loadout ?? null, level: m.level ?? null }; }, body);
  if (!pick) { log.frames.push({ name: body, note: 'no such creature up in this zone' }); console.log('skip', body, 'not present'); await page.close(); continue; }
  await moveTo(page, pick.x, pick.z + 9, Math.PI);   // ready: 9 m south of it, facing it
  let seen = null; for (let i = 0; i < 20 && !seen; i++) { await page.waitForTimeout(1000); seen = await page.evaluate((id) => originsPreview.mobScreen(id), pick.id); }
  await page.waitForTimeout(4000);
  await shot(page, `${body}-ready`, `hero 9 m from ${pick.id} (${pick.name ?? ''} Lv ${pick.level}${pick.loadout ? ', loadout ' + pick.loadout : ''}), not engaged; creature centre on screen at ${JSON.stringify(seen)}`);
  let how;
  if (body === 'giant-salamander') { await moveTo(page, pick.x, pick.z + 3.2, Math.PI); await page.waitForTimeout(2500); how = 'stood 3.2 m off and pressed heavy'; }
  else { const ok = await page.evaluate((id) => originsPreview.tapMob(id), pick.id); await page.waitForTimeout(4000); how = `engaged via tapMob (${ok})`; }
  for (let i = 0; i < 4; i++) { await page.evaluate(() => originsPreview.press('heavy')); await page.waitForTimeout(350); }
  await shot(page, `${body}-fight`, `${how}, 4 heavy presses, frame mid-exchange`);
  await page.close();
}
writeFileSync(`${OUT}/${TAG}-summary.json`, JSON.stringify(log, null, 2));
console.log('console lines:', log.console.length, JSON.stringify([...new Set(log.console)].slice(0, 6)));
await browser.close();
