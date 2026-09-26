// The equip fallback is visible (Lead P1, 2026-09-26): a guest with the Nightborn's estoc equipped, the estoc's equip file routed to
// fail, a career fight. The rig falls back to the longsword (characters.ts armWarriors) and the page must SAY so in the banner
// ("Your estoc could not load; fighting with the longsword", match.ts equipNotice) — it used to be silent outside a replay — and
// the fight must still run on the longsword. Then the route is lifted and the page reloaded: nothing was unequipped, so the estoc
// is asked for again and drawn, with no line.
// Guest only, nothing sent anywhere. QA_URL points it at a deployed site; unset, it serves this tree's build (run `npm run build` first).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { preview } from 'vite';

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.EQUIP_FALLBACK_RECEIPT_DIR || 'artifacts/equip-fallback'; await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
page.setDefaultTimeout(90000);
const errors = [], estocFetches = []; page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*sentry.io/**', route => route.abort());
// Every line the banner shows, recorded as it appears: the fallback line clears itself after 6 s (main.ts), so a slow load could miss it.
await page.addInitScript(() => { window.__banners = []; document.addEventListener('DOMContentLoaded', () => { const b = document.querySelector('#replay-banner'); new MutationObserver(() => { if (!b.hidden && b.textContent) window.__banners.push(b.textContent); }).observe(b, { childList: true, characterData: true, subtree: true, attributes: true }); }); });
// The estoc's equip file only (vite names it assets/estoc-<hash>.glb): a .glb whose file name starts with "estoc".
const ESTOC = /\/estoc[^/]*\.glb$/;
let failEstoc = true;
await page.route(url => ESTOC.test(url.pathname), route => { estocFetches.push(failEstoc ? 'aborted' : 'served'); return failEstoc ? route.abort('failed') : route.continue(); });
const receipt = { origin, revision: null, failed: null, retried: null, errors, passed: false };
const ready = async () => {
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
};
const read = () => page.evaluate(() => {
  const banner = document.querySelector('#replay-banner'), d = document.querySelector('#debug');
  return { banner: banner.hidden ? null : banner.textContent, banners: window.__banners ?? [], clips: (d.dataset.clips ?? '').split(' ')[0],   // `role:clip@node` for the player, then the opponent tick: Number(d.dataset.tick ?? -1),
    equipped: JSON.parse(localStorage.getItem('frankendom.fighter.v1'))?.loot?.equipped ?? {} };
});
try {
  receipt.revision = await page.request.get(new URL('/release.json', origin).href).then(r => r.json()).catch(() => null);
  await page.goto(new URL('/?opponent=goblin&debug=1', origin).href); await ready();
  await page.evaluate(() => { const key = 'frankendom.fighter.v1'; const p = JSON.parse(localStorage.getItem(key)); p.loot = { owned: ['nightborn.Estoc'], equipped: { main: 'nightborn.Estoc' } }; localStorage.setItem(key, JSON.stringify(p)); });
  await page.reload(); await ready();
  const failed = await read();
  await page.locator('#attack-button').tap();   // draw: the fight is played, not just watched
  // The fight runs: 30 ticks pass after the first reading taken inside the page (a reading taken before the rearm's restart would be stale).
  await page.waitForFunction(() => { const t = Number(document.querySelector('#debug').dataset.tick); window.__from ??= t; if (t < window.__from) window.__from = t; return t > window.__from + 30; }, null, { timeout: 30000 })
    .catch(async (error) => { throw Error(`the fight did not run: ${JSON.stringify(await page.evaluate(() => ({ from: window.__from, tick: document.querySelector('#debug').dataset.tick, clock: document.querySelector('#debug').dataset.clock })))}`, { cause: error }); });
  await page.screenshot({ path: `${dir}/failed-375.png` });
  receipt.failed = { ...failed, fetches: [...estocFetches], ranTo: (await read()).tick };
  assert.ok(estocFetches.includes('aborted'), `the page asked for the estoc's equip file: ${JSON.stringify(estocFetches)}`);
  assert.ok(failed.banners.includes('Your estoc could not load; fighting with the longsword'), `the fallback is said, not silent: ${JSON.stringify(failed.banners)}`);
  assert.match(failed.clips, /@SwordDrawn$/, `the player's rig carries the longsword: ${failed.clips}`);
  assert.deepEqual(failed.equipped, { main: 'nightborn.Estoc' }, 'nothing was unequipped');
  // The next boot asks again: the file is served this time, and the estoc is drawn with no line.
  failEstoc = false; estocFetches.length = 0;
  await page.reload(); await ready();
  const retried = await read();
  receipt.retried = { ...retried, fetches: [...estocFetches] };
  assert.ok(estocFetches.includes('served'), `the next boot asked for the estoc again: ${JSON.stringify(estocFetches)}`);
  assert.ok(!retried.banners.some(b => /could not load/.test(b)), `no fallback line when the file loads: ${JSON.stringify(retried.banners)}`);
  assert.doesNotMatch(retried.clips, /@SwordDrawn$/, `the estoc is in hand: ${retried.clips}`);
  assert.deepEqual(errors, []);
  receipt.passed = true;
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(JSON.stringify({ passed: receipt.passed, revision: receipt.revision?.revision ?? null, failed: receipt.failed, retried: receipt.retried, errors }));
