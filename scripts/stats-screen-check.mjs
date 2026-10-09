// The Stats screen and the top tab bar (Dom via Strategy 2026-10-01, GPT concept 04) at 375x812 and 390x844 touch: the three career tiles and the
// opponent cards read the REAL scorecard seeded below (4 fights / 2 wins / 2 losses; one opponent 1W·2L, one 1W·0L, the rest "Unfought"),
// the equipment row names the worn piece, "View gear" goes to Gear, the foot button says "Back to the arena" while the Pit door is shut and closes
// the sheet, Settings stays reachable, nothing scrolls sideways, every tap target is >= 44 px, the screen scrolls, and the sheet's text colours
/* global process, console, document, localStorage */
// keep 4.5:1 on its grounds. Stills: artifacts/stats-screen/. Guest only; serves this tree's build (run `npm run build` first).
import { chromium } from 'playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const dir = process.env.STATS_RECEIPT_DIR || 'artifacts/stats-screen'; await fs.mkdir(dir, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const profile = { version: 1, id: 'stats-fighter-0001', name: 'Wanderer', career: { victoryMarks: 7 }, loot: { owned: ['knight.Helmet', 'knight.Body'], equipped: { head: 'knight.Helmet', chest: 'knight.Body' } } };
const card = { version: 1, rows: { veteran: { fights: 3, wins: 1, losses: 2, left: 0, last: [] }, goblin: { fights: 1, wins: 1, losses: 0, left: 0, last: [] } } };
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const receipt = { origin, errors: [], screens: {}, contrast: {}, passed: false };
// WCAG contrast of the sheet's text tokens (style.css #journal: --jf, --jm, --jg2 and the dimmed Pit tab) on its two grounds
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const [name, fg] of Object.entries({ ink: '#e9e3d6', muted: '#9a9382', gold: '#e7cf93', dimmedPit: '#8a8474' })) for (const bg of ['#12100d', '#1d1913']) { const r = ratio(fg, bg); receipt.contrast[`${name} on ${bg}`] = Math.round(r * 100) / 100; assert.ok(r >= 4.5, `${name} on ${bg} is ${r.toFixed(2)}:1`); }
try {
  for (const [W, H] of [[375, 812], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await context.addInitScript(([p, c]) => { localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); localStorage.setItem('frankendom.scorecard.v1', JSON.stringify(c)); }, [profile, card]);
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
    await page.goto(`${origin}/`);
    await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '');
    if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).tap();
    await page.waitForFunction(() => document.querySelector('#welcome').hidden);
    await page.locator('#journal-button').tap(); await page.waitForTimeout(1500);
    // the tab bar sits under the header, two tabs, then Stats
    const bar = await page.evaluate(() => { const r = document.getElementById('app-nav').getBoundingClientRect(); return { top: r.top, h: r.height, labels: [...document.querySelectorAll('#app-nav button')].map((b) => b.textContent) }; });
    assert.deepEqual(bar.labels, ['Gear & pack', 'Arena']); assert.ok(bar.top > 80 && bar.top < 260, `tab bar under the header (${bar.top})`);
    await page.locator('#journal .tab-fighter').tap(); await page.waitForTimeout(500);
    const stats = await page.evaluate(() => ({
      tiles: ['stat-fights', 'stat-wins', 'stat-losses'].map((id) => document.getElementById(id).textContent),
      rows: [...document.querySelectorAll('#opponent-list li')].map((li) => [li.dataset.opponent, li.querySelector('span').textContent.replace(/\u00a0/g, ' ')]),
      gear: document.getElementById('stats-gear-name').textContent, ret: document.getElementById('stats-return').textContent,
    }));
    assert.deepEqual(stats.tiles, ['4', '2', '2']); assert.equal(stats.rows.length, 10);
    assert.deepEqual(stats.rows.find(([id]) => id === 'veteran'), ['veteran', '1 W · 2 L']); assert.deepEqual(stats.rows.find(([id]) => id === 'goblin'), ['goblin', '1 W · 0 L']);
    assert.equal(stats.rows.filter(([, t]) => t === 'Unfought').length, 8); assert.match(stats.gear, /knight/i); assert.equal(stats.ret, 'Back to the arena');
    // no sideways scroll, every tap target >= 44 px, the screen scrolls
    const geo = await page.evaluate(() => {
      const small = [...document.querySelectorAll('#journal .tab-strip label:not([hidden]):not(.tab-profile), #app-nav button, #stats-gear-view, #stats-return, #journal-name')].map((e) => [e.id || e.className || e.textContent, Math.round(e.getBoundingClientRect().height), Math.round(e.getBoundingClientRect().width)]).filter(([, h, w]) => h < 44 || w < 44);
      const j = document.getElementById('journal'); j.scrollTop = 99999; return { small, wide: [document.documentElement.scrollWidth, j.scrollWidth], scrolled: j.scrollTop, scrollable: j.scrollHeight > j.clientHeight };
    });
    assert.deepEqual(geo.small, [], 'tap targets >= 44 px'); assert.ok(geo.wide.every((w) => w <= W), `no sideways scroll ${geo.wide}`); assert.ok(geo.scrollable && geo.scrolled > 0, 'the Stats screen scrolls');
    await page.screenshot({ path: `${dir}/stats-${W}-scrolled.png` });
    await page.evaluate(() => { document.getElementById('journal').scrollTop = 0; }); await page.screenshot({ path: `${dir}/stats-${W}.png` });
    // View gear -> Gear; Settings reachable; Gear scrolls too
    await page.locator('#stats-gear-view').tap(); assert.equal(await page.evaluate(() => document.getElementById('journal-tab-profile').checked), true);
    await page.waitForTimeout(800); await page.screenshot({ path: `${dir}/gear-${W}.png` });
    const gearGeo = await page.evaluate(() => { const j = document.getElementById('journal'); j.scrollTop = 99999; return { wide: [document.documentElement.scrollWidth, j.scrollWidth], scrolled: j.scrollTop }; });
    assert.ok(gearGeo.wide.every((w) => w <= W) && gearGeo.scrolled > 0, `Gear scrolls and does not overflow ${JSON.stringify(gearGeo)}`);
    await page.locator('#journal .tab-settings').tap(); assert.equal(await page.evaluate(() => document.getElementById('journal-tab-settings').checked), true);
    // the foot button on Stats closes the sheet while the Pit is shut
    await page.locator('#journal .tab-fighter').tap(); await page.locator('#stats-return').tap(); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => document.getElementById('journal').open), false, 'Back to the arena closes the sheet');
    receipt.screens[`${W}x${H}`] = { stats, geo: { wide: geo.wide }, gearGeo };
    await context.close();
  }
  assert.deepEqual(receipt.errors, []); receipt.passed = true;
} finally { await browser.close(); server.httpServer.close(); await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2)); console.log(JSON.stringify({ passed: receipt.passed, errors: receipt.errors, screens: receipt.screens })); }
