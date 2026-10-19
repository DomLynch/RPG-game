// A guest takes the Ferry Landing bow, wears it from Gear and fights (PR #3374's visual gate). Dev server on 5190. STEP=1 take + gear list; STEP=2 also wear + fight.
import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:5190/preview/origins/?region=1', OUT = process.env.OUT || 'artifacts/guest-wield', ID = process.env.ITEM || 'ground:zone1.bow-1';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
const log = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push(`${m.type()}: ${m.text().slice(0, 200)}`); }); page.on('pageerror', (e) => log.push(`pageerror: ${String(e).slice(0, 300)}`));
const shot = (n) => page.screenshot({ path: path.join(OUT, n) });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__zoneReady, null, { timeout: 150000 });
await page.waitForFunction((id) => window.originsPreview.ground.anchor(id) !== undefined, ID, { timeout: 120000 });
const at = await page.evaluate((id) => window.originsPreview.ground.anchor(id), ID); console.log('anchor', JSON.stringify(at));
const ax = at.x ?? at[0], az = at.z ?? at[1];
await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 1.0, 0), [ax, az]);
await page.waitForTimeout(3000);
console.log('prompt', JSON.stringify(await page.evaluate(() => { const p = document.getElementById('prompt'); return { hidden: p.hidden, text: p.textContent }; })));
await shot('1-near-bow.png');
const hit = await page.evaluate(() => { const r = document.getElementById('prompt').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.touchscreen.tap(hit.x, hit.y); await page.waitForTimeout(1500);
console.log('toast', await page.evaluate(() => document.getElementById('world-toast')?.textContent ?? null));
await shot('2-after-take.png');
await page.evaluate(() => { const b = document.querySelector('button[aria-label*="enu" i], #menu-btn, #menu, .menu-btn') || [...document.querySelectorAll('button')].find((x) => /☰|≡/.test(x.textContent || '')); if (b) b.click(); });
await page.waitForTimeout(800); await shot('3-menu.png');
const gearBtn = page.getByRole('button', { name: 'Gear', exact: true }).first();
console.log('gear visible', await gearBtn.isVisible().catch(() => false));
await gearBtn.click({ timeout: 8000 }).catch((e) => console.log('gear click failed', String(e).slice(0, 120)));
await page.waitForTimeout(2500); await shot('4-gear.png');
console.log('gear text', JSON.stringify(await page.evaluate(() => (document.body.innerText || '').split('\n').filter((l) => /bow|main hand|wear|owned|pack|rack|gear/i.test(l)).slice(0, 25))));
if (process.env.STEP === '2') {
  await page.locator('button[data-fit="starter.Bow"]').first().click({ timeout: 8000 }); await page.waitForTimeout(1500); await shot('5-bow-selected.png');
  console.log('after select', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => (b.textContent || '').trim().slice(0, 30)).filter(Boolean).slice(0, 30))));
  const wear = page.getByRole('button', { name: /wear|main hand|equip/i }).first();
  await wear.click({ timeout: 8000 }).catch((e) => console.log('wear click failed', String(e).slice(0, 160)));
  await page.waitForTimeout(2500); await shot('6-worn.png');
  console.log('main hand after', JSON.stringify(await page.evaluate(() => (document.body.innerText || '').split('\n').filter((l) => /main hand|longsword|bow|off hand/i.test(l)).slice(0, 12))));
  await page.getByText('CINDER FIELDS', { exact: false }).first().click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1500);
  const mobs = await page.evaluate(() => window.originsPreview.mobs().mobs.filter((m) => m.drawn).map((m) => ({ id: m.id, x: m.x, z: m.z })).slice(0, 12)); console.log('mobs', JSON.stringify(mobs.slice(0, 5)));
  const m = mobs.sort((a, b) => Math.hypot(a.x + 138, a.z + 52) - Math.hypot(b.x + 138, b.z + 52))[0];
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z + 2.6, Math.PI), [m.x, m.z]); await page.waitForTimeout(2500); await shot('7-near-creature.png');
  console.log('weapon', await page.evaluate(() => JSON.stringify(window.originsPreview.rigWeapon?.() ?? null)));
  const strike = page.getByText('STRIKE', { exact: true }).first();
  for (let i = 0; i < 4; i++) { await strike.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(500); if (i === 1) await shot('8-mid-fight.png'); }
  await page.waitForTimeout(700); await shot('9-fight-later.png');
}
console.log('buttons', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button,a,[role=button]')].map((b) => (b.textContent || '').trim().slice(0, 24)).filter(Boolean).slice(0, 60))));
console.log('log', JSON.stringify(log.slice(0, 10)));
await browser.close();
