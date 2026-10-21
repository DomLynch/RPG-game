// Zone sandbox check (see scripts/zone-sandbox/README.md). Usage: node scripts/zone-sandbox/regen-hunted-check.mjs <outDir> "<url>"   // control (quiet heals) then a goblin hunting him (quiet timer stays 0, health never rises)
// Needs playwright resolvable from PW_ROOT (default: the current directory) and a Mac GPU: it launches chromium with --use-angle=metal.
import { launchBrowser } from '../lib/browser-launch.mjs';
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_ROOT ?? process.cwd()) + '/');
const { chromium } = require('playwright');
const [OUT, URL] = process.argv.slice(2);
const browser = await launchBrowser(chromium, { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
await page.goto(URL + `&v=rh${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs.some((x) => x.loadout) && originsPreview.pose().actor, null, { timeout: 150000, polling: 1000 });
await page.waitForTimeout(8000);
const read = () => page.evaluate(() => { const h = originsPreview.combat().hero, f = originsPreview.combat().fighters.filter((x) => x.id !== 'me'); return { hp: Math.round(h.health * 10) / 10, quiet: originsPreview.regenQuiet(), hunting: f.filter((x) => x.hunting).length, nearest: Math.round(f.map((x) => Math.hypot(x.x - originsPreview.pos.x, x.z - originsPreview.pos.z)).sort((a, b) => a - b)[0] ?? -1) }; });
// 1. quiet and hurt: it regenerates (the control)
await page.evaluate(() => originsPreview.hurt(60));
const quiet = [await read()]; for (let i = 0; i < 4; i++) { await page.waitForTimeout(3000); quiet.push(await read()); }
console.log('QUIET  :', quiet.map((r) => `hp ${r.hp} quiet ${r.quiet}s hunting ${r.hunting}`).join(' | '));
// 2. a goblin notices him: stand where it hunts him, never press an attack, sample every second
const g = await page.evaluate(() => { const m = originsPreview.mobs().mobs.find((x) => x.loadout?.startsWith('goblin')); originsPreview.pos.x = m.x + 3.5; originsPreview.pos.z = m.z; return m.id; });
await page.waitForTimeout(1200);
const hunted = []; let rose = 0, prev = (await read()).hp;
for (let i = 0; i < 14; i++) { await page.waitForTimeout(1000); const r = await read(); hunted.push(r); if (r.hp > prev + 0.05) rose++; prev = r.hp; if (r.hp <= 5) break; }
console.log('HUNTED :', hunted.map((r) => `hp ${r.hp} q ${r.quiet} hunt ${r.hunting} d ${r.nearest}`).join(' | '));
console.log('seconds where health ROSE while hunted:', rose, '| max quiet while hunted:', Math.max(...hunted.map((r) => r.quiet)));
await page.screenshot({ path: `${OUT}/regen-hunted.png` });
console.log('page errors', errors.length);
await browser.close();
