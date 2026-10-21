// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: node scripts/zone-sandbox/claw-check.mjs "<url>"   // per-bone skin counts and claw/hand-bone distances for a goblin and a troll (reads mobs().handMesh)
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
import { launchBrowser } from '../lib/browser-launch.mjs';
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [URL] = process.argv.slice(2);
const browser = await launchBrowser(chromium, { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
await page.goto(URL + `&v=hm${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs.some((x) => x.loadout), null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(3000);
const ids = await page.evaluate(() => originsPreview.mobs().mobs.filter((m) => m.loadout).map((m) => ({ id: m.id, l: m.loadout }))).then((l) => [l.find((x) => x.l.startsWith('goblin')), l.find((x) => x.l.startsWith('troll'))]);
for (const m of ids) {
  await page.evaluate((id) => { const q = originsPreview.mobs().mobs.find((x) => x.id === id); originsPreview.pos.x = q.x; originsPreview.pos.z = q.z + 8; }, m.id);
  await page.waitForFunction((id) => originsPreview.mobs().mobs.find((q) => q.id === id)?.model, m.id, { timeout: 25000, polling: 500 }).catch(() => {});
  await page.waitForTimeout(3500);
  console.log(m.l, JSON.stringify(await page.evaluate((id) => originsPreview.mobs().handMesh.find((x) => id.endsWith(x.id)), m.id)));
}
await browser.close();
