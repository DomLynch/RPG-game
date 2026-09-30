// The Profile tab's fighter image keeps its size (Dom's iPhone on 93b1a768, 2026-09-26: "the character image shrinks or changes size
// when I tap Store or add an item"). Cause: .doll-figure took height: 100% of the four slot rows, and a slot row grows when its Store
// button appears (a take) or a long piece name wraps, so the figure grew and shrank with the slot beside it (src/style.css .doll-figure).
// This reads the figure's box (getBoundingClientRect of .doll-figure img) at 375×812 across every state a tap can reach in the journal —
// worn with a long name (Store showing), Store tapped (slot empty, piece in the pack), Wear tapped from the pack (Store back), and a
// second piece worn on the other side — and asserts the box never changes by more than half a pixel. It also asserts the rows DID change
// (the slot's height differs between worn and empty), so a green here means the figure is decoupled, not that nothing moved.
// Guest only: a ledger is seeded straight into localStorage, nothing is sent anywhere. QA_URL points it at a deployed site; unset, it
// serves this tree's build (run `npm run build` first). Stills of the tab in each state are the receipt.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { preview } from 'vite';

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.FIGURE_RECEIPT_DIR || 'artifacts/profile-figure'; await fs.mkdir(dir, { recursive: true });
// veteran.Helmet reads "the Centurion's helmet": long enough to wrap in a 375 px slot card, the other lever on the row's height.
const SEED = { owned: ['veteran.Helmet', 'goblin.Body'], equipped: { head: 'veteran.Helmet' }, pack: ['goblin.Body'] };
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })).newPage();
page.setDefaultTimeout(90000);
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*sentry.io/**', route => route.abort());
const receipt = { origin, revision: null, states: {}, errors, passed: false };
const ready = async () => {
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
};
// The figure's box and the head slot's height, after layout settled (two frames).
const measure = async (name) => {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; };
    return { figure: box(document.querySelector('.doll-figure img')), headSlot: box(document.querySelector('#slot-head')).height, storeShown: !document.querySelector('#slot-head-off').hidden, headName: document.querySelector('#slot-head-name').textContent, packWear: document.querySelectorAll('#pack button[data-wear]').length };
  });
  await page.screenshot({ path: `${dir}/${name}.png` });
  receipt.states[name] = state;
  return state;
};
try {
  receipt.revision = await page.request.get(new URL('/release.json', origin).href).then(r => r.json()).catch(() => null);
  await page.goto(new URL('/?opponent=goblin', origin).href); await ready();
  await page.evaluate((loot) => { const key = 'frankendom.fighter.v1'; const p = JSON.parse(localStorage.getItem(key)); p.loot = loot; localStorage.setItem(key, JSON.stringify(p)); }, SEED);
  await page.reload(); await ready();
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('frankendom.fighter.v1')).loot);
  assert.deepEqual({ equipped: kept.equipped, pack: kept.pack }, { equipped: SEED.equipped, pack: SEED.pack }, 'the page kept the seeded ledger');
  await page.locator('#journal-button').tap();
  await page.waitForSelector('#journal[open]');
  await page.locator('#journal-tab-profile').check({ force: true }).catch(() => {});
  const worn = await measure('1-worn');
  assert.ok(worn.storeShown && worn.headName !== 'Empty', `worn state: the head slot shows the helmet and its Store button: ${JSON.stringify(worn)}`);
  await page.locator('#slot-head-off').tap();                       // Store: the helmet goes to the pack, the slot empties, Store hides
  const stored = await measure('2-stored');
  assert.equal(stored.headName, 'Empty', 'Store emptied the head slot');
  assert.ok(!stored.storeShown && stored.packWear === 2, `Store put the helmet in the pack: ${JSON.stringify(stored)}`);
  await page.locator('#pack li[data-loot="veteran.Helmet"] button[data-wear]').tap();   // Wear from the pack: the helmet is back on
  const reworn = await measure('3-reworn');
  assert.equal(reworn.headName, worn.headName, 'Wear put the helmet back');
  await page.locator('#pack li[data-loot="goblin.Body"] button[data-wear]').tap();       // a second piece on the other column
  const two = await measure('4-two-worn');
  assert.equal(two.packWear, 0, 'both pieces worn, the pack is empty');
  // The rows moved (the slot beside the figure is taller worn than empty), and the figure did not.
  assert.ok(Math.abs(worn.headSlot - stored.headSlot) > 4, `the head slot's height changes between worn and empty (${worn.headSlot} vs ${stored.headSlot}): the check exercises the lever`);
  for (const [name, s] of Object.entries(receipt.states)) {
    assert.ok(Math.abs(s.figure.width - worn.figure.width) <= .5 && Math.abs(s.figure.height - worn.figure.height) <= .5, `${name}: the figure keeps its box ${JSON.stringify(worn.figure)}, got ${JSON.stringify(s.figure)}`);
  }
  assert.deepEqual(errors, []);
  receipt.passed = true;
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(`profile-figure-check: figure ${JSON.stringify(receipt.states['1-worn']?.figure)} in ${Object.keys(receipt.states).length} states, receipts in ${dir}`);
