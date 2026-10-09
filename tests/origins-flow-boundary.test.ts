// Rule 1 (Dom, 2026-10-09): the open world (origins/) runs the Pit's shared fight CORE (duel, ai, sim, moves, input, hud, characters, scene, gore ...) and never the Pit's FLOW: the arena, the ladder,
// the match / trial / scorecard / sparring scenes that start and end a Pit fight. A test (like sim-boundary.test.ts, for the same reason: no-restricted-imports cannot say "except these") fails when
// any non-test file under origins/ imports a flow module. Imports that exist today are pinned in KNOWN as debt: a NEW one fails, and a listed one that has been removed fails too, so the list only shrinks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const FLOW = ['main', 'match', 'ladder', 'arena', 'arena-themes', 'arena-props', 'trial', 'scorecard', 'sparring', 'sparring-specials', 'sparring-special-runtime'] as const;
const KNOWN: readonly string[] = [
  // The Pit mount (pit-duel.ts / pit-adapter.ts) and the record reader: the debt the one-core slices S3-S7 pay down. Remove a line when its import goes.
  'origins/preview/pit-adapter.ts -> src/arena-themes.ts',
  'origins/preview/pit-adapter.ts -> src/arena.ts',
  'origins/preview/pit-duel.ts -> src/match.ts',
  'origins/preview/pit-duel.ts -> src/scorecard.ts',
  'origins/preview/pit-duel.ts -> src/trial.ts',
  'origins/preview/world-record.ts -> src/match.ts',
];

const IMPORT = /(?:^\s*(?:import|export)\b[^'"]*?\bfrom\s+|^\s*import\s+|\bimport\()\s*['"]([^'"]+)['"]/gm;
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [join(dir, e.name)] : []);
const violations = (): string[] => files('origins').flatMap((file) => [...new Set([...readFileSync(file, 'utf8').matchAll(IMPORT)].map((m) => m[1]!)
  .filter((s) => /(^|\/)src\/[^/]+$/.test(s))
  .map((s) => s.replace(/\?.*$/, '').replace(/\.ts$/, '').split('/').pop()!)
  .filter((name) => (FLOW as readonly string[]).includes(name)))].map((name) => `${file} -> src/${name}.ts`)).sort();

test('origins/ imports no Pit flow module except the pinned debt, and the debt only shrinks', () => {
  const now = violations();
  assert.deepEqual(now.filter((v) => !KNOWN.includes(v)), [], 'a new import of Pit/arena flow code from origins/ (rule 1)');
  assert.deepEqual(KNOWN.filter((v) => !now.includes(v)), [], 'a listed import is gone: delete it from KNOWN so it cannot come back');
});

test('the flow check sees static, re-export and dynamic imports', () => {
  const src = "import { a } from '../../src/arena.ts';\nexport { b } from '../../src/match.ts';\nconst c = await import('../../src/ladder.ts');\nimport '../../src/trial.ts';\n";
  assert.deepEqual([...src.matchAll(IMPORT)].map((m) => m[1]), ['../../src/arena.ts', '../../src/match.ts', '../../src/ladder.ts', '../../src/trial.ts']);
});
