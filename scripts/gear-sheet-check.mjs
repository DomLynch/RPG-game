// The gear sheet (Fitting rail, 2026-10-01) in the built game at 375x812 touch, on a guest ledger seeded straight into localStorage (nothing is
// sent anywhere). Checks: the sheet opens on Gear with the live mannequin up; the rail's tiles and the stored rows are >= 44 px and nothing
// but the stage covers the mannequin; trying a stored piece on dresses the rig IN MEMORY (the stored profile is unchanged) and Cancel puts it
// back; Wear this swaps through the pack (the replaced piece takes the pack place); a worn slot's Store moves it into the pack; the empty
// pack says where gear comes from; closing the sheet mid-try reverts. Stills of each state are the receipt (artifacts/gear-sheet).
// QA_URL points it at a deployed site; unset, it serves this tree's build (run `npm run build` first).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { preview } from 'vite';

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.GEAR_RECEIPT_DIR || 'artifacts/gear-sheet'; await fs.mkdir(dir, { recursive: true });
const day = '2026-09-30', taken = (opponent, tier) => ({ opponent, attempt: 1, healthLeft: 100, recordId: null, day, tier });
const KIT = { head: 'shieldmaiden.Helmet', chest: 'shieldmaiden.Body', arms: 'shieldmaiden.Arms', hands: 'shieldmaiden.Gloves', legs: 'shieldmaiden.Greaves', feet: 'shieldmaiden.Boots', off: 'shieldmaiden.Shield' };
const STORED = { owned: [...Object.values(KIT), 'veteran.Body', 'knight.Helmet'], equipped: KIT, pack: ['veteran.Body'], taken: { 'veteran.Body': taken('veteran', 4), 'shieldmaiden.Body': taken('shieldmaiden', 3) } };
const EMPTY = { owned: Object.values(KIT), equipped: KIT, pack: [] };
// A Mac's headless Chromium needs the GPU flags or the software renderer blocks the main thread (the live game never boots); the VPS runs SwiftShader (PIT_GL).
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const receipt = { origin, revision: null, errors: [], states: {}, passed: false };
const open = async (loot, query = '') => {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  page.setDefaultTimeout(180000); page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.goto(new URL(`/?opponent=goblin${query}`, origin).href);
  const ready = () => page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
  await ready();
  await page.evaluate((l) => { const k = 'frankendom.fighter.v1', p = JSON.parse(localStorage.getItem(k)); p.loot = l; localStorage.setItem(k, JSON.stringify(p)); }, loot);
  await page.reload(); await ready();
  await page.locator('#journal-button').tap(); await page.waitForSelector('#journal[open][data-gear="live"]');
  await page.waitForTimeout(2500);   // the rig dresses and a few frames draw
  return page;
};
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('frankendom.fighter.v1')).loot);
const stage = (page, name) => (console.log('still', name), page.screenshot({ path: `${dir}/${name}.png` }));
// The mean colour of the mannequin's chest (a box in the stage, decoded in the page from a screenshot): the dressed piece changes it, a
// frame of idle breathing does not.
let decoder;
const chest = async (page) => {
  const png = (await page.screenshot({ clip: { x: 120, y: 250, width: 70, height: 90 } })).toString('base64');
  decoder ??= await browser.newPage();   // a blank page: the game's CSP refuses data: fetches
  return decoder.evaluate(async (b64) => { const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob()), c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, img.width, img.height).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return [r / n, g / n, b / n]; }, png);
};
const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
try {
  receipt.revision = await fetch(new URL('/release.json', origin)).then((r) => r.json()).catch(() => null);
  let page = await open(STORED);
  await stage(page, '1-rest');
  const geo = await page.evaluate(() => {
    const box = (e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }; };
    const doll = document.querySelector('#journal .doll'), r = doll.getBoundingClientRect(), mid = document.elementFromPoint(r.x + (r.width - 68) / 2, r.y + r.height / 2);
    return { tabs: document.querySelector('.tab-profile').textContent, stage: box(doll), tiles: [...document.querySelectorAll('#journal .doll .slot:not([hidden])')].map(box), rows: [...document.querySelectorAll('#journal .pack li')].map(box), centre: mid?.className || mid?.tagName, scrollW: document.querySelector('#journal').scrollWidth, crest: !!document.querySelector('#slot-crest:not([hidden])') };
  });
  receipt.states.rest = geo;
  assert.equal(geo.tabs, 'Gear'); assert.ok(!geo.crest, 'no crest worn: no crest tile');
  assert.ok(geo.tiles.every((t) => t.w >= 44 && t.h >= 44), `rail tiles >= 44: ${JSON.stringify(geo.tiles)}`);
  assert.ok(geo.rows.every((r) => r.h >= 44), 'stored rows >= 44');
  assert.match(geo.centre, /doll/, `nothing covers the mannequin: ${geo.centre}`);
  assert.equal(geo.scrollW, 375, 'no sideways scroll');
  await page.locator('#pack li[data-loot="veteran.Body"] button').tap(); await page.waitForTimeout(1500);
  await stage(page, '2-trying-on');
  assert.equal(await page.locator('#fitting').isVisible(), true); assert.match(await page.locator('#fitting-rank').textContent(), /replaces .*body/i);
  assert.deepEqual((await stored(page)).equipped, KIT, 'trying on changes nothing in the profile');
  await page.locator('#fitting-cancel').tap(); await page.waitForTimeout(1200);
  assert.equal(await page.locator('#fitting').isVisible(), false);
  await stage(page, '3-cancelled');
  await page.locator('#pack li[data-loot="veteran.Body"] button').tap(); await page.waitForTimeout(800);
  await page.locator('#fitting-wear').tap(); await page.waitForTimeout(1200);
  const swapped = await stored(page);
  assert.equal(swapped.equipped.chest, 'veteran.Body'); assert.deepEqual(swapped.pack, ['shieldmaiden.Body'], 'the replaced piece took the pack place');
  await stage(page, '4-worn-after-swap');
  await page.locator('#slot-head').tap(); await page.waitForTimeout(400); await stage(page, '5-worn-slot-selected');
  assert.equal(await page.locator('#fitting-store').isVisible(), true);
  await page.locator('#fitting-store').tap();
  const stowed = await stored(page); assert.equal(stowed.equipped.head, undefined); assert.deepEqual(stowed.pack, ['shieldmaiden.Body', 'shieldmaiden.Helmet']);
  await page.locator('#slot-chest').tap(); await page.waitForTimeout(300);
  assert.equal(await page.locator('#fitting-store').isDisabled(), true, 'a full pack disables Store'); assert.match(await page.locator('#fitting-note').textContent(), /Pack full/);
  await stage(page, '6-pack-full');
  // closing the sheet mid-try reverts the rig and keeps the profile
  await page.locator('#pack li[data-loot="shieldmaiden.Helmet"] button').tap(); await page.waitForTimeout(500);
  await page.locator('#close-journal').tap(); await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => document.querySelector('#journal').dataset.gear ?? null), null, 'the live stage is left on close');
  assert.deepEqual((await stored(page)).equipped.head, undefined, 'closing mid-try wears nothing');
  await page.context().close();
  // the rig itself: the preview dresses it, Cancel and closing undress it (the chest's mean colour, off the same fixed camera)
  page = await open(STORED);
  const rest = await chest(page);
  await page.locator('#pack li[data-loot="veteran.Body"] button').tap(); await page.waitForTimeout(1500);
  const tried = await chest(page);
  await page.locator('#fitting-cancel').tap(); await page.waitForTimeout(1500);
  const back = await chest(page);
  await page.locator('#pack li[data-loot="veteran.Body"] button').tap(); await page.waitForTimeout(800); await page.locator('#close-journal').tap(); await page.waitForTimeout(800);
  await page.locator('#journal-button').tap(); await page.waitForTimeout(1800);
  const reopened = await chest(page);
  receipt.states.chestColour = { rest, tried, back, reopened, restVsTried: far(rest, tried), restVsBack: far(rest, back), restVsReopened: far(rest, reopened) };
  assert.ok(far(rest, tried) > 25, `trying on dresses the rig with the stored chest: ${JSON.stringify(receipt.states.chestColour)}`);
  assert.ok(far(rest, back) < 12 && far(rest, reopened) < 12, `Cancel and closing mid-try dress the rig back: ${JSON.stringify(receipt.states.chestColour)}`);
  await page.context().close();
  page = await open(EMPTY); await stage(page, '7-empty-pack');
  assert.match(await page.locator('#pack').textContent(), /Nothing stored/);
  assert.equal(await page.locator('#pack li.pack-locked').count(), 3, 'three locked pack rows');
  await page.context().close();
  receipt.passed = true;
} catch (error) { receipt.errors.push(String(error)); process.exitCode = 1; }
finally { await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 1)); console.log(JSON.stringify({ passed: receipt.passed, errors: receipt.errors })); await browser.close(); server?.httpServer.close(); }
