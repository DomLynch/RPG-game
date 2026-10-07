// Real SDK + rendered game. Provider transport is controlled; this is not a live Google login receipt.
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { rankFor } from '../src/career.ts';
import { encodeRecord } from '../src/record.ts';
import { liveRecorder } from '../tests/lib/live-recorder.ts';   // era flags on (RV29 refuses a headless recorder's older stamp)
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
  let row = null, standing = { marks: 12, owned: [], pending: 1, pending_owned: [] }, admin = false, failRead = false, failLogout = false, writes = [], claimPosts = [], claimedHashes = new Set(), authUrl;
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
    if (url.pathname === '/rest/v1/rpc/mint_share') {   // one short server-minted share id for guests and fighters alike (migration 202609220009)
      assert.equal(request.method(), 'POST'); assert.deepEqual(Object.keys(request.postDataJSON()).sort(), ['opponent', 'record']);
      return json('1a');
    }
    if (url.pathname === '/rest/v1/rpc/my_standing') {   // the account's server standing (migration 202609230001): the rank reads it, never the save's count
      assert.equal(request.method(), 'POST'); return json([standing]);
    }
    if (url.pathname === '/rest/v1/loot_claims') {   // the claim outbox (migration 202609230001): owner insert; the record hash is unique, first claimer wins
      assert.equal(request.method(), 'POST'); assert.equal(request.headers().authorization, `Bearer ${session.access_token}`);
      const body = request.postDataJSON(), status = claimedHashes.has(body.record) ? 409 : 201; claimedHashes.add(body.record);
      claimPosts.push({ opponent: body.opponent, piece: body.piece, record: body.record, status });
      return status === 201 ? route.fulfill({ status }) : json({ code: '23505', message: 'duplicate key value violates unique constraint' }, 409);
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
  // The rank is the server's figure (marks + pending), not the save's 80: a forged or stale device count never becomes rank (SCOPE 9).
  await page.waitForFunction(label => document.querySelector('#rank').getAttribute('aria-label') === label, rankFor(standing.marks + standing.pending).label);
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
  // A win whose player leaves without a last word (#943): the page going away (pagehide, not the back/forward cache) sends the open
  // entry itself, with keepalive. Playwright's routing never sees a request made by an unloading page (real Chromium and WebKit do send
  // it, preflight and all), so the page records the fetch it made; the stub then answers as hosted would once that claim landed: the next
  // load's re-post is 23505 (the global record hash) and the outbox empties with no second claim.
  const qaRecord = 'qa-pagehide-record-1';
  await page.evaluate(({ userId, record }) => {
    localStorage.setItem('frankendom.claims.v1', JSON.stringify([{ userId, opponent: 'goblin', record, piece: null, final: false }]));
    const send = window.fetch;   // main.ts reads the global fetch at pagehide time
    window.fetch = (input, init) => {
      if (String(input).endsWith('/rest/v1/loot_claims')) localStorage.setItem('qa.claim-sent', JSON.stringify({ url: String(input), method: init?.method, keepalive: init?.keepalive, auth: init?.headers?.Authorization, body: JSON.parse(init?.body ?? 'null') }));
      return send(input, init);
    };
    addEventListener('pagehide', event => localStorage.setItem('qa.pagehide-persisted', String(event.persisted)));
  }, { userId: user.id, record: qaRecord });
  assert.equal(claimPosts.length, 0, 'an open claim is not posted while the page stays');
  claimedHashes.add(qaRecord);   // the keepalive claim reached hosted
  await page.reload(); await ready(page);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('frankendom.claims.v1') ?? '[]').length === 0);
  const hidden = await page.evaluate(() => ({ persisted: localStorage.getItem('qa.pagehide-persisted'), sent: JSON.parse(localStorage.getItem('qa.claim-sent') ?? 'null') }));
  assert.equal(hidden.persisted, 'false', 'a reload is a real pagehide, not the back/forward cache');
  assert.deepEqual(hidden.sent, { url: `${api}/rest/v1/loot_claims`, method: 'POST', keepalive: true, auth: `Bearer ${session.access_token}`, body: { opponent: 'goblin', piece: null, record: qaRecord } }, 'the leaving page sent the open entry, final with no piece, with keepalive and the stored token');
  assert.deepEqual(claimPosts, [{ opponent: 'goblin', piece: null, record: qaRecord, status: 409 }], 'the next load posts it once more, 23505 drops it: one claim either way');
  receipt.pagehide = { sent: { ...hidden.sent, auth: 'Bearer <qa token>' }, nextLoadPosts: claimPosts };
  receipt.checks.push('A signed-in win left with no last word is sent on pagehide (keepalive, stored token, not bfcache); the next load\'s re-post is 23505 and the outbox empties');
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
  await desktop.locator('#nav-arena').click();
  assert.equal(await desktop.locator('#account-login').isVisible(), false);
  receipt.checks.push('Account controls inside journal on desktop and mobile, hidden when journal closes');
  await desktop.close();
  // Re-pinned (Daily removed, Dom 2026-09-29): an old `?daily=1` link boots the LADDER fight, in the EQUIPPED kit, and asks the server
  // nothing daily. A fresh guest with the Nightborn's estoc equipped opens it: no daily banner, the estoc in hand, and no Supabase call at
  // all before a fight ends (the daily_fight / daily_board_summary endpoints stay on the server, unused by this client).
  const dailyContext = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const daily = await dailyContext.newPage(); inspectedPage = daily; daily.setDefaultTimeout(60000);
  daily.on('pageerror', error => receipt.errors.push(String(error)));
  const dailyCalls = [];
  await dailyContext.route('**/*sentry.io/**', route => route.abort());
  await dailyContext.route(`${api}/**`, route => { dailyCalls.push(new URL(route.request().url()).pathname); return route.abort(); });   // any call is a finding: the assertion below names it
  await daily.addInitScript(() => {
    if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'guest-daily-1', name: 'Daily fighter', loot: { owned: ['nightborn.Estoc'], equipped: { main: 'nightborn.Estoc' } } }));
  });
  await daily.goto(`${origin}/?daily=1`, { timeout: 120000 });
  await ready(daily);
  const dailyView = await daily.evaluate(() => ({ search: location.search, status: document.querySelector('#combat-status').textContent, banner: document.querySelector('#replay-banner')?.textContent ?? '' }));
  receipt.daily = { ...dailyView, calls: dailyCalls };
  await daily.screenshot({ path: 'artifacts/account/mobile-old-daily-link.png' });
  assert.doesNotMatch(dailyView.banner, /daily/i, `no daily banner: ${dailyView.banner}`);
  assert.match(dailyView.status, /^Tap Fight\./, `the ladder fight waits sheathed: ${dailyView.status}`);
  // The sheathed line stopped naming the weapon (Draw → Fight, Dom 2026-09-29), so the estoc receipt is the draw line after the tap.
  await daily.waitForFunction(() => document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
  await daily.getByRole('button', { name: 'Fight', exact: true }).tap();
  await daily.waitForFunction(() => /^Drawing estoc/.test(document.querySelector('#combat-status').textContent), null, { timeout: 10000, polling: 16 });
  assert.deepEqual([...new Set(dailyCalls)], [], 'an old daily link asks the server nothing');
  receipt.checks.push('An old ?daily=1 link boots the ladder in the equipped kit: no daily banner, no daily call, "Drawing estoc…" after Fight');
  // B3 (Dom's Safari, 2026-09-30): a kill link is self-contained (Strategy). A signed-in viewer at a high rank, wearing loot, and a guest open
  // the same level-1 link; both pages must show the FIGHT: its rank on the HUD (Lead 2026-09-30) and no worn loot on the replayed hero.
  // Before the fix the signed-in page dressed both rigs and the HUD from his own save (main.ts careerMarks / wornIds).
  // encodeRecord is async: the stored text is the awaited string (run AV row 14: the un-awaited Promise went up as {}, the page read 'no such fight').
  const linkRecord = await (() => { const rec = liveRecorder({ build: 'dev', opponent: 'veteran', weapon: 'longsword', level: 1, seed: 731 }); for (let i = 0; i < 90; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true }); return encodeRecord(rec.finish('abandoned')); })();
  const viewers = {};
  for (const signedIn of [true, false]) {
    const who = signedIn ? 'signed-in' : 'guest';
    const linkContext = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    const link = await linkContext.newPage(); inspectedPage = link; link.setDefaultTimeout(60000);
    link.on('pageerror', error => receipt.errors.push(String(error)));
    const viewerStanding = { marks: 200, owned: ['dwarf.Greaves'], pending: 0, pending_owned: [] };
    await linkContext.route('**/*sentry.io/**', route => route.abort());
    await linkContext.route(`${api}/**`, async route => {
      const request = route.request(), url = new URL(request.url());
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.pathname === '/rest/v1/fight_records') { assert.equal(url.searchParams.get('id'), 'eq.1b'); return json([{ record: linkRecord }]); }
      assert.ok(signedIn, `a guest viewer asked the server for ${url.pathname}`);
      if (url.pathname === '/auth/v1/user') return json(user);
      if (url.pathname === '/rest/v1/admins') return json(null);
      if (url.pathname === '/rest/v1/rpc/my_standing') return json([viewerStanding]);
      if (url.pathname === '/rest/v1/fighter_profiles' && request.method() === 'GET') return json({ display_name: 'High viewer', encounter: 'veteran', revision: 1, victory_marks: 200, loot: { owned: ['dwarf.Greaves'], equipped: { legs: 'dwarf.Greaves' } } });
      return route.fulfill({ status: 204 });   // no write is expected; a stray one is not what this row checks
    });
    await link.addInitScript(({ signedIn, session }) => {
      if (localStorage.getItem('frankendom.fighter.v1')) return;
      localStorage.setItem('frankendom.fighter.v1', JSON.stringify(signedIn
        ? { version: 1, id: 'viewer-qa-1', name: 'High viewer', encounter: 'veteran', career: { victoryMarks: 200 }, loot: { owned: ['dwarf.Greaves'], equipped: { legs: 'dwarf.Greaves' } } }
        : { version: 1, id: 'viewer-qa-2', name: 'Guest viewer', encounter: 'veteran' }));
      if (signedIn) localStorage.setItem('frankendom.auth.v1', JSON.stringify(session));
    }, { signedIn, session });
    await link.goto(`${origin}/s/1b?debug=1`, { timeout: 120000 });
    // The replay started: PLAY NOW is up. The record is 90 idle ticks with no finish, so after 1.5 s of sim the page stalls on purpose and
    // 'Replay' becomes 'Recorded on an older build' (main.ts, a record that runs out before its finish); under load both can pass inside
    // one frame, so either line counts. A link that never replayed shows the faded page or 'This fight cannot be played here' instead.
    await link.waitForFunction(() => document.querySelector('#reset-button').dataset.play === '1' && /^(Replay|Recorded on an older build)/.test(document.querySelector('#replay-banner').textContent), null, { timeout: 120000 });
    // Signed in, wait for the account to answer (the journal rank turns to his 200 marks) so a late dress from his save would have landed.
    if (signedIn) await link.waitForFunction(label => document.querySelector('#rank').getAttribute('aria-label') === label, rankFor(200).label, { timeout: 60000 });
    await link.waitForTimeout(4000);   // the loot file is local and small: a worn piece that was going to draw has drawn by now
    const seen = await link.evaluate(() => ({ fightRank: document.querySelector('#fight-rank').getAttribute('aria-label'), worn: JSON.parse(document.querySelector('#debug').dataset.worn || '{}').worn ?? null }));
    await link.screenshot({ path: `artifacts/account/kill-link-${who}.png` });
    viewers[who] = seen;
    assert.equal(seen.fightRank, rankFor(0).label, `${who}: the HUD shows the fight's rank, not the viewer's`);
    assert.deepEqual(seen.worn, [], `${who}: the replayed hero wears none of the viewer's loot`);
    await linkContext.close();
  }
  assert.deepEqual(viewers['signed-in'], viewers.guest, 'a signed-in viewer and a guest see the same kill-link fight');
  receipt.killLink = viewers;
  receipt.checks.push('A level-1 kill link shows the same fight to a signed-in rank-200 viewer wearing loot and to a guest: the fight\'s rank on the HUD, no worn loot (B3)');
  assert.deepEqual(receipt.errors, []); receipt.passed = true;
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) { receipt.failure = String(error); receipt.ui = inspectedPage?.isClosed() ? 'phone page closed' : await inspectedPage?.locator('#account').textContent().catch(() => 'not available'); console.error(JSON.stringify(receipt, null, 2)); throw error; }
finally {
  await fs.writeFile('artifacts/account/browser-receipt.json', JSON.stringify(receipt, null, 2));
  await browser.close(); await new Promise(resolve => server.httpServer.close(resolve));
}
