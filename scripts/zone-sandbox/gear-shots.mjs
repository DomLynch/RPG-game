// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: node scripts/zone-sandbox/gear-shots.mjs <outDir> "<url>" <body: goblin|cave-troll>   // walks the hero up to each creature with a loadout and makes a contact sheet
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
// (old header) // Walk the hero up to several goblins (no fight started: no ?fight=) and take a close portrait still of each, to judge the armour finishes and weapons per loadout. Contact sheet of up to 8.
import { launchBrowser } from '../lib/harness-browser-launch.mjs';
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const OUT = process.argv[2], URL = process.argv[3], BODY = process.argv[4] ?? 'goblin';
const browser = await launchBrowser(chromium, { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(URL + `&v=gs${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview && originsPreview.mobs() && originsPreview.mobs().mobs.length > 8, null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(3000);
const list = await page.evaluate((b) => originsPreview.mobs().mobs.filter((m) => m.body === b).map((m) => ({ id: m.id, x: m.x, z: m.z, loadout: m.loadout ?? null })), BODY);
console.log(list.map((m) => `${m.id.slice(-12)}:${m.loadout}`).join(' | '));
const shots = [];
for (const m of list.slice(0, 8)) {
  await page.evaluate((m) => { originsPreview.pos.x = m.x + 1.6; originsPreview.pos.z = m.z + 4.2; }, m);
  await page.waitForFunction((id) => originsPreview.mobs().mobs.find((q) => q.id === id)?.model, m.id, { timeout: 60000, polling: 500 }).catch(() => {});
  await page.waitForTimeout(2600); shots.push([m.loadout, (await page.screenshot()).toString('base64')]);
}
const s = await ctx.newPage(); await s.setViewportSize({ width: 1600, height: 900 });
await s.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,400px)">${shots.map(([l, b]) => `<div style="position:relative"><img src="data:image/png;base64,${b}" style="width:400px;height:433px;object-fit:cover;object-position:50% 70%"><span style="position:absolute;left:4px;top:4px;color:#fff;font:13px sans-serif;background:#000a;padding:2px 5px">${l}</span></div>`).join('')}</body>`);
await s.waitForTimeout(600); await s.screenshot({ path: `${OUT}/gear-sheet.png` });
await browser.close();
