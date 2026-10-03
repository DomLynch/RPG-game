// No-write arena trial workflow: native Stage/Start, real input, source/dist/public; owned browser/server closed in finally.
import { createServer } from 'vite';
import { launch, phonePage, serveDist, waitForGame, writeReceipt } from './lib/harness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source = process.argv.includes('--source');
const trial = process.argv.includes('--portrait') ? 'portrait' : 'art1';
const out = process.env.STATIC_ARENA_RECEIPT_DIR || `artifacts/static-arena-${trial}`;
const receipt = { trial, mode: source ? 'source' : process.env.QA_URL ? 'public' : 'dist', errors: [], consoleErrors: [], responses: [], blockedWrites: [], stages: [], passed: false };
let site, browser;
try {
  if (source) {
    const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: true } });
    await server.listen(); site = { url: `http://127.0.0.1:${server.httpServer.address().port}`, close: () => server.close() };
  } else site = await serveDist();
  receipt.url = site.url;
  await fs.mkdir(out, { recursive: true });
  browser = await launch();
  const { page } = await phonePage(browser, { viewport: { width: 375, height: 812 }, timeout: 30000, errors: receipt.errors });
  // Measurement never sends production writes. Asset GETs remain real; attempted telemetry/cloud writes are recorded and blocked.
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) { receipt.blockedWrites.push({ url: url.href, method: request.method() }); return route.abort(); }
    return url.origin === new URL(site.url).origin || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort();
  });
  page.on('console', message => { if (message.type() === 'error') receipt.consoleErrors.push({ url: page.url(), text: message.text(), at: Date.now() }); });
  page.on('response', response => { if (new URL(response.url()).origin === new URL(site.url).origin && response.status() >= 400) receipt.responses.push({ url: response.url(), status: response.status() }); });
  const storage = () => page.evaluate(() => Object.fromEntries(['frankendom.fighter.v1', 'frankendom.controls.v1', 'frankendom.scorecard.v1', 'frankendom.fight.v1'].map(k => [k, localStorage.getItem(k)])));
  const snap = () => page.evaluate(() => ({ special: globalThis.__special?.(), debug: document.querySelector('#debug')?.textContent, phase: JSON.parse(document.querySelector('#debug')?.dataset.finishPhase || 'null'), blood: JSON.parse(document.querySelector('#debug')?.dataset.blood || 'null'), art: document.querySelector('#art-status')?.textContent }));
  const boot = async arena => {
    await page.goto(new URL(`/?debug=1&spar=1&opponent=veteran&difficulty=dummy&weapon=longsword&skill=none&special=none&yourSpecial=none&arena=${arena}`, site.url).href);
    await waitForGame(page, { art: true });
    await page.waitForFunction(() => document.querySelector('#versus')?.hidden);
  };
  const cameraFrame = () => page.evaluate(() => {
    const view = globalThis.__view, stage = view.pitStage(() => null), c = stage.camera;
    return { lens: [c.fov, c.near, c.far, c.aspect], position: c.position.toArray(), quaternion: c.quaternion.toArray(),
      feet: view.project([0, 0, 4]), head: view.project([0, 2, 4]) };
  });
  await boot('1');
  if (trial === 'portrait') receipt.classicCamera = await cameraFrame();
  await page.screenshot({ path: `${out}/classic-portrait.png` });
  await page.locator('#journal-button').tap(); await page.locator('#sparring-tab').tap();
  const beforeForm = await storage();
  await page.selectOption('#arena-select', trial);
  await page.selectOption('#spar-skill', 'special:price');
  await page.selectOption('#finisher-select', 'decapitation');
  assert.deepEqual(await storage(), beforeForm, 'stage/skill picks do not persist changes');
  await Promise.all([page.waitForEvent('load'), page.locator('#spar-start').tap()]);
  await waitForGame(page, { art: true });
  assert.equal(new URL(page.url()).searchParams.get('arena'), trial, 'native Start carries image 1');
  // Start's URL intentionally omits debug. Re-open its exact valid picks with the existing read-only debug view.
  await page.waitForTimeout(450); // allow the first document's loading-card/asset work to settle before observational navigation
  const nativeURL = page.url();
  const observed = new URL(page.url()); observed.searchParams.set('debug', '1');
  await page.goto(observed.href); await waitForGame(page, { art: true });
  await page.waitForTimeout(450);
  const beforeFight = await storage();
  receipt.nativeStart = { selected: trial, nativeURL, observedURL: observed.href };
  receipt.start = await snap();
  if (trial === 'portrait') {
    receipt.portraitCamera = await cameraFrame();
    for (const key of ['lens', 'position', 'quaternion', 'feet', 'head']) {
      assert.equal(receipt.classicCamera[key].length, receipt.portraitCamera[key].length);
      receipt.classicCamera[key].forEach((n, i) => assert.ok(Math.abs(n - receipt.portraitCamera[key][i]) < 1e-6, `original ${key}[${i}] unchanged`));
    }
    receipt.characterHeight = receipt.portraitCamera.feet[1] - receipt.portraitCamera.head[1];
    assert.ok(receipt.characterHeight > 100, 'native two-metre fighter remains phone-readable');
  }
  assert.ok(receipt.start.debug?.includes('tick'), 'read-only debug reports this fresh fight');
  assert.equal(receipt.start.special.mode, 'sparring'); assert.equal(receipt.start.special.recorder, false);
  await page.screenshot({ path: `${out}/art1-portrait.png` });
  await page.locator('#attack-button').tap(); // real draw
  await page.waitForFunction(() => document.querySelector('#skill-button')?.getAttribute('aria-disabled') === 'false');
  const origin = (await snap()).special.fighters[0];
  const stick = await page.locator('#joystick').boundingBox(); assert.ok(stick);
  await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2); await page.mouse.down();
  try {
    await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2 - 32);
    await page.waitForFunction(() => { const [a, b] = globalThis.__special().fighters; return Math.hypot(a.x - b.x, a.z - b.z) < 1.5; });
  } finally { await page.mouse.up(); }
  receipt.moved = await snap();
  const moved = receipt.moved.special.fighters[0];
  assert.ok(Math.hypot(moved.x - origin.x, moved.z - origin.z) > .25, 'real joystick moves the actor');
  assert.ok(Math.hypot(moved.x, moved.z) <= 8.55, 'movement respects the existing ring boundary');
  await page.screenshot({ path: `${out}/art1-moved.png` });
  await page.locator('#skill-button').tap();
  await page.waitForFunction(() => globalThis.__special().events.some(e => e.type === 'SpecialLanded' && e.actor === 0));
  receipt.landed = await snap();
  await page.screenshot({ path: `${out}/art1-special.png` });
  await page.waitForFunction(() => globalThis.__special().stages[0] === null);
  receipt.recovered = await snap();

  // One real dummy duel; no fabricated health, clock, events or presentation state.
  for (let i = 0; i < 100 && await page.locator('#target-health').evaluate(e => +e.value) > 0; i++) {
    if (await page.locator('#attack-button').getAttribute('aria-disabled') === 'false') await page.locator('#attack-button').tap();
    await page.waitForTimeout(250);
  }
  assert.equal(await page.locator('#target-health').evaluate(e => +e.value), 0, 'real attacks kill the dummy');
  await page.waitForFunction(() => JSON.parse(document.querySelector('#debug')?.dataset.finishPhase || 'null')?.complete, null, { timeout: 20000 });
  receipt.finish = await snap();
  await page.screenshot({ path: `${out}/art1-finish.png` });
  receipt.storage = { before: beforeFight, after: await storage() };
  for (const key of ['frankendom.fighter.v1', 'frankendom.controls.v1', 'frankendom.scorecard.v1']) assert.equal(receipt.storage.after[key], beforeFight[key], `reward-free trial preserves ${key}`);
  // Existing main.ts terminal cleanup clears this AFK marker even in Sparring; it must never contain a live fight record.
  assert.equal(receipt.storage.after['frankendom.fight.v1'], '', 'terminal cleanup leaves no AFK fight record');
  await page.setViewportSize({ width: 812, height: 375 });
  await page.waitForTimeout(350); await page.screenshot({ path: `${out}/art1-landscape.png` });
  receipt.landscape = await snap();
  receipt.network = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /(?:art1|portrait).*webp/.test(e.name)).map(e => ({ url: e.name, encoded: e.encodedBodySize, decoded: e.decodedBodySize, transfer: e.transferSize })));
  await boot('1');
  await page.screenshot({ path: `${out}/classic-landscape.png` });
  assert.equal(new URL(page.url()).searchParams.get('arena'), '1');
  assert.equal((await snap()).art, '', 'classic route loads again');

  // Normal career mode is observed separately: reward-free storage assertions above do not apply here.
  await page.goto(new URL(`/?arena=${trial}&debug=1&opponent=executioner`, site.url).href);
  await waitForGame(page, { art: true }); await page.locator('#attack-button').tap();
  await page.waitForFunction(() => +document.querySelector('#player-health').value === 0, null, { timeout: 90000 });
  await page.waitForFunction(() => !document.querySelector('#pit-button').hidden && !document.documentElement.classList.contains('endgame-fade'), null, { timeout: 20000 });
  await page.locator('#pit-button').tap();
  await page.waitForFunction(() => document.body.dataset.pit === 'on');
  await page.waitForTimeout(800); await page.screenshot({ path: `${out}/art1-pit.png` });
  receipt.pit = await page.evaluate(() => ({ mode: document.body.dataset.pit, art: document.querySelector('#art-status')?.textContent }));
  // Defeat arrives at the rack. Walk to the gate; the rack's Open loadout button is not the exit.
  await page.keyboard.down('KeyD'); await page.waitForTimeout(2000); await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  try { await page.waitForFunction(() => document.querySelector('#pit-ui h2')?.textContent?.includes('gate')); }
  finally { await page.keyboard.up('KeyW'); }
  await page.screenshot({ path: `${out}/art1-pit-gate.png` });
  await page.locator('#pit-ui .pit-go').tap();
  // A defeat rematches in this document; only a career win's Next reloads.
  await page.waitForFunction(() => !document.body.dataset.pit && +document.querySelector('#player-health').value > 0 && +document.querySelector('#target-health').value > 0);
  await waitForGame(page, { art: true });
  await page.waitForFunction(() => {
    const debug = document.querySelector('#debug');
    return debug?.dataset.finishPhase === '' && +debug.dataset.tick < 100 && debug.textContent.includes('you: hp 150');
  });
  receipt.pitReturn = { url: page.url(), state: await snap() };
  assert.equal(new URL(page.url()).searchParams.get('arena'), trial, 'Pit return retains the opt-in trial');
  await page.screenshot({ path: `${out}/art1-pit-return.png` });
  assert.deepEqual(receipt.responses, [], 'no same-origin 404/server errors');
  assert.deepEqual(receipt.errors, [], 'no page errors');
  assert.deepEqual(receipt.consoleErrors, [], 'no console errors');
  assert.deepEqual(receipt.blockedWrites, [], 'no attempted backend writes'); receipt.passed = true;
} finally {
  await writeReceipt(`${out}/receipt.json`, receipt);
  await browser?.close(); await site?.close();
  console.log(JSON.stringify({ passed: receipt.passed, mode: receipt.mode, errors: receipt.errors, responses: receipt.responses }));
}
