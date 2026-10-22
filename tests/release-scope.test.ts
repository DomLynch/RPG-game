// The release scope is a data row (Lead 2026-10-22: delta rows only, the path->row map as data): scripts/release-scope.json, read by deployRowsFor,
// which deploy.sh and a candidate's release-checks plan both call. Every row it names must exist, and a zone-only diff runs a handful of rows, not the matrix.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deployRowsFor, rows } from '../scripts/release-rows-for.mjs';

const scope = JSON.parse(readFileSync('scripts/release-scope.json', 'utf8')) as { core: string[]; areas: { paths: string[]; rows: string[] }[]; full: string[]; lib_no_rows: string[]; public_scoped: string[] };

test('every row the scope names is a release_commands row', () => {
  const names = new Set(rows.map((r: { name: string }) => r.name));
  for (const spec of [...scope.core, ...scope.areas.flatMap(a => a.rows)]) assert.ok(names.has(spec.split(':')[0]), `${spec} is not in .quality-gate.json release_commands`);
  for (const a of scope.areas) assert.ok(a.paths.length && a.rows.length, `an area needs paths and rows: ${JSON.stringify(a)}`);
});

test('a zone-only diff runs core + the writer boot row, a docs diff runs nothing, a build file runs every row', () => {
  const zone = deployRowsFor(['origins/preview/legend-copy.ts', 'origins/zone-rows/zone7.row.json'], []).map((r: { name: string }) => r.name);
  assert.ok(zone.length <= scope.core.length + 1, `zone diff ran ${zone.length} rows: ${zone.join(', ')}`);
  assert.ok(zone.includes('origins-writer-boot-check'), 'origins/** reaches the writer boot row');
  assert.deepEqual(deployRowsFor(['docs/state/lead.md'], []), []);
  assert.equal(deployRowsFor(['package-lock.json'], []).length, rows.length);
  assert.equal(deployRowsFor(['public/world/kit/x.glb'], []).length, rows.length, 'public/ outside public_scoped is a full run');
});
