// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: node scripts/zone-sandbox/loot-check.mjs <outDir> "<url>"   // fell three ranks via originsPreview.fell, walk onto the drops, print the outfit, reload, count console errors
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
import { launchBrowser } from '../lib/browser-launch.mjs';
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [OUT, URL] = process.argv.slice(2);
const browser = await launchBrowser(chromium, { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = []; let phase = 'load';
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${phase}] ${m.text().slice(0, 160)}`); });
page.on('pageerror', (e) => errors.push(`[${phase}] pageerror ${String(e).slice(0, 160)}`));
const outfit = () => page.evaluate(() => JSON.parse(localStorage.getItem('origins-preview.outfit.v1') ?? '{}'));
const show = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${v.id.split('.')[1]}@${v.tier}`])));
await page.goto(URL + `&v=lf${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs.some((x) => x.loadout) && originsPreview.pose().actor, null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(6000);
await page.evaluate(() => { localStorage.removeItem('origins-preview.outfit.v1'); localStorage.removeItem('origins-preview.found.v1'); });
const goblins = await page.evaluate(() => originsPreview.mobs().mobs.filter((m) => m.body === 'goblin' && m.loadout).map((m) => ({ id: m.id, l: m.loadout, x: m.x, z: m.z })));
const order = ['goblin.t7.longsword', 'goblin.t4.gladius', 'goblin.t6.warhammer'];   // Master, Veteran, Praetorian: three bodies, three rungs
let pos = null;
for (const l of order) {
  const g = goblins.find((x) => x.l === l); if (!g) { console.log('no goblin with', l, 'this load'); continue; }
  await page.evaluate((g) => { originsPreview.pos.x = g.x + 6; originsPreview.pos.z = g.z + 6; }, g);
  await page.waitForTimeout(1500);
  const before = JSON.stringify(await outfit());
  const now = await page.evaluate((id) => { const m = originsPreview.mobs().mobs.find((x) => x.id === id); return { x: m.x, z: m.z }; }, g.id);   // where it stands NOW (goblins wander)
  g.x = now.x; g.z = now.z;
  await page.evaluate((id) => originsPreview.fell(id), g.id);
  await page.waitForTimeout(5200);   // the drops appear 3.6 s after the fall
  const toast = await page.evaluate(() => (document.body.innerText.match(/drops everything:[^\n]*/) ?? [''])[0]);
  const pieces = toast ? toast.split(':')[1].split(',').length : 0;
  for (let a = 0; a < 5 && JSON.stringify(await outfit()) === before; a++) {
    const o = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]][a];
    await page.evaluate(([g, o]) => { originsPreview.pos.x = g.x + o[0]; originsPreview.pos.z = g.z + o[1]; }, [g, o]);
    await page.waitForTimeout(3000);
  }
  pos = { x: g.x, z: g.z };
  console.log(`${l}: ${pieces} pieces dropped; outfit now ${show(await outfit())}`);
}
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/final-dressed.png` });
const o1 = JSON.stringify(await outfit());
phase = 'reload';
await page.goto(URL + `&v=lf2${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview?.pose?.().actor, null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(5000);
await page.evaluate((p) => { originsPreview.pos.x = p.x; originsPreview.pos.z = p.z + 6; }, pos);
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/final-after-reload.png` });
console.log('outfit survived reload:', o1 === JSON.stringify(await outfit()));
console.log('console errors:', errors.length, JSON.stringify(errors));
await browser.close();
