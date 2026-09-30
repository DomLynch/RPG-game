// The simulation boundary (GPT audit 2026-09-22): the modules that replay a duel deterministically may import only each other — no
// three, no scene/hud/input, no account or network code, no package at all. eslint.config.js owns the list (SIM) and keeps clocks and
// randomness out of those files; this test keeps foreign imports out, from the same list, so a new sim helper joins SIM and is
// covered by both. ESLint's no-restricted-imports could not express "everything except these siblings" reliably, hence a test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SIM } from '../eslint.config.js';

const IMPORT = /^\s*(?:import|export)\b[^'"]*?\bfrom\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;
const imports = (file: string) => [...readFileSync(join(process.cwd(), file), 'utf8').matchAll(IMPORT)].map(m => m[1] ?? m[2]!);

test('simulation modules import only simulation modules', () => {
  assert.ok(SIM.length >= 9 && SIM.every(f => f.startsWith('src/') && f.endsWith('.ts')), 'SIM lists src/*.ts files');
  const allowed = new Set(SIM.map(f => './' + f.slice(4)));
  const foreign: string[] = [];
  for (const file of SIM) for (const source of imports(file)) if (!allowed.has(source)) foreign.push(`${file} imports ${source}`);
  assert.deepEqual(foreign, [], `foreign imports inside the simulation:\n  ${foreign.join('\n  ')}\n(a new sim helper joins SIM in eslint.config.js instead)`);
});

test('the boundary check sees every import form', () => {
  const src = "import { a } from './duel.ts';\nimport type { B } from './moves.ts';\nimport * as T from 'three';\nexport { c } from './scene.ts';\nimport './side.ts';\n";
  assert.deepEqual([...src.matchAll(IMPORT)].map(m => m[1] ?? m[2]), ['./duel.ts', './moves.ts', 'three', './scene.ts', './side.ts']);
});
