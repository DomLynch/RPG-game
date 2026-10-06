// Release row: a brand-new visitor's first minute. No other row covers it (roster/account seed a fighter first), and the scripted first loss
// (src/first-loss.ts, prompts in src/lessons.ts, the one-time trigger in main.ts) changes what every new player meets.
//   1. a fresh profile opens `/` and the lesson starts: nothing recorded, nothing awarded, the one-time flag stored;
//   2. the scripted fight plays out, "Fight for real" lands on `?fight=1`, and a normal fight starts (not the lesson);
//   3. a second plain visit (flag stored, still no fights) is not the lesson;
//   4. no page errors anywhere.
// Time is the harness clock's (scripts/lib/harness-clock.mjs) while the fight plays out, and frames are not painted (skipDraws) because the
// check reads state, not pixels. QA_URL points it at a built page instead of starting `vite preview`.
import { chromium } from 'playwright';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { preview } from 'vite';
import process from 'node:process';
import console from 'node:console';
import { setTimeout as sleep } from 'node:timers/promises';
/* global localStorage, document, location */

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.FIRST_LOSS_RECEIPT_DIR || 'artifacts/first-loss'; await fs.mkdir(dir, { recursive: true });
const FLAG = 'frankendom.firstloss.v1';
const receipt = { steps: [], errors: [] };
const step = (name, data) => { receipt.steps.push({ name, ...data }); console.log(name, JSON.stringify(data)); };
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
try {
  // A fresh context: empty storage, so this is a first visit. 375 wide, touch, like a phone.
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const watch = (page, tag) => { page.on('pageerror', (e) => receipt.errors.push(`${tag}: ${e.message}`)); return page.route('**/*sentry.io/**', (r) => r.abort()); };
  const page = await context.newPage(); await watch(page, 'lesson');

  // 1. the plain page is the lesson.
  await page.goto(`${origin}/`);
  await page.waitForFunction(() => typeof globalThis.__lesson === 'function' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 180000 });
  const first = await page.evaluate((flag) => ({ lesson: globalThis.__lesson(), flag: localStorage.getItem(flag), search: location.search }), FLAG);
  assert.equal(first.search, '', 'the plain page, no parameters');
  assert.equal(first.lesson.recorder, false, 'the lesson records nothing');
  assert.equal(first.lesson.practiceOnly, true, 'the lesson awards nothing');
  assert.equal(first.flag, '1', 'the one-time flag is stored when the lesson starts');
  step('1 fresh visit starts the lesson', { recorder: first.lesson.recorder, practiceOnly: first.lesson.practiceOnly, flag: first.flag });

  // 2. play the script out (stand still: every beat fires on its timeout), then leave through "Fight for real".
  const { run, until } = await harnessClock(page);
  await run(200);
  await page.keyboard.press('KeyF'); await run(300);
  await skipDraws(page, true);
  await until(() => !!globalThis.__lesson().finish, 900000);
  const heard = await page.evaluate(() => globalThis.__lesson().heard);
  assert.deepEqual(heard, ['stayAfterParry', 'blockEarnsNothing', 'rollSideways', 'woundedStamina', 'tapStepHoldRoll'], 'every beat fired, once, in the taught order');
  await until(() => !document.querySelector('#reset-button').hidden && !document.documentElement.classList.contains('endgame-fade'), 30000);
  await skipDraws(page, false); await run(120);
  const end = await page.evaluate(() => ({ status: document.getElementById('combat-status').textContent, button: document.getElementById('reset-button').textContent }));
  assert.equal(end.status, 'You fell. That was the lesson.', 'the after-loss line');
  assert.equal(end.button, 'Fight for real', 'the button that leaves the lesson');
  step('2a the lesson plays out', { heard, ...end });
  const navigated = page.waitForEvent('framenavigated', { timeout: 60000 });
  await page.evaluate(() => document.getElementById('reset-button').click());
  await navigated;
  // The reload boots under the paused fake clock: boot is promise-driven, so poll on real time, not on page time.
  let booted = false;
  for (let i = 0; i < 240 && !booted; i++) { booted = await page.evaluate(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false').catch(() => false); if (!booted) await sleep(500); }
  assert.ok(booted, 'the page after "Fight for real" boots to a fight');
  const real = await page.evaluate(() => ({ search: location.search, lesson: typeof globalThis.__lesson, dataLesson: document.documentElement.dataset.lesson ?? null }));
  assert.equal(real.search, '?fight=1', '"Fight for real" lands on ?fight=1');
  assert.equal(real.lesson, 'undefined', 'the real fight is not the lesson');
  assert.equal(real.dataLesson, null, 'no lesson beat is showing');
  await run(200); await page.keyboard.press('KeyF'); await run(300);
  const fight = await page.evaluate(() => ({ foe: Number(document.querySelector('#target-health').value), me: Number(document.querySelector('#player-health').value), status: document.getElementById('combat-status').textContent }));
  assert.ok(fight.foe > 0 && fight.me > 0, 'a normal fight is on: both fighters standing');
  assert.doesNotMatch(fight.status, /lesson|stay and hit|earns nothing|Roll sideways|wounded stamina|Tap to step/i, 'no teaching line in the real fight');
  step('2b Fight for real starts a normal fight', { ...real, ...fight });

  // 3. a second plain visit: the flag is stored and the scorecard may still be empty, so only the flag keeps it out of the lesson.
  const second = await context.newPage(); await watch(second, 'second visit');
  await second.goto(`${origin}/`);
  await second.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 180000 });
  await sleep(1500);
  const again = await second.evaluate((flag) => ({ lesson: typeof globalThis.__lesson, flag: localStorage.getItem(flag), search: location.search }), FLAG);
  assert.equal(again.search, '', 'a plain visit');
  assert.equal(again.flag, '1');
  assert.equal(again.lesson, 'undefined', 'a second plain visit is not the lesson');
  step('3 a second plain visit is not the lesson', again);
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); server?.httpServer.close();
}
// 4. no page errors.
assert.deepEqual(receipt.errors, [], 'no page errors');
console.log(`first-loss-browser-check PASS: ${receipt.steps.length} steps, 0 page errors`);
process.exit(0);
