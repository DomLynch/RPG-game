// The raw duplicate-key scan (scripts/lib/json-dup-keys.mjs): JSON.parse keeps the LAST of two equal keys silently, so a data row that repeats an id passed every check on the parsed value (Auditor HOLD on #2275).
// The scan reads the text. One implementation for the gate (every data-path JSON), zoneProblems (a zone row's text) and Backend's registry loader.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { duplicateKeys, describeDuplicates } from '../scripts/lib/json-dup-keys.mjs';
import { onDataPath } from '../scripts/lib/data-only.mjs';
import { verdict } from '../scripts/data-only-check.mjs';
import { loadZone, zoneProblems } from '../origins/zones/loader.ts';

const FIXTURE = `{
  "name": "Zone 9",
  "mobLooks": {
    "looks": {
      "character:ash-wolf": { "opponent": "wolf", "tint": 1 },
      "character:ash-boar": { "opponent": "boar", "tint": 2 },
      "character:ash-wolf": { "opponent": "wolf", "tint": 3 }
    }
  },
  "list": [ { "k": 1, "k": 2 } ],
  "name": "again"
}`;

test('a duplicate key at a nested path is returned with its path, the key and the line of the shadowing copy', () => {
  assert.deepEqual(duplicateKeys(FIXTURE), [
    { path: 'mobLooks.looks', key: 'character:ash-wolf', line: 7 },
    { path: 'list[0]', key: 'k', line: 10 },
    { path: '', key: 'name', line: 11 },
  ]);
  assert.deepEqual(describeDuplicates('row.json', duplicateKeys('{"a":1,\n"a":2}')), ['row.json:2: duplicate key "a" (JSON.parse would silently keep the last)']);
});

test('what is not a repeated key is not reported: equal keys in different objects, braces and quotes inside strings, numbers, nesting', () => {
  assert.deepEqual(duplicateKeys('{"a":{"x":1},"b":{"x":2},"s":"{\\"a\\":1,\\"a\\":2}","n":[1,-2.5e3,true,null,{},[]]}'), []);
  assert.deepEqual(duplicateKeys('[]'), []); assert.deepEqual(duplicateKeys('{}'), []);
});

test('a key spelled with an escape is the same key (a\\u0062 is ab); invalid JSON is an error, not a pass', () => {
  assert.deepEqual(duplicateKeys('{"a\\u0062":1,"ab":2}').map((d) => d.key), ['ab']);
  assert.throws(() => duplicateKeys('{"a":1,}'), /not JSON at line 1/);
  assert.throws(() => duplicateKeys('{"a":1} x'), /trailing text/);
});

test('every committed JSON file on the data path is free of repeated keys', () => {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.json') && onDataPath(f));
  assert.ok(files.length >= 5, `found ${files.length} data JSON files`);
  for (const f of files) assert.deepEqual(describeDuplicates(f, duplicateKeys(readFileSync(f, 'utf8'))), [], f);
});

test('the data-only gate is red (code 2) for a repeated key in ANY changed data JSON: a zone row, towns.json, the loot rows', () => {
  for (const file of ['origins/zone-rows/zone9.row.json', 'origins/region1/towns.json', 'src/assets/source/loot/loot.json']) {
    const v = verdict([{ file, status: 'modified' }], () => '{"a":{"x":1,\n"x":2}}');
    assert.equal(v.dataOnly, false); assert.equal(v.code, 2, file); assert.match(v.problems.join(';'), new RegExp(`${file.replace(/\./g, '\\.')}:2: duplicate key "x" in a`));
  }
});

test('zoneProblems scans a zone row\'s raw text when it is given, and is unchanged when it is not', () => {
  const z = loadZone('1'), text = readFileSync('origins/zone-rows/zone1.row.json', 'utf8');
  assert.deepEqual(zoneProblems(z, undefined, text), [], 'the real row text is clean');
  assert.deepEqual(zoneProblems(z), []);
  const dup = text.replace('"mobLooks": {', '"mobLooks": {\n    "looks": {},\n    "looks": {}, "x": 1,');
  assert.match(zoneProblems(z, undefined, dup).join(';'), /zone 1 row:\d+: duplicate key "looks" in mobLooks/);
});
