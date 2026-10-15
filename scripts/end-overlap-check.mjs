/* global process, console, document, window, localStorage */
// Release-style check: after the first win and the take, no visible control sits under the "Next fight" button (Lead 2026-10-15, found in the intro receipt frames: ROLL and GUARD showed through behind it at 375).
// A fresh guest at a phone width, headless Chromium on software GL, the fight driver of scripts/loot-smoke-check.mjs on the harness clock. Prints the controls that intersect Next fight; exits non-zero if any.
// One duel, then the same kill screen is measured at 375 and again after a resize to 320 (the layout is pure CSS, so a resize is the same page at the narrower phone). Release row 55.
//   node scripts/end-overlap-check.mjs [--dist dist] [--out artifacts/end-overlap] [--width 375]     (no --dist: builds this tree; no --width: 375 then 320)
import { chromium } from 'playwright';
import { quietDebug } from './lib/harness.mjs';
import { harnessClock } from './lib/harness-clock.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { build } from 'vite';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', 'artifacts/end-overlap')), WIDTHS = arg('width') ? [Number(arg('width'))] : [375, 320];
const DIST = arg('dist') ? path.resolve(arg('dist')) : path.join(OUT, 'build');
if (!arg('dist')) await build({ logLevel: 'error', build: { outDir: DIST, emptyOutDir: true } });
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
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 72, timeout: 240000 });
const result = { widths: WIDTHS, take: {}, overlaps: {} };
try {
  const ctx = await browser.newContext({ viewport: { width: WIDTHS[0], height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }); const page = await ctx.newPage(); await quietDebug(page); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); await page.route('**/*sentry.io/**', (route) => route.abort());
  await page.goto(`${origin}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') !== 'true' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 280000, polling: 300 });
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
  await run(400);
  const at = async (w) => { await page.setViewportSize({ width: w, height: 812 }); await run(300); };
  // Take must be on screen and the topmost thing at its centre when the player reaches for it (Lead 2026-10-15: the fix hides fight buttons on this very screen).
  for (const w of WIDTHS) {
    await at(w);
    result.take[w] = await page.evaluate(() => {
      const t = document.getElementById('loot-take'); if (!t) return { error: 'no #loot-take' };
      const r = t.getBoundingClientRect(), cs = getComputedStyle(t), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], viewport: [innerWidth, innerHeight], hidden: t.hidden, disabled: t.disabled || t.getAttribute('aria-disabled'), visibility: cs.visibility, pe: cs.pointerEvents, opacity: cs.opacity, topmost: top?.id || top?.tagName };
    });
    await shot(page, `take-${w}.jpg`);
  }
  await page.locator('#loot-take').tap(); await run(600);
  // Every control a player can see (display, visibility and opacity all on, a real box) against the Next fight button.
  for (const w of WIDTHS) {
    await at(w);
    result.overlaps[w] = await page.evaluate(() => {
      const next = document.getElementById('reset-button'); if (!next || next.hidden) return { error: 'Next fight is not shown' };
      const nr = next.getBoundingClientRect(), hit = (r) => !(r.right <= nr.left || r.left >= nr.right || r.bottom <= nr.top || r.top >= nr.bottom);
      const seen = (e) => { const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && r.width > 0 && r.height > 0; };
      const out = []; for (const e of document.querySelectorAll('.actions button, #joystick, .clip-pick button, #share-link, #duel-button, #clip-button')) if (e !== next && seen(e) && hit(e.getBoundingClientRect())) out.push(e.id || e.className || e.tagName); return { next: [Math.round(nr.left), Math.round(nr.top), Math.round(nr.right), Math.round(nr.bottom)], overlapping: out };
    });
    await shot(page, `next-fight-${w}.jpg`);
  }
  result.errors = errors; await ctx.close();
  const bad = WIDTHS.some((w) => result.overlaps[w].error || result.overlaps[w].overlapping.length || result.take[w].error || result.take[w].hidden || result.take[w].pe === 'none' || result.take[w].topmost !== 'loot-take');
  console.log('RESULT', JSON.stringify(result)); if (errors.length || bad) process.exitCode = 1;
} finally { await browser.close(); srv.close(); }
