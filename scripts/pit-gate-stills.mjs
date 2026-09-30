// D2's four stills (docs/pit-design.md §9, PR #1149): after a win at 375×812, (1) the kill screen idle with the door shown, (2) mid-walk with
// the door hidden, (3) held at the gate line with the door saying "Opening the gate…" (the Pit's chunk is slowed by a route so the hold is
// seen), (4) the arrival in the room after the fade. Guest only, this tree's build; the win is pit-door-stills' goblin duel.
//   node scripts/pit-gate-stills.mjs        stills + receipt: artifacts/pit/gate/
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { harnessClock } from './lib/harness-clock.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const outDir = 'artifacts/pit/build', out = 'artifacts/pit/gate';
await fs.mkdir(out, { recursive: true });
await build({ logLevel: 'error', build: { outDir } });
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
// 5 marks = rank level 6, so the career fight is the rank's own level and claims (loot-smoke-check); a few owned pieces for the room.
const profile = { version: 1, id: 'pit-door-fighter-0001', name: 'Wanderer', career: { victoryMarks: 5 }, loot: { owned: ['knight.Helmet', 'goblin.Boots'], equipped: { head: 'knight.Helmet' } } };
const receipt = { origin, profile: 'seeded guest fighter, not Dom\'s device', engine: 'Chromium (Playwright), 375x812 touch', stills: [], gate: {}, errors: [] };
const CHUNK_DELAY_MS = 9000;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });

async function fightTo(opponent, win) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript((p) => { if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => receipt.errors.push(`${opponent}: ${e.message}`));
  await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.route('**/assets/pit-*.js', async (r) => { await new Promise((d) => setTimeout(d, CHUNK_DELAY_MS)); await r.continue(); });   // the chunk lands late: he holds at the line
  await page.goto(`${origin}/?opponent=${opponent}&debug=1`);
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).tap();
  await page.waitForFunction(() => document.querySelector('#welcome').hidden);
  const { run, until } = await harnessClock(page); await run(200);
  if (!win) {   // stand still: the idle fighter dies (endgame-hud-check)
    await page.getByRole('button', { name: 'Fight', exact: true }).tap();
    assert.ok(await until(() => +document.querySelector('#player-health').value === 0, 6000 * 16.7), 'the idle fighter dies within budget');
  } else {
    let killed = false;
    for (let attempt = 1; attempt <= 3 && !killed; attempt++) {
      await page.keyboard.press('KeyF'); await run(16);   // sheathed, a strike is the draw
      await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 20000);
      let elapsed = 0;
      const step = async (ms) => { await run(ms); elapsed += ms; };
      const enabled = async (id) => (await page.locator('#' + id).getAttribute('aria-disabled')) === 'false';
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
          if (windup >= 0 && age < windup && distance < 2.6) {
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
      killed = await page.locator('#target-health').evaluate((e) => +e.value === 0);
      if (killed || attempt === 3) break;
      await until(() => !document.querySelector('#reset-button').hidden && !document.documentElement.classList.contains('endgame-fade'), 20000);
      await page.locator('#reset-button').tap();
      await until(() => document.querySelector('#target-health').value > 0 && document.querySelector('#player-health').value > 0 && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', 20000);
    }
    assert.ok(killed, 'the goblin duel must kill the Goblin: three duels fought, none killed');
  }
  // The kill screen once settled: the HUD fades in within a second (VPS probe 2026-09-30: reset and door at opacity 1 at settle + 1 s),
  // then the arena-cam tour fades it again at ~3 s until a touch. Page time runs on the harness clock, so the waits below are until(),
  // not waitForFunction (which never sees a transition advance while the clock stands).
  await until(() => !!JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null')?.settled, 8000);
  return page;
}

try {
  const page = await fightTo('goblin', true);
  const { run, until } = await harnessClock(page);
  const still = async (name) => { const path = `${out}/${name}-375.png`; await page.screenshot({ path }); receipt.stills.push(path); };
  const door = () => page.evaluate(() => { const d = document.getElementById('pit-button'); return { hidden: d.hidden, label: d.textContent.trim(), walking: document.documentElement.classList.contains('walking'), fade: document.documentElement.classList.contains('gate-fade'), pit: document.body.dataset.pit ?? null }; });
  // The loot offer, if the kill made one: Leave it, so the walk may start (main.ts: the walk waits for the offer's row to go).
  // The offer shows once the finisher has played; the walk waits for its row to go. Decline it (#loot-decline) if it comes within 6 s.
  const offered = await until(() => { const d = document.getElementById('loot-decline'); return !!d && !d.hidden && !document.getElementById('loot-panel-actions').hidden; }, 6000).then(() => true, () => false);   // until() resolves with the page time it was met at (0 when at once), so not its own truthiness
  receipt.gate.offer = offered;
  if (offered) { await page.locator('#loot-decline').tap(); await run(300); }   // the touch also stops the tour
  else { await page.locator('canvas').tap({ position: { x: 190, y: 300 } }); await run(300); }
  await until(() => document.documentElement.classList.contains('walking'), 12000);
  await until(() => getComputedStyle(document.getElementById('pit-button')).opacity === '1' && getComputedStyle(document.getElementById('reset-button')).opacity === '1', 5000);
  await run(400);
  receipt.gate.idle = await door(); await still('gate-1-idle');
  // Mid-walk: the stick (W, forward on the camera that now faces the gate) moves him; the door hides at once.
  await page.locator('#world').focus();
  await page.keyboard.down('KeyW'); await run(900);
  receipt.gate.walking = await door(); await still('gate-2-walking');
  // On to the line: the open starts, the chunk is late, he holds; after 3 s still the door returns saying it is opening.
  await until(() => document.getElementById('pit-button').textContent.trim() === 'Opening the gate…' || !!document.body.dataset.pit, 20000);
  await page.keyboard.up('KeyW');
  await until(() => !document.getElementById('pit-button').hidden || !!document.body.dataset.pit, 5000);
  receipt.gate.line = await door(); await still('gate-3-line');
  // The chunk lands, the fade, the room: he arrives walking.
  await until(() => document.body.dataset.pit === 'on', CHUNK_DELAY_MS + 5000);
  await run(1300);
  receipt.gate.arrival = await door(); await still('gate-4-arrival');
  await page.context().close();
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); server.httpServer.close();
}
const g = receipt.gate;
assert.equal(g.idle?.hidden, false, 'idle: the door shows'); assert.equal(g.idle?.label, 'Enter the Pit');
assert.equal(g.walking?.hidden, true, 'walking: the door hides');
assert.equal(g.line?.label, 'Opening the gate…', `at the line: ${JSON.stringify(g.line)}`);
assert.equal(g.arrival?.pit, 'on', 'arrived in the Pit');
assert.deepEqual(receipt.errors, [], 'no page errors');
console.log(`pit-gate-stills PASS: ${JSON.stringify(receipt.gate)}; stills: ${receipt.stills.join(', ')}`);
