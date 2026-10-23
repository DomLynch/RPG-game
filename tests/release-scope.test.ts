// The release scope is a data row (Lead 2026-10-22: delta rows only, the path->row map as data): scripts/release-scope.json, read by deployRowsFor,
// which deploy.sh and a candidate's release-checks plan both call. Every row it names must exist, and a zone-only diff runs a handful of rows, not the matrix.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ciFullAge, deployRowsFor, rows } from '../scripts/release-rows-for.mjs';

const scope = JSON.parse(readFileSync('scripts/release-scope.json', 'utf8')) as { core: string[]; areas: { paths: string[]; rows: string[] }[]; full: string[]; lib_no_rows: string[]; public_scoped: string[] };

test('every row the scope names is a release_commands row', () => {
  const names = new Set(rows.map((r: { name: string }) => r.name));
  for (const spec of [...scope.core, ...scope.areas.flatMap(a => a.rows)]) assert.ok(names.has(spec.split(':')[0]), `${spec} is not in .quality-gate.json release_commands`);
  for (const a of scope.areas) assert.ok(a.paths.length && a.rows.length, `an area needs paths and rows: ${JSON.stringify(a)}`);
});

test('a zone-only diff runs core + the writer boot row + the zone pages row, a docs diff runs nothing, a build file runs every row', () => {
  const zone = deployRowsFor(['origins/preview/legend-copy.ts', 'origins/zone-rows/zone7.row.json'], []).map((r: { name: string }) => r.name);
  assert.ok(zone.length <= scope.core.length + 2, `zone diff ran ${zone.length} rows: ${zone.join(', ')}`);
  assert.ok(zone.includes('origins-writer-boot-check'), 'origins/** reaches the writer boot row');
  assert.ok(zone.includes('zone-pages-check'), 'a zone row reaches row 58 (every /zoneN/ page opens)');
  for (const f of ['origins/zones/plan-rows.json', 'origins/world/town/x.json', 'scripts/gen-zones.mjs'])
    assert.ok(deployRowsFor([f], []).some((r: { name: string }) => r.name === 'zone-pages-check'), `${f} reaches row 58`);
  assert.ok(!deployRowsFor(['src/fight/hud.ts'], []).some((r: { name: string }) => r.name === 'zone-pages-check'), 'a Pit-only file does not run row 58');
  assert.deepEqual(deployRowsFor(['docs/state/lead.md'], []), []);
  assert.equal(deployRowsFor(['package-lock.json'], []).length, rows.length);
  assert.equal(deployRowsFor(['public/world/kit/x.glb'], []).length, rows.length, 'public/ outside public_scoped is a full run');
});

// A fake gh: the runs list, then each run's row-job conclusions (what the real call's --jq returns), keyed by run id.
const fakeGh = (runs: { id: number; started: string }[], jobs: Record<number, string[]>, fail = false): string => {
  const dir = mkdtempSync(join(tmpdir(), 'fake-gh-')), bin = join(dir, 'gh');
  writeFileSync(bin, `#!/usr/bin/env node\nconst p = process.argv[3]; if (${fail}) process.exit(1);\nconst m = /runs\\/(\\d+)\\/jobs/.exec(p);\nprocess.stdout.write(JSON.stringify(m ? (${JSON.stringify(jobs)})[m[1]] ?? [] : ${JSON.stringify(runs)}));\n`);
  chmodSync(bin, 0o755);
  return bin;
};

test('the nightly CI full run counts as the daily full run only when every row job in it is green (Lead 2026-10-22)', () => {
  const now = Date.parse('2026-10-23T08:00:00Z'), started = '2026-10-22T23:17:05Z', age = Math.floor((now - Date.parse(started)) / 1000);
  assert.equal(ciFullAge({ gh: fakeGh([{ id: 1, started }], { 1: ['success', 'success'] }), now }), age);
  assert.equal(ciFullAge({ gh: fakeGh([{ id: 1, started }], { 1: ['success', 'failure'] }), now }), -1, 'a red row: not a full run');
  assert.equal(ciFullAge({ gh: fakeGh([{ id: 1, started }, { id: 2, started: '2026-10-21T23:17:00Z' }], { 1: ['cancelled'], 2: ['success'] }), now }), Math.floor((now - Date.parse('2026-10-21T23:17:00Z')) / 1000), 'the newest GREEN scheduled run counts');
  assert.equal(ciFullAge({ gh: fakeGh([{ id: 1, started }], { 1: [] }), now }), -1, 'a run with no row jobs is not a full run');
  assert.equal(ciFullAge({ gh: fakeGh([], {}, true), now }), -1, 'a gh error: the local receipt alone decides');
});
