import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pagesToOpen, shortPaths, titleOf, zonePages } from '../scripts/lib/zone-pages.mjs';
import { sourceWithImports, vpsSafeRow } from '../scripts/lib/vps-receipts.mjs';

// The release placement reads a row's script AND every relative import it names; one that points at a file that does not exist makes the whole row "Mac-only" (it did, through gen-zones.mjs's template strings, in the first cut of this row).
test('the row is placed by its real source: every import it follows exists, and it is not a Mac-only row', () => {
  const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : null), script = 'scripts/zone-pages-check.mjs';
  assert.notEqual(sourceWithImports(script, read), null, 'a relative import in the script or its imports names a missing file');
  assert.equal(vpsSafeRow(`node ${script}`, ['node', script], read, true), true, 'zone-pages-check is a CI/VPS row, not Mac-only');
});

// The zone-pages release row (scripts/zone-pages-check.mjs) is driven by the zone registry's rows: a zone appears on its list the moment its row exists.
const dirWith = (rows: Record<string, unknown>) => { const d = mkdtempSync(join(tmpdir(), 'zone-pages-')); for (const [f, row] of Object.entries(rows)) writeFileSync(join(d, f), JSON.stringify(row)); return d; };

test('every zone row gives /zone<N>/ and, when it names an alias, /<alias>/; unlisted rows only with --all', () => {
  const dir = dirWith({ 'zone0.row.json': { name: 'Town' }, 'zone2.row.json': { name: 'Two' }, 'zone7.row.json': { name: 'Dungeon 1', unlisted: true, alias: 'dungeon1' }, 'zone12.row.json': { name: 'Twelve', alias: 'twelve12' } });
  const zones = zonePages(dir);
  assert.deepEqual(zones.map((z) => z.id), ['0', '2', '7', '12']);   // zone-number order, "0" is the town
  type Page = { id: string; name: string; path: string };
  assert.deepEqual((pagesToOpen(zones) as Page[]).map((p) => p.path), ['/zone0/', '/zone2/', '/zone12/', '/twelve12/']);
  assert.deepEqual((pagesToOpen(zones, true) as Page[]).map((p) => p.path), ['/zone0/', '/zone2/', '/zone7/', '/dungeon1/', '/zone12/', '/twelve12/']);
  assert.deepEqual(shortPaths(zones).includes('/dungeon1/'), true);   // the server answers an unlisted zone's address too
  assert.equal((pagesToOpen(zones, true) as Page[]).find((p) => p.path === '/dungeon1/')!.name, 'Dungeon 1');
  assert.equal(titleOf('Dungeon 1'), 'Frankendom — Dungeon 1');
});

test('a row without a name, a bad alias or a misnamed file is refused, never skipped', () => {
  assert.throws(() => zonePages(dirWith({ 'zone1.row.json': {} })), /display name/);
  assert.throws(() => zonePages(dirWith({ 'zone1.row.json': { name: 'One', alias: 'Not A Link' } })), /not a short link name/);
  assert.throws(() => zonePages(dirWith({ 'zone01.row.json': { name: 'One' } })), /not a zone row name/);
});

test('the real registry: every row is on the list with its own /zone<N>/ and a name', () => {
  const zones = zonePages();
  assert.ok(zones.length > 0);
  for (const z of zones) { assert.ok(z.paths.includes(`/zone${z.id}/`), z.id); assert.ok(z.name.trim(), z.id); }
  assert.ok(pagesToOpen(zones).length > 0, 'at least one listed page to open');
});
