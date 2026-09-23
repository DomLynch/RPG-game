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
import { preview } from 'vite';

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const url = new URL('/?opponent=goblin&debug=1', origin).href, dir = process.env.LOOT_RECEIPT_DIR || 'artifacts/loot-smoke';
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })).newPage();
page.setDefaultTimeout(15000);
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*sentry.io/**', route => route.abort());
const ledger = () => page.evaluate(() => JSON.parse(localStorage.getItem('frankendom.fighter.v1') || 'null')?.loot ?? null);
const receipt = { url, revision: null, steps: {}, errors, passed: false };
try {
  // The served revision: a deployed site's release.json; a local preview serves the SPA shell there, so it records this tree's HEAD.
  receipt.revision = await page.request.get(new URL('/release.json', origin).href).then(r => r.json()).catch(() => null)
    ?? (server ? { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 10000 }).trim(), source: 'local preview of this tree' } : null);
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
  for (let i = 0; i < 3 && (await page.locator('#difficulty').textContent()) !== 'Difficulty: easy'; i++) { await page.evaluate(() => document.querySelector('#difficulty').click()); await page.waitForTimeout(150); }
  await page.getByRole('button', { name: 'Enter the arena' }).tap();
  await page.waitForFunction(() => document.querySelector('#welcome').hidden);
  await page.waitForFunction(() => document.querySelector('#art-status').textContent === '' && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
  const { run, until } = await harnessClock(page); await run(200);

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

  // ---- the kill screen: panel opens on the finisher-complete latch; the first touch stops the tour (tiles are inert under the fade)
  await until(() => document.getElementById('loot-panel')?.getAttribute('data-on') === '1', 15000);
  await page.locator('canvas').tap({ position: { x: 190, y: 300 } });
  await until(() => !document.documentElement.classList.contains('endgame-fade'), 10000);
  await run(400);   // the 250 ms fade back plus the panel's 300 ms tap guard
  const tiles = await page.locator('#loot-panel-pieces li').evaluateAll(lis => lis.map(li => ({ id: li.dataset.loot, owned: li.dataset.owned === 'true', label: li.textContent.trim(), disabled: li.querySelector('button').disabled })));
  const knife = tiles.find(t => t.id === 'goblin.Knife');
  assert.ok(knife && !knife.disabled, `(1) the Goblin's knife is offered as a takeable tile — tiles: ${JSON.stringify(tiles)}`);
  receipt.steps.knifeOffered = { tiles };

  // ---- (2) tap is the take; Undo restores the ledger the take found
  const before = await ledger();
  await page.locator('#loot-panel-pieces li[data-loot="goblin.Knife"] button').tap();
  await run(200);
  const after = await ledger();
  assert.ok(after?.owned?.includes('goblin.Knife'), `(2) the tap took the knife — ledger ${JSON.stringify(after)}`);
  assert.equal(await page.locator('#loot-undo').isVisible(), true, 'Undo is offered after the take');
  await page.locator('#loot-undo').tap();
  await run(200);
  const undone = await ledger();
  assert.deepEqual(undone, before, '(2) Undo returns the ledger to exactly what the take found');
  await until(() => !!document.querySelector('#loot-panel-pieces li[data-loot="goblin.Knife"] button:not([disabled])'), 5000);   // the panel reopens, nothing taken
  receipt.steps.takeUndo = { before, after, undone };

  // ---- (3) Leave it, then a refresh: the declined kill is still in the guest profile
  await run(400);
  const declinedBefore = (await ledger())?.declined?.length ?? 0;
  await page.locator('#loot-decline').tap();
  await run(200);
  const declined = await ledger();
  assert.equal(declined?.declined?.length, declinedBefore + 1, `(3) Leave it records the declined kill — ledger ${JSON.stringify(declined)}`);
  const kill = declined.declined.at(-1);
  await page.reload();
  for (let i = 0; i < 450; i++) {   // boot is promise-driven and runs on real time; ≤ 90 s for the rigs
    if (await page.evaluate(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false').catch(() => false)) break;
    await new Promise(r => setTimeout(r, 200));
  }
  await run(500);
  const reloaded = await ledger();
  assert.ok(reloaded?.declined?.some(k => JSON.stringify(k) === JSON.stringify(kill)), `(3) the declined kill survives a refresh — before ${JSON.stringify(declined)}, after ${JSON.stringify(reloaded)}`);
  receipt.steps.declineSurvivesRefresh = { kill, reloaded };

  assert.deepEqual(errors, [], 'no page errors');
  receipt.passed = true;
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ passed: receipt.passed, revision: receipt.revision, steps: Object.keys(receipt.steps), errors }));
  await browser.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
