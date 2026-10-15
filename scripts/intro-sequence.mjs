/* global process, console, document, window, localStorage */
// The intro + first-five-minutes receipt (brief #2772, Web): a fresh guest at 375x812 from cold load through the intro, fight 1, the kill, the take and the share row, filmed (a video of the run + stills) and timed. Headless Chromium, software GL, the harness clock for the fight
// (scripts/lib/harness-clock.mjs) as the release rows use it: it is an EMULATED phone run, not a real device. The fight driver and the kill-screen steps are scripts/loot-smoke-check.mjs's, unchanged.
//   node scripts/intro-sequence.mjs --dist dist --out artifacts/intro-seq
import { chromium } from 'playwright';
import { quietDebug } from './lib/harness.mjs';
import { harnessClock } from './lib/harness-clock.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const DIST = path.resolve(arg('dist', 'dist')), OUT = path.resolve(arg('out', 'artifacts/intro-seq'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const srv = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  let file = path.join(DIST, p), data; try { data = await fs.readFile(file); } catch { file = path.join(DIST, 'index.html'); data = await fs.readFile(file); }
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(data);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${srv.address().port}`;
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const phone = (extra = {}) => browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, ...extra });
const ready = (page) => page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') !== 'true' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 280000, polling: 300 });
const caption = (page) => page.evaluate(() => { const c = document.querySelector('.intro-caption'); return c ? Number(c.style.opacity) : null; });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 72, timeout: 240000 });
const result = { emulated: 'headless Chromium, software GL, 375x812 touch; NOT a real device' };
const URL_INTRO = `${origin}/?intro=1&debug=1`;
try {
  // ---- timing A: cold load -> FIGHT enabled -> the first tap (which also ends the intro: the skip)
  { const ctx = await phone(); const page = await ctx.newPage(); await quietDebug(page); const t0 = Date.now(); await page.goto(URL_INTRO, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await ready(page); result.loadToFightEnabledMs = Date.now() - t0;
    await page.waitForFunction(() => document.querySelector('.intro-caption'), null, { timeout: 60000 }); result.loadToIntroStartMs = Date.now() - t0;
    await page.evaluate(() => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d))));
    const tap = Date.now(); await page.touchscreen.tap(188, 700); result.loadToFirstTapMs = tap - t0; await page.waitForTimeout(300); result.introGoneAfterTap = (await caption(page)) === null; await ctx.close(); }
  // ---- timing B: no skip, the intro plays to its own end (page-clock seconds from the first card)
  { const ctx = await phone(); const page = await ctx.newPage(); await quietDebug(page); await page.goto(URL_INTRO, { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(page);
    await page.waitForFunction(() => document.querySelector('.intro-caption'), null, { timeout: 60000 }); const t1 = Date.now();
    await page.waitForFunction(() => !document.querySelector('.intro-caption'), null, { timeout: 300000, polling: 500 }); result.introPlaysToEndMs = Date.now() - t1; await ctx.close(); }
  console.log('TIMING', JSON.stringify(result));
  // ---- the sequence, filmed
  const ctx = await phone({ recordVideo: { dir: path.join(OUT, 'video'), size: { width: 375, height: 812 } } }); const page = await ctx.newPage(); await quietDebug(page); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); await page.route('**/*sentry.io/**', (route) => route.abort());
  const T0 = Date.now(); await page.goto(URL_INTRO, { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(page);
  await page.waitForFunction(() => { const c = document.querySelector('.intro-caption'); return c && c.textContent && Number(c.style.opacity) > 0.95; }, null, { timeout: 60000 }); await shot(page, '1-intro-card.jpg');
  await page.touchscreen.tap(188, 300); await page.waitForTimeout(300); assert.equal(await caption(page), null, 'a tap skips the intro'); await shot(page, '2-after-skip.jpg');
  await page.evaluate(() => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d))));
  if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).tap();
  await page.waitForFunction(() => document.querySelector('#welcome').hidden);
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
  assert.ok(killed, 'a real UI duel must kill the first opponent');
  await shot(page, '3-kill.jpg');
  // ---- the kill screen: panel opens on the finisher-complete latch; the first touch stops the tour (tiles are inert under the fade)
  await until(() => document.getElementById('loot-panel')?.getAttribute('data-on') === '1', 15000);
  // The touch lands on bare canvas just above the panel: stopTour is a document-level pointerdown (main.ts), and a fixed point was covered
  // by a tile once the panel grew a skill row (RV15, the Goblin's Dirty Jab), so the tap is placed from the panel's own box and checked.
  const panelBox = await page.locator('#loot-panel').boundingBox();
  const stop = { x: Math.round(panelBox.x + panelBox.width / 2), y: Math.max(8, Math.round(panelBox.y - 24)) };
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, [stop.x, stop.y]);
  assert.equal(hit, 'CANVAS', `the tour-stop touch at ${stop.x},${stop.y} must land on bare canvas, not ${hit}`);
  await page.touchscreen.tap(stop.x, stop.y);
  await until(() => !document.documentElement.classList.contains('endgame-fade'), 10000);
  await run(400);   // the 250 ms fade back plus the panel's 300 ms tap guard
  await shot(page, '4-kill-screen.jpg');
  const tiles = await page.locator('#loot-panel-pieces li').count(); result.lootTiles = tiles;
  await run(400); await page.locator('#loot-take').tap(); await run(300); await shot(page, '5-taken.jpg');
  const row = await page.evaluate(() => Object.fromEntries(['share-link', 'duel-button', 'clip-button'].map((id) => { const e = document.getElementById(id); const r = e?.getBoundingClientRect(); return [id, !!e && !e.hidden && r.width > 0]; })));
  result.shareRow = row; console.log('share row visible:', JSON.stringify(row)); await shot(page, '6-share-row.jpg');
  result.sequenceWallMs = Date.now() - T0; result.errors = errors; await ctx.close();
  console.log('RESULT', JSON.stringify(result)); if (errors.length) process.exitCode = 1;
} finally { await browser.close(); srv.close(); }
