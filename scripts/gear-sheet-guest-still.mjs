// The gear sheet with the GUEST account block showing (375x812, this tree's build): the block only un-hides when the build has Supabase env
// (src/account-entry.ts), which a local preview lacks, so it is shown by hand the way the live guest state reads. Checks the mannequin stays
// whole when the block pushes the stage down (gear-room refits when the stage box moves) and that Continue with Google reads (text vs plate).
//   node scripts/gear-sheet-guest-still.mjs  -> artifacts/gear-sheet/after-guest-block.png   (run `npm run build` first)
import { chromium } from 'playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const dir = process.env.GEAR_RECEIPT_DIR || 'artifacts/gear-sheet'; await fs.mkdir(dir, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const KIT = { head: 'shieldmaiden.Helmet', chest: 'shieldmaiden.Body', arms: 'shieldmaiden.Arms', hands: 'shieldmaiden.Gloves', legs: 'shieldmaiden.Greaves', feet: 'shieldmaiden.Boots', off: 'shieldmaiden.Shield' };
const loot = { owned: [...Object.values(KIT), 'veteran.Body'], equipped: KIT, pack: ['veteran.Body'], taken: { 'veteran.Body': { opponent: 'veteran', attempt: 1, healthLeft: 100, recordId: null, day: '2026-09-30', tier: 4 } } };
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
let passed = false;
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript((l) => { const k = 'frankendom.fighter.v1'; const p = JSON.parse(localStorage.getItem(k) || 'null') || { version: 1, id: 'guest-still-0001', name: 'Wanderer', career: { victoryMarks: 0 } }; p.loot = l; localStorage.setItem(k, JSON.stringify(p)); }, loot);
  const page = await ctx.newPage(); page.setDefaultTimeout(120000); await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.goto(origin + '/?opponent=goblin');
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
  await page.locator('#journal-button').tap(); await page.waitForSelector('#journal[open][data-gear="live"]'); await page.waitForTimeout(2000);
  const top0 = await page.evaluate(() => document.getElementById('gear-stage').getBoundingClientRect().top);
  await page.evaluate(() => { const a = document.getElementById('account'); a.hidden = false; document.getElementById('account-identity').textContent = 'Guest'; document.getElementById('account-status').textContent = 'Sign in to keep your fighter name, opponent and career marks across devices.'; document.getElementById('account-login').disabled = false; });
  await page.waitForTimeout(2000);
  const top1 = await page.evaluate(() => document.getElementById('gear-stage').getBoundingClientRect().top);
  assert.ok(top1 > top0 + 40, `the account block pushed the stage down (${top0} to ${top1})`);
  const btn = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('account-login')); return { color: s.color, bg: s.backgroundColor }; });
  const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const ratio = (Math.max(lum(btn.color), lum(btn.bg)) + .05) / (Math.min(lum(btn.color), lum(btn.bg)) + .05);
  assert.ok(ratio >= 4.5, `Continue with Google contrast ${ratio.toFixed(1)}:1 (${JSON.stringify(btn)})`);
  await page.screenshot({ path: `${dir}/after-guest-block.png` });
  passed = true;
} finally { console.log(JSON.stringify({ passed })); await browser.close(); server.httpServer.close(); }
