// Native Web Audio observations during ordinary live UI gameplay. No simulation overrides. Time is the gate's: once the page
// has booted for real, the harness clock (scripts/lib/harness-clock.mjs) advances it frame by frame, so the duel that ends in
// the player's defeat takes the same simulation ticks on a MacBook, a GPU-less VPS or a CI runner — the old wall-clock wait for
// a Killed event (90 s) never arrived on ubuntu-latest, where the live loop crawls.
import { chromium } from 'playwright';
import { harnessClock } from './lib/harness-clock.mjs';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { MANIFEST } from '../src/audio/manifest.ts';
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const url = new URL(process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`); url.searchParams.set('debug', '1');
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { url: url.href, physicalPhone: false, errors: [], requests: [] };
const out = 'artifacts/audio/fatal-browser'; await fs.mkdir(out, { recursive: true });
try {
 const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
 await page.route('**/*sentry.io/**', r => r.abort());
 page.on('pageerror', e => receipt.errors.push(String(e)));
 page.on('response', r => { if (/sprite.*\.(ogg|m4a)/.test(r.url())) receipt.requests.push({ url: r.url(), status: r.status() }); });
 await page.addInitScript(() => {
  window.__audio = []; window.__events = []; let id = 0;
  const ids = new WeakMap(), start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function(...args) { const n = ++id; ids.set(this, n); window.__audio.push({ id: n, when: args[0], offset: args[1], duration: args[2], calledAt: this.context.currentTime }); return start.apply(this, args); };
  AudioBufferSourceNode.prototype.stop = function(...args) { window.__audio.push({ stop: ids.get(this), when: args[0] }); return stop.apply(this, args); };
  window.addEventListener('frankendom:combat', e => window.__events.push(...e.detail.events));
 });
 await page.goto(url.href); await page.getByRole('button', { name: 'Enter the arena' }).tap();
 await page.waitForFunction(() => document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
 const { run, until } = await harnessClock(page);   // from here on, page time moves only when the gate advances it
 await page.locator('#attack-button').tap();
 // Stand within the normal starting attack range: the actual opponent wins through real attacks — in page time, not wall time.
 receipt.defeatPageMs = await until(() => window.__events.some(e => e.type === 'Killed'), 120000);
 receipt.killed = await page.evaluate(() => window.__events.filter(e => e.type === 'Killed'));
 assert.equal(receipt.killed.length, 1); assert.equal(receipt.killed[0].target, 0, 'actual player defeat');
 receipt.audio = await page.evaluate(() => window.__audio);
 const source = name => receipt.audio.find(a => MANIFEST[name].some(([s]) => a.offset === s));
 const voice = source('death_voice'), crowd = source('crowd_cheer'), body = source('kill');
 assert.ok(voice && crowd && body, 'native death voice, crowd and body regions scheduled');
 assert.ok(crowd.when - crowd.calledAt >= .34 && crowd.when - voice.when >= .3, 'crowd follows fatal contact');
 // The cheer is scheduled .35 s after contact in AUDIO time, which the page clock does not govern: on a slow runner one
 // page frame is a second of wall time, so waiting in page time would let the whole 3 s cheer end before the menu opened
 // (run 35566004241: 'menu stops the live crowd source' false). Wait a moment of real time instead, then pause it through the real menu.
 await page.waitForTimeout(400);
 await page.getByRole('button', { name: 'Menu and field journal' }).tap();
 const paused = await page.evaluate(() => window.__audio);
 assert.ok(paused.some(a => a.stop === crowd.id), 'menu stops the live crowd source');
 await page.locator('#close-journal').click(); await run(600);
 assert.equal((await page.evaluate(() => window.__audio)).filter(a => a.offset === crowd.offset).length, 1, 'resume does not replay the cheer');
 await page.screenshot({ path: `${out}/defeat.png` });
 assert.deepEqual(receipt.errors, []); receipt.passed = true;
} finally {
 await fs.writeFile(process.env.AUDIO_RECEIPT || `${out}/browser.json`, JSON.stringify(receipt, null, 2));
 await browser.close(); await server?.close();
}
console.log(JSON.stringify({ passed: receipt.passed, killed: receipt.killed, requests: receipt.requests, errors: receipt.errors }));
