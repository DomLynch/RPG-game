import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const out = process.argv[2], url = process.argv[3] || 'https://frankendom.com/zone/2/';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, recordVideo: { dir: out, size: { width: 375, height: 812 } } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(url, { waitUntil: 'load' });
  console.log('title:', await page.title());
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 }).catch(() => console.log('no __zoneReady'));
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 });
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => { const ms = window.originsPreview.mobs().mobs.filter((m) => /reach-wolves/.test(m.id)); return { n: ms.length, ids: ms.map((m) => [m.id, m.drawn, Math.round(m.x), Math.round(m.z)]), c: ms.reduce((a, m) => ({ x: a.x + m.x / ms.length, z: a.z + m.z / ms.length }), { x: 0, z: 0 }), all: window.originsPreview.mobs().mobs.length }; });
  console.log('wolves:', JSON.stringify(info));
  await page.screenshot({ path: path.join(out, '0-idle.png') });
  const spot = await page.evaluate(() => { const ms = window.originsPreview.mobs().mobs.filter((m) => /reach-wolves/.test(m.id)); let best = null; for (let x = -75; x <= -30; x += 1) for (let z = -135; z <= -85; z += 1) { if (!window.originsPreview.canStand(x, z)) continue; const n = ms.filter((m) => Math.hypot(m.x - x, m.z - z) <= 8).length; const far = Math.max(...ms.map((m) => Math.hypot(m.x - x, m.z - z))); if (!best || n > best.n || (n === best.n && far < best.far)) best = { x, z, n, far: Math.round(far) }; } return best; });
  console.log('spot:', JSON.stringify(spot));
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), [spot.x, spot.z]);
  const rows = [];
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => { const c = window.originsPreview.combat(); const card = document.querySelector('.mobcard, #foe, [data-card]'); return { hero: c.hero.health, hunting: c.fighters.filter((f) => f.hunting && f.id !== 'me').map((f) => f.id), tgt: c.target, card: [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && /Ember wolf/i.test(e.textContent || '')).map((e) => e.textContent).slice(0, 2) }; });
    rows.push(s);
    if (i === 3 || i === 7 || i === 12 || i === 20) await page.screenshot({ path: path.join(out, `t${i}.png`) });
  }
  console.log('rows:', JSON.stringify(rows.map((r) => [r.hero, r.hunting.length, r.tgt && r.tgt.name, r.card[0]])));
  const maxJoin = Math.max(...rows.map((r) => r.hunting.length)), hits = rows.reduce((n, r, i) => n + (i && r.hero < rows[i - 1].hero ? 1 : 0), 0);
  console.log('maxHunting:', maxJoin, 'heroDrops:', hits, 'errors:', errors.length, errors.slice(0, 2));
  await ctx.close();
} finally { await browser.close(); }
