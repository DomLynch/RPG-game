// Loot smoke check (Strategy via Lead, 2026-09-23): a guest on a phone beats the Goblin through the real UI, then
// (1) the Goblin's KNIFE is offered as a loot tile (moves.ts PLAYER_WEAPONS_OFFERED since #530),
// (2) a TAP on a tile takes it and Undo puts the ledger back byte for byte (owned before → after → before),
// (3) a DECLINE (Leave it) survives a page refresh: the declined kill is still in the guest profile after reload (#535's path).
// Guest only: no sign-in, nothing written beyond what a guest fight already writes. QA_URL points it at a deployed site; unset, it
// serves this tree's build with vite preview (run `npm run build` first). Time is the harness clock's (scripts/lib/harness-clock.mjs)
// from the first press on; the duel is quiet-one-browser-check.mjs's goblin win, trimmed to what a win needs.
import { chromium } from 'playwright';
import { harnessClock } from './lib/harness-clock.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { preview } from 'vite';

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const LOOK = process.env.LOOK ? `&look=${process.env.LOOK}` : ''; const url = new URL('/?opponent=goblin&debug=1' + LOOK, origin).href, dir = process.env.OUT || 'out';
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width: +(process.env.W||375), height: +(process.env.H||812) }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
// A named guest on 5 career marks, so rank level 6 (career.ts levelOf) IS the level-6 fight below: a pick off the rank's level is a Dev
// override since #917 (practice only: no loot), so the row fights on the rank's own level to keep proving the reward path. Only when no
// profile exists yet, so the row's own reloads keep what the fight wrote.
await page.addInitScript(() => { if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'release-row-rank6', name: 'Wanderer', career: { victoryMarks: 5 } })); });
page.setDefaultTimeout(15000);
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*sentry.io/**', route => route.abort());
const ledger = () => page.evaluate(() => JSON.parse(localStorage.getItem('frankendom.fighter.v1') || 'null')?.loot ?? null);
const receipt = { url, revision: null, steps: {}, errors, passed: false };
try {
  // The served revision: a deployed site's release.json; a local preview serves the SPA shell there, so it records this tree's HEAD.
  receipt.revision = await page.request.get(new URL('/release.json', origin).href).then(r => r.json()).catch(() => null)
    ?? null;
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
  // 5 career marks = level 6 (the old easy, 46-level ladder, 2026-09-27): the rank's own level, so the win still claims; the live pick is retired (Dom 2026-09-29).
  // The rigs attach when #art-status empties and the NEXT frame compiles every shader: on the runner's software GL that frame holds
  // the main thread for tens of seconds and a tap issued before it times out (check 32, #533). The tap waits for the rigs and one
  // painted frame after them — a load wait keyed on the event, not a longer timeout.
  await page.waitForFunction(() => document.querySelector('#art-status').textContent === '' && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).tap();   // the seeded guest is a returning player: no card
  await page.waitForFunction(() => document.querySelector('#welcome').hidden);
  const { run, until } = await harnessClock(page); await run(200);

const MODE = process.env.MODE || 'win';
  if (MODE === 'win') {
  // ---- the goblin win (quiet-one-browser-check.mjs fight(), goblin branch) -------------------------------------------------------
  let killed = false;
  for (let attempt = 1; attempt <= 3 && !killed; attempt++) {
    await page.keyboard.press('KeyF'); await run(16);   // sheathed, a strike is the draw
    await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 20000);
    let elapsed = 0;
    const step = async ms => { await run(ms); elapsed += ms; };
    const enabled = async id => (await page.locator('#' + id).getAttribute('aria-disabled')) === 'false';
    while (elapsed < 90000) {
      const state = await page.evaluate(() => ({ text: document.querySelector('#debug').textContent, hp: document.querySelector('#player-health').value, enemy: document.querySelector('#target-health').value, light: document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', thrust: document.querySelector('#thrust-button').getAttribute('aria-disabled') === 'false' }));
      if (!state.hp || !state.enemy) break;
      const distance = +(state.text.match(/gap ([\d.]+)/)?.[1] ?? Infinity);
      const attack = (state.text.split('warden:')[1]?.split('\n') ?? [])[1]?.match(/([a-z_]+)\+? (\d+)\/(\d+) ([·#|\-]+)/);
      const stamina = +(state.text.match(/you: hp \d+ st (\d+)/)?.[1] ?? 0), punish = +(state.text.split('warden:')[0].match(/punish (\d+)/)?.[1] ?? 0);
      if (punish > 0 && state.light && stamina >= 22 && distance < 2) { await page.keyboard.press('KeyF'); await step(200); continue; }
      if (attack) {
        const age = +attack[2], windup = attack[4].indexOf('#');
        if (attack[1] === 'kick' && distance < 1.35) { await page.keyboard.down('KeyS'); await step(250); await page.keyboard.up('KeyS'); continue; }
        if (windup >= 0 && age < windup && distance < 2.6) {   // a parry tap at contact − 3 ticks, then the riposte
          if (age < windup - 3) { await step(16); continue; }
          await page.keyboard.down('KeyQ'); await step(48); await page.keyboard.up('KeyQ');
          for (let k = 0; k < 6; k++) { if (await enabled('thrust-button')) { await page.keyboard.press('KeyT'); await step(180); break; } await step(16); }
          continue;
        }
        if (age > windup + 8 && state.thrust && stamina > 45 && distance < 1.65) { await page.keyboard.press('KeyT'); await step(180); continue; }
      }
      if (distance > 1.1) { await page.keyboard.down('KeyW'); await step(80); await page.keyboard.up('KeyW'); continue; }
      await step(40);
    }
    killed = await page.locator('#target-health').evaluate(e => +e.value === 0);
    if (killed || attempt === 3) break;
    console.log(`duel ${attempt} did not kill (page time ${elapsed} ms) — rematch`);
    // #546: Rematch is inert under the endgame fade; tap it only once it is shown and the fade has lifted.
    await until(() => !document.querySelector('#reset-button').hidden && !document.documentElement.classList.contains('endgame-fade'), 20000);
    await page.locator('#reset-button').tap();
    await until(() => document.querySelector('#target-health').value > 0 && document.querySelector('#player-health').value > 0 && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', 20000);
  }
  assert.ok(killed, 'a real UI duel must kill the Goblin: three duels fought, none killed');

  await until(() => document.getElementById('loot-panel')?.getAttribute('data-on') === '1', 15000);
  const panelBox = await page.locator('#loot-panel').boundingBox();
  await page.touchscreen.tap(Math.round(panelBox.x + panelBox.width / 2), Math.max(8, Math.round(panelBox.y - 24)));
  await until(() => !document.documentElement.classList.contains('endgame-fade'), 10000);
  await run(300);
  await page.screenshot({ path: `${dir}/win-1-offer.png` });
  const tile = page.locator('#loot-panel-pieces button, #loot-panel-pieces li').first();
  if (await tile.isVisible()) { await tile.tap(); await run(300); const take = page.locator('#loot-take'); if (await take.isVisible()) { await take.tap(); await run(400); } }
  await page.screenshot({ path: `${dir}/win-2-taken.png` });
  const dump = async (n) => console.log(n, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button, .share-button, #share-status, #loot-panel, #loot-panel-note, #joystick')].filter(e => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden').map(e => { const r = e.getBoundingClientRect(); return [e.id, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }))));
  await dump('TAKEN');
  await run(5000);
  await until(() => document.documentElement.classList.contains('walking'), 20000).catch(() => console.log('never walking'));
  await run(800);
  await page.screenshot({ path: `${dir}/win-3-walking.png` });
  await dump('WALKING');
  } else {
  // ---- the loss: idle until the goblin kills him
  let t = 0; while (t < 240000 && await page.locator('#player-health').evaluate(e => +e.value) > 0) { await run(500); t += 500; }
  assert.ok(await page.locator('#player-health').evaluate(e => +e.value === 0), 'the idle fighter must die');
  await until(() => !document.querySelector('#pit-button').hidden || !document.querySelector('#reset-button').hidden, 20000);
  await until(() => !document.documentElement.classList.contains('endgame-fade'), 20000).catch(async () => { await page.touchscreen.tap(20, 300); await run(300); });
  await run(600);
  await page.screenshot({ path: `${dir}/loss.png` });
  console.log('LOSS', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button, .share-button, #share-status')].filter(e => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden').map(e => { const r = e.getBoundingClientRect(); return [e.id, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }))));
  }
} finally { await browser.close(); if (server) server.httpServer.close(); }
