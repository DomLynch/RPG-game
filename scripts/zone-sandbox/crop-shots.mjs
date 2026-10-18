// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: node scripts/zone-sandbox/crop-shots.mjs <outDir> "<url>" <body> <distanceM>   // a 3x crop around each creature of that body, from <distanceM> away
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [OUT, URL, BODY, DIST] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(URL + `&v=cs${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs.some((x) => x.loadout), null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(3000);
const list = await page.evaluate((b) => originsPreview.mobs().mobs.filter((m) => m.loadout && m.body === b).map((m) => ({ id: m.id, l: m.loadout })), BODY);
const out = [];
for (const m of list) {
  await page.evaluate(([id, d]) => { const q = originsPreview.mobs().mobs.find((x) => x.id === id); originsPreview.pos.x = q.x; originsPreview.pos.z = q.z + Number(d); }, [m.id, DIST ?? 11]);
  await page.waitForFunction((id) => originsPreview.mobs().mobs.find((q) => q.id === id)?.model, m.id, { timeout: 25000, polling: 500 }).catch(() => {});
  let at = null;
  for (let i = 0; i < 10 && !at; i++) { await page.waitForTimeout(1200); at = await page.evaluate((id) => originsPreview.mobScreen(id), m.id); }   // the camera swings round behind the hero first
  await page.waitForTimeout(1500); at = await page.evaluate((id) => originsPreview.mobScreen(id), m.id) ?? at;
  if (!at) { console.log(m.l, 'not on screen'); continue; }
  const w = 170, h = 220, x = Math.max(0, Math.min(375 - w, at.x - w / 2)), y = Math.max(0, Math.min(812 - h, at.y - h * 0.62));
  const file = `${OUT}/crop-${out.length}-${m.l}.png`; await page.screenshot({ path: file, clip: { x, y, width: w, height: h } }); out.push([m.l, file]);
}
console.log(out.map(([l]) => l).join(' | '));
await browser.close();
