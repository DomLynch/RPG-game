// One-off: after a real Witch-fire cast on live, does the SKILL button stay unlit for the 15 s cooldown (RULES.skillCooldown 900 ticks)?
const REPO = '/Users/domininclynch/Developer/frankendom-char';
const { chromium } = await import(`${REPO}/node_modules/playwright/index.mjs`);
const { harnessClock } = await import(`${REPO}/scripts/lib/harness-clock.mjs`);
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await context.newPage(); page.setDefaultTimeout(20000);
await page.route('**/*sentry.io/**', r => r.abort());
const log = m => console.log(new Date().toISOString().slice(11, 19), m);
const ready = () => page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 150000 });
log('goto'); await page.goto('https://frankendom.com/?opponent=witch&debug=1', { waitUntil: 'domcontentloaded' }); await ready();
await page.evaluate(() => { const k = 'frankendom.fighter.v1', p = JSON.parse(localStorage.getItem(k)); p.loot = { owned: [], equipped: {}, skill: 'witchfire' }; localStorage.setItem(k, JSON.stringify(p)); });
log('reload'); await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
if (!await page.evaluate(() => document.querySelector('#welcome').hidden)) await page.getByRole('button', { name: 'Enter the arena' }).tap();
log('entered'); const { run, until } = await harnessClock(page);
await run(200); await page.keyboard.press('KeyF'); await run(900);
log('drawn'); await until(() => document.querySelector('#skill-button')?.getAttribute('aria-disabled') === 'false', 15000);
const sample = () => page.evaluate(() => ({ lit: document.querySelector('#skill-button').getAttribute('aria-disabled') === 'false', hidden: document.querySelector('#skill-button').hidden, you: document.querySelector('#debug').textContent.match(/you:[^\n]*\n\s*([a-z_]+)/)?.[1] ?? '', st: +(document.querySelector('#debug').textContent.match(/you: hp \d+ st (\d+)/)?.[1] ?? -1) }));
console.log('before', JSON.stringify(await sample()));
await page.locator('#skill-button').dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true, button: 0 });
await run(120); await page.locator('#skill-button').dispatchEvent('pointerup', { pointerId: 1, isPrimary: true, button: 0 });
for (let t = 250; t <= 4000; t += 250) { await run(250); console.log(`+${t}ms`, JSON.stringify(await sample())); }
await browser.close();
