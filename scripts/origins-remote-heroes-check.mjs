// Other players in Zone 1 (Web, #2929), end to end: a real presence server on loopback, the built origins preview as one signed-in client (real page, stub writer), and headless clients on Backend's
// origins/presence/test-client.ts as the others. Gates:
//   sees   a bot walking east is drawn on the page (remote().shown), moves about as far as it walked, and carries its name tag ("Bob"); a guest bot carries "Guest"; a signed-in bot with no name carries none
//   seen   the page's own player is seen by the bots (an entity in their down packet, and an enter record with the page's name)
//   ninth  nine bots in range after [zone ready]: eight or more figures are drawn (the warmed pool plus one) and the page's render programs do not grow (0 compiles after zone ready)
//   gone   a bot that leaves (closes) is no longer drawn within the expiry
// Serves artifacts/origins-preview (built here when missing). Exit 1 with the numbers on a miss; a receipt goes to artifacts/origins-remote-heroes.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { createPresence, LIMITS } from '../origins/presence/server.ts';
import { joinBot } from '../origins/presence/test-client.ts';
import { serveOriginsPreview, AUTH_KEY } from './lib/origins-preview-harness.mjs';

const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
if (!fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 600_000 });
const acct = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PAGE = acct(1), names = { [PAGE]: 'Alice', [acct(2)]: 'Bob', [acct(3)]: null };   // acct(3): signed in with no name; acct(4..) are the crowd (named after their number)
const verify = async (t) => (t === 'stub.token.value' ? PAGE : /^bot\d+$/.test(t) ? acct(Number(t.slice(3))) : null);
const nameOf = (a) => (a in names ? names[a] : `P${Number(a.slice(-12))}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (ok, ms = 20000) => { for (let t = 0; t < ms; t += 100) { if (await ok()) return true; await wait(100); } return false; };

const presence = createPresence({ verify, nameOf, log: () => {}, limits: { ...LIMITS, ipSockets: 64, ipJoinsPerMinute: 600 } });   // every client is 127.0.0.1: the per-address caps (a production defence) would refuse the ninth socket
await new Promise((r) => presence.server.listen(0, '127.0.0.1', r));
const { origin, close } = await serveOriginsPreview(built);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { origin, physicalPhone: false, errors: [], bots: 0 }, bots = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.setDefaultTimeout(170000);
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  const port = presence.port();
  await page.addInitScript(([key, exp, p]) => {
    localStorage.setItem(key, JSON.stringify({ access_token: 'stub.token.value', expires_at: exp }));
    const Real = window.WebSocket;   // the page asks its own origin for /origins/presence (nginx in production): point that at the loopback presence server
    window.WebSocket = class extends Real { constructor(u, protocols) { super(String(u).replace(/^wss?:\/\/[^/]+/, `ws://127.0.0.1:${p}`), protocols); } };
  }, [AUTH_KEY, Math.floor(Date.now() / 1000) + 3600, port]);
  await page.route((u) => /^\/origins\/[a-z_]+$/.test(u.pathname), (route) => {   // the writer is a stub: it only has to let the page sign in
    const op = new URL(route.request().url()).pathname.split('/').pop();
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    const ok = (result) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result }) });
    return op === 'open' ? ok({ characters: [{ id: 'pc:still', name: 'Alice' }] }) : route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'stub' }) });
  });
  await page.goto(`${origin}/preview/origins/?region=1&zone=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 170000 });
  assert.ok(await page.waitForFunction(() => window.originsPreview.remote() !== null, null, { timeout: 120000 }).then(() => true).catch(() => false), 'the remote view never came up (the hero rig did not load)');
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 }).catch(() => { throw new Error('zone never ready: [zone ready] (window.__zoneReady) did not fire'); });
  const programs = () => page.evaluate(() => window.originsPreview.renderInfo().programNames.length);
  const programsBefore = await programs(); receipt.programsBeforeBots = programsBefore;
  assert.ok(await until(async () => (await page.evaluate(() => window.originsPreview.presence().state)) === 'live', 60000), 'the page never reached presence (state is not live)');

  // sees: Bob (named), then a guest, then an unnamed signed-in player; Bob walks east
  const join = async (token) => {   // the page warps itself to Zone 1's start landmark when it joins (main.ts onHello): so does each bot, or it would stand at the default spawn, out of range
    const b = await joinBot(port, token); bots.push(b); receipt.bots = bots.length;
    b.warp('zone1-start'); assert.ok(await until(() => b.hellos() >= 2, 10000), `bot ${token} was not warped to zone1-start`);
    return b;
  };
  const diag = async () => JSON.stringify({ page: await page.evaluate(() => ({ pos: { x: window.originsPreview.pos.x, z: window.originsPreview.pos.z }, presence: window.originsPreview.presence(), remote: window.originsPreview.remote() })), bots: bots.map((b) => b.at()) });
  const bob = await join('bot2'), bobId = presence.world.byAccount.get(acct(2)).id;
  const drawn = (id) => page.evaluate((i) => window.originsPreview.remote().shown.find((s) => s.id === i) ?? null, id);
  assert.ok(await until(async () => (await drawn(bobId))?.tag === 'Bob'), `Bob is not drawn with his name: ${await diag()}`);
  const start = await drawn(bobId), from = bob.at();
  for (let i = 1; i <= 8; i++) { bob.pose(from.x + i * 1.5, from.z); await wait(150); }
  assert.ok(await until(async () => { const s = await drawn(bobId); return s && Math.hypot(s.x - start.x, s.z - start.z) >= 8; }), `Bob walked 12 m and the page shows him moving less than 8: ${JSON.stringify([start, await drawn(bobId)])}`);
  receipt.bobMoved = { start, end: await drawn(bobId) };
  const guest = await join(null), guestId = guest.hello.id;
  assert.ok(await until(async () => (await drawn(guestId))?.tag === 'Guest'), `the guest is not tagged "Guest": ${JSON.stringify(await drawn(guestId))}`);
  await join('bot3'); const unnamedId = presence.world.byAccount.get(acct(3)).id;
  assert.ok(await until(async () => (await drawn(unnamedId))?.visible === true), 'the unnamed player is not drawn');
  assert.equal((await drawn(unnamedId)).tag, '', 'a signed-in player with no name carries no tag');

  // seen: the bots see the page's own player, and its name
  assert.ok(await until(() => bob.seen().length >= 1 && bob.entered().some((e) => e.name === 'Alice')), `the bots do not see the page's player: seen ${bob.seen().length}, entered ${JSON.stringify(bob.entered())}`);

  // ninth: a crowd after [zone ready]: the pool holds, no program is added
  for (let n = 4; n <= 11; n++) await join(`bot${n}`);
  assert.ok(await until(async () => (await page.evaluate(() => window.originsPreview.remote().shown.length)) >= 9, 30000), `the crowd is not drawn: ${JSON.stringify(await page.evaluate(() => window.originsPreview.remote()))}`);
  await wait(3000);
  const programsAfter = await programs(); receipt.programsAfterBots = programsAfter; receipt.shown = await page.evaluate(() => window.originsPreview.remote().shown.length);
  assert.equal(programsAfter, programsBefore, `a remote added render programs after zone ready: ${programsBefore} -> ${programsAfter}`);

  // tags: a bot that leaves is gone within the expiry, and its slot is reused with no stale name
  bob.close();
  assert.ok(await until(async () => !(await drawn(bobId)), 8000), 'Bob left and is still drawn');
  receipt.pass = true;
} catch (e) { receipt.pass = false; receipt.failure = String(e.message ?? e).slice(0, 1800); console.error('FAIL', receipt.failure); }
finally {
  for (const b of bots) try { b.close(); } catch { /* already closed */ }
  fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync('artifacts/origins-remote-heroes.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
  await browser.close(); await close(); await presence.close();
  process.exit(receipt.pass ? 0 : 1);
}
