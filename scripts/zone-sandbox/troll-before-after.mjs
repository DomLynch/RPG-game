// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: LO=<loadout id> node scripts/zone-sandbox/troll-before-after.mjs <outDir> "<url>" <tag>   // ready crop + mid-fight screen for one troll; run with &fit=0 for the "before"
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [OUT, URL, TAG] = process.argv.slice(2);   // TAG: before | after
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(URL + `&v=fr${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs.some((x) => x.body === 'cave-troll' && x.loadout), null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(3000);
const id = await page.evaluate((lo) => (originsPreview.mobs().mobs.find((x) => x.body === 'cave-troll' && x.loadout === lo) ?? originsPreview.mobs().mobs.find((x) => x.body === 'cave-troll')).id, process.env.LO ?? 'troll.pit.t4.cleaver');   // the cleaver troll showed best in the earlier crops
const crop = async (name) => { let at = null; for (let i = 0; i < 25 && !at; i++) { await page.waitForTimeout(1000); at = await page.evaluate((id) => originsPreview.mobScreen(id), id); }
  const w = 230, h = 300, x = Math.max(0, Math.min(375 - w, at.x - w / 2)), y = Math.max(0, Math.min(812 - h, at.y - h * 0.6)); await page.screenshot({ path: `${OUT}/fit-${TAG}-${name}.png`, clip: { x, y, width: w, height: h } }); };
// ready: hero 10 m off, the troll not yet engaged
await page.evaluate((id) => { const q = originsPreview.mobs().mobs.find((x) => x.id === id); originsPreview.pos.x = q.x; originsPreview.pos.z = q.z + 9; }, id);
await page.waitForFunction((id) => originsPreview.mobs().mobs.find((q) => q.id === id)?.model, id, { timeout: 30000, polling: 500 }).catch(() => {});
await page.waitForTimeout(3000); await crop('ready');
console.log('fit stats:', JSON.stringify(await page.evaluate(() => originsPreview.mobs().fit)));
// mid-fight: engage and swing, take the frame mid-exchange
await page.evaluate((id) => originsPreview.tapMob(id), id);   // too far to cut: it aggroes and walks up to him
await page.waitForTimeout(4500);
for (let i = 0; i < 5; i++) { await page.evaluate(() => originsPreview.press('heavy')); await page.waitForTimeout(300); }
await page.screenshot({ path: `${OUT}/fit-${TAG}-fight.png` });   // the whole screen, mid-exchange
await browser.close();
