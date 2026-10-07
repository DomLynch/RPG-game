// Guard (Lead 2026-10-07): CI's test:all runs tests/*.test.ts only, so an origins/**/*.test.ts file reaches the gate solely through a
// tests/origins-*.test.ts stub that imports it. Four PRs in one morning added origins tests with no stub (#1633, #1641, #1644, #1646): green CI,
// test never run. This fails naming every orphan; the fix is a one-line stub beside the others.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const originsTests = readdirSync(join(root, 'origins'), { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.test.ts')).map((f) => join('origins', f)).sort();
const stubs = readdirSync(join(root, 'tests')).filter((f) => /^origins-.*\.test\.ts$/.test(f));
const imported = new Set<string>();
for (const stub of stubs) {
  for (const m of readFileSync(join(root, 'tests', stub), 'utf8').matchAll(/^\s*import\s+['"](\.\.\/origins\/[^'"]+\.test\.ts)['"]/gm)) imported.add(relative(root, join(root, 'tests', m[1]!)));
}

test('every origins/**/*.test.ts is imported by a tests/origins-*.test.ts stub, so CI actually runs it', () => {
  assert.ok(originsTests.length > 30, `found only ${originsTests.length} origins tests: is the scan broken?`);
  const orphans = originsTests.filter((f) => !imported.has(f));
  assert.deepEqual(orphans, [], `origins tests with no CI stub (add tests/origins-<area>.test.ts with: import '../${orphans[0] ?? 'origins/x.test.ts'}';)`);
});

test('every stub import points at a file that exists', () => {
  const missing = [...imported].filter((f) => !originsTests.includes(f));
  assert.deepEqual(missing, [], 'a stub imports an origins test that is gone');
});
