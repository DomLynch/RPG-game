// Sparring picks boot exactly what the Sparring tab shows (Dom 2026-09-26: picked Dwarf / dummy / estoc / Witch-fire, got the normal
// Centurion). Path C of that defect was the Opponent picker reloading the page under Sparring and dropping the other picks; with one
// Opponent picker and one Difficulty control, under Sparring nothing reloads until Start sparring. This row makes every pick first,
// asserts no navigation happened, then taps Start and asserts the booted fight is that opponent, level, weapon and move.
import { launch, phonePage, serveDist, waitForGame, writeReceipt } from './lib/harness.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const PICK = { opponent: 'dwarf', difficulty: 'dummy', weapon: 'estoc', skill: 'witchfire' };
const site = await serveDist(), browser = await launch();
const receipt = { url: site.url, pick: PICK, errors: [], passed: false };
try {
  await mkdir('artifacts/sparring-browser-check', { recursive: true });
  const { page } = await phonePage(browser, { errors: receipt.errors, timeout: 30000 });
  await page.addInitScript(() => { if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'spar-row-0001', name: 'Wanderer' })); });
  await page.goto(new URL('/?debug=1', site.url).href); await waitForGame(page, { art: true });
  let loads = 0; page.on('load', () => { loads++; });

  // The admin Sparring tab (admins and ?debug see it; no Ladder/Sparring switch, Dom 2026-09-29), then every pick. None of them may navigate.
  await page.locator('#journal-button').tap();
  await page.locator('#sparring-tab').tap();
  assert.ok(await page.locator('#sparring-row').isVisible(), 'the Sparring tab shows the Start sparring row');
  const levels = await page.locator('#difficulty-select option').evaluateAll((os) => os.map((o) => o.value));
  // Re-pinned (Sparring layout A, Dom 2026-09-29): the Opponent's ten ranks (a fresh fighter's rank 1 at its level 1, the others at their top) and the dummy.
  assert.deepEqual(levels, ['1', '10', '15', '20', '25', '30', '35', '40', '45', '46', 'dummy'], `Difficulty offers ten ranks and the dummy (has ${levels})`);
  await page.selectOption('#opponent-select', PICK.opponent);
  await page.selectOption('#difficulty-select', PICK.difficulty);
  await page.selectOption('#spar-weapon', PICK.weapon);
  await page.selectOption('#spar-skill', PICK.skill);
  await page.waitForTimeout(1500);   // a reload the pickers wrongly fire would land in this window
  receipt.loadsBeforeStart = loads;
  assert.equal(loads, 0, 'path C: no pick reloads the page before Start sparring');
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
  // The banner reads under the HUD, never over its labels and meters (Lead 2026-09-28: at a fixed 56 px it sat on HEALTH / STAMINA).
  receipt.bannerOverlaps = await page.evaluate(() => {
    const b = document.querySelector('#replay-banner').getBoundingClientRect();
    return [...document.querySelectorAll('.combat-hud > span, .combat-hud > meter, #fight-rank, #combat-status')].filter((e) => {
      const r = e.getBoundingClientRect(); return r.width && r.height && r.left < b.right && b.left < r.right && r.top < b.bottom && b.top < r.bottom;
    }).map((e) => e.id || e.className || e.tagName);
  });
  assert.deepEqual(receipt.bannerOverlaps, [], 'the sparring banner clears the HUD labels and meters');
  // The distinct opponent SPECIAL MOVE goes through the form and Start; player MOVE/weapon and Difficulty survive.
  await page.goto(new URL('/?debug=1', site.url).href); await waitForGame(page, { art: true });
  await page.locator('#journal-button').tap(); await page.locator('#sparring-tab').tap();
  await page.selectOption('#opponent-select', 'nightborn');
  const groups = await page.locator('#spar-special optgroup').evaluateAll(os => os.map(o => o.label));
  assert.deepEqual(groups, ['L1–3', 'L4–7', 'L8', 'L9', 'L10']);
  assert.equal(await page.locator('#spar-special').inputValue(), 'unavailable-0', 'held A cannot auto-pick a boss');
  await page.selectOption('#difficulty-select', '46');
  assert.equal(await page.locator('#spar-special').inputValue(), 'nyx', 'Nightborn10 auto-selects Nyx');
  await page.selectOption('#difficulty-select', '10'); await page.selectOption('#spar-special', 'nyx');
  await page.selectOption('#spar-weapon', 'estoc'); await page.selectOption('#spar-skill', 'miasma');
  assert.match(await page.locator('#spar-special-status').textContent(), /L10 special; opponent difficulty 2/);
  receipt.specialField = await page.locator('#spar-special').evaluate(e => {
    const style = getComputedStyle(e), box = e.getBoundingClientRect();
    return { background: style.backgroundColor, color: style.color, fontSize: style.fontSize, width: box.width, right: box.right, viewport: document.documentElement.clientWidth };
  });
  assert.notEqual(receipt.specialField.background, 'rgb(255, 255, 255)', 'mobile field no longer white');
  assert.notEqual(receipt.specialField.color, receipt.specialField.background);
  assert.ok(receipt.specialField.right <= receipt.specialField.viewport + 1, 'native select fits375');
  await page.screenshot({ path: 'artifacts/sparring-browser-check/special-form-375.png' });
  await Promise.all([page.waitForURL(/special=nyx/), page.locator('#spar-start').tap()]);
  await waitForGame(page, { art: true });
  receipt.specialBoot = await page.evaluate(() => ({ search: Object.fromEntries(new URLSearchParams(location.search)), weapon: document.getElementById('spar-weapon').value, skill: document.getElementById('spar-skill').value, special: document.getElementById('spar-special').value }));
  assert.deepEqual(receipt.specialBoot.search, { opponent: 'nightborn', spar: '1', weapon: 'estoc', difficulty: '10', skill: 'miasma', special: 'nyx' });
  assert.deepEqual([receipt.specialBoot.weapon, receipt.specialBoot.skill, receipt.specialBoot.special], ['estoc', 'miasma', 'nyx']);
  await page.locator('#attack-button').tap();
  await page.waitForFunction(() => { const stage = globalThis.__special?.().stages[1]; return stage?.stage === 'windup' && stage.progress >= .5; }, null, { timeout: 30000, polling: 50 });
  receipt.specialWindup = await page.evaluate(() => globalThis.__special());
  await page.screenshot({ path: 'artifacts/sparring-browser-check/nyx-windup-375.png' });
  await page.waitForFunction(() => globalThis.__special?.().stages[1]?.stage === 'recover', null, { timeout: 10000, polling: 25 });
  receipt.specialRecover = await page.evaluate(() => globalThis.__special());
  await page.screenshot({ path: 'artifacts/sparring-browser-check/nyx-recover-375.png' });
  // Stages prove real simulation activity; these normal screenshots still require independent visible-FX judgment.
  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} catch (e) { receipt.failure = String(e?.stack || e); process.exitCode = 1; }
finally { await browser.close(); await site.close(); }
await writeReceipt('artifacts/sparring-browser-check/receipt.json', receipt);
console.log(JSON.stringify({ passed: receipt.passed, loadsBeforeStart: receipt.loadsBeforeStart, booted: receipt.booted, failure: receipt.failure?.split('\n')[0], errors: receipt.errors.slice(0, 3) }));
