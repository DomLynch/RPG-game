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
  let row = null, failRead = false, failLogout = false, writes = [], authUrl;
  await context.route('**/*sentry.io/**', route => route.abort());
  await context.route(`${api}/**`, async route => {
    const request = route.request(), url = new URL(request.url());
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/auth/v1/authorize') { authUrl = url; return route.fulfill({ contentType: 'text/html', body: '<h1>Google redirect intercepted by local QA</h1>' }); }
    if (url.pathname === '/auth/v1/token') { assert.equal(request.postDataJSON().auth_code, 'qa-code'); return json(session); }
    if (url.pathname === '/auth/v1/logout') return failLogout ? json({ message: 'Sign-out rejected' }, 400) : route.fulfill({ status: 204 });
    if (url.pathname === '/auth/v1/user') return json(user);
    assert.equal(url.pathname, '/rest/v1/fighter_profiles');
    assert.equal(url.searchParams.get('user_id'), request.method() === 'POST' ? null : `eq.${user.id}`);
    if (request.method() === 'GET') return failRead ? json({ message: 'Temporary service failure' }, 503) : json(row);
    const body = request.postDataJSON(); writes.push(body);
    assert.deepEqual(Object.keys(body).sort(), request.method() === 'POST' ? ['display_name', 'encounter', 'user_id', 'victory_marks'] : ['display_name', 'encounter', 'victory_marks']);
    if (request.method() === 'PATCH' && url.searchParams.get('revision') !== `eq.${row.revision}`) return json([]);
    row = { display_name: body.display_name, encounter: body.encounter, victory_marks: body.victory_marks, revision: (row?.revision ?? 0) + 1 };
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
  row = { display_name: 'Cloud fighter', encounter: 'goblin', revision: 4, victory_marks: 80 };
  await page.goto(`${origin}/?account=return&code=qa-code`); await ready(page);
  await page.getByText('Cloud fighter: Cloud fighter.', { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('frankendom.fighter.v1')).name), 'Local fighter');
  assert.equal(writes.length, 0, 'Signing in never overwrites either save');
  await page.screenshot({ path: 'artifacts/account/mobile-signed-in.png' });
  await page.locator('#account-load').tap();
  await page.waitForFunction(() => document.querySelector('#opponent-select').value === 'goblin');
  const loaded = await page.evaluate(() => JSON.parse(localStorage.getItem('frankendom.fighter.v1')));
  assert.equal(loaded.name, 'Cloud fighter'); assert.equal(loaded.id, 'guest-qa-123'); assert.deepEqual(loaded.career, { victoryMarks: 80 }, 'a higher cloud count lifts the device; a lower one never drops it');
  await page.locator('#journal-button').tap();
  await page.getByText('Cloud fighter: Cloud fighter.', { exact: false }).waitFor();
  await page.locator('#account-save').tap();
  await page.getByText('Saved Cloud fighter.', { exact: false }).waitFor();
  assert.equal(row.revision, 5); assert.equal(row.victory_marks, 80, 'marks travel with the save');
  row = { ...row, revision: 6, display_name: 'Newer device' };
  await page.locator('#account-save').tap();
  await page.getByText('Save failed or changed on another device.', { exact: false }).waitFor();
  assert.equal(await page.locator('#account-save').isEnabled(), false);
  assert.equal(row.display_name, 'Newer device');
  await page.locator('#account-retry').tap();
  await page.getByText('Cloud fighter: Newer device.', { exact: false }).waitFor();
  receipt.checks.push('Real SDK code exchange/session recovery; explicit cloud load; whitelisted save with career marks; load never lowers the device count; stale-write conflict and retry');
  failRead = true;
  await page.reload(); await ready(page); await page.locator('#journal-button').tap();
  await page.getByText('Could not read your account.', { exact: false }).waitFor();
  assert.equal(await page.locator('#account-save').isEnabled(), false);
  assert.equal(await page.locator('#account-load').isEnabled(), false);
  failLogout = true; await page.locator('#account-logout').tap();
  // Supabase clears the local session even if remote revocation fails; no stale account controls may survive.
  await page.getByText('Sign in to keep your fighter name', { exact: false }).waitFor();
  assert.equal(await page.locator('#account-save').isVisible(), false);
  assert.equal(await page.locator('#account-load').isVisible(), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('frankendom.auth.v1')), null);
  failLogout = false;
  await page.evaluate(value => localStorage.setItem('frankendom.auth.v1', JSON.stringify(value)), session);
  await page.reload(); await ready(page); await page.locator('#journal-button').tap();
  await page.getByText('Could not read your account.', { exact: false }).waitFor();
  failRead = false; await page.locator('#account-retry').tap();
  await page.getByText('Cloud fighter: Newer device.', { exact: false }).waitFor();
  await page.locator('#account-logout').tap();
  await page.getByText('Sign in to keep your fighter name', { exact: false }).waitFor();
  assert.equal(await page.locator('#account-load').isVisible(), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('frankendom.auth.v1')), null);
  receipt.checks.push('Service failure cannot overwrite cloud; retry recovers; sign-out clears session and cloud controls');
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  desktop.on('pageerror', error => receipt.errors.push(String(error)));
  await desktop.goto(origin); await ready(desktop); await desktop.locator('#journal-button').click();
  await desktop.getByText('Sign in to keep your fighter name', { exact: false }).waitFor();
  assert.equal(await desktop.locator('#journal-button span').isVisible(), true, 'Actual desktop media path');
  assert.equal(await desktop.locator('#account-login').isVisible(), true);
  await desktop.screenshot({ path: 'artifacts/account/desktop-menu.png' });
  await desktop.locator('#close-journal').click();
  assert.equal(await desktop.locator('#account-login').isVisible(), false);
  receipt.checks.push('Account controls inside journal on desktop and mobile, hidden when journal closes');
  assert.deepEqual(receipt.errors, []); receipt.passed = true;
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) { receipt.failure = String(error); receipt.ui = await inspectedPage?.locator('#account').textContent().catch(() => 'not available'); console.error(JSON.stringify(receipt, null, 2)); throw error; }
finally {
  await fs.writeFile('artifacts/account/browser-receipt.json', JSON.stringify(receipt, null, 2));
  await browser.close(); await new Promise(resolve => server.httpServer.close(resolve));
}
