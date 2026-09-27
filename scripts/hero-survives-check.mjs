// Release row: a hero preview (`?hero=/herolook/<name>.glb`, src/hero-preview.ts) survives the game's own reloads (Lead 2026-09-27).
// Daily: the "Today's duel" button reloads onto `/?daily=1`; the new link keeps a valid hero and drops an invalid one. Kill link: a
// `?replay=` record against another opponent re-opens the page on that opponent's rig; the re-opened link keeps the hero. The daily's own
// move to the day's opponent needs the fight store, so it is pinned by tests/hero-preview.test.ts (the same withHero) rather than here.
// Guest only; nothing sent anywhere. QA_URL points it at a deployed site; unset, it serves this tree's build.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { serveDist, waitForGame, writeReceipt } from './lib/harness.mjs';
import { createRecorder, encodeRecord } from '../src/record.ts';
import { idleIntent } from '../src/duel.ts';
import { LADDER } from '../src/ladder.ts';

const HERO = '/herolook/legionary.glb';
const heroOf = (href) => new URL(href).searchParams.get('hero');
const foe = LADDER.find((rung) => rung.id !== 'veteran').id;   // a fresh profile boots the Veteran, so the record must name someone else
const recorder = createRecorder({ build: 'hero-survives-check', opponent: foe, weapon: 'longsword', profile: 'normal', seed: 731 });
recorder.push(idleIntent());
const link = await encodeRecord(recorder.finish('abandoned'));

const site = await serveDist(), browser = await chromium.launch({ headless: true });
const receipt = { url: site.url, foe, daily: null, dailyInvalid: null, killLink: null, errors: [], passed: false };
try {
  const open = async () => {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    page.setDefaultTimeout(30000); page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
    await page.addInitScript(() => localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'hero-row-0001', name: 'Wanderer' })));
    return page;
  };
  const daily = async (hero) => {
    const page = await open();
    await page.goto(`${site.url}/?hero=${hero}`); await waitForGame(page);
    await Promise.all([page.waitForURL(/[?&]daily=1/), page.evaluate(() => document.getElementById('daily-button').click())]);   // the pane is hidden outside Daily; the button's handler is what is under test
    const href = page.url(); await page.close(); return href;
  };
  receipt.daily = await daily(HERO);
  assert.equal(heroOf(receipt.daily), HERO, `the Daily button keeps the hero: ${receipt.daily}`);
  receipt.dailyInvalid = await daily('/assets/warrior.glb');
  assert.equal(heroOf(receipt.dailyInvalid), null, `the Daily button drops an invalid hero: ${receipt.dailyInvalid}`);

  const page = await open();
  await page.goto(`${site.url}/?replay=${link}&hero=${HERO}`);
  await page.waitForURL(new RegExp(`[?&]opponent=${foe}`));
  receipt.killLink = page.url();
  assert.equal(heroOf(receipt.killLink), HERO, `the kill link's re-open keeps the hero: ${receipt.killLink}`);
  await page.close();

  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} finally {
  await writeReceipt('artifacts/hero-survives/receipt.json', receipt);
  await browser.close(); await site.close();
}
console.log(`hero-survives-check: daily ${receipt.daily} · kill link ${receipt.killLink}`);
