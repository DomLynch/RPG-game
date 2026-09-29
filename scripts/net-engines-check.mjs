// Cross-engine determinism for live PvP (docs/duel-architecture.md §2.3). The fixture (src/net/fixture.ts: seeded warden-vs-warden PvP
// duels over every weapon) runs in Node, then in Chromium and WebKit — the engines behind Android Chrome and iOS Safari — served from
// this tree by vite dev. Every fight's fingerprint chain must be identical in all three; one differing fight fails the check.
// CI only (quality.yml `net-engines`); `NET_FIGHTS=<n>` sets the count (default 1,000: Dom, 2026-09-29). Receipt: artifacts/net-engines/receipt.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fixtureChains } from '../src/net/fixture.ts';

const FIGHTS = Number(process.env.NET_FIGHTS ?? 1000), dir = 'artifacts/net-engines';
const started = Date.now();
const node = fixtureChains(FIGHTS);
const receipt = { fights: FIGHTS, node: process.version, engines: {}, differing: {}, passed: false, seconds: 0 };

const { chromium, webkit } = await import('playwright');
const { createServer } = await import('vite');
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
try {
  for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await type.launch({ headless: true });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(15 * 60 * 1000);
      await page.goto(`${origin}/src/net/fixture.ts`);   // any same-origin document; the module is imported below
      const t0 = Date.now();
      const chains = await page.evaluate(async (n) => (await import('/src/net/fixture.ts')).fixtureChains(n), FIGHTS);
      const differing = chains.filter((c, i) => JSON.stringify(c) !== JSON.stringify(node[i])).map((c) => ({ browser: c, node: node[c.fight] }));
      receipt.engines[name] = { version: browser.version(), seconds: +((Date.now() - t0) / 1000).toFixed(1), differing: differing.length };
      if (differing.length) receipt.differing[name] = differing.slice(0, 10);
      console.log(`${name} ${browser.version()}: ${FIGHTS - differing.length}/${FIGHTS} fights identical to Node ${process.version} (${receipt.engines[name].seconds}s)`);
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
receipt.passed = Object.values(receipt.engines).length === 2 && Object.values(receipt.engines).every((e) => e.differing === 0);
receipt.seconds = +((Date.now() - started) / 1000).toFixed(1);
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
console.log(`net-engines-check: ${receipt.passed ? 'PASS' : 'FAIL'} ${FIGHTS} fights, Node + Chromium + WebKit, ${receipt.seconds}s; receipt ${dir}/receipt.json`);
process.exit(receipt.passed ? 0 : 1);
