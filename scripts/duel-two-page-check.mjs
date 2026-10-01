// A live duel between two real pages (docs/duel-architecture.md §7, stage (a)): the challenger opens `?duel=new`, the guest opens the
// link the page shows, and the two fight over the real path: the relay (scripts/duel-relay.mjs, open minting as on CI), the WebRTC
// data channel when one opens, the lobby handshake and the rollback session. The challenger attacks, the guest stands; the check passes
// only when BOTH pages settle on the same finish with the same confirmed fingerprints, 0 desyncs, 0 refused packets and no page error.
// Real time, not the harness clock: two pages and a socket share one wall clock, and the lobby measures the round trip with it. The
// draws are skipped (a GPU-less runner paints a frame in ~0.5 s), so both pages tick near 60 Hz; the sim, the input and the DOM run as ever.
// CI only (quality.yml `duel-two-page`): no local browser runs (Lead). Receipt: artifacts/duel-two-page/receipt.json.
/* global document */
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout } from 'node:timers';
import { URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { startRelay } from './duel-relay.mjs';
import { skipDraws } from './lib/harness-clock.mjs';
import { launch } from './lib/harness.mjs';

const BUDGET_MS = Number(process.env.DUEL_BUDGET_MS ?? 180_000), dir = 'artifacts/duel-two-page';
const started = Date.now();
const glbs = { challenger: [], guest: [] };   // every .glb each page fetched: the peer is drawn on the hero's rig, so no roster body (veteran) may appear
const receipt = { passed: false, why: '', link: false, artReady: false, glbs, kick: null, shared: 0, pages: [], errors: [], relay: null, seconds: 0 };

const relay = await startRelay({ port: 0, secret: randomBytes(32).toString('hex'), log: () => {}, admit: null });
const { createServer } = await import('vite');
// The page asks its own origin for the relay (transport.ts relayUrl), as nginx serves it on the box: the dev server forwards both the mint and the socket.
const server = await createServer({ server: { host: '127.0.0.1', port: 0, proxy: { '/duel/relay': { target: `http://127.0.0.1:${relay.port}`, ws: true } } }, logLevel: 'error' });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await launch();
const state = (page) => page.evaluate(() => JSON.parse(document.documentElement.dataset.duel ?? 'null'));
const open = async (url, name) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } }), page = await context.newPage();   // the phone width the stills are taken at
  page.setDefaultTimeout(120_000);
  page.on('request', (r) => { const p = new URL(r.url()).pathname; if (p.endsWith('.glb')) glbs[name].push(p); });
  await page.route('**/*sentry.io/**', (route) => route.abort());
  page.on('pageerror', (e) => receipt.errors.push(`${name}: ${String(e).slice(0, 300)}`));
  await page.goto(url);
  await skipDraws(page, true);
  return page;
};
// A picture of what each page shows: draws back on for a moment (the check runs with them off), then off again.
const still = async (page, name) => {
  await page.evaluate(() => { globalThis.__skipDraws = false; });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${dir}/${name}.png` });
  await page.evaluate(() => { globalThis.__skipDraws = true; });
};
mkdirSync(dir, { recursive: true });
try {
  const host = await open(`${origin}/?duel=new&debug=1`, 'challenger');
  await host.waitForFunction(() => /[?&]duel=[\w.-]+/.test(document.getElementById('share-status')?.textContent ?? ''), null, { polling: 100 });
  const link = await host.evaluate(() => document.getElementById('share-status').textContent);
  receipt.link = new URL(link).origin === origin && [...new URL(link).searchParams.keys()].join() === 'duel';   // the guest's token and nothing else
  const guest = await open(`${link}&debug=1`, 'guest');
  for (const page of [host, guest]) await page.waitForFunction(() => JSON.parse(document.documentElement.dataset.duel ?? 'null')?.stage === 'fighting', null, { polling: 100 });

  for (const page of [host, guest]) await page.waitForFunction(() => document.getElementById('art-status')?.textContent === '', null, { polling: 250, timeout: 180_000 });   // the rigs are in (a failed load leaves its notice here)
  receipt.artReady = true;
  await still(host, 'challenger-ready'); await still(guest, 'guest-ready');

  // The challenger walks in and strikes (the first press draws); the guest never presses a key.
  await host.keyboard.down('KeyW');
  let both = [], kicked = false, stillMid = false;
  const room = new URL(link).searchParams.get('duel').split('.')[0];
  for (const t0 = Date.now(); Date.now() - t0 < BUDGET_MS;) {
    await host.keyboard.press('KeyF');
    await new Promise((r) => setTimeout(r, 400));
    both = await Promise.all([state(host), state(guest)]);
    if (!stillMid && both[0]?.stage === 'fighting' && both[0].tick > 150) { stillMid = true; await still(host, 'challenger-mid-fight'); await still(guest, 'guest-mid-fight'); }
    // Reconnect (Strategy 2026-10-01): once the duel is under way, cut the guest's relay socket as a network drop would. The guest must
    // see its own link go down and come back (same token, the relay lets it retake the side) and the duel must still settle identically.
    if (!kicked && both[1]?.stage === 'fighting' && both[1].tick > 120) {
      kicked = relay.kick(room, 1);
      receipt.kick = { sockets: relay.stats().sockets };
      await guest.waitForFunction(() => JSON.parse(document.documentElement.dataset.duel ?? 'null')?.link === false, null, { polling: 50, timeout: 5000 }).then(() => { receipt.kick.sawDown = true; }, () => { receipt.kick.sawDown = false; });
      await guest.waitForFunction(() => JSON.parse(document.documentElement.dataset.duel ?? 'null')?.link === true, null, { polling: 100, timeout: 20_000 }).then(() => { receipt.kick.backUp = true; }, () => { receipt.kick.backUp = false; });
    }
    if (both.every((s) => s?.settled && s.finish) || both.some((s) => s && s.stage !== 'fighting')) break;
  }
  await host.keyboard.up('KeyW');
  receipt.pages = both.map((s) => s && { ...s, hashes: s.hashes.length });
  const [a, b] = both, theirs = new Map(b?.hashes ?? []), shared = (a?.hashes ?? []).filter(([t]) => theirs.has(t));
  receipt.shared = shared.length;
  receipt.why = !a || !b ? 'a page never reported its duel'
    : !a.settled || !b.settled || !a.finish || !b.finish ? `no settled finish within ${BUDGET_MS / 1000} s (stages ${a.stage}/${b.stage}, ticks ${a.tick}/${b.tick})`
    : JSON.stringify(a.finish) !== JSON.stringify(b.finish) ? `the pages disagree on the finish: ${JSON.stringify(a.finish)} vs ${JSON.stringify(b.finish)}`
    : a.finish.victim !== 1 || a.finish.draw ? `the standing guest should have fallen: ${JSON.stringify(a.finish)}`
    : !shared.length || shared.some(([t, h]) => theirs.get(t) !== h) ? `confirmed fingerprints differ or none shared (${shared.length} shared)`
    : a.desyncs || b.desyncs ? `desyncs ${a.desyncs}/${b.desyncs}`
    : a.rejected || b.rejected ? `refused packets ${a.rejected}/${b.rejected}`
    : !kicked || receipt.kick?.backUp !== true ? `the guest's relay socket was ${kicked ? 'cut but its link never came back' : 'never cut'}: ${JSON.stringify(receipt.kick)}`
    : [...glbs.challenger, ...glbs.guest].some((f) => /\/veteran/.test(f)) || !glbs.guest.some((f) => /\/warrior/.test(f)) ? `the peer is not on the hero rig: fetched ${JSON.stringify(glbs)}`   // Option A: no roster body, the hero's warrior.glb on both pages
    : !receipt.link ? `the challenge link carried more than the guest's token: ${link}`
    : receipt.errors.length ? `page errors: ${receipt.errors[0]}` : '';
  receipt.passed = !receipt.why;
} catch (error) {
  receipt.why = String(error).slice(0, 400);
} finally {
  receipt.relay = relay.stats();
  await browser.close(); await server.close(); await relay.close();
}
receipt.seconds = +((Date.now() - started) / 1000).toFixed(1);
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
const [a, b] = receipt.pages;
console.log(`duel-two-page-check: ${receipt.passed ? 'PASS' : `FAIL (${receipt.why})`}; ${a && b ? `path ${a.path}/${b.path} (${a.candidate}/${b.candidate}), delay ${a.delay}, ticks ${a.tick}/${b.tick}, ${receipt.shared} shared fingerprints, ` : ''}${receipt.seconds}s; receipt ${dir}/receipt.json`);
process.exit(receipt.passed ? 0 : 1);
