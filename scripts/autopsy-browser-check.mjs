// Release check: the death screen and the autopsy (beta plan brief 2; Dom 2026-09-23 moved the autopsy off the death screen). A real
// browser, the gate's own clock (scripts/lib/harness-clock.mjs): boot against the Centurion, draw the sword, stand still — the idle
// fighter dies — then assert the death screen shows the rank row (`#fight-rank`: the account panel's component, class · bar · next class) and no
// `#autopsy`; the scorecard's last-fight lines are one or two plain lines, the first naming the cause, no "!" or "?"; the field journal's
// record lists the fought opponent first with no autopsy sub-row; a rematch clears the rank line. Mirrors tests/graphics.test.ts
// "fight end: …" through the live DOM.
// Never overrides combat state; the fight is the real one, on harness time, so it lands on the same tick on any machine.
import { chromium } from 'playwright';
import { harnessClock } from './lib/harness-clock.mjs';
import { ROSTER } from '../src/roster.ts';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const CAUSE = /^(Your posture broke|Your guard broke|You were out of stamina|The (cut|heavy|thrust|kick|riposte|counter|critical) landed on your (head|torso|legs)\.)/;
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const url = new URL(process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`);
url.searchParams.set('debug', '1'); url.searchParams.set('opponent', 'veteran');
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { url: url.href, physicalPhone: false, errors: [] };
const out = 'artifacts/autopsy-check'; await fs.mkdir(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  page.setDefaultTimeout(12000);
  await page.route('**/*sentry.io/**', r => r.abort());
  page.on('pageerror', e => receipt.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') receipt.console = [...(receipt.console || []).slice(-9), m.text().slice(0, 200)]; });
  // Load waits are real time (assets); behaviour waits are harness time below.
  await page.goto(url.href);
  await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
  // The rigs attach when #art-status empties (scene.ts assetStatus 'ready') and the NEXT frame compiles every shader: on the runner's
  // software GL that frame holds the main thread for tens of seconds, and a tap issued before it timed out on every CI run while the
  // same tap passed on a Mac's GPU in milliseconds. So the tap waits for the rigs and then for one frame to paint after them — a load
  // wait keyed on the event, not a longer timeout.
  await page.waitForFunction(() => document.querySelector('#art-status').textContent === '', null, { timeout: 120000 });
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.getByRole('button', { name: 'Enter the arena' }).tap();
  await page.waitForFunction(() => document.querySelector('#welcome').hidden && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
  const { run, until } = await harnessClock(page);
  await run(200);
  await page.evaluate(() => { window.__finish = null; window.addEventListener('frankendom:combat', e => { const k = e.detail.events.find(x => x.type === 'Killed'); if (k) window.__finish = k; }); });
  await page.getByRole('button', { name: 'Draw sword', exact: true }).tap();
  await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 5000);
  // Stand still: the Centurion kills an idle fighter well inside 2000 ticks (tests/graphics.test.ts allows 6000). Budget in page time.
  const died = await until(() => window.__finish !== null, 6000 * 16.7);
  receipt.killed = await page.evaluate(() => window.__finish);
  assert.equal(receipt.killed.target, 0, 'the player is the one killed');
  // Dom 2026-09-23: the death screen shows the player's rank line where the autopsy was; the autopsy lines live on in the journal only.
  await until(() => !document.querySelector('#fight-rank').hidden, 2000);
  receipt.rank = await page.evaluate(() => { const row = document.querySelector('#fight-rank'); return { label: row.getAttribute('aria-label'), now: row.querySelector('.rank-now')?.textContent, segments: row.querySelectorAll('.rank-seg').length, next: row.querySelector('.rank-next')?.textContent, same: row.innerHTML === document.querySelector('#rank').innerHTML, autopsyEl: document.querySelector('#autopsy') !== null }; });
  assert.match(receipt.rank.label, /^Recruit I · [○●]( [○●]){2}$/, `the rank row's accessible label: ${receipt.rank.label}`);
  assert.equal(receipt.rank.now, 'Recruit I'); assert.equal(receipt.rank.segments, 5, 'one bar segment per numeral');
  assert.equal(receipt.rank.next, 'Legionary', 'the next class at the right end of the bar');
  assert.equal(receipt.rank.same, true, 'the fight-end row is the account panel\'s component');
  assert.equal(receipt.rank.autopsyEl, false, 'no #autopsy on the death screen');
  assert.ok(await page.locator('#fight-rank').isVisible(), '#fight-rank is visible on the death screen');
  receipt.autopsy = await page.evaluate(() => JSON.parse(localStorage.getItem('frankendom.scorecard.v1')).rows.veteran.last);
  assert.ok(receipt.autopsy.length >= 1 && receipt.autopsy.length <= 2, `one or two lines, got ${receipt.autopsy.length}`);
  assert.match(receipt.autopsy[0], CAUSE, `first line names the cause: ${receipt.autopsy[0]}`);
  for (const l of receipt.autopsy) assert.ok(!/[!?]/.test(l), `plain prose, no ! or ?: ${l}`);
  await page.screenshot({ path: `${out}/death-screen.png` });
  // The field journal keeps the note under the opponent's row for the last fight. The name is read from the roster
  // (ROSTER.veteran.name), never pinned here: #464 renamed 'the Veteran' -> 'the Centurion' and this row broke on the literal.
  await page.getByRole('button', { name: 'Menu and field journal' }).tap();
  await run(100);
  // The field journal opens on Profile (Dom 2026-09-23); the record is on Stats: most-fought first, no autopsy sub-rows any more.
  await page.locator('label[for=journal-tab-fighter]').tap();
  receipt.journal = await page.evaluate((name) => {
    const rows = [...document.querySelectorAll('#scorecard-table tr')].map(r => [...r.children].map(c => c.textContent));
    return { name, first: rows[1], autopsyRows: document.querySelectorAll('#scorecard-table .autopsy-row').length };
  }, ROSTER.veteran.name);
  assert.deepEqual(receipt.journal.first, [ROSTER.veteran.name, '1', '0', '1'], `the one fought opponent, ${ROSTER.veteran.name}, is the first row`);
  assert.equal(receipt.journal.autopsyRows, 0, 'no autopsy line under a record row');
  await page.locator('#close-journal').click();
  await run(100);
  // Rematch is inert until the finisher camera settles (owner 2026-09-22: no HUD button fires while it is still fading in) —
  // finishPhase() runs on the wall clock, not harness ticks, so this wait is real time, same as a player would see.
  await until(() => JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null')?.settled === true, 3000);
  // A rematch clears the rank line.
  await page.locator('#reset-button').click();
  await run(200);
  const navigated = await page.evaluate(() => document.querySelector('#fight-rank') === null).catch(() => true);   // a reload is fine: the new document boots hidden
  if (!navigated) assert.equal(await page.evaluate(() => document.querySelector('#fight-rank').hidden), true, 'the rematch hides the rank line');
  receipt.diedAfterPageMs = died;
  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(JSON.stringify({ passed: receipt.passed, rank: receipt.rank, autopsy: receipt.autopsy, journal: receipt.journal, diedAfterPageMs: receipt.diedAfterPageMs, errors: receipt.errors }));
