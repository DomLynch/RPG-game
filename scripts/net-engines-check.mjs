// Cross-engine determinism for live PvP (docs/duel-architecture.md §2.3). The fixture (src/net/fixture.ts: seeded warden-vs-warden PvP
// duels over every weapon) runs in Node, then in Chromium and WebKit — the engines behind Android Chrome and iOS Safari — served from
// this tree by vite dev. Every fight's fingerprint chain must be identical in all three; one differing fight fails the check.
// CI only (quality.yml `net-engines`); `NET_FIGHTS=<n>` sets the count (default 1,000: Dom, 2026-09-29). Receipt: artifacts/net-engines/receipt.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fightStateAt, fightTrace, fixtureChains } from '../src/net/fixture.ts';

// The first path at which two JSON values differ (e.g. `f.1.body.x`).
const firstDiff = (a, b, at = '') => {
  if (a === b) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return `${at || '(root)'}: ${JSON.stringify(b)} here vs ${JSON.stringify(a)} there`;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], at ? `${at}.${k}` : k); if (d) return d; }
  return null;
};

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
      // The first differing tick of each (up to 10): both engines re-step the fight hashing every tick.
      for (const d of differing.slice(0, 10)) {
        const there = await page.evaluate(async (f) => (await import('/src/net/fixture.ts')).fightTrace(f), d.node.fight), here = fightTrace(d.node.fight);
        d.firstTick = here.findIndex((h, i) => h !== there[i]) + 1;
        if (d.firstTick > 0) d.field = firstDiff(JSON.parse(await page.evaluate(async ([f, t]) => (await import('/src/net/fixture.ts')).fightStateAt(f, t), [d.node.fight, d.firstTick])), JSON.parse(fightStateAt(d.node.fight, d.firstTick)));
      }
      if (differing.length) receipt.differing[name] = differing.slice(0, 10);
      console.log(`${name} ${browser.version()}: ${FIGHTS - differing.length}/${FIGHTS} fights identical to Node ${process.version} (${receipt.engines[name].seconds}s)${differing.length ? `; first differing ticks ${differing.slice(0, 10).map((d) => `fight ${d.node.fight} @ tick ${d.firstTick} (${d.field})`).join(', ')}` : ''}`);
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
receipt.passed = Object.values(receipt.engines).length === 2 && Object.values(receipt.engines).every((e) => e.differing === 0);
receipt.seconds = +((Date.now() - started) / 1000).toFixed(1);
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
console.log(`net-engines-check: ${receipt.passed ? 'PASS' : 'FAIL'} ${FIGHTS} fights, Node + Chromium + WebKit, ${receipt.seconds}s; receipt ${dir}/receipt.json`);
process.exit(receipt.passed ? 0 : 1);
