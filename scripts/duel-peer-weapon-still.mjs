// Still of a live duel's PEER wielding a ranged weapon (#3387 drew the peer through loadRangedPart): two real pages over the relay as scripts/duel-two-page-check.mjs, each with its own dev-kit weapon
// (sessionStorage frankendom.dev-kit), so the challenger carries CHALLENGER_WEAPON and the guest GUEST_WEAPON (default bow / staff). Each page's screen then shows the OTHER player's weapon on the hero rig.
// Draws stay ON (the check skips them). 375 wide. Stills: artifacts/duel-peer-weapon/<challenger|guest>-<ready|fight>.png; receipt.json names each page's weapon and the rig loads. Not a release row.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout } from 'node:timers';
import process from 'node:process';
import console from 'node:console';
import { startRelay } from './duel-relay.mjs';
import { launch, quietDebug } from './lib/harness.mjs';

const dir = 'artifacts/duel-peer-weapon', weapons = { challenger: process.env.CHALLENGER_WEAPON || 'bow', guest: process.env.GUEST_WEAPON || 'staff' };
const receipt = { weapons, errors: [], stills: [], glbs: { challenger: [], guest: [] } };
mkdirSync(dir, { recursive: true });
const relay = await startRelay({ port: 0, secret: randomBytes(32).toString('hex'), log: () => {}, admit: null });
const { createServer } = await import('vite');
const server = await createServer({ server: { host: '127.0.0.1', port: 0, proxy: { '/duel/relay': { target: `http://127.0.0.1:${relay.port}`, ws: true } } }, logLevel: 'error' });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await launch();
const state = (page) => page.evaluate(() => JSON.parse(document.documentElement.dataset.duel ?? 'null'));
const open = async (url, name) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } }), page = await context.newPage(); await quietDebug(context);
  page.setDefaultTimeout(180_000);
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.endsWith('.glb')) receipt.glbs[name].push(u.pathname); });
  page.on('pageerror', (e) => receipt.errors.push(`${name}: ${String(e).slice(0, 300)}`));
  await page.route('**/*sentry.io/**', (route) => route.abort());
  await context.addInitScript((w) => sessionStorage.setItem('frankendom.dev-kit', JSON.stringify({ weapon: w })), weapons[name]);
  await page.goto(url);
  return page;
};
const shoot = async (page, name, label) => { await new Promise((r) => setTimeout(r, 2500)); const file = `${dir}/${name}-${label}.png`; await page.screenshot({ path: file }); receipt.stills.push(file); };
let failed = null;
try {
  const host = await open(`${origin}/?duel=new&debug=1`, 'challenger');
  await host.waitForFunction(() => /[?&]duel=[\w.-]+/.test(document.getElementById('share-status')?.textContent ?? ''), null, { polling: 100 });
  const link = await host.evaluate(() => document.getElementById('share-status').textContent);
  const guest = await open(`${link}&debug=1`, 'guest');
  for (const page of [host, guest]) await page.waitForFunction(() => JSON.parse(document.documentElement.dataset.duel ?? 'null')?.stage === 'fighting', null, { polling: 100 });
  for (const page of [host, guest]) await page.waitForFunction(() => document.getElementById('art-status')?.textContent === '', null, { polling: 250 });
  await shoot(host, 'challenger', 'ready'); await shoot(guest, 'guest', 'ready');
  await host.keyboard.down('KeyW');
  for (let i = 0; i < 6; i++) { await host.keyboard.press('KeyF'); await new Promise((r) => setTimeout(r, 400)); }
  await host.keyboard.up('KeyW');
  await shoot(host, 'challenger', 'fight'); await shoot(guest, 'guest', 'fight');
  receipt.pages = await Promise.all([state(host), state(guest)]);
} catch (error) { failed = error; receipt.failure = String(error).slice(0, 400); }
finally { await browser.close(); await server.close(); await relay.close(); }
writeFileSync(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ weapons, stills: receipt.stills, errors: receipt.errors, failure: receipt.failure ?? null, bowGlbs: Object.fromEntries(Object.entries(receipt.glbs).map(([k, v]) => [k, v.filter((f) => /bow|staff/.test(f))])) }));
process.exit(failed || receipt.errors.length ? 1 : 0);
