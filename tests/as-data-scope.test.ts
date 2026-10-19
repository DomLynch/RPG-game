// The inline-number ratchet (as-data rule (h), scripts/as-data/inline-number.yml) scans only the files named in inline-number-scope.json. A new file in the record sim (tests/record-version-guard.test.ts SIM_FILES) or the
// world sim (tests/world-sim-guard.test.ts WORLD_SIM_FILES) must not escape it: every .ts file of those two lists is in the scope, or in its `excluded` list (generated or data files, each with the reason in the file's note).
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const listIn = (file: string, name: string): string[] => {
  const m = new RegExp(`const ${name} = \\[(.*?)\\];`, 's').exec(read(file));
  assert.ok(m, `${file}: no ${name} list found (renamed? update this test)`);
  return [...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
};
const scope = JSON.parse(read('scripts/as-data/inline-number-scope.json')) as { files: string[]; excluded: string[]; dirs: string[] };

test('inline-number-scope.json covers every .ts file of SIM_FILES and WORLD_SIM_FILES (bar the named generated/data exclusions), so a new sim file cannot escape the ratchet', () => {
  const sim = [...new Set([...listIn('tests/record-version-guard.test.ts', 'SIM_FILES'), ...listIn('tests/world-sim-guard.test.ts', 'WORLD_SIM_FILES')])].filter((f) => f.endsWith('.ts'));
  assert.ok(sim.length >= 40, `only ${sim.length} sim files read: the lists moved?`);
  const covered = new Set([...scope.files, ...scope.excluded]);
  const missing = sim.filter((f) => !covered.has(f));
  assert.deepEqual(missing, [], `sim files outside inline-number-scope.json (add them to "files", or to "excluded" if generated/data): ${missing.join(', ')}`);
});

test('the scope names only files that exist, and an excluded file is not also scanned', () => {
  for (const f of [...scope.files, ...scope.excluded]) assert.doesNotThrow(() => read(f), `${f} is in inline-number-scope.json but is not a file`);
  assert.deepEqual(scope.files.filter((f) => scope.excluded.includes(f)), []);
});
