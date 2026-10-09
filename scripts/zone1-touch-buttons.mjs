// Taps the REAL Zone 1 touch buttons (iPhone WebKit emulation, 375 wide) and reports the hero's combat phase after each tap.
// Usage: node scripts/zone1-touch-buttons.mjs <page url> [out dir]   e.g. https://frankendom.com/zone1/
import fs from 'node:fs';
import { webkit, devices } from 'playwright';

const [url, out = ''] = process.argv.slice(2);
if (out) fs.mkdirSync(out, { recursive: true });
const browser = await webkit.launch();
try {
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e.stack ?? e).slice(0, 400)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 });
  await page.waitForTimeout(6000);
  const phase = () => page.evaluate(() => window.originsPreview.combat().hero.phase);
  const buttons = await page.evaluate(() => [...document.querySelectorAll('button[id$="-button"]')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.id, text: b.textContent.trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), vis: r.width > 0 && getComputedStyle(b).display !== 'none', disabled: b.disabled }; }));
  console.log(JSON.stringify(buttons));
  const ready = async () => { for (let i = 0; i < 120; i++) { if ((await phase()) === 'ready') return; await page.waitForTimeout(50); } };
  const sample = async (ms) => { const seen = []; for (let t = 0; t < ms; t += 25) { const p = await phase(); if (seen[seen.length - 1] !== p) seen.push(p); await page.waitForTimeout(25); } return seen.join('>'); };
  for (const b of buttons.filter((b) => b.vis && /^(attack|thrust|heavy|kick|skill|dodge|guard)-button$/.test(b.id))) {
    await ready(); await page.waitForTimeout(300);
    if (b.id === 'guard-button') {   // a held button: WebKit playwright has no touch hold, so a mouse press (pointerdown ... pointerup on the same button)
      await page.mouse.move(b.x, b.y); await page.mouse.down();
      console.log(b.id, b.text, 'held ->', await sample(500)); await page.mouse.up(); continue;
    }
    await page.touchscreen.tap(b.x, b.y);
    console.log(b.id, b.text, '->', await sample(1200));
  }
  if (out) await page.screenshot({ path: `${out}/after-taps.png` });
  console.log('errors:', errors.length, errors.slice(0, 2));
} finally { await browser.close(); }
