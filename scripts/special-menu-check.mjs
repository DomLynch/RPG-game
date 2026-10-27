// The Zone 1 burger menu's Specials picker (Beta specials B) at 375x812 on the built origins-preview page, a brand-new guest: the menu has a Specials entry, the picker lists the four in row order with both slots on the defaults
// (Skull Crack, Whirlwind), Equip SPECIAL 1 on Ground Slam moves it in, a skill already in the other slot moves (never in both), the HUD's two buttons wear the new names, the pick is kept in this device's store, and a reload keeps it.
// Usage: node scripts/special-menu-check.mjs <built origins-preview dist> <out dir>   (PIT_GL=1 = software GL)   receipt: <out>/receipt.json   stills: menu-open.png picker-defaults.png picker-swapped.png hud-swapped.png
/* global process, console, window, document, localStorage */
import { launchBrowser } from './lib/harness-browser-launch.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(path.resolve(dist), u.replace(/^\/preview\/origins\//, '')); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.statusCode = 404; res.end(); return; } res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await launchBrowser(chromium, { args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const receipt = { dist, checks: [], errors: [], passed: false };
const ok = (name, detail) => { receipt.checks.push({ name, ...(detail === undefined ? {} : { detail }) }); console.log('ok:', name, detail === undefined ? '' : JSON.stringify(detail)); };
const KEY = 'frankendom.special.slots.v1';
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 240)));
  const url = `http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight&zone=1`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model) && document.getElementById('menu-specials'), null, { timeout: 300000 });
  await page.waitForTimeout(2000);
  const labels = () => page.evaluate(() => ({ one: document.querySelector('#skill-button')?.getAttribute('aria-label'), two: document.querySelector('#skill2-button')?.getAttribute('aria-label') }));
  const l0 = await labels(); assert.equal(l0.one, 'Skull Crack'); assert.equal(l0.two, 'Whirlwind');
  ok('a brand-new guest: the HUD buttons are Skull Crack and Whirlwind', l0);
  await page.locator('#journal-button').click({ force: true });
  assert.ok(await page.evaluate(() => document.getElementById('journal').open), 'the burger opens the menu');
  await page.screenshot({ path: path.join(out, 'menu-open.png') });
  assert.ok(await page.locator('#menu-specials').isVisible(), 'the menu has a Specials entry');
  ok('the burger menu has a Specials entry');
  await page.locator('#menu-specials').click({ force: true });
  assert.ok(await page.evaluate(() => document.getElementById('special-dialog').open), 'Specials opens the picker');
  const entries = await page.locator('#special-dialog .grimoire-entry').evaluateAll((es) => es.map((e) => ({ id: e.dataset.skill, name: e.querySelector('.grimoire-name')?.textContent, buttons: e.querySelectorAll('.grimoire-equip').length })));
  assert.deepEqual(entries.map((e) => e.id), ['cleave', 'reaping', 'stomp', 'lunge']); assert.deepEqual(entries.map((e) => e.name), ['Skull Crack', 'Whirlwind', 'Ground Slam', 'Lunge']); assert.ok(entries.every((e) => e.buttons === 2));
  ok('the picker lists the four in row order, two slot buttons each', entries.map((e) => e.name));
  assert.match(await page.locator('#special-dialog .grimoire-count').textContent(), /SPECIAL 1: Skull Crack · SPECIAL 2: Whirlwind/);
  await page.screenshot({ path: path.join(out, 'picker-defaults.png') });
  await page.locator('#special-dialog .grimoire-entry[data-skill="stomp"] .grimoire-equip[data-slot="1"]').click({ force: true });
  assert.match(await page.locator('#special-dialog .grimoire-count').textContent(), /SPECIAL 1: Ground Slam · SPECIAL 2: Whirlwind/);
  const stored = await page.evaluate((k) => localStorage.getItem(k), KEY); assert.equal(stored, JSON.stringify(['stomp', null]));
  ok('Equip SPECIAL 1 on Ground Slam: the summary and the store follow', stored);
  await page.locator('#special-dialog .grimoire-entry[data-skill="reaping"] .grimoire-equip[data-slot="1"]').click({ force: true });
  assert.match(await page.locator('#special-dialog .grimoire-count').textContent(), /SPECIAL 1: Whirlwind · SPECIAL 2: Skull Crack/);
  ok('a skill already in the other slot moves; the displaced slot takes its alternative, never the same skill twice');
  await page.locator('#special-dialog .grimoire-entry[data-skill="stomp"] .grimoire-equip[data-slot="1"]').click({ force: true });
  await page.locator('#special-dialog .grimoire-entry[data-skill="lunge"] .grimoire-equip[data-slot="2"]').click({ force: true });
  await page.screenshot({ path: path.join(out, 'picker-swapped.png') });
  await page.locator('#special-dialog .grimoire-close').click({ force: true });
  await page.waitForTimeout(500);
  const l1 = await labels(); assert.equal(l1.one, 'Ground Slam'); assert.equal(l1.two, 'Lunge');
  ok('the HUD buttons wear the swapped names', l1);
  await page.screenshot({ path: path.join(out, 'hud-swapped.png') });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('menu-specials') && document.querySelector('#skill-button'), null, { timeout: 300000 }); await page.waitForTimeout(2000);
  const l2 = await labels(); assert.equal(l2.one, 'Ground Slam'); assert.equal(l2.two, 'Lunge');
  ok('a reload keeps the swap (this device)', l2);
  assert.equal(receipt.errors.length, 0, `no page errors: ${receipt.errors.join(' | ')}`);
  receipt.passed = true;
} finally {
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 1));
  await browser.close(); server.close();
}
console.log(receipt.passed ? 'PASS' : 'FAIL');
