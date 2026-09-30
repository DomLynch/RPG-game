// Leaving the Pit for the next fighter: no black frame (Dom's phone test 2026-09-30: "about 2 s of full black"). After a won career
// fight at 375×812 touch: the walk through the gate, the room, the gate's sheet, its Next button. The press reloads the page for the next
// rung; from the press, on the REAL clock, every frame the page shows for 12 s is kept and its mean luminance read in a helper page.
// The row (WebKit, the nearest this Mac has to the phone's Safari; screenshots as fast as the page gives them): no frame under the black
// floor from the press until the fight is ready, the gate's light seen across the reload, the light down again afterwards, the fight ready.
// On trunk before gate-light.ts the new document's first frame measured 1 of 255.
//   node scripts/pit-exit-check.mjs                      the row
//   PIT_EXIT_ENGINE=chromium PIT_EXIT_CPU=4 PIT_EXIT_NET=4g PIT_EXIT_ASSERT=0 node scripts/pit-exit-check.mjs
//        measure only: Chromium's screencast, CPU throttled 4×, "Fast 4G" (9 Mbit/s, 170 ms) for the fresh page's requests
//   PIT_EXIT_PREFETCH=off   the next rung's files are not fetched from the Pit (the before figure); PIT_EXIT_FRAMES=1 keeps the frames
// receipt: artifacts/pit/exit/receipt.json. Guest only, this tree's build; the win is pit-gate-stills' goblin duel.
import { chromium, webkit } from 'playwright';
import { build, preview } from 'vite';
import { harnessClock } from './lib/harness-clock.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const outDir = 'artifacts/pit/build', out = 'artifacts/pit/exit';
await fs.mkdir(out, { recursive: true });
await build({ logLevel: 'error', build: { outDir } });
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
// 5 marks = rank level 6, so the career fight is the rank's own level and claims (loot-smoke-check); a few owned pieces for the room.
const profile = { version: 1, id: 'pit-door-fighter-0001', name: 'Wanderer', career: { victoryMarks: 5 }, loot: { owned: ['knight.Helmet', 'goblin.Boots'], equipped: { head: 'knight.Helmet' } } };
const receipt = { origin, profile: 'seeded guest fighter, not Dom\'s device', engine: 'Chromium (Playwright), 375x812 touch', exit: {}, errors: [] };
const ENGINE = process.env.PIT_EXIT_ENGINE === 'chromium' ? 'chromium' : 'webkit';
const browser = ENGINE === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true, executablePath: chromium.executablePath() });

async function fightTo(opponent, win) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript((p) => { if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => receipt.errors.push(`${opponent}: ${e.message}`));
  await page.route('**/*sentry.io/**', (r) => r.abort());
  // PIT_EXIT_PREFETCH=off (the before figure): a .glb asked for while the Pit shows is the prefetch; refuse it, so the fresh page fetches cold.
  if (!PREFETCH) await page.route('**/*.glb', async (r) => { if (await page.evaluate(() => document.body.dataset.pit === 'on').catch(() => false)) await r.abort(); else await r.fallback(); });
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

const WINDOW = 12000, FLOOR = 12, LIGHT = 120;   // LIGHT: a frame this bright after the press is the gate's light (#d9b37a reads ~180)
const ASSERT = process.env.PIT_EXIT_ASSERT !== '0', PREFETCH = process.env.PIT_EXIT_PREFETCH !== 'off';   // mean luminance (0..255) under which a frame reads as black
try {
  const page = await fightTo('goblin', true);
  const { run, until } = await harnessClock(page);
  const offered = await until(() => { const d = document.getElementById('loot-decline'); return !!d && !d.hidden && !document.getElementById('loot-panel-actions').hidden; }, 6000).then(() => true, () => false);
  if (offered) { await page.locator('#loot-decline').tap(); await run(300); }
  else { await page.locator('canvas').tap({ position: { x: 190, y: 300 } }); await run(300); }
  await until(() => document.documentElement.classList.contains('walking'), 12000);
  await page.locator('#world').focus();
  await page.keyboard.down('KeyW');
  await until(() => document.body.dataset.pit === 'on', 40000);
  // In the room: on toward the gate until its sheet offers the way out.
  await until(() => !!document.querySelector('#pit-ui .pit-go') && !document.getElementById('pit-ui').hidden, 30000);
  await page.keyboard.up('KeyW'); await run(600);
  receipt.exit.button = await page.locator('#pit-ui .pit-go').textContent();
  // Real time from here: the press, the fresh page (a win's Next reloads: the next fighter is another rig), its first arena frame.
  await page.clock.resume();
  const cpu = Number(process.env.PIT_EXIT_CPU || 1);
  const cdp = ENGINE === 'chromium' ? await page.context().newCDPSession(page) : null;
  if (cdp && cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  // PIT_EXIT_NET=4g: 9 Mbit/s down, 170 ms round trip (Chrome's "Fast 4G"), for the fresh page's requests.
  if (cdp && process.env.PIT_EXIT_NET === '4g') { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 170, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 }); }
  await page.waitForTimeout(500);
  // The screencast hands over every frame the page PRESENTS, with its wall time: what the player sees, across the reload too (a
  // screenshot blocks while the new document loads and misses the gap).
  const frames = [];
  let navigated = null, ready = null;
  page.on('framenavigated', (f) => { if (f === page.mainFrame() && navigated === null) navigated = Date.now(); });
  cdp?.on('Page.screencastFrame', (f) => { frames.push({ at: Math.round(f.metadata.timestamp * 1000), jpeg: Buffer.from(f.data, 'base64') }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp?.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: 375, maxHeight: 812, everyNthFrame: 1 });
  await page.waitForTimeout(300);
  const t0 = Date.now();
  await page.evaluate(() => { document.querySelector('#pit-ui .pit-go').click(); });
  while (Date.now() - t0 < WINDOW) {
    // WebKit has no screencast: a screenshot as often as the page gives one (it may block while the new document loads: the gap shows in the series).
    // doc: what the document was just after the shot (its own clock, parse state, the light's class), to tell a frame of the fresh document apart.
    if (!cdp) { const at = Date.now(); try { const jpeg = await page.screenshot({ type: 'jpeg', quality: 40, scale: 'css', timeout: 3000 }); frames.push({ at, jpeg, doc: await page.evaluate(() => ({ age: Math.round(performance.now()), state: document.readyState, body: !!document.body, sheets: document.styleSheets.length, light: document.documentElement.classList.contains('gate-light') })).catch(() => null) }); } catch { /* mid-navigation */ } }
    else await new Promise((r) => setTimeout(r, 50));
    if (ready === null && await page.evaluate(() => document.querySelector('#art-status')?.textContent === '' && !document.body.dataset.pit && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false').catch(() => false)) ready = Date.now() - t0;
  }
  await cdp?.send('Page.stopScreencast').catch(() => {});
  for (const f of frames) f.at -= t0;
  const helper = await page.context().newPage();
  await helper.goto(origin + '/release.json').catch(() => {});   // a same-origin document, so fetch(data:) and the canvas work in WebKit too
  for (const f of frames) {
    f.luma = f.jpeg ? await helper.evaluate(async (b64) => {
      const image = new Image(); image.src = `data:image/jpeg;base64,${b64}`; await image.decode();
      const c = document.createElement('canvas'); c.width = 75; c.height = 162;
      const g = c.getContext('2d'); g.drawImage(image, 0, 0, 75, 162);
      const d = g.getImageData(0, 0, 75, 162).data; let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return Math.round(sum / (d.length / 4) * 10) / 10;
    }, f.jpeg.toString('base64')) : null;
  }
  if (process.env.PIT_EXIT_FRAMES) { await fs.mkdir(`${out}/frames`, { recursive: true }); for (const f of frames) if (f.jpeg) await fs.writeFile(`${out}/frames/${String(f.at).padStart(5, '0')}.jpg`, f.jpeg); }
  // Each frame stays on screen until the next one: the black time is the sum of the stretches a dark frame was showing, after the press.
  const seen = frames.filter((f) => f.luma !== null);
  let blackMs = 0, firstDark = null, lastDarkEnd = null, longest = 0;
  seen.forEach((f, i) => {
    const from = Math.max(f.at, 0), to = Math.min(seen[i + 1]?.at ?? WINDOW, WINDOW);
    if (f.luma >= FLOOR || to <= from) return;
    blackMs += to - from; longest = Math.max(longest, to - from); firstDark ??= from; lastDarkEnd = to;
  });
  const lit = seen.filter((f) => f.at > 0 && f.luma >= LIGHT).length;
  const after = await page.evaluate(() => ({ light: document.documentElement.classList.contains('gate-light'), out: document.documentElement.classList.contains('gate-light-out'), fade: getComputedStyle(document.getElementById('pit-fade')).opacity })).catch(() => null);
  Object.assign(receipt.exit, { engine: ENGINE, prefetch: PREFETCH, litFrames: lit, after, minLuma: Math.min(...seen.filter((f) => f.at >= 0).map((f) => f.luma)), cpu, net: process.env.PIT_EXIT_NET ?? 'local', floor: FLOOR, windowMs: WINDOW, frames: seen.length, navigatedMs: navigated === null ? null : navigated - t0, blackMs, firstDarkMs: firstDark, lastDarkEndsMs: lastDarkEnd, fightReadyMs: ready, luma: seen.map((f) => [f.at, f.luma]), dark: seen.filter((f) => f.at >= 0 && f.luma < FLOOR).map((f) => ({ at: f.at, luma: f.luma, doc: f.doc ?? null })) });
  await page.context().close();
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); server.httpServer.close();
}
const e = receipt.exit;
console.log(`pit-exit-measure (${e.engine}): button "${e.button}", CPU ×${e.cpu}, network ${e.net}: black ${e.blackMs} ms under luminance ${e.floor} (from ${e.firstDarkMs} ms to ${e.lastDarkEndsMs} ms after the press); page navigated at ${e.navigatedMs} ms; fight ready at ${e.fightReadyMs} ms; ${e.frames} frames; page errors ${receipt.errors.length}`);
if (ASSERT) {
  assert.deepEqual(receipt.errors, [], 'no page errors');
  assert.ok(e.navigatedMs !== null, 'the press loaded the next rung\'s page');
  assert.equal(e.blackMs, 0, `no black frame from the press to the fight: ${e.blackMs} ms under luminance ${e.floor} (darkest frame ${e.minLuma})`);
  assert.ok(e.litFrames > 0, 'the gate\'s light was seen across the reload');
  assert.ok(e.fightReadyMs !== null, 'the next fight is ready within the window');
  assert.deepEqual(e.after, { light: false, out: false, fade: '0' }, `the light is down once the arena draws: ${JSON.stringify(e.after)}`);
  console.log('pit-exit-check PASS');
}
