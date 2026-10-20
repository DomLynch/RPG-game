// The load-time gate's page table (scripts/load-time-check.mjs, Strategy via Lead 2026-10-20): the Pit stays the default page with exactly
// today's address, ready signal, routing and receipt; Zone 1 is the origins preview under its vite base, ready at the load cover's lift.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PAGE, PAGES, parseArgs, routeOf } from '../scripts/load-time-check.mjs';

test('load-time pages: pit and zone1 only, pit the default, one receipt each (pit keeps receipt.json)', () => {
  assert.deepEqual(Object.keys(PAGES), ['pit', 'zone1']);
  assert.equal(DEFAULT_PAGE, 'pit');
  const { pit, zone1 } = PAGES;
  assert.deepEqual({ prefix: pit.prefix, query: pit.query, spa: pit.spa, publicFrom: pit.publicFrom, receipt: pit.receipt }, { prefix: '/', query: '', spa: '/s/', publicFrom: null, receipt: 'receipt.json' });
  assert.deepEqual({ prefix: zone1.prefix, query: zone1.query, spa: zone1.spa, publicFrom: zone1.publicFrom, receipt: zone1.receipt }, { prefix: '/preview/origins/', query: '?zone=1&presence=0', spa: null, publicFrom: '../../public', receipt: 'receipt-zone1.json' });
  assert.equal(new Set(Object.values(PAGES).map((p) => p.receipt)).size, Object.keys(PAGES).length, 'two pages never share a receipt');
});

test('load-time pages: the ready signals (pit #attack-button enabled; zone1 the cover lift, never [zone ready])', () => {
  assert.match(String(PAGES.pit.ready), /#attack-button.*aria-disabled.*'false'/);
  assert.match(String(PAGES.zone1.ready), /originsPreview\?\.cover\?\.\(\)/);
  assert.match(String(PAGES.zone1.ready), /c\.atMs/);
  assert.doesNotMatch(String(PAGES.zone1.ready), /zone ready/);
  // The vite base the zone build uses is the prefix it is served under.
  assert.ok(Object.values(PAGES).every((p) => p.prefix.startsWith('/') && p.prefix.endsWith('/')));
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
