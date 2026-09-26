// Sparring picks boot exactly what the Options tab shows (Dom 2026-09-26: picked Dwarf / dummy / estoc / Witch-fire, got the normal
// Centurion). Path C of that defect was the Opponent picker reloading the page under Sparring and dropping the other picks; with one
// Opponent picker and one Difficulty control, under Sparring nothing reloads until Start sparring. This row makes every pick first,
// asserts no navigation happened, then taps Start and asserts the booted fight is that opponent, level, weapon and move.
import { launch, phonePage, serveDist, waitForGame, writeReceipt } from './lib/harness.mjs';
import assert from 'node:assert/strict';

const PICK = { opponent: 'dwarf', difficulty: 'dummy', weapon: 'estoc', skill: 'witchfire' };
const site = await serveDist(), browser = await launch();
const receipt = { url: site.url, pick: PICK, errors: [], passed: false };
try {
  const { page } = await phonePage(browser, { errors: receipt.errors, timeout: 30000 });
  await page.addInitScript(() => { if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'spar-row-0001', name: 'Wanderer' })); });
  await page.goto(new URL('/?debug=1', site.url).href); await waitForGame(page, { art: true });
  let loads = 0; page.on('load', () => { loads++; });

  // The Options tab, Arena = Sparring (admins and ?debug see it), then every pick. Under Sparring none of them may navigate.
  await page.locator('#journal-button').tap();
  await page.locator('label[for="journal-tab-arena"]').tap();
  await page.locator('#mode-sparring').check({ force: true });
  assert.ok(await page.locator('#sparring-row').isVisible(), 'Arena = Sparring shows the Start sparring row');
  const levels = await page.locator('#difficulty-select option').evaluateAll((os) => os.map((o) => o.value));
  assert.ok(levels.includes('dummy'), `the one Difficulty control offers the dummy under Sparring (has ${levels})`);
  await page.selectOption('#opponent-select', PICK.opponent);
  await page.selectOption('#difficulty-select', PICK.difficulty);
  await page.selectOption('#spar-weapon', PICK.weapon);
  await page.selectOption('#spar-skill', PICK.skill);
  await page.waitForTimeout(1500);   // a reload the pickers wrongly fire would land in this window
  receipt.loadsBeforeStart = loads;
  assert.equal(loads, 0, 'path C: under Sparring no pick reloads the page before Start sparring');
  receipt.picked = await page.evaluate(() => Object.fromEntries(['opponent-select', 'difficulty-select', 'spar-weapon', 'spar-skill'].map((id) => [id, document.getElementById(id).value])));

  // Start sparring boots exactly those picks.
  await Promise.all([page.waitForURL(/spar=1/), page.locator('#spar-start').tap()]);
  await waitForGame(page, { art: true });
  const booted = await page.evaluate(() => ({
    search: Object.fromEntries(new URLSearchParams(location.search)),
    foe: document.querySelector('#opponent-name')?.textContent.trim(),
    banner: document.querySelector('#replay-banner')?.textContent.trim(),
    weapon: document.getElementById('spar-weapon').value, skill: document.getElementById('spar-skill').value,
  }));
  receipt.booted = booted;
  assert.deepEqual({ opponent: booted.search.opponent, difficulty: booted.search.difficulty, weapon: booted.search.weapon, skill: booted.search.skill }, PICK, 'the link carries every pick');
  assert.match(booted.foe ?? '', /dwarf/i, 'the fight on screen is the picked opponent');
  assert.match(booted.banner ?? '', /Sparring the dummy/, 'the dummy level boots (its banner)');
  assert.equal(booted.weapon, PICK.weapon, 'the booted kit carries the picked weapon');
  assert.equal(booted.skill, PICK.skill, 'the booted kit carries the picked move');
  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} catch (e) { receipt.failure = String(e?.stack || e); process.exitCode = 1; }
finally { await browser.close(); await site.close(); }
await writeReceipt('artifacts/sparring-browser-check/receipt.json', receipt);
console.log(JSON.stringify({ passed: receipt.passed, loadsBeforeStart: receipt.loadsBeforeStart, booted: receipt.booted, failure: receipt.failure?.split('\n')[0], errors: receipt.errors.slice(0, 3) }));
