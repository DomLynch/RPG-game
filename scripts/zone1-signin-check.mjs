// Zone 1 "Sign in" round trip (#1889) against a STUBBED Supabase (no Google, no credentials): the arena is built with a fake project URL and every call to it is answered here.
//   success: /?account=signin&next=zone1 -> journal -> Continue with Google -> authorize 302s back with ?code -> token exchange succeeds -> the page goes to /zone1/
//   cancel : the same, but the return is ?error=access_denied -> the page stays on the arena, the stored wish is gone
//   later  : after a cancel, an ordinary arena sign-in that succeeds does NOT jump to /zone1/
// Usage: node scripts/zone1-signin-check.mjs [arena dist dir]   (built here from the repo when no dir is given, into a temp dir)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const SB = 'https://sb.test', root = process.cwd();
let dist = process.argv[2];
if (!dist) {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'signin-arena-'));
  execFileSync('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir'], { stdio: 'inherit', timeout: 900_000, env: { ...process.env, VITE_SUPABASE_URL: SB, VITE_SUPABASE_PUBLISHABLE_KEY: 'stub-key' } });
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(dist, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ARENA = `http://127.0.0.1:${server.address().port}`;
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'stub@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const session = () => ({ access_token: 'stub-access', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'stub-refresh', user });
const json = (body, status = 200) => ({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
const browser = await chromium.launch();
const receipt = { cases: {} };
async function run(name, returnQuery, steps) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } }), page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.route(`${SB}/**`, async (route) => {
    const r = route.request(), url = new URL(r.url());
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname === '/auth/v1/authorize') return route.fulfill({ status: 302, headers: { location: `${ARENA}/?account=return${returnQuery()}` } });
    if (url.pathname === '/auth/v1/token') return route.fulfill(json(session()));
    if (url.pathname === '/auth/v1/user') return route.fulfill(json(user));
    return route.fulfill(json([]));   // rest/rpc: an empty account
  });
  await page.route(`${ARENA}/zone1/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>zone1 stub</title>' }));
  try { await steps(page); receipt.cases[name] = { ok: true, errors }; } finally { await ctx.close(); }
}
const startSignIn = async (page) => {
  await page.goto(`${ARENA}/?account=signin&next=zone1`);
  await page.waitForFunction(() => { const b = document.getElementById('account-login'); return b && !b.hidden && !b.disabled; }, null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => !!sessionStorage.getItem('frankendom.next')), true, 'the wish is remembered');
  assert.equal(new URL(page.url()).search, '', 'the signin params are gone from the address bar');
};
await run('success', () => '&code=stub-code', async (page) => {
  await startSignIn(page);
  await page.click('#account-login');
  await page.waitForURL(/\/zone1\/$/, { timeout: 30000 });
  assert.equal(await page.evaluate(() => sessionStorage.getItem('frankendom.next')), null, 'the wish is used up');
});
let cancelState;
await run('cancel', () => '&error=access_denied', async (page) => {
  await startSignIn(page);
  await page.click('#account-login');
  await page.waitForFunction(() => !location.search.includes('account=return'), null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  assert.equal(new URL(page.url()).pathname, '/', 'stays on the arena');
  cancelState = await page.evaluate(() => sessionStorage.getItem('frankendom.next'));
  assert.equal(cancelState, null, 'the wish is cleared on a cancelled return');
});
await run('later-arena-sign-in-after-cancel', () => '&code=stub-code', async (page) => {
  await page.goto(`${ARENA}/`);   // no signin link this time: the wish was never remembered (or expired)
  await page.evaluate(() => document.getElementById('journal-button').click());   // programmatic, as account-entry does: a first-fight overlay covers the ☰ on a fresh fighter
  await page.waitForFunction(() => { const b = document.getElementById('account-login'); return b && !b.hidden && !b.disabled; }, null, { timeout: 30000 });
  await page.click('#account-login');
  await page.waitForFunction(() => !location.search.includes('account=return'), null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  assert.equal(new URL(page.url()).pathname, '/', 'an ordinary arena sign-in stays on the arena');
});
await browser.close(); server.close();
console.log(JSON.stringify(receipt));
