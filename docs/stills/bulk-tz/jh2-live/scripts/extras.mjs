// Extras for the zone 90 stills: the hut (from the region's landmarks) and a salamander fight framed right after the first press.
// Usage: node extras.mjs <outDir> "<url>" <tag>
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [OUT, URL, TAG] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const log = { url: URL, tag: TAG, at: new Date().toISOString(), frames: [] };
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
const open = async () => { const page = await ctx.newPage(); await page.goto(URL + `&v=fr${Date.now()}`, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.length > 0, null, { timeout: 180000, polling: 1000 }); await page.waitForTimeout(3000); return page; };
const hideHint = (page) => page.evaluate(() => { for (const el of document.querySelectorAll('body *')) if (el.children.length === 0 && (el.textContent ?? '').startsWith('Left stick walks')) el.hidden = true; }).catch(() => {});
const shot = async (page, name, note) => { await hideHint(page); await page.waitForTimeout(150); const f = `${OUT}/${TAG}-${name}-375.jpg`; await page.screenshot({ path: f, type: 'jpeg', quality: 88 }); const hero = await page.evaluate(() => ({ x: originsPreview.pos.x, z: originsPreview.pos.z, zone: originsPreview.region?.()?.zone?.name ?? null })).catch(() => null); log.frames.push({ name, file: f, note, hero }); console.log('frame', name, note ?? '', JSON.stringify(hero)); };
{ // the huts: the region's landmarks carry the layout spots
  const page = await open();
  const region = await page.evaluate(() => originsPreview.region());
  const marks = (region?.zones ?? []).flatMap((z) => { const L = z.landmarks ?? []; return Array.isArray(L) ? L.map((l) => ({ zone: z.zone, ...l })) : Object.entries(L).map(([id, v]) => ({ zone: z.zone, id, ...(typeof v === 'object' ? v : { at: v }) })); });
  console.log('landmarks', JSON.stringify(marks).slice(0, 1500));
  log.landmarks = marks;
  const huts = marks.filter((l) => /hut/i.test(JSON.stringify(l)));
  for (const [i, h] of huts.entries()) {
    const at = h.at ?? h.pos ?? h; const x = at.x ?? at[0], z = at.z ?? at[1]; if (!Number.isFinite(x)) continue;
    await page.evaluate(([x, z]) => originsPreview.place(x - 9, z, Math.PI / 2), [x, z]);   // 9 m west of it, facing east (the huts face 90)
    await page.waitForTimeout(5000); await shot(page, `hut-${i + 1}`, `hero 9 m west of ${h.id ?? h.name ?? 'hut'} at ${x},${z}`);
  }
  await page.close();
}
{ // salamander: 5 m off, one press, the frame 1.2 s later
  const page = await open();
  const pick = await page.evaluate(() => { const h = originsPreview.pos, ms = originsPreview.mobs().mobs.filter((m) => m.body === 'giant-salamander'); ms.sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z)); const m = ms[0]; return m && { id: m.id, x: m.x, z: m.z, name: m.name, level: m.level }; });
  if (pick) {
    await page.evaluate((p) => originsPreview.place(p.x, p.z + 5, Math.PI), pick); await page.waitForTimeout(3000);
    await page.evaluate(() => originsPreview.press('heavy')); await page.waitForTimeout(600); await page.evaluate(() => originsPreview.press('heavy')); await page.waitForTimeout(700);
    await shot(page, 'giant-salamander-fight2', `hero 5 m from ${pick.id} (${pick.name} Lv ${pick.level}), two heavy presses, frame 1.3 s after the first`);
  }
  await page.close();
}
writeFileSync(`${OUT}/${TAG}-extras-summary.json`, JSON.stringify(log, null, 2));
await browser.close();
