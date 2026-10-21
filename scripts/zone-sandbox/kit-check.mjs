// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: node scripts/zone-sandbox/kit-check.mjs <outDir> "<url>" [body]   // every creature with a loadout: built or CAPSULE, plus the warnings
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
import { launchBrowser } from '../lib/browser-launch.mjs';
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [OUT, URL, BODY] = process.argv.slice(2);
const browser = await launchBrowser(chromium, { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const warns = []; page.on('console', (m) => { if (['warning', 'error'].includes(m.type()) && /did not|missing|Warrior/.test(m.text())) warns.push(m.text().slice(0, 140)); });
await page.goto(URL + `&v=kc${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs.some((x) => x.loadout), null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(3000);
const list = await page.evaluate((b) => originsPreview.mobs().mobs.filter((m) => m.loadout && (!b || m.body === b)).map((m) => ({ id: m.id, l: m.loadout, x: m.x, z: m.z })), BODY ?? '');
const shots = [], report = [];
for (const m of list) {
  await page.evaluate((m) => { const q = originsPreview.mobs().mobs.find((x) => x.id === m.id); originsPreview.pos.x = q.x + 2.2; originsPreview.pos.z = q.z + 7; }, m);
  await page.waitForFunction((id) => originsPreview.mobs().mobs.find((q) => q.id === id)?.model, m.id, { timeout: 25000, polling: 500 }).catch(() => {});
  await page.waitForTimeout(2500);
  const model = await page.evaluate((id) => !!originsPreview.mobs().mobs.find((q) => q.id === id)?.model, m.id);
  report.push(`${m.l}:${model ? 'built' : 'CAPSULE'}`);
  const png = await page.screenshot({ path: `${OUT}/kit-${shots.length}-${m.l}.png` });
  shots.push([m.l + (model ? '' : ' (capsule)'), png.toString('base64')]);
}
console.log(report.join(' | '));
console.log('warnings', warns.length, JSON.stringify([...new Set(warns)].slice(0, 4)));
const s = await ctx.newPage(); await s.setViewportSize({ width: 1600, height: 900 });
await s.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,400px)">${shots.map(([l, b]) => `<div style="position:relative"><img src="data:image/png;base64,${b}" style="width:400px;height:433px;object-fit:cover;object-position:50% 62%"><span style="position:absolute;left:4px;top:4px;color:#fff;font:13px sans-serif;background:#000a;padding:2px 5px">${l}</span></div>`).join('')}</body>`);
await s.waitForTimeout(600); await s.screenshot({ path: `${OUT}/kit-sheet.png` });
await browser.close();
