// The stance setting lives in the burger menu now (Dom 2026-10-19: "keep stances, but NOT on the fight screen"). Real page, real arena boot: there is NO #stance-panel on the fight screen, ready or mid-fight, and the menu's Gear tab
// holds #stance-menu with four buttons labelled Balanced / Aggressive / Defensive / Trickster (the fourth's id stays neutral). A pick sticks (aria-pressed, the fighter card names it) without restarting the fight, the buttons are
// disabled mid-fight with the hint "Locked in a fight" and open again before Fight; ?stances=off (the kill switch) hides the menu setting.
import { chromium } from 'playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const base = new URL(process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`);
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { url: base.href, cases: [], errors: [] };
const menuState = (page) => page.evaluate(() => {
  const menu = document.querySelector('#stance-menu');
  return { fightPanel: !!document.querySelector('#stance-panel'), menu: !!menu && !menu.hidden, buttons: [...document.querySelectorAll('#stance-menu [data-stance]')].map((b) => `${b.dataset.stance}=${b.getAttribute('aria-label')}`), disabled: [...document.querySelectorAll('#stance-menu [data-stance]')].map((b) => b.disabled), pressed: [...document.querySelectorAll('#stance-menu [data-stance]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.stance), hint: document.querySelector('#stance-menu .stance-hint')?.textContent ?? '', card: document.querySelector('#journal-stance')?.textContent ?? '' };
});
const openGear = async (page) => { await page.locator('#journal-button').tap(); await page.waitForTimeout(1000); await page.locator('#journal #nav-gear').click(); await page.waitForTimeout(600); };
try {
  for (const [search, expectMenu] of [['', true], ['?stances=off', false]]) {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
    await page.goto(base.href + search);
    const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap({ timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#art-status').textContent === '' && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 240000 });
    const before = await menuState(page);
    assert.equal(before.fightPanel, false, `${search || '(no flag)'}: no stance panel on the fight screen before the fight`);
    assert.equal(before.menu, expectMenu, `${search || '(no flag)'}: the menu setting`);
    const c = { search, expectMenu, before };
    if (expectMenu) {
      assert.deepEqual(before.buttons, ['neutral=Balanced', 'aggressive=Aggressive', 'defensive=Defensive', 'trickster=Trickster'], 'the four stance buttons, the fourth shown as Balanced');
      assert.ok(before.disabled.every((d) => !d), 'open before Fight is tapped');
      await openGear(page); await page.locator('#stance-menu [data-stance=aggressive]').tap(); c.picked = await menuState(page);
      assert.deepEqual(c.picked.pressed, ['aggressive']); assert.match(c.picked.card, /Aggressive/, 'the fighter card names the stance');
      await page.evaluate(() => document.getElementById('journal').close()); await page.waitForTimeout(500);
    }
    await page.getByRole('button', { name: 'Fight', exact: true }).tap(); await page.waitForTimeout(1500);
    c.after = await menuState(page);
    assert.equal(c.after.fightPanel, false, `${search || '(no flag)'}: no stance panel mid-fight`);
    if (expectMenu) { assert.ok(c.after.disabled.every(Boolean), 'locked mid-fight'); assert.equal(c.after.hint, 'Locked in a fight'); }
    receipt.cases.push(c);
    await page.close();
  }
  assert.deepEqual(receipt.errors, [], 'no page errors');
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); await server?.close(); }
