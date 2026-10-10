// Data-only PRs (scripts/lib/data-only.mjs): which files may skip the Auditor, and the proof that a zone module is data, not code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { classify, dataProblems, legendCitations, legendProblems, moduleValue, onDataPath } from '../scripts/lib/data-only.mjs';
import { verdict } from '../scripts/data-only-check.mjs';

const zoneFiles = readdirSync('origins/zones', { withFileTypes: true }).filter(d => d.isDirectory() && /^zone\d+$/.test(d.name))
  .flatMap(d => ['zone', 'spawns', 'kit', 'look'].map(f => `origins/zones/${d.name}/${f}.ts`));

test('every zone module on trunk is pure data, and the loot table is JSON', () => {
  assert.ok(zoneFiles.length >= 8, 'zone1 and zone2 at least');
  for (const f of [...zoneFiles, 'src/assets/source/loot/loot.json']) {
    assert.ok(onDataPath(f), f);
    assert.deepEqual(dataProblems(f, readFileSync(f, 'utf8')), [], f);
  }
});

test('the path list is strict: engine code, loaders, biomes, catalogue rows, legends and tests are never data', () => {
  for (const f of ['origins/zones/loader.ts', 'origins/zones/biomes.ts', 'origins/zones/zone1/place.ts', 'origins/zones/zone1/zone.test.ts', 'src/fight/catalogue-rows.ts',
    'docs/research/legends-fame.md', 'src/loot.ts', 'origins/zones/biomes.ts.data', 'origins/zones/zone1/biomes-data.ts', 'origins/zones/zone1/zone.ts.bak', 'origins/zones/zone1/../loader.ts']) assert.equal(onDataPath(f), false, f);
});

test('anything that runs is not data (mutation cases: a call, a value import, an outside identifier, ${}, a function, a spread, a second statement)', () => {
  const ok = "import type { MobRow } from '../../mobs/row.ts';\ntype Local = { n: number };\nconst spawns: { rows: MobRow[] } = { rows: [{ id: 'character:wolf', level: 1, n: -2, on: true, at: null }] };\nexport default spawns;\n";
  assert.deepEqual(dataProblems('origins/zones/zone9/spawns.ts', ok), []);
  const bad: Record<string, string> = {
    call: ok.replace("'character:wolf'", "String(1)"),
    valueImport: ok.replace('import type { MobRow }', 'import { MobRow }'),
    identifier: ok.replace("'character:wolf'", 'process.env.X'),
    template: ok.replace("'character:wolf'", '`a${1}`'),
    fn: ok.replace("on: true", 'on: () => true'),
    spread: ok.replace("{ id:", '{ ...{}, id:'),
    extra: ok + 'console.log(1);\n',
    computedKey: ok.replace('level: 1', "['lev' + 'el']: 1"),
    noExport: ok.replace('export default spawns;\n', ''),
  };
  for (const [why, text] of Object.entries(bad)) assert.notDeepEqual(dataProblems('origins/zones/zone9/spawns.ts', text), [], why);
});

test('a PR is data-only only when EVERY file is on the list and pure data: a zone row alone passes, a zone row plus one .ts is blocked', () => {
  const read = (f: string) => readFileSync(f, 'utf8');
  assert.equal(classify([{ file: 'origins/zones/zone1/spawns.ts', status: 'modified' }], read).dataOnly, true);
  const mixed = classify([{ file: 'origins/zones/zone1/spawns.ts', status: 'modified' }, { file: 'origins/zones/loader.ts', status: 'modified' }], read);
  assert.equal(mixed.dataOnly, false); assert.match(mixed.problems.join(), /loader\.ts is not on the data-only path list/);
  assert.equal(classify([], read).dataOnly, false, 'an empty PR is not data-only');
});

test('legends: a spawns row bringing a NEW legend id, or a changed source citation, is not data-only; reusing an existing id with its citation is (Lead 2026-10-09)', () => {
  const rows = (moduleValue('origins/zones/zone1/spawns.ts', readFileSync('origins/zones/zone1/spawns.ts', 'utf8')) as { rows: unknown[] }).rows;
  const trunk = legendCitations(rows);
  assert.ok(Object.keys(trunk).length >= 3 && Object.keys(trunk).every(id => id.startsWith('character:')), 'zone 1 cites its legends');
  assert.deepEqual(legendProblems(trunk, trunk), [], 'the same rows: nothing new');
  const [firstId] = Object.keys(trunk);
  assert.deepEqual(legendProblems({ [firstId]: trunk[firstId] }, trunk), [], 'a zone reusing one existing legend');
  assert.match(legendProblems({ ...trunk, 'character:new-thing': '{"kind":"folklore"}' }, trunk).join(), /character:new-thing is a new legend/);
  assert.match(legendProblems({ ...trunk, [firstId]: '{"kind":"scripture"}' }, trunk).join(), /source citation changed/);
  assert.deepEqual(legendCitations([{ id: 'character:x' }, { id: 'kind:wolf', source: {} }, null]), {}, 'a row without a citation, or not a character, is not a legend');
});

test('a PR that edits the gate is judged by the base copy and is a normal PR (exit 1): the workflow restores the gate from base before npm ci (Lead 2026-10-10)', () => {
  const read = (f: string) => readFileSync(f, 'utf8');
  for (const f of ['scripts/data-only-check.mjs', 'scripts/lib/data-only.mjs', 'package.json', 'package-lock.json', '.github/workflows/data-only.yml']) {
    const v = verdict([{ file: 'origins/zones/zone1/spawns.ts', status: 'modified' }, { file: f, status: 'modified' }], read);
    assert.equal(v.dataOnly, false, f); assert.equal(v.code, 1, f);
  }
  const wf = readFileSync('.github/workflows/data-only.yml', 'utf8'), restore = wf.indexOf('git checkout "$BASE" -- "$f"');
  assert.ok(restore > 0 && restore < wf.indexOf('npm ci') && wf.indexOf('npm ci') < wf.indexOf('node scripts/data-only-check.mjs'), 'restore from base, then npm ci, then the check');
  for (const f of ['scripts/data-only-check.mjs', 'scripts/lib/data-only.mjs', 'package.json', 'package-lock.json']) assert.ok(wf.includes(f), f);
});
