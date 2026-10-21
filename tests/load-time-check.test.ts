// The load-time gate's page table (scripts/load-time-check.mjs, Strategy via Lead 2026-10-20): the Pit stays the default page with exactly
// today's address, ready signal, routing and receipt; Zone 1 is the origins preview under its vite base, ready at the page's settled stamp, with a whole-load byte tripwire.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bytesVerdict, DEFAULT_PAGE, PAGES, pairedDelta, pairOrder, parseArgs, routeOf, sitePaths } from '../scripts/load-time-check.mjs';

test('load-time pages: pit and zone1 only, pit the default, one receipt each (pit keeps receipt.json)', () => {
  assert.deepEqual(Object.keys(PAGES), ['pit', 'zone1']);
  assert.equal(DEFAULT_PAGE, 'pit');
  const { pit, zone1 } = PAGES;
  assert.deepEqual({ prefix: pit.prefix, query: pit.query, spa: pit.spa, publicFrom: pit.publicFrom, receipt: pit.receipt }, { prefix: '/', query: '', spa: '/s/', publicFrom: null, receipt: 'receipt.json' });
  assert.deepEqual({ prefix: zone1.prefix, query: zone1.query, spa: zone1.spa, publicFrom: zone1.publicFrom, receipt: zone1.receipt }, { prefix: '/preview/origins/', query: '?zone=1&presence=0', spa: null, publicFrom: '../../public', receipt: 'receipt-zone1.json' });
  assert.equal(new Set(Object.values(PAGES).map((p) => p.receipt)).size, Object.keys(PAGES).length, 'two pages never share a receipt');
});

test('load-time pages: the ready signals (pit #attack-button enabled; zone1 the settled stamp, never the cover lift or [zone ready])', () => {
  assert.match(String(PAGES.pit.ready), /#attack-button.*aria-disabled.*'false'/);
  // The cover's lift on software GL is always its max hold (HF cpu-upgrade, 12 of 12 samples): zone1 times the load-bound stamp instead.
  assert.match(String(PAGES.zone1.ready), /originsPreview\?\.settledAt\?\.\(\)/);
  assert.doesNotMatch(String(PAGES.zone1.ready), /cover|zone ready/);
  // The vite base the zone build uses is the prefix it is served under.
  assert.ok(Object.values(PAGES).every((p) => p.prefix.startsWith('/') && p.prefix.endsWith('/')));
});

test('load-time bytes: the pit has no whole-load tripwire; zone1 fails a byte or file jump past base unless ruled', () => {
  assert.equal(PAGES.pit.bytes, null);
  const limits = PAGES.zone1.bytes;
  assert.ok(limits.mbDelta > 0 && limits.filesDelta > 0);
  assert.equal(limits.row, '../../origins/zone-rows/zone1.row.json', 'the zone row beside the build (artifacts/origins-preview -> the repo root)');
  assert.equal('quietMs' in limits, false, 'no runtime network-quiet window: it split identical builds 12.25 MB against 19.1 MB on CI');
  const base = { totalMb: 28.3, totalFiles: 240 };
  assert.equal(bytesVerdict(limits, base, base, false).bytesFail, false);
  assert.equal(bytesVerdict(limits, base, { totalMb: 28.3 + limits.mbDelta, totalFiles: 240 + limits.filesDelta }, false).bytesFail, false, 'at the limit passes');
  assert.equal(bytesVerdict(limits, base, { totalMb: 28.3 + limits.mbDelta + 0.1, totalFiles: 240 }, false).bytesFail, true);
  assert.equal(bytesVerdict(limits, base, { totalMb: 28.3, totalFiles: 240 + limits.filesDelta + 1 }, false).bytesFail, true);
  assert.equal(bytesVerdict(limits, base, { totalMb: 40, totalFiles: 300 }, true).bytesFail, false, 'load-time-ruled makes it report-only');
  assert.deepEqual(bytesVerdict(limits, base, { totalMb: 27.8, totalFiles: 238 }, false), { mbGrowth: -0.5, filesGrowth: -2, bytesFail: false });
});

test('load-time paired delta: the median of head_i - base_i, not the difference of the medians; unequal sides throw', () => {
  const s = (xs: number[]) => xs.map((x) => ({ s: x }));
  // Box drift: both sides slow down over the run. The medians differ by 1 s; every pair is within 0.1 s.
  assert.equal(pairedDelta(s([20, 21, 22, 23, 24]), s([20.1, 21.0, 21.9, 23.1, 24.0])), 0);
  assert.equal(pairedDelta(s([20, 20, 20]), s([21.5, 21, 22])), 1.5);
  assert.throws(() => pairedDelta(s([1, 2]), s([1])), /do not pair/);
  assert.deepEqual([PAGES.pit.paired, PAGES.zone1.paired], [false, true]);
  // The absolute tripwire per page (Lead 2026-10-21): the Pit keeps 30 s; Zone 1's identical code read 34 s on a slow CI runner.
  assert.deepEqual([PAGES.pit.limitS, PAGES.zone1.limitS], [30, 45]);
});

test('load-time site paths: every "/x/y.ext" string in a row, once, sorted; the zone1 row names its kit', () => {
  assert.deepEqual(sitePaths({ a: '/world/b.glb', b: ['/world/a.png', 'not/a/path.png', '/world/b.glb'], c: { d: 'zone1', e: 3 } }), ['/world/a.png', '/world/b.glb']);
  assert.deepEqual(sitePaths({ url: '/preview/origins/', id: '/no-extension' }), []);
});

test('load-time runs: the pit keeps 5 base-first pairs; zone1 runs 11 pairs, alternating which side loads first', () => {
  assert.deepEqual([PAGES.pit.runs, PAGES.pit.alternate], [5, false]);
  assert.deepEqual([PAGES.zone1.runs, PAGES.zone1.alternate], [11, true]);
  assert.deepEqual([0, 1, 2].map((i) => pairOrder(i, false)), [['base', 'head'], ['base', 'head'], ['base', 'head']]);
  assert.deepEqual([0, 1, 2].map((i) => pairOrder(i, true)), [['base', 'head'], ['head', 'base'], ['base', 'head']]);
});

test('load-time args: no --page is the pit; --page and --page= name a page; an unknown page throws', () => {
  assert.deepEqual(parseArgs(['a', 'b']), { page: 'pit', dirs: ['a', 'b'] });
  assert.deepEqual(parseArgs(['a', 'b', '--page', 'zone1']), { page: 'zone1', dirs: ['a', 'b'] });
  assert.deepEqual(parseArgs(['--page=zone1', 'a', 'b']), { page: 'zone1', dirs: ['a', 'b'] });
  assert.throws(() => parseArgs(['a', 'b', '--page', 'zone2']), /no page zone2/);
});

test('load-time routing: the pit is served exactly as before; zone1 under its prefix, the site root from public/', () => {
  const { pit, zone1 } = PAGES;
  assert.deepEqual(routeOf(pit, 'D', null, '/'), ['D', '/index.html']);
  assert.deepEqual(routeOf(pit, 'D', null, '/s/abc'), ['D', '/index.html']);
  assert.deepEqual(routeOf(pit, 'D', null, '/assets/x.js'), ['D', '/assets/x.js']);
  assert.deepEqual(routeOf(pit, 'D', null, '/world/x.glb'), ['D', '/world/x.glb']);
  assert.deepEqual(routeOf(zone1, 'Z', 'P', '/preview/origins/'), ['Z', '/index.html']);
  assert.deepEqual(routeOf(zone1, 'Z', 'P', '/preview/origins/assets/index-1.js'), ['Z', '/assets/index-1.js']);
  assert.deepEqual(routeOf(zone1, 'Z', 'P', '/world/goblin.glb'), ['P', '/world/goblin.glb']);
  assert.deepEqual(routeOf(zone1, 'Z', 'P', '/s/abc'), ['P', '/s/abc'], 'no share-link rule on the zone page');
  assert.equal(routeOf(zone1, 'Z', null, '/world/goblin.glb'), null, 'no site-root folder: a 404');
});
