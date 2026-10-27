// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: node scripts/zone-sandbox/drop-look.mjs <outDir> "<url>" <loadout id>   // fell one creature, list which drop models are drawn, still of the drops
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
import { launchBrowser } from '../lib/harness-browser-launch.mjs';
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [OUT, URL, LOADOUT] = process.argv.slice(2);
const browser = await launchBrowser(chromium, { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const warns = []; page.on('console', (m) => { if (['warning', 'error'].includes(m.type()) && !/404|Clock/.test(m.text())) warns.push(m.text().slice(0, 160)); });
await page.goto(URL + `&v=dl${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs.some((x) => x.loadout), null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(3000);
const g = await page.evaluate((l) => { const m = originsPreview.mobs().mobs.find((x) => x.loadout === l) ?? originsPreview.mobs().mobs.find((x) => x.loadout); originsPreview.pos.x = m.x + 3; originsPreview.pos.z = m.z + 5; return { id: m.id, l: m.loadout }; }, LOADOUT);
await page.waitForTimeout(6000);
const at = await page.evaluate((id) => { const m = originsPreview.mobs().mobs.find((x) => x.id === id); return { x: m.x, z: m.z }; }, g.id);
await page.evaluate((id) => originsPreview.fell(id), g.id);
await page.waitForTimeout(6500);   // the drops appear 3.6 s after the fall
await page.evaluate((a) => { originsPreview.pos.x = a.x + 2.2; originsPreview.pos.z = a.z + 4.5; }, at);   // not on top of them: they stay lying
await page.waitForTimeout(6000);
const lying = await page.evaluate(() => { const out = []; for (let i = 1; i <= 12; i++) { const a = originsPreview.ground.anchor(`drop:${i}`); if (a) out.push(i); } return out; });
console.log('drawn lying models (drop ids):', JSON.stringify(lying), '| found', await page.evaluate(() => JSON.parse(localStorage.getItem('origins-preview.found.v1') ?? '[]').map((f) => f.piece).join(',')));
await page.screenshot({ path: `${OUT}/drops-lying.png` });
console.log('fell', g.l, 'warnings', JSON.stringify([...new Set(warns)].slice(0, 5)));
await browser.close();
