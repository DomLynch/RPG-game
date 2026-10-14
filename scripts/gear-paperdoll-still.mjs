// Stills of the Pit's Gear tab (the paper-doll look: tier-tinted slot cards, the selected slot, the stat strip) with six pieces worn at different rungs, at 375x812 and 812x375.
// Serves this tree's build (run `npx vite build` first). PIT_GL=1 = the browser's own GL (the VPS). Out: artifacts/gear-paperdoll/.
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';

const dir = process.env.OUT || 'artifacts/gear-paperdoll'; await fs.mkdir(dir, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const worn = { head: 'veteran.Helmet', chest: 'nightborn.Body', arms: 'executioner.Arms', hands: 'goblin.Gloves', legs: 'pitborn.Greaves', feet: 'dwarf.Boots' };
const tiers = [2, 4, 6, 8, 9, 10], taken = Object.fromEntries(Object.values(worn).map((id, i) => [id, { opponent: id.split('.')[0], attempt: 1, healthLeft: 50, recordId: null, day: '2026-10-12', tier: tiers[i] }]));
const profile = { version: 1, id: 'gear-still', name: 'Wanderer', career: { victoryMarks: 7 }, loot: { owned: Object.values(worn), equipped: worn, taken } };
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args: process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const receipt = { views: {}, errors: [] };
try {
  for (const [name, W, H] of [['portrait', 375, 812], ['landscape', 812, 375]]) {
    const context = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });
    await context.addInitScript((p) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
    const page = await context.newPage(); page.setDefaultTimeout(60000); page.on('pageerror', (e) => receipt.errors.push(`${name}: ${e}`)); await page.route('**/*sentry.io/**', (r) => r.abort());
    await page.goto(`${origin}/`); await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '');
    if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).click();
    await page.waitForFunction(() => document.querySelector('#welcome').hidden);
    await page.locator('#journal-button').click(); await page.waitForTimeout(2500);
    await page.screenshot({ path: `${dir}/gear-${name}.png` });
    await page.locator('#slot-chest').click(); await page.waitForTimeout(1200);
    await page.screenshot({ path: `${dir}/gear-${name}-selected.png` });
    receipt.views[name] = await page.evaluate(() => ({ stats: [...document.querySelectorAll('#gear-stats > div')].map((d) => d.textContent), tints: [...document.querySelectorAll('#journal .doll .slot.on')].map((s) => s.id + ':' + s.style.getPropertyValue('--tier')) }));
    await context.close();
  }
  receipt.passed = receipt.errors.length === 0; console.log(JSON.stringify(receipt));
} finally { await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2)); await browser.close(); await server.close(); }
