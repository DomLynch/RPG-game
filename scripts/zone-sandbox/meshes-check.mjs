// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: node scripts/zone-sandbox/meshes-check.mjs "<url>"   // every mesh drawn under a goblin and a troll (reads mobs().meshesOf)
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
import { launchBrowser } from '../lib/browser-launch.mjs';
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [URL] = process.argv.slice(2);
const browser = await launchBrowser(chromium, { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
await page.goto(URL + `&v=dr${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs.some((x) => x.loadout), null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(3000);
for (const body of ['goblin', 'cave-troll']) {
  const id = await page.evaluate((b) => originsPreview.mobs().mobs.find((m) => m.body === b && m.loadout).id, body);
  await page.evaluate((id) => { const q = originsPreview.mobs().mobs.find((x) => x.id === id); originsPreview.pos.x = q.x; originsPreview.pos.z = q.z + 8; }, id);
  await page.waitForFunction((id) => originsPreview.mobs().mobs.find((q) => q.id === id)?.model, id, { timeout: 25000, polling: 500 }).catch(() => {});
  await page.waitForTimeout(4000);
  console.log(body, JSON.stringify(await page.evaluate((id) => originsPreview.mobs().meshesOf.find((x) => id.endsWith(x.id)), id)));
}
await browser.close();
