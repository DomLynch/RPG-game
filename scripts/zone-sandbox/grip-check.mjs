// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: node scripts/zone-sandbox/grip-check.mjs "<url>"   // where each creature's weapon sits against its hand bone (reads mobs().grips)
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
import { launchBrowser } from '../lib/harness-browser-launch.mjs';
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [URL] = process.argv.slice(2);
const browser = await launchBrowser(chromium, { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
await page.goto(URL + `&v=gp${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs.some((x) => x.loadout), null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(3000);
const ids = await page.evaluate(() => originsPreview.mobs().mobs.filter((m) => m.loadout).map((m) => ({ id: m.id, l: m.loadout })));
console.log('hero fist (hand to knuckle, m):', await page.evaluate(() => originsPreview.heroFist()));
for (const m of ids) {
  await page.evaluate((id) => { const q = originsPreview.mobs().mobs.find((x) => x.id === id); originsPreview.pos.x = q.x; originsPreview.pos.z = q.z + 8; }, m.id);
  await page.waitForFunction((id) => originsPreview.mobs().mobs.find((q) => q.id === id)?.model, m.id, { timeout: 25000, polling: 500 }).catch(() => {});
  await page.waitForTimeout(3500);
  const g = await page.evaluate((id) => originsPreview.mobs().grips.find((x) => id.endsWith(x.id)), m.id);
  console.log(m.l.padEnd(24), JSON.stringify(g));
}
await browser.close();
