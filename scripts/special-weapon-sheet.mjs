// One contact sheet per weapon: for each melee special, three stills at the fight camera at 375 wide (the windup's middle, the strike tick, 12 ticks after it), one row per special. No video.
// Shared box only (a real browser): ssh the VPS, `cd /root/frankendom-worktrees/sandbox && capture --prio 3 sandbox node scripts/special-weapon-sheet.mjs --weapon maul --out out/sheets`
//   [--base https://frankendom.com/preview/sandbox/] [--only cleave,stomp] [--wait 260]. Writes <out>/sheet-<weapon>.jpg (rows in the order of --only) plus the stills beside it.
/* global process, console, document, globalThis */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BASE = arg('base', 'https://frankendom.com/preview/sandbox/'), OUT = arg('out', 'out/sheets'), WEAPON = arg('weapon', 'maul'), WAIT = Number(arg('wait', '260'));
const BOW = arg('bow', '') === '1', ORBIT = Number(arg('orbit', '0')), CROP = ORBIT ? 'crop=330:400:22:200' : 'crop=250:330:62:250', TAG = ORBIT ? '-side' : '';
const SPECIALS = ['cleave', 'reaping', 'stomp', 'lunge'].filter((s) => !arg('only', '') || arg('only', '').split(',').includes(s));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
await fs.mkdir(OUT, { recursive: true });
const rows = [];
for (const special of SPECIALS) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await context.addInitScript(() => { try { localStorage.removeItem('frankendom.sandbox.loadout'); } catch { /* none */ } });
  const page = await context.newPage();
  await page.goto(`${BASE}?spar=1&weapon=${WEAPON}${BOW ? `&bow=${WEAPON}` : ''}&difficulty=dummy&skill=${special === 'lunge' ? 'lunge' : 'pommel'}&opponent=Centurion&special2=${special === 'lunge' ? 'pommel' : special}&debug=1`);
  await page.getByRole('button', { name: 'Fight', exact: true }).first().click({ timeout: 600000 });
  await page.waitForFunction(() => globalThis.__sandboxMatch?.practice?.duel?.fighters?.[0]?.phase === 'ready', null, { timeout: 120000, polling: 500 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  const { run } = await harnessClock(page);
  await skipDraws(page, true);
  for (let n = 0; n < WAIT; n++) await run(n % 3 === 2 ? 16 : 17);   // the first-cast cooldown
  await skipDraws(page, false); await run(17);
  await page.waitForTimeout(2500); await run(17); await page.waitForTimeout(500);   // the special's clip is fetched on the first draw, in real time: let it land first
  if (ORBIT) { await page.evaluate((dx) => globalThis.__view?.orbit?.(dx, 0), ORBIT); for (let n = 0; n < 60; n++) await run(n % 3 === 2 ? 16 : 17); }   // --orbit <dx>: turn the camera (yaw -= dx * 0.005 rad; -314 is a quarter turn, the character seen from the side), then let it settle
  if (BOW) await page.evaluate((gap) => { const d = globalThis.__sandboxMatch?.practice?.duel, f = d?.fighters; if (f) f[0].body = { ...f[0].body, z: f[1].body.z + gap, heading: Math.PI }; }, 3.5);   // --bow 1: stand the archer 3.5 m from the foe (past the missile gap), facing him, so the special flies as arrows
  { const id = special === 'lunge' ? 'skill-button' : 'sbx-spell2'; for (let n = 0; n < 400 && (await page.evaluate((i) => document.getElementById(i)?.getAttribute('aria-disabled'), id)) !== 'false'; n++) await run(n % 3 === 2 ? 16 : 17); }   // wait until the button is lit (cooldown over, controls ready) before the press
  await page.locator(special === 'lunge' ? '#skill-button' : '#sbx-spell2').tap();
  await skipDraws(page, true);
  const state = () => page.evaluate(() => { const f = globalThis.__sandboxMatch?.practice?.duel?.fighters?.[0]; return { special: f?.special ?? 0, recover: f?.specialRecover ?? 0, clip: (globalThis.__view?.playing?.() ?? '').split(' ')[0] }; });
  const shot = async (tag) => { await skipDraws(page, false); await run(17); const file = `${OUT}/${special}-${WEAPON}${TAG}-${tag}.jpg`; await page.screenshot({ path: file, type: 'jpeg', quality: 90 }); await skipDraws(page, true); return file; };
  const files = [], clips = []; let mid = false, hit = false, after = false, w0 = 0;
  for (let n = 0; n < 400 && !after; n++) {
    const s = await state();
    if (s.special > 0 && w0 === 0) w0 = s.special;   // the windup length of this cast (32 melee, 14 for Quick Shot): the middle is half of it
    if (!mid && s.special > 0 && s.special <= Math.min(16, Math.ceil(w0 / 2))) { files.push(await shot('1windup')); clips.push(s.clip); mid = true; }
    else if (!hit && s.special === 0 && s.recover > 0) { files.push(await shot('2strike')); clips.push(s.clip); hit = true; }
    else if (hit && s.recover > 0 && s.recover <= 33) { files.push(await shot('3after')); clips.push(s.clip); after = true; }
    else await run(n % 3 === 2 ? 16 : 17);
  }
  console.log(`${special} on the ${WEAPON}: ${files.length} stills; clip at each: ${clips.join(' | ')}`);
  if (files.length === 3) {
    const row = `${OUT}/row-${special}-${WEAPON}${TAG}.jpg`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...files.flatMap((f) => ['-i', f]), '-filter_complex', `[0]${CROP}[a];[1]${CROP}[b];[2]${CROP}[c];[a][b][c]hstack=inputs=3`, '-frames:v', '1', '-update', '1', row], { timeout: 600_000 });   // bounded (tests/child-process-bounds.test.ts)
    rows.push(row);
  }
  await context.close();
}
await browser.close();
if (rows.length) { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...rows.flatMap((f) => ['-i', f]), '-filter_complex', `vstack=inputs=${rows.length}`, '-frames:v', '1', '-update', '1', `${OUT}/sheet-${WEAPON}${TAG}.jpg`], { timeout: 600_000 }); console.log(`sheet: ${OUT}/sheet-${WEAPON}${TAG}.jpg (rows: ${SPECIALS.join(', ')}; columns: windup middle, strike, 12 ticks after)`); }
