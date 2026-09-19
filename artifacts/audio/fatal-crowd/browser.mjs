// Native Web Audio observations during ordinary live UI gameplay. No simulation overrides.
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { MANIFEST } from '../../../src/audio/manifest.ts';
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const url = new URL(process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`); url.searchParams.set('debug', '1');
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { url: url.href, physicalPhone: false, errors: [], requests: [] };
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
 await page.locator('#attack-button').tap();
 // Stand within the normal starting attack range: the actual opponent wins through real attacks.
 await page.waitForFunction(() => window.__events.some(e => e.type === 'Killed'), null, { timeout: 90000 });
 receipt.killed = await page.evaluate(() => window.__events.filter(e => e.type === 'Killed'));
 assert.equal(receipt.killed.length, 1); assert.equal(receipt.killed[0].target, 0, 'actual player defeat');
 receipt.audio = await page.evaluate(() => window.__audio);
 const source = name => receipt.audio.find(a => MANIFEST[name].some(([s]) => a.offset === s));
 const voice = source('death_voice'), crowd = source('crowd_cheer'), body = source('kill');
 assert.ok(voice && crowd && body, 'native death voice, crowd and body regions scheduled');
 assert.ok(crowd.when - crowd.calledAt >= .34 && crowd.when - voice.when >= .3, 'crowd follows fatal contact');
 await page.waitForTimeout(650); // let the crowd begin, then pause it through the real menu
 await page.getByRole('button', { name: 'Menu and field journal' }).tap();
 const paused = await page.evaluate(() => window.__audio);
 assert.ok(paused.some(a => a.stop === crowd.id), 'menu stops the live crowd source');
 await page.locator('#close-journal').click(); await page.waitForTimeout(600);
 assert.equal((await page.evaluate(() => window.__audio)).filter(a => a.offset === crowd.offset).length, 1, 'resume does not replay the cheer');
 await page.screenshot({ path: 'artifacts/audio/fatal-crowd/defeat.png' });
 assert.deepEqual(receipt.errors, []); receipt.passed = true;
} finally {
 await fs.writeFile(process.env.AUDIO_RECEIPT || 'artifacts/audio/fatal-crowd/browser.json', JSON.stringify(receipt, null, 2));
 await browser.close(); await server?.close();
}
console.log(JSON.stringify({ passed: receipt.passed, killed: receipt.killed, requests: receipt.requests, errors: receipt.errors }));
