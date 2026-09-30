// The Pit's door on the kill screen, as the player sees it (Lead's #1122 ask, the visual-PR rule): a WIN at 375×812 (Enter the Pit) and a
// LOSS (Recover), each after the settle and the 250 ms fade, with the joystick hidden; then a tap on the door, caught while it opens.
// endgame-hud-check proves the geometry; this is the look. Guest only, this tree's build (vite preview). The win is loot-smoke-check's
// goblin duel (quiet-one-browser-check.mjs fight(), goblin branch); the loss is endgame-hud-check's idle fighter.
//   node scripts/pit-door-stills.mjs        stills + receipt: artifacts/pit/door/
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { harnessClock } from './lib/harness-clock.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const outDir = 'artifacts/pit/build', out = 'artifacts/pit/door';
await fs.mkdir(out, { recursive: true });
await build({ logLevel: 'error', build: { outDir } });
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
// 5 marks = rank level 6, so the career fight is the rank's own level and claims (loot-smoke-check); a few owned pieces for the room.
const profile = { version: 1, id: 'pit-door-fighter-0001', name: 'Wanderer', career: { victoryMarks: 5 }, loot: { owned: ['knight.Helmet', 'goblin.Boots'], equipped: { head: 'knight.Helmet' } } };
const receipt = { origin, profile: 'seeded guest fighter, not Dom\'s device', engine: 'Chromium (Playwright), 375x812 touch', stills: [], doors: {}, errors: [] };
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });

async function fightTo(opponent, win) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript((p) => { if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => receipt.errors.push(`${opponent}: ${e.message}`));
  await page.route('**/*sentry.io/**', (r) => r.abort());
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
  // The kill screen once settled and the fade has finished (endgame-hud-check's deterministic sample).
  await until(() => !!JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null')?.settled, 8000);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('reset-button')).opacity === '1', null, { timeout: 5000 });
  await page.waitForFunction(() => { const d = document.getElementById('pit-button'); return !!d && !d.hidden && getComputedStyle(d).opacity === '1'; }, null, { timeout: 5000 });
  return page;
}

try {
  for (const [name, opponent, win] of [['win', 'goblin', true], ['loss', 'veteran', false]]) {
    const page = await fightTo(opponent, win);
    const door = await page.evaluate(() => {
      const d = document.getElementById('pit-button'), r = d.getBoundingClientRect();
      return { label: d.textContent.trim(), box: [r.x, r.y, r.width, r.height].map(Math.round), clipped: d.scrollWidth > d.clientWidth + 1, joystick: getComputedStyle(document.getElementById('joystick')).visibility };
    });
    receipt.doors[name] = door;
    const path = `${out}/door-${name}-375.png`; await page.screenshot({ path }); receipt.stills.push(path);
    // The tap, caught before the room covers it: the label while the chunk lands ("Opening the gate…" if it has not yet).
    await page.locator('#pit-button').tap();
    receipt.doors[name].afterTap = await page.evaluate(() => document.getElementById('pit-button')?.textContent.trim());
    const opened = `${out}/door-${name}-tapped-375.png`; await page.screenshot({ path: opened }); receipt.stills.push(opened);
    await page.context().close();
  }
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); server.httpServer.close();
}
for (const [name, door] of Object.entries(receipt.doors)) {
  assert.equal(door.joystick, 'hidden', `${name}: the joystick hides while the door shows`);
  assert.ok(!door.clipped, `${name}: the door's label is not clipped (${door.label})`);
}
assert.deepEqual(receipt.errors, [], 'no page errors');
console.log(`pit-door-stills PASS: ${JSON.stringify(receipt.doors)}; stills: ${receipt.stills.join(', ')}`);
