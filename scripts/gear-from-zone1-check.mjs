// Zone 1's Gear button lands on the engine's gear screen at /arena/?gear=1 (Web, 2026-10-09). A fake writer on loopback stands in for the server ledger (gear_open / gear_equip / gear_unequip),
// a signed-in session is seeded, and the page is opened exactly as the button opens it. Checks: the sheet opens on the Profile tab with Back to Zone 1; the piece the server holds (a goblin
// helmet dropped in the pack) is on the sheet; Wear sends gear_equip and the sheet then shows it worn; the flag leaves the address. Stills: artifacts/gear-from-zone1. PIT_GL on the VPS (SwiftShader).
// QA_URL points it at a deployed site; unset, it serves this tree's build (run `npx vite build` first).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { preview } from 'vite';

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.GEAR_RECEIPT_DIR || 'artifacts/gear-from-zone1'; await fs.mkdir(dir, { recursive: true });
const piece = (where, paperdoll) => ({ id: 'inst:g1', item: 'item:loot.goblin.Helmet', lootId: 'goblin.Helmet', slot: 'Helmet', where, index: where === 'equipped' ? null : 0, paperdoll, tier: 'Recruit', version: 1 });
let ledger = { pieces: [piece('pack', null)], worn: {}, packSize: 8, bankSize: 100 };
const seen = [];
// The page's CSP allows only its own origin to be fetched, so the fake writer is the page's own /origins/<op> answered by the browser (page.route), as the live page would reach nginx.
const answer = (route) => {
  const op = route.request().url().split('/').at(-1), cors = { 'access-control-allow-origin': '*' };
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  seen.push({ op, auth: route.request().headers().authorization });
  if (op === 'gear_equip') ledger = { pieces: [piece('equipped', 'head')], worn: { head: 'inst:g1' }, packSize: 8, bankSize: 100 };
  const result = op === 'open' ? { career: { total_credit: 0 }, characters: [{ id: 'c1', name: 'Dom' }], marks: 0 } : ledger;
  return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ ok: true, result }) });
};
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const errors = [], logs = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  page.setDefaultTimeout(240000); page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 160)}`)); await page.route('**/*sentry.io/**', (r) => r.abort()); await page.route('**/origins/*', answer);
  await page.addInitScript((s) => localStorage.setItem('frankendom.auth.v1', s), JSON.stringify({ access_token: 'tok', expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  await page.goto(new URL('/?gear=1', origin).href);
  await page.waitForSelector('#journal[open][data-gear="live"]');
  await page.waitForSelector('#pack li[data-loot="goblin.Helmet"]', { timeout: 60000 }).catch(async (e) => { console.log('NO PIECE. writer saw', JSON.stringify(seen), 'errors', JSON.stringify(errors), 'console', JSON.stringify(logs.slice(-6)), 'pack', await page.evaluate(() => document.getElementById('pack')?.innerHTML.slice(0, 300))); throw e; });
  assert.equal(await page.locator('#gear-back').innerText(), 'Back to Zone 1'); assert.equal(await page.evaluate(() => document.getElementById('journal-tab-profile').checked), true, 'the Profile tab');
  assert.ok(!new URL(page.url()).search.includes('gear=1'), 'the flag leaves the address');
  await page.screenshot({ path: `${dir}/1-server-piece-in-pack.png` });
  await page.locator('#pack li[data-loot="goblin.Helmet"] [data-fit]').tap(); await page.locator('#fitting-wear').tap();
  await page.waitForSelector('#slot-head[data-loot="goblin.Helmet"]'); await page.waitForTimeout(2500);
  assert.deepEqual(seen.map((s) => s.op).filter((o) => o.startsWith('gear_')), ['gear_open', 'gear_equip']); assert.ok(seen.every((s) => s.auth === 'Bearer tok'));
  await page.screenshot({ path: `${dir}/2-worn-from-the-server.png` });
  assert.deepEqual(errors, []); console.log(JSON.stringify({ passed: true, ops: seen.map((s) => s.op) }));
} finally { await browser.close(); await server?.close(); }
