// Real SDK + rendered game. Provider transport is controlled; this is not a live Google login receipt.
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const outDir = 'artifacts/account/build', api = 'https://frankendom-qa.supabase.co';
await build({ logLevel: 'error', build: { outDir }, define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(api), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test_only') } });
console.log(execFileSync(process.execPath, ['scripts/check-budget.mjs', outDir], { encoding: 'utf8' }));
// The preview serves the hosted CSP (vite.config.mjs); its connect-src names the live Supabase project, so this build's QA host
// takes that origin's place and every other directive stays exactly as deployed.
const hostedCsp = readFileSync('deploy/frankendom.com.conf', 'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
const csp = hostedCsp.replace(/https:\/\/[a-z0-9-]+\.supabase\.co/, api);
assert.notEqual(csp, hostedCsp, 'hosted CSP must name a Supabase origin for the QA host to replace');
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0, headers: { 'Content-Security-Policy': csp } } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
let inspectedPage;
const receipt = { origin, providerTransport: 'controlled test responses, not live Google', checks: [], errors: [] };
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'fighter@example.test', aud: 'authenticated', role: 'authenticated' };
const session = { access_token: 'qa-access-token', refresh_token: 'qa-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); inspectedPage = page; page.setDefaultTimeout(60000);   // a software-GL runner: text and taps wait behind the game's startup on every navigation
  page.on('pageerror', error => receipt.errors.push(String(error)));
  let row = null, admin = false, failRead = false, failLogout = false, writes = [], authUrl;
  await context.route('**/*sentry.io/**', route => route.abort());
  await context.route(`${api}/**`, async route => {
    const request = route.request(), url = new URL(request.url());
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/auth/v1/authorize') { authUrl = url; return route.fulfill({ contentType: 'text/html', body: '<h1>Google redirect intercepted by local QA</h1>' }); }
    if (url.pathname === '/auth/v1/token') { assert.equal(request.postDataJSON().auth_code, 'qa-code'); return json(session); }
    if (url.pathname === '/auth/v1/logout') return failLogout ? json({ message: 'Sign-out rejected' }, 400) : route.fulfill({ status: 204 });
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/rest/v1/admins') {   // the admins roster: the account reads only its own row (PR #282); null = not an admin
      assert.equal(request.method(), 'GET'); assert.equal(url.searchParams.get('select'), 'user_id'); assert.equal(url.searchParams.get('user_id'), `eq.${user.id}`);
      return json(admin ? { user_id: user.id } : null);
    }
    // The journal's daily line (PR #327) asks the server on every journal open, guest or not: today's warden and the day's board.
    if (url.pathname === '/rest/v1/rpc/daily_fight') { assert.equal(request.method(), 'POST'); return json({ day: new Date().toISOString().slice(0, 10), number: 1, seed: 12345 }); }
    if (url.pathname === '/rest/v1/rpc/mint_share') {   // one short server-minted share id for guests and fighters alike (migration 202609220009)
      assert.equal(request.method(), 'POST'); assert.deepEqual(Object.keys(request.postDataJSON()).sort(), ['opponent', 'record']);
      return json('1a');
    }
    if (url.pathname === '/rest/v1/rpc/daily_board_summary') {   // the board is one server-side summary (migration 202609220007), never a page of rows
      assert.equal(request.method(), 'POST'); assert.deepEqual(Object.keys(request.postDataJSON()), ['on_day']);
      return json({ day: request.postDataJSON().on_day, fastest_kill: null, cleanest_kill: null, longest_survived: null, fastest_death: null, where: null, pending: 0 });
    }
    assert.equal(url.pathname, '/rest/v1/fighter_profiles');
    assert.equal(url.searchParams.get('user_id'), request.method() === 'POST' ? null : `eq.${user.id}`);
    if (request.method() === 'GET') return failRead ? json({ message: 'Temporary service failure' }, 503) : json(row);
    const body = request.postDataJSON(); writes.push(body);
    assert.deepEqual(Object.keys(body).sort(), request.method() === 'POST' ? ['display_name', 'encounter', 'loot', 'user_id', 'victory_marks'] : ['display_name', 'encounter', 'loot', 'victory_marks']);
    if (request.method() === 'PATCH' && url.searchParams.get('revision') !== `eq.${row.revision}`) return json([]);
    row = { display_name: body.display_name, encounter: body.encounter, victory_marks: body.victory_marks, loot: body.loot, revision: (row?.revision ?? 0) + 1 };
    return json([row]);
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'guest-qa-123', name: 'Local fighter', encounter: 'veteran', career: { victoryMarks: 77 } }));
  });
  const requests = []; page.on('request', request => requests.push(request.url()));
  await page.goto(origin);
  // Readiness = the attack button enables (assets decoded, renderer up). 120 s: a software-GL runner spends most of a minute here, and the
  // page's main thread is blocked meanwhile — a click attempted before this hangs until Playwright's own timeout (CI run 35534160181, check 11).
  const ready = p => p.waitForFunction(() => document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
  await ready(page);
  assert.equal(await page.locator('#account-login').isVisible(), false);
  assert.equal(requests.some(url => url.startsWith(api) || /\/account-[^/]+\.js/.test(url)), false);
  await page.locator('#journal-button').tap();
  await page.getByText('Sign in to keep your fighter name', { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'artifacts/account/mobile-guest.png' });
  await page.locator('#account-login').tap();
  await page.waitForURL(`${api}/**`);
  assert.equal(authUrl.searchParams.get('provider'), 'google');
  assert.equal(authUrl.searchParams.get('redirect_to'), `${origin}/?account=return`);
  assert.equal(authUrl.searchParams.get('code_challenge_method'), 's256');
  assert.ok(authUrl.searchParams.get('code_challenge'));
  receipt.checks.push('Guest arena has no account overlay or SDK download; mobile menu layout; Google PKCE redirect');
  await page.goto(`${origin}/?account=return&error=access_denied&error_description=qa`); await ready(page);
  await page.getByText('Sign-in cancelled.', { exact: false }).waitFor();
  assert.equal(new URL(page.url()).search, '');
  receipt.checks.push('Cancelled OAuth returns to usable journal and removes callback parameters');
  await page.evaluate(() => localStorage.setItem('frankendom.auth.v1-code-verifier', JSON.stringify('qa-verifier')));
  row = { display_name: 'Cloud fighter', encounter: 'goblin', revision: 4, victory_marks: 80, loot: { owned: [], equipped: {} } };   // the cloud row carries the loot column (PR #330); a row without it is refused as invalid
  await page.goto(`${origin}/?account=return&code=qa-code`); await ready(page);
  // The sign-in merges the cloud fighter into the device and restarts once on it: the cloud's name and opponent, the higher mark count;
  // nothing is written up because the device had nothing the cloud lacked. No Save / Load buttons (owner 2026-09-21).
  await page.waitForFunction(() => document.querySelector('#opponent-select').value === 'goblin');
  const loaded = await page.evaluate(() => JSON.parse(localStorage.getItem('frankendom.fighter.v1')));
  assert.equal(loaded.name, 'Cloud fighter'); assert.equal(loaded.id, 'guest-qa-123'); assert.deepEqual(loaded.career, { victoryMarks: 80 }, 'a higher cloud count lifts the device count');
  assert.equal(writes.length, 0, 'a sign-in with nothing new on the device writes nothing');
  await page.locator('#journal-button').tap();
  await page.locator('#account-status[data-saved="Cloud fighter"]').waitFor({ state: 'attached' });   // the status line is blank when saved; the attribute is the signal
  const toolsHidden = p => p.evaluate(() => document.querySelector('#test-tools').hidden);
  assert.equal(await toolsHidden(page), true, 'a signed-in account off the admins roster never sees the journal test tools');
  assert.equal(await page.locator('#account-save').count(), 0); assert.equal(await page.locator('#account-load').count(), 0);
  await page.screenshot({ path: 'artifacts/account/mobile-signed-in.png' });
  // A change on this device goes up on the next persist beat, with no button.
  const rename = (name) => page.evaluate(n => { const p = JSON.parse(localStorage.getItem('frankendom.fighter.v1')); p.name = n; localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); window.dispatchEvent(new Event('frankendom:profile')); }, name);
  await rename('Renamed');
  await page.locator('#account-status[data-saved="Renamed"]').waitFor({ state: 'attached' });   // the status line is blank when saved; the attribute is the signal
  assert.equal(row.revision, 5); assert.equal(row.display_name, 'Renamed'); assert.equal(row.victory_marks, 80, 'marks travel with the save');
  // Another device wrote meanwhile: the stale write is refused, retry reads the latest, and the device's change goes up on top of it.
  row = { ...row, revision: 6, display_name: 'Newer device' };
  await rename('Renamed again');
  await page.getByText('Save changed on another device.', { exact: false }).waitFor();   // a real revision conflict keeps its own line (202609260001)
  assert.equal(row.display_name, 'Newer device');
  await page.locator('#account-retry').tap();
  await page.locator('#account-status[data-saved="Renamed again"]').waitFor({ state: 'attached' });   // the status line is blank when saved; the attribute is the signal
  assert.equal(row.revision, 7); assert.equal(row.display_name, 'Renamed again');
  receipt.checks.push('Real SDK code exchange/session recovery; automatic cloud merge on sign-in (never lowers the device count, writes nothing when nothing is new); automatic save on the persist beat with career marks; stale-write refusal and retry');
  failRead = true;
  await page.reload(); await ready(page); await page.locator('#journal-button').tap();
  await page.getByText('Could not read your account.', { exact: false }).waitFor();
  assert.equal(await page.locator('#save-status').textContent(), 'Signed in · not synced', 'a failed account read never claims a save is underway (audit 2026-09-23)');
  failLogout = true; await page.locator('#account-logout').tap();
  // Supabase clears the local session even if remote revocation fails; no stale account controls may survive.
  await page.getByText('Sign in to keep your fighter name', { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('frankendom.auth.v1')), null);
  failLogout = false;
  await page.evaluate(value => localStorage.setItem('frankendom.auth.v1', JSON.stringify(value)), session);
  await page.reload(); await ready(page); await page.locator('#journal-button').tap();
  await page.getByText('Could not read your account.', { exact: false }).waitFor();
  failRead = false; admin = true; await page.locator('#account-retry').tap();
  await page.locator('#account-status[data-saved="Renamed again"]').waitFor({ state: 'attached' });   // the status line is blank when saved; the attribute is the signal
  await page.waitForFunction(() => document.querySelector('#test-tools').hidden === false);
  assert.equal(await page.evaluate(() => document.querySelector('#test-tools').dataset.admin), 'true', 'a roster row reveals the test tools');
  await page.locator('#account-logout').tap();
  await page.getByText('Sign in to keep your fighter name', { exact: false }).waitFor();
  assert.equal(await toolsHidden(page), true, 'sign-out hides the test tools again');
  admin = false;
  assert.equal(await page.evaluate(() => localStorage.getItem('frankendom.auth.v1')), null);
  receipt.checks.push('Service failure cannot overwrite cloud; retry recovers; admins roster gates the journal test tools; sign-out clears session, cloud controls and test tools');
  await page.close();   // the phone page's game loop would starve the desktop page's load on a software-GL runner (third Linux run: page.goto timed out at 30 s)
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } }); desktop.setDefaultTimeout(60000);
  desktop.on('pageerror', error => receipt.errors.push(String(error)));
  await desktop.goto(origin, { timeout: 120000 }); await ready(desktop); await desktop.locator('#journal-button').click();
  await desktop.getByText('Sign in to keep your fighter name', { exact: false }).waitFor();
  assert.equal(await desktop.locator('#journal-button span').isVisible(), true, 'Actual desktop media path');
  assert.equal(await desktop.locator('#account-login').isVisible(), true);
  await desktop.screenshot({ path: 'artifacts/account/desktop-menu.png' });
  await desktop.locator('#close-journal').click();
  assert.equal(await desktop.locator('#account-login').isVisible(), false);
  receipt.checks.push('Account controls inside journal on desktop and mobile, hidden when journal closes');
  assert.deepEqual(receipt.errors, []); receipt.passed = true;
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) { receipt.failure = String(error); receipt.ui = inspectedPage?.isClosed() ? 'phone page closed' : await inspectedPage?.locator('#account').textContent().catch(() => 'not available'); console.error(JSON.stringify(receipt, null, 2)); throw error; }
finally {
  await fs.writeFile('artifacts/account/browser-receipt.json', JSON.stringify(receipt, null, 2));
  await browser.close(); await new Promise(resolve => server.httpServer.close(resolve));
}
