// Release check: the death-screen autopsy (beta plan brief 2). A real browser, the gate's own clock (scripts/lib/harness-clock.mjs):
// boot against the Veteran, draw the sword, stand still — the idle fighter dies — then assert the autopsy: `#autopsy` visible with one
// or two plain lines, the first naming the cause, no "!" or "?"; a rematch clears it; the field journal carries the same note as a
// `tr.autopsy-row` right under the Veteran's row. Mirrors tests/graphics.test.ts "autopsy: a death puts…" through the live DOM.
// Never overrides combat state; the fight is the real one, on harness time, so it lands on the same tick on any machine.
import { chromium } from 'playwright';
import { harnessClock } from './lib/harness-clock.mjs';
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
  await page.getByRole('button', { name: 'Enter the arena' }).tap();
  await page.waitForFunction(() => document.querySelector('#welcome').hidden && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
  const { run, until } = await harnessClock(page);
  await run(200);
  await page.evaluate(() => { window.__finish = null; window.addEventListener('frankendom:combat', e => { const k = e.detail.events.find(x => x.type === 'Killed'); if (k) window.__finish = k; }); });
  await page.getByRole('button', { name: 'Draw sword', exact: true }).tap();
  await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 5000);
  // Stand still: the Veteran kills an idle fighter well inside 2000 ticks (tests/graphics.test.ts allows 6000). Budget in page time.
  const died = await until(() => window.__finish !== null, 6000 * 16.7);
  receipt.killed = await page.evaluate(() => window.__finish);
  assert.equal(receipt.killed.target, 0, 'the player is the one killed');
  await until(() => !document.querySelector('#autopsy').hidden, 2000);
  const lines = await page.evaluate(() => [...document.querySelector('#autopsy').children].map(c => ({ tag: c.tagName, text: c.textContent })));
  receipt.autopsy = lines.map(l => l.text);
  assert.ok(lines.length >= 1 && lines.length <= 2, `one or two lines, got ${lines.length}`);
  assert.ok(lines.every(l => l.tag === 'SPAN'), 'each line is a span');
  assert.match(lines[0].text, CAUSE, `first line names the cause: ${lines[0].text}`);
  for (const l of lines) assert.ok(!/[!?]/.test(l.text), `plain prose, no ! or ?: ${l.text}`);
  assert.ok(await page.locator('#autopsy').isVisible(), '#autopsy is visible on the death screen');
  await page.screenshot({ path: `${out}/death-screen.png` });
  // The field journal keeps the note under the Veteran's row for the last fight.
  await page.getByRole('button', { name: 'Menu and field journal' }).tap();
  await run(100);
  receipt.journal = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#scorecard-table tr')];
    const i = rows.findIndex(r => r.firstElementChild?.textContent === 'the Veteran');
    const next = rows[i + 1];
    return { veteranRow: i, nextClass: next?.className ?? null, note: next?.textContent ?? null };
  });
  assert.ok(receipt.journal.veteranRow >= 0, 'the Veteran has a journal row');
  assert.equal(receipt.journal.nextClass, 'autopsy-row', 'a tr.autopsy-row sits right under the Veteran');
  assert.equal(receipt.journal.note, receipt.autopsy.join(' '), 'the journal note is the death-screen text');
  await page.locator('#close-journal').click();
  await run(100);
  // A rematch clears the autopsy.
  await page.locator('#reset-button').click();
  await run(200);
  const navigated = await page.evaluate(() => document.querySelector('#autopsy') === null).catch(() => true);   // a reload is fine: the new document boots hidden
  if (!navigated) assert.equal(await page.evaluate(() => document.querySelector('#autopsy').hidden), true, 'the rematch hides the autopsy');
  receipt.diedAfterPageMs = died;
  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(JSON.stringify({ passed: receipt.passed, autopsy: receipt.autopsy, journal: receipt.journal, diedAfterPageMs: receipt.diedAfterPageMs, errors: receipt.errors }));
