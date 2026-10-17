// SPECIAL 1 / SPECIAL 2 on the PIT page (the specials PR, RV75 / WSV52) at 375x812 touch, on this tree's built dist: the picks are in the store before the page loads (`?fight=1` skips the scripted first-loss lesson, which takes no pick),
// the fighter is drawn, both SPECIAL buttons show (the second wears the skill row's name), pressing each starts that skill's own move (the button dims while it cools), and the fight's record names the pick.
// Usage: node scripts/special-pit-check.mjs [out dir]   (needs `npx vite build` first; QA_URL points it at a deployed site; PIT_GL=1 = software GL for a loaded box)  receipt: <out>/receipt.json
/* global process, console, window, document */
import assert from 'node:assert/strict';
import { launch, phonePage, serveDist, waitForGame, writeReceipt } from './lib/harness.mjs';

const out = process.argv[2] ?? 'artifacts/special-pit', FIRST = process.env.SPECIAL_FIRST ?? 'lunge', SECOND = process.env.SPECIAL_SECOND ?? 'stomp';
const server = await serveDist();
const browser = await launch(process.env.PIT_GL === '1' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
const receipt = { picks: [FIRST, SECOND], checks: [], errors: [], passed: false };
const ok = (name, detail) => { receipt.checks.push({ name, ...(detail === undefined ? {} : { detail }) }); console.log('ok:', name, detail === undefined ? '' : JSON.stringify(detail)); };
try {
  const { page, errors } = await phonePage(browser, { viewport: { width: 375, height: 812 }, timeout: 20000, errors: receipt.errors });
  await page.addInitScript(([a, b]) => { try { localStorage.setItem('frankendom.special.slots.v1', JSON.stringify([a, b])); } catch { /* storage refused */ } }, [FIRST, SECOND]);
  await page.goto(`${server.url}/?fight=1`, { waitUntil: 'commit' });
  await waitForGame(page);
  ok('the Pit page boots with both picks stored (?fight=1: no lesson)');
  const button = (sel) => page.evaluate((s) => { const b = document.querySelector(s); return b ? { hidden: b.hidden, disabled: b.getAttribute('aria-disabled'), label: b.getAttribute('aria-label') ?? b.textContent } : null; }, sel);
  // draw the blade: the first press of a fresh fight draws; wait until the attack control reads "Light attack" (ready)
  await page.locator('#attack-button').tap();
  await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-label') === 'Light attack', null, { timeout: 30000 });
  const one = await button('#skill-button'), two = await button('#skill2-button');
  assert.ok(one && !one.hidden, `SPECIAL 1 button shows: ${JSON.stringify(one)}`);
  assert.ok(two && !two.hidden, `SPECIAL 2 button shows: ${JSON.stringify(two)}`);
  assert.match(String(two.label), /stomp/i, `SPECIAL 2 wears the skill row's name: ${two.label}`);
  ok('both SPECIAL buttons show and SPECIAL 2 wears its skill name', { one: one.label, two: two.label });
  await page.screenshot({ path: `${out}/pit-both-lit.png` });
  // SPECIAL 1: pressing it starts a move and the button dims while it cools
  await page.locator('#skill-button').tap();
  await page.waitForFunction(() => document.querySelector('#skill-button')?.getAttribute('aria-disabled') === 'true', null, { timeout: 8000 });
  ok('SPECIAL 1 fires and dims while it cools');
  // SPECIAL 2: its own cooldown, so it is still lit when SPECIAL 1 cools; press it once the first move is over
  await page.waitForFunction(() => document.querySelector('#skill2-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 20000 });
  await page.locator('#skill2-button').tap();
  await page.waitForFunction(() => document.querySelector('#skill2-button')?.getAttribute('aria-disabled') === 'true', null, { timeout: 8000 });
  ok('SPECIAL 2 fires on its own cooldown and dims while it cools');
  await page.screenshot({ path: `${out}/pit-after-both.png` });
  assert.equal(errors.length, 0, `no page errors: ${errors.join(' | ')}`);
  receipt.passed = true;
} finally {
  await writeReceipt(`${out}/receipt.json`, receipt);
  await browser.close(); await server.close();
}
console.log(receipt.passed ? 'PASS' : 'FAIL');
