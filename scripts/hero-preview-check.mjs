// Hero preview flag (src/hero-preview.ts) in the built game, WebKit at 375x812 touch, on a MOCKED signed-in QA profile (the
// account-browser-check pattern: a QA Supabase host whose auth and REST answers are served here; nothing leaves this machine) wearing
// the Centurion kit. Checks: `?hero=/herolook/<rig>.glb` loads that rig and never fetches loot.glb (no pieces layered over the set);
// the flag survives a reload (rematch-to-next-rung and the weapon-swap rematch are location.reload()) and the journal's loot screen;
// a refused value (`?hero=/assets/...`, a full URL) boots warrior.glb with no page or console error.
//   node scripts/hero-preview-check.mjs [/herolook/legionary.glb]      receipt: artifacts/hero-preview/receipt.json
import { webkit } from 'playwright';
import { build, preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const RIG = process.argv[2] || '/herolook/legionary.glb';
const outDir = 'artifacts/hero-preview/build', out = 'artifacts/hero-preview', api = 'https://frankendom-qa.supabase.co';
await fs.mkdir(out, { recursive: true });
await build({ logLevel: 'error', build: { outDir }, define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(api), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test_only') } });
const hostedCsp = readFileSync('deploy/frankendom.com.conf', 'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
const csp = hostedCsp.replace(/https:\/\/[a-z0-9-]+\.supabase\.co/, api);
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0, headers: { 'Content-Security-Policy': csp } } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'fighter@example.test', aud: 'authenticated', role: 'authenticated' };
const session = { access_token: 'qa-access-token', refresh_token: 'qa-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
const KIT = { head: 'veteran.Helmet', crest: 'veteran.Crest', chest: 'veteran.Body', arms: 'veteran.Arms', hands: 'veteran.Gloves', legs: 'veteran.Greaves', feet: 'veteran.Boots', off: 'veteran.Shield' };
const loot = { owned: Object.values(KIT), equipped: KIT, pack: [] };
const row = { display_name: 'QA fighter', encounter: 'veteran', victory_marks: 12, loot, revision: 1 };
const receipt = { origin, rig: RIG, profile: 'mocked QA profile, not Dom\'s device', engine: 'WebKit (Playwright), 375x812 touch', runs: [], errors: [] };
const browser = await webkit.launch({ headless: true });
try {
  const run = async (label, query, steps = async () => {}) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const page = await context.newPage(); page.setDefaultTimeout(180000);
    const errors = [], glbs = [];
    page.on('pageerror', (e) => errors.push(`pageerror ${e}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${m.text()}`); });
    page.on('request', (r) => { const p = new URL(r.url()).pathname; if (p.endsWith('.glb')) glbs.push(p); });
    await context.route('**/*sentry.io/**', (r) => r.abort());
    await context.route(`${api}/**`, async (route) => {
      const url = new URL(route.request().url()), json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.pathname === '/auth/v1/user') return json(user);
      if (url.pathname === '/rest/v1/admins') return json(null);
      if (url.pathname === '/rest/v1/rpc/daily_fight') return json({ day: new Date().toISOString().slice(0, 10), number: 1, seed: 12345 });
      if (url.pathname === '/rest/v1/rpc/daily_board_summary') return json({ day: new Date().toISOString().slice(0, 10), fastest_kill: null, cleanest_kill: null, longest_survived: null, fastest_death: null, where: null, pending: 0 });
      if (url.pathname === '/rest/v1/fighter_profiles') return route.request().method() === 'GET' ? json(row) : json([row]);
      return json({ message: `unmocked ${url.pathname}` }, 404);
    });
    await page.addInitScript(({ session, loot }) => {
      localStorage.setItem('frankendom.auth.v1', JSON.stringify(session));
      localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'guest-qa-123', name: 'QA fighter', encounter: 'veteran', career: { victoryMarks: 12 }, loot }));
    }, { session, loot });
    const ready = () => page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
    await page.goto(`${origin}/${query}`); await ready();
    await page.waitForTimeout(3000);   // loot.glb is fetched after the rigs, never gating readiness: give it time to (not) arrive
    await page.screenshot({ path: `${out}/${label}.png` });
    await steps(page, ready);
    const result = { label, query, url: page.url(), glbs: [...glbs], errors: [...errors] };
    receipt.runs.push(result); await context.close();
    return result;
  };
  const hero = (r) => r.glbs.filter((p) => p.startsWith('/herolook/'));
  const lootFetched = (r) => r.glbs.some((p) => /\/loot-[A-Za-z0-9_-]{8}\.glb$/.test(p));
  const warrior = (r) => r.glbs.some((p) => /\/warrior-[A-Za-z0-9_-]{8}\.glb$/.test(p));

  const today = await run('today-kit', '?opponent=veteran');
  assert.ok(lootFetched(today) && warrior(today), 'control: the kit wearer fetches warrior.glb and loot.glb');
  const flagged = await run('preview', `?opponent=veteran&hero=${RIG}`, async (page, ready) => {
    await page.reload(); await ready(); await page.waitForTimeout(3000);   // what rematch-to-next-rung does (location.reload)
    await page.screenshot({ path: `${out}/preview-after-reload.png` });
    await page.locator('#journal-button').tap(); await page.waitForTimeout(1500);   // the loot screen: the journal's Profile
    await page.screenshot({ path: `${out}/preview-loot-screen.png` });
  });
  assert.equal(new URL(flagged.url).searchParams.get('hero'), RIG, '?hero= survives the reload and the loot screen');
  assert.equal(hero(flagged).length, 2, 'the preview rig loads on boot and again after the reload');
  assert.ok(!warrior(flagged), 'warrior.glb is not fetched when the preview rig loads');
  assert.ok(!lootFetched(flagged), 'no loot.glb: the kit is never layered over the preview set');
  assert.deepEqual(flagged.errors, []);
  for (const [label, bad] of [['refused-path', '/assets/warrior.glb'], ['refused-url', 'https://example.com/herolook/x.glb']]) {
    const r = await run(label, `?opponent=veteran&hero=${encodeURIComponent(bad)}`);
    assert.equal(hero(r).length, 0, `${label}: nothing under /herolook/ is fetched`);
    assert.ok(warrior(r), `${label}: today's hero boots`);
    assert.deepEqual(r.errors, [], `${label}: no page or console error`);
  }
  receipt.passed = true;
} catch (error) {
  receipt.errors.push(String(error)); process.exitCode = 1;
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ passed: !!receipt.passed, runs: receipt.runs.map((r) => ({ label: r.label, glbs: r.glbs.length, errors: r.errors.length })), errors: receipt.errors }));
  await browser.close(); await server.close();
}
