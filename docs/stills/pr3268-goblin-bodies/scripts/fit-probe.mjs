// Read #3268's fit stats (originsPreview.mobs().fit: bodies = fitted body keys, refused, tris, draws) after standing by a pit goblin and a scavenger.
// Usage: PW_ROOT=<repo with playwright> node fit-probe.mjs "<url>"
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { webkit } = require('playwright');
const [URL] = process.argv.slice(2);
const browser = await webkit.launch(); const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const page = await ctx.newPage();
await page.goto(URL + `&v=fp${Date.now()}`, { waitUntil: 'commit' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.length > 0, null, { timeout: 240000, polling: 500 });
await page.waitForTimeout(4000);
const pick = (re) => page.evaluate((re) => { const h = originsPreview.pos, ms = originsPreview.mobs().mobs.filter((m) => new RegExp(re, 'i').test(`${m.id} ${m.name}`)); ms.sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z)); const m = ms[0]; return m && { id: m.id, name: m.name, body: m.body, x: m.x, z: m.z }; }, re);
const out = {};
for (const [tag, re] of [['pit-goblin', 'pit.?goblin'], ['scavenger', 'scavenger']]) {
  const m = await pick(re); if (!m) { out[tag] = 'none'; continue; }
  await page.evaluate((p) => originsPreview.place(p.x, p.z + 6, Math.PI), m); await page.waitForTimeout(6000);
  out[tag] = { mob: m, fit: await page.evaluate(() => { const d = originsPreview.mobs(); return d.fit ?? null; }) };
}
console.log(JSON.stringify(out, null, 1)); await browser.close();
