// Sparring picks boot exactly what the Sparring tab shows (Dom 2026-09-26: picked Dwarf / dummy / estoc / Witch-fire, got the normal
// Centurion). Path C of that defect was the Opponent picker reloading the page under Sparring and dropping the other picks; with one
// Opponent picker and one Difficulty control, under Sparring nothing reloads until Start sparring. This row makes every pick first,
// asserts no navigation happened, then taps Start and asserts the booted fight is that opponent, level, weapon and move.
import { launch, phonePage, serveDist, waitForGame, writeReceipt } from './lib/harness.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { setTimeout, clearTimeout } from 'node:timers';
/* global localStorage, document, URLSearchParams, location, sessionStorage, getComputedStyle */

const PICK = { opponent: 'dwarf', difficulty: 'dummy', weapon: 'estoc', skill: 'witchfire' };
const source = process.argv.includes('--source');
let site, browser, deadline, activePage;
const receipt = { mode: source ? 'current-source/local-synthetic-tester' : 'dist', pick: PICK, errors: [], passed: false };
async function check() {
  if (source) {
    const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: true, open: false } });
    site = { close: () => server.close() };
    await server.listen();
    site.url = `http://127.0.0.1:${server.httpServer.address().port}`;
  } else site = await serveDist();
  receipt.url = site.url;
  browser = await launch({ timeout: 30000 });
  await mkdir('artifacts/sparring-browser-check', { recursive: true });
  const { page } = await phonePage(browser, { viewport: { width: 375, height: 812 }, errors: receipt.errors, timeout: 30000 });
  activePage = page;
  if (source) await page.route('**/*', route => new URL(route.request().url()).origin === site.url ? route.continue() : route.abort());
  await page.addInitScript(() => { if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'spar-row-0001', name: 'Wanderer' })); });
  await page.goto(new URL('/?debug=1', site.url).href); await waitForGame(page, { art: true });
  assert.deepEqual(await page.locator('#arena-select option').evaluateAll(os => os.map(o => o.value)), ['', '1', 'a', 'b', 'c', 'd'], 'only the original arena choices remain');
  let loads = 0; page.on('load', () => { loads++; });

  // The admin Sparring tab (admins and ?debug see it; no Ladder/Sparring switch, Dom 2026-09-29), then every pick. None of them may navigate.
  await page.locator('#journal-button').tap();
  await page.locator('#sparring-tab').tap();
  assert.ok(await page.locator('#sparring-row').isVisible(), 'the Sparring tab shows the Start sparring row');
  const levels = await page.locator('#difficulty-select option').evaluateAll((os) => os.map((o) => o.value));
  // Re-pinned (Sparring layout A, Dom 2026-09-29): the Opponent's ten ranks (a fresh fighter's rank 1 at its level 1, the others at their top) and the dummy.
  assert.deepEqual(levels, ['1', '10', '15', '20', '25', '30', '35', '40', '45', '46', 'dummy'], `Difficulty offers ten ranks and the dummy (has ${levels})`);
  const matrix = {
    veteran: ['setfoot', 'standfast', 'shield', 'centurion', 'tithe'], nightborn: ['lunge', 'cuts', 'set', 'hades', 'nyx'],
    witch: ['wake', 'stirring', 'mist', 'echo', 'price'], plaguedoctor: ['tempo', 'pulse', 'flies', 'stain', 'breath'],
    knight: ['drag', 'swing', 'sling', 'haze', 'storm'], goblin: ['knuckledirt', 'ratrun', 'reynard', 'hermes', 'loki'],
    executioner: ['heelreap', 'blackfurrow', 'arawn', 'thanatos', 'reaper'], pitborn: ['cleaverset', 'earthfold', 'antaeus', 'surtr', 'typhon'],
    dwarf: ['groundset', 'ironsettle', 'dwarf8', 'dwarf9', 'dwarf10'], shieldmaiden: ['cutmark', 'gatherededge', 'shield8', 'shield9', 'shield10'],
  };
  assert.deepEqual((await page.locator('#opponent-select option').evaluateAll(os => os.map(o => o.value))).sort(), Object.keys(matrix).sort());
  let enabled = 0, disabled = 0;
  receipt.catalog = {};
  for (const [opponent, expected] of Object.entries(matrix)) {
    await page.selectOption('#opponent-select', opponent); await page.selectOption('#difficulty-select', { index: 0 });
    const groups = await page.locator('#spar-special optgroup').evaluateAll(gs => gs.map(g => ({ label: g.label, options: [...g.children].map(o => ({ value: o.value, disabled: o.disabled })) })));
    assert.deepEqual(groups.map(g => g.label), ['L1–3', 'L4–7', 'L8', 'L9', 'L10']);
    assert.deepEqual(groups.map(g => g.options), expected.map((id, i) => [{ value: id ?? `unavailable-${i}`, disabled: id === null }]), opponent);
    enabled += groups.flatMap(g => g.options).filter(o => !o.disabled).length;
    disabled += groups.flatMap(g => g.options).filter(o => o.disabled).length;
    receipt.catalog[opponent] = groups;
    assert.equal(await page.locator('#spar-special').inputValue(), expected[0] ?? 'none', `${opponent}: class change resets A`);
    await page.selectOption('#difficulty-select', '46');
    assert.equal(await page.locator('#spar-special').inputValue(), expected[4], `${opponent}: L10 default`);
    await page.selectOption('#spar-special', expected[2]);
    assert.equal(await page.locator('#difficulty-select').inputValue(), '46', 'manual preview preserves Difficulty');
    await page.selectOption('#difficulty-select', '35');
    assert.equal(await page.locator('#spar-special').inputValue(), expected[1] ?? 'none', `${opponent}: Difficulty resets B`);
    await page.selectOption('#difficulty-select', 'dummy');
    assert.equal(await page.locator('#spar-special').isDisabled(), true, 'Dummy cannot select a special');
    assert.equal(await page.locator('#spar-special').inputValue(), 'none', 'Dummy selects no registered move, including classes with a registered A');
    assert.equal(await page.locator('#spar-special-status').textContent(), 'Opponent: Dummy does not cast special moves.');
  }
  assert.deepEqual({ enabled, disabled }, { enabled: 50, disabled: 0 });
  receipt.playerCatalog = await page.locator('#spar-skill option').evaluateAll(os => os.map(o => ({ value: o.value, disabled: o.disabled })));
  assert.equal(receipt.playerCatalog.filter(o => o.value.startsWith('special:') && !o.disabled).length, 50, '50 supported player presets');
  assert.equal(receipt.playerCatalog.filter(o => o.value.startsWith('unavailable:') && o.disabled).length, 0, 'all player slots are registered');
  assert.equal(receipt.playerCatalog.filter(o => !o.disabled && o.value !== 'none' && !o.value.startsWith('special:')).length, 11, 'legacy player skills retained');
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
  assert.deepEqual(booted.search, { ...PICK, spar: '1', special: 'none', yourSpecial: 'none', arena: 'ladder' }, 'Dummy carries explicit NONE and Ladder');
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
  // Opponent-only Nyx goes through the form and Start, with Your explicitly off.
  await page.goto(new URL('/?debug=1&opponent=nightborn', site.url).href); await waitForGame(page, { art: true });
  await page.locator('#journal-button').tap(); await page.locator('#sparring-tab').tap();
  await page.selectOption('#opponent-select', 'nightborn');
  const groups = await page.locator('#spar-special optgroup').evaluateAll(os => os.map(o => o.label));
  assert.deepEqual(groups, ['L1–3', 'L4–7', 'L8', 'L9', 'L10']);
  assert.equal(await page.locator('#spar-special').inputValue(), 'none', 'held A cannot auto-pick a boss');
  await page.selectOption('#difficulty-select', '46');
  assert.equal(await page.locator('#spar-special').inputValue(), 'nyx', 'Nightborn10 auto-selects Nyx');
  await page.selectOption('#difficulty-select', '10'); await page.selectOption('#spar-special', 'nyx');
  await page.selectOption('#spar-weapon', 'estoc'); await page.selectOption('#spar-skill', 'none');
  const arenaBefore = await page.evaluate(() => sessionStorage.getItem('frankendom.arena-override'));
  const loadsBeforeFields = loads;
  await page.selectOption('#arena-select', 'a'); await page.selectOption('#finisher-select', 'opened');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('frankendom.arena-override')), arenaBefore, 'Stage field changes write no session configuration');
  assert.equal(loads, loadsBeforeFields, 'Stage/Finisher field changes do not navigate');
  assert.match(await page.locator('#spar-special-status').textContent(), /L10 special; opponent difficulty 2/);
  receipt.specialField = await page.locator('#spar-special').evaluate(e => {
    const style = getComputedStyle(e), box = e.getBoundingClientRect();
    const luminance = color => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const a = luminance(style.backgroundColor), b = luminance(style.color);
    return { background: style.backgroundColor, color: style.color, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), fontSize: style.fontSize, width: box.width, right: box.right, viewport: document.documentElement.clientWidth };
  });
  assert.notEqual(receipt.specialField.background, 'rgb(255, 255, 255)', 'mobile field no longer white');
  assert.notEqual(receipt.specialField.color, receipt.specialField.background);
  assert.ok(receipt.specialField.contrast >= 4.5, 'mobile select text contrast is at least4.5:1');
  assert.equal(receipt.specialField.viewport, 375);
  assert.ok(receipt.specialField.right <= receipt.specialField.viewport + 1, 'native select fits375');
  await page.screenshot({ path: 'artifacts/sparring-browser-check/special-form-375.png' });
  await Promise.all([page.waitForURL(/special=nyx/), page.locator('#spar-start').tap()]);
  await waitForGame(page, { art: true });
  receipt.specialBoot = await page.evaluate(() => ({ search: Object.fromEntries(new URLSearchParams(location.search)), weapon: document.getElementById('spar-weapon').value, skill: document.getElementById('spar-skill').value, special: document.getElementById('spar-special').value }));
  assert.deepEqual(receipt.specialBoot.search, { opponent: 'nightborn', spar: '1', weapon: 'estoc', difficulty: '10', skill: 'none', special: 'nyx', yourSpecial: 'none', arena: 'a', finisher: 'opened' });
  assert.deepEqual([receipt.specialBoot.weapon, receipt.specialBoot.skill, receipt.specialBoot.special], ['estoc', 'none', 'nyx']);
  assert.equal(await page.locator('#arena-select').inputValue(), 'a');
  assert.equal(await page.locator('#finisher-select').inputValue(), 'opened');
  await page.locator('#attack-button').tap();
  await page.waitForFunction(() => { const stage = globalThis.__special?.().stages[1]; return stage?.stage === 'windup' && stage.progress >= .5; }, null, { timeout: 30000, polling: 50 });
  receipt.specialWindup = await page.evaluate(() => globalThis.__special());
  await page.screenshot({ path: 'artifacts/sparring-browser-check/nyx-windup-375.png' });
  await page.waitForFunction(() => globalThis.__special?.().stages[1]?.stage === 'recover', null, { timeout: 10000, polling: 25 });
  receipt.specialRecover = await page.evaluate(() => globalThis.__special());
  await page.screenshot({ path: 'artifacts/sparring-browser-check/nyx-recover-375.png' });
  assert.equal(await page.evaluate(() => globalThis.__special().fighters[0].skill), null, 'opponent-only boot has no player skill');
  assert.equal(await page.locator('#skill-button').getAttribute('aria-disabled'), 'true');
  // Keep the existing Stage proof on the Nyx document before subsequent cases navigate.
  // Stages prove real simulation activity; these normal screenshots still require independent visible-FX judgment.
  const debugStage = new URL(page.url()); debugStage.searchParams.set('debug', '1');
  await page.goto(debugStage.href); await waitForGame(page, { art: true });
  receipt.passiveDebugStage = await page.evaluate(() => ({ fog: globalThis.__view.arena.group.parent.fog.color.getHexString(), density: globalThis.__view.arena.group.parent.fog.density }));
  assert.deepEqual(receipt.passiveDebugStage, { fog: '261c1a', density: .028 }, 'separate passive debug reload draws the selected Night Pit');
  async function openForm(search = '/?debug=1&opponent=nightborn&spar=1&weapon=estoc&difficulty=6&skill=none&special=none&yourSpecial=none') {
    await page.goto(new URL(search, site.url).href); await waitForGame(page, { art: true });
    await page.locator('#journal-button').tap(); await page.locator('#sparring-tab').tap();
  }
  let beforeStartStorage;
  const storageSnapshot = () => page.evaluate(() => Object.fromEntries(['frankendom.fighter.v1', 'frankendom.controls.v1', 'frankendom.scorecard.v1', 'frankendom.fight.v1'].map(key => [key, localStorage.getItem(key)])));
  async function startForm() {
    beforeStartStorage = await storageSnapshot();
    const expected = await page.evaluate(() => {
      const value = id => document.getElementById(id).value, your = value('spar-skill');
      return { opponent: value('opponent-select'), difficulty: value('difficulty-select'), weapon: value('spar-weapon'), skill: your.startsWith('special:') || your === 'none' ? 'none' : your, special: value('spar-special'), yourSpecial: your.startsWith('special:') ? your.slice(8) : 'none' };
    });
    await Promise.all([page.waitForEvent('load'), page.locator('#spar-start').tap()]);
    await waitForGame(page, { art: true });
    const actual = Object.fromEntries(new URL(page.url()).searchParams);
    for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, `real Start navigation carries ${key}`);
    receipt.caseStarts ??= []; receipt.caseStarts.push({ expected, actual });
    await page.locator('#attack-button').tap();
  }
  receipt.preManual = []; receipt.manualMovement = [];
  let lastManual;
  async function manualSkill() {
    // Real draw and cooldown must finish; no debug setter or manufactured cast.
    await page.waitForFunction(() => document.querySelector('#skill-button').getAttribute('aria-disabled') === 'false', null, { timeout: 15000 });
    const origin = await page.evaluate(() => globalThis.__special().fighters[0]);
    const box = await page.locator('#joystick').boundingBox(); assert.ok(box, 'real movement joystick available');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    try {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 32);
      await page.waitForFunction(([x, z]) => { const f = globalThis.__special().fighters[0]; return Math.hypot(f.x - x, f.z - z) >= .25; }, [origin.x, origin.z], { timeout: 5000 });
    } finally { await page.mouse.up(); }
    await page.waitForFunction(() => document.querySelector('#skill-button').getAttribute('aria-disabled') === 'false', null, { timeout: 15000 });
    const before = await page.evaluate(() => globalThis.__special());
    receipt.manualMovement.push({ origin, after: before.fighters[0] }); lastManual = before;
    assert.equal(before.events.some(e => e.actor === 0 && e.type === 'SpecialStarted'), false, 'player preset never casts automatically');
    assert.equal(before.mode, 'sparring'); assert.equal(before.recorder, false); assert.equal(before.practiceOnly, true);
    receipt.preManual.push(before);
    await page.locator('#skill-button').tap();
  }
  async function castLifecycle(label, requireLand = true) {
    const finished = await page.waitForFunction(land => {
      const state = globalThis.__special();
      return state.events.some(e => e.actor === 0 && (e.type === 'SpecialLanded' || (!land && e.type === 'SpecialFizzled'))) ? state : false;
    }, requireLand, { timeout: 15000, polling: 25 });
    const terminal = await finished.jsonValue();
    await finished.dispose();
    const ended = terminal.events.find(e => e.actor === 0 && (e.type === 'SpecialLanded' || (!requireLand && e.type === 'SpecialFizzled')));
    let recovery = null;
    if (requireLand) assert.equal(ended.type, 'SpecialLanded', 'primary player proof must land');
    if (ended.type === 'SpecialLanded') {
      assert.equal(ended.target, 1, 'manual player special lands on foe'); assert.ok(ended.damage > 0);
      assert.ok(terminal.fighters[1].health < lastManual.fighters[1].health, 'real target health decreases');
      // Keep an already observed recovery; capture it before screenshot I/O can consume the short phase.
      if (terminal.stages[0]?.stage === 'recover') recovery = terminal;
      else {
        const recovered = await page.waitForFunction(() => {
          const state = globalThis.__special();
          return state.stages[0]?.stage === 'recover' ? state : false;
        }, null, { timeout: 10000, polling: 25 });
        recovery = await recovered.jsonValue();
        await recovered.dispose();
      }
      // Images follow observed checkpoints; their pixels may be later than the captured phase snapshots.
      await page.screenshot({ path: `artifacts/sparring-browser-check/${label}-after-land-375.png` });
      await page.screenshot({ path: `artifacts/sparring-browser-check/${label}-after-recovery-375.png` });
    }
    await page.waitForFunction(() => globalThis.__special().stages[0] === null, null, { timeout: 15000 });
    receipt[label] = { outcome: ended.type, terminal, recovery, cleared: await page.evaluate(() => globalThis.__special()), storageUnchanged: JSON.stringify(await storageSnapshot()) === JSON.stringify(beforeStartStorage) };
    assert.equal(receipt[label].storageUnchanged, true, 'test cast writes no kit/progression/reward/record');
  }
  await openForm();
  await page.selectOption('#spar-skill', 'miasma'); await page.selectOption('#spar-special', 'none');
  await startForm(); await manualSkill();
  await page.waitForFunction(() => globalThis.__special().events.some(e => e.actor === 0 && e.type === 'AttackStarted' && e.move === 'skill_miasma'));
  receipt.playerMiasma = await page.evaluate(() => globalThis.__special());
  assert.equal(receipt.playerMiasma.fighters[1].specialShare, undefined, 'player Miasma leaves foe special off');
  assert.equal(receipt.playerMiasma.events.some(e => e.actor === 1 && e.type === 'SpecialStarted'), false);
  await page.screenshot({ path: 'artifacts/sparring-browser-check/player-miasma-375.png' });
  assert.deepEqual(await storageSnapshot(), beforeStartStorage, 'legacy player-only cast writes nothing');

  await openForm(); await page.selectOption('#spar-skill', 'special:wake');
  await page.selectOption('#difficulty-select', '46'); await page.selectOption('#opponent-select', 'witch');
  assert.equal(await page.locator('#spar-skill').inputValue(), 'special:wake', 'foe class/rank preserve Your preset');
  await page.selectOption('#difficulty-select', '10'); await page.selectOption('#spar-special', 'none');
  await startForm(); await manualSkill();
  await page.waitForFunction(() => globalThis.__special().stages[0]?.stage === 'windup');
  receipt.playerClass = await page.evaluate(() => globalThis.__special());
  assert.equal(receipt.playerClass.presets[0], 'wake'); assert.equal(receipt.playerClass.fighters[1].specialShare, undefined);
  assert.ok(receipt.playerClass.events.some(e => e.actor === 0 && e.type === 'SpecialStarted'));
  await page.screenshot({ path: 'artifacts/sparring-browser-check/player-wake-375.png' });
  await castLifecycle('playerClassLifecycle');

  await openForm(); await page.selectOption('#spar-skill', 'special:price'); await page.selectOption('#difficulty-select', 'dummy');
  await page.selectOption('#spar-weapon', 'estoc');
  await startForm(); await manualSkill();
  await page.waitForFunction(() => globalThis.__special().stages[0]?.stage === 'windup');
  receipt.playerBoss = await page.evaluate(() => globalThis.__special());
  assert.deepEqual(receipt.playerBoss.presets, ['price', null]); assert.equal(receipt.playerBoss.fighters[0].weapon, 'estoc');
  await page.screenshot({ path: 'artifacts/sparring-browser-check/player-price-solo-375.png' });
  await castLifecycle('playerBossLifecycle');

  await openForm(); await page.selectOption('#spar-skill', 'special:price'); await page.selectOption('#spar-special', 'nyx');
  await startForm(); await manualSkill();
  await page.waitForFunction(() => globalThis.__special().stages[0]?.stage === 'windup');
  receipt.bothPlayerWindup = await page.evaluate(() => globalThis.__special());
  assert.deepEqual(receipt.bothPlayerWindup.presets, ['price', 'nyx']);
  await page.screenshot({ path: 'artifacts/sparring-browser-check/player-price-both-375.png' });
  await castLifecycle('bothPlayerLifecycle', false);
  await page.waitForFunction(() => globalThis.__special().events.some(e => e.actor === 1 && e.type === 'SpecialStarted' && e.name === 'nyxnightfall'), null, { timeout: 30000 });
  receipt.bothCasts = await page.evaluate(() => globalThis.__special());
  assert.ok(receipt.bothCasts.events.some(e => e.actor === 0 && e.type === 'SpecialStarted' && e.name === 'theprice'));
  assert.ok(receipt.bothCasts.events.some(e => e.actor === 1 && e.type === 'SpecialStarted' && e.name === 'nyxnightfall'));

  await openForm('/?debug=1&spar=1&opponent=nightborn&weapon=estoc&difficulty=6&skill=miasma&special=nyx');
  assert.equal(await page.locator('#spar-skill').inputValue(), 'miasma'); assert.equal(await page.locator('#spar-special').inputValue(), 'nyx');
  await Promise.all([page.waitForURL(/yourSpecial=none/), page.locator('#spar-start').tap()]); await waitForGame(page, { art: true });
  receipt.legacyBoth = Object.fromEntries(new URL(page.url()).searchParams);
  assert.equal(receipt.legacyBoth.skill, 'miasma'); assert.equal(receipt.legacyBoth.special, 'nyx'); assert.equal(receipt.legacyBoth.yourSpecial, 'none');
  // Bookmarked trials and old tab storage must still boot the original arena.
  receipt.retiredArenas = [];
  const base = '/?debug=1&opponent=veteran&spar=1&weapon=longsword&difficulty=dummy&skill=none&special=none&yourSpecial=none';
  for (const retired of ['art1', 'portrait']) {
    await page.evaluate(value => sessionStorage.setItem('frankendom.arena-override', value), retired);
    for (const suffix of ['', `&arena=${retired}`]) {
      await page.goto(new URL(base + suffix, site.url).href); await waitForGame(page, { art: true });
      await page.locator('#versus').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#arena-select').inputValue(), '', 'retired URL/storage falls back to Ladder');
      const camera = await page.evaluate(() => { const c = globalThis.__view.pitStage(() => null).camera; return [c.fov, c.near, c.far]; });
      assert.deepEqual(camera, [51, 0.1, 180], 'original camera lens retained');
      receipt.retiredArenas.push({ retired, url: page.url(), camera });
    }
    await page.screenshot({ path: `artifacts/sparring-browser-check/retired-${retired}-default-375.png` });
  }
  assert.deepEqual(receipt.errors, []);
}
try {
  await Promise.race([check(), new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Sparring browser check exceeded180s')), 180000); })]);
  receipt.passed = true;
} catch (e) {
  receipt.failure = String(e?.stack || e); process.exitCode = 1;
  try {
    receipt.failureState = await activePage?.evaluate(() => ({ url: location.href, actual: globalThis.__special?.(), skillButton: document.querySelector('#skill-button')?.getAttribute('aria-disabled'), storage: Object.fromEntries(['frankendom.fighter.v1', 'frankendom.controls.v1', 'frankendom.scorecard.v1', 'frankendom.fight.v1'].map(key => [key, localStorage.getItem(key)])) }));
    await activePage?.screenshot({ path: 'artifacts/sparring-browser-check/failure-375.png' });
  } catch (snapshotError) { receipt.failureSnapshotError = String(snapshotError); }
}
finally {
  clearTimeout(deadline);
  const closed = await Promise.allSettled([browser?.close(), site?.close()]);
  const failure = closed.find(r => r.status === 'rejected');
  if (failure) { receipt.passed = false; receipt.failure = String(failure.reason); process.exitCode = 1; }
}
await writeReceipt('artifacts/sparring-browser-check/receipt.json', receipt);
console.log(JSON.stringify({ passed: receipt.passed, loadsBeforeStart: receipt.loadsBeforeStart, booted: receipt.booted, failure: receipt.failure?.split('\n')[0], errors: receipt.errors.slice(0, 3) }));
