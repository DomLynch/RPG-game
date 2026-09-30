// The Pit's boundary (docs/pit-design.md §3, Lead 2026-09-29): src/pit/ is a sealed module in its own lazy chunk. Only
// src/pit-coordinator.ts may reach it, and only by dynamic import or `import type`, so no fight code can pull it into the entry
// chunk. The Pit may import only three (and its addons), its own files and a few game TYPES (loot, roster, grades): everything live reaches it through
// the Stage the coordinator hands in. The simulation never sees the coordinator. Same approach as tests/sim-boundary.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { SIM } from '../eslint.config.js';

const COORDINATOR = 'src/pit-coordinator.ts', PIT = 'src/pit/';
const PIT_TYPES = new Set(['src/loot.ts', 'src/roster.ts', 'src/grades.ts']);   // type-only imports the Pit may make from the game
// Static imports and re-exports (with whether they are type-only), and dynamic import() calls, including `typeof import()`.
const STATIC = /^\s*(?:import|export)\s+(type\s+)?[^'";]*?\bfrom\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;
const DYNAMIC = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const QUOTED_RELATIVE = /['"](\.{1,2}\/[^'"]+)['"]/g;

type Ref = { spec: string; typeOnly: boolean; dynamic: boolean };
function refs(text: string): Ref[] {
  return [
    ...[...text.matchAll(STATIC)].map(m => ({ spec: (m[2] ?? m[3])!, typeOnly: !!m[1], dynamic: false })),
    ...[...text.matchAll(DYNAMIC)].map(m => ({ spec: m[1]!, typeOnly: false, dynamic: true })),
  ];
}
const resolve = (file: string, spec: string) => (spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file), spec)) : spec);
function sources(dir = 'src'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const path = `${dir}/${e.name}`;
    return e.isDirectory() ? sources(path) : /\.ts$/.test(e.name) ? [path] : [];
  });
}
const read = (file: string) => readFileSync(file, 'utf8');

test('only the coordinator reaches src/pit/, and only by import() or import type', () => {
  const files = sources(), bad: string[] = [];
  assert.ok(files.includes(COORDINATOR), 'the coordinator exists');
  for (const file of files.filter(f => !f.startsWith(PIT))) {
    const text = read(file);
    // Any quoted relative path into src/pit/, in any form (import, re-export, import(), a string handed to a loader).
    const intoPit = [...text.matchAll(QUOTED_RELATIVE)].filter(m => resolve(file, m[1]!).startsWith(PIT));
    if (file !== COORDINATOR) { for (const m of intoPit) bad.push(`${file} refers to ${m[1]}`); continue; }
    const allowed = refs(text).filter(r => resolve(file, r.spec).startsWith(PIT) && (r.dynamic || r.typeOnly)).length;
    if (allowed !== intoPit.length) bad.push(`${file}: ${intoPit.length - allowed} reference(s) into src/pit/ that are neither import() nor import type`);
  }
  assert.deepEqual(bad, [], `the Pit is reached outside its door:\n  ${bad.join('\n  ')}`);
});

test('src/pit/ imports only three (and its addons), itself and game types', () => {
  const files = sources().filter(f => f.startsWith(PIT)), bad: string[] = [];
  assert.ok(files.length >= 2, 'the Pit module has its entry and its Stage');
  for (const file of files) for (const r of refs(read(file))) {
    const target = resolve(file, r.spec);
    if (r.dynamic) bad.push(`${file} dynamically imports ${r.spec} (only the coordinator loads code)`);
    else if (target === 'three' || target.startsWith('three/addons/') || target.startsWith(PIT)) continue;
    else if (!(r.typeOnly && PIT_TYPES.has(target))) bad.push(`${file} imports ${r.spec}${r.typeOnly ? ' (type)' : ''}`);
  }
  assert.deepEqual(bad, [], `the Pit imports outside its list:\n  ${bad.join('\n  ')}\n(live game data reaches the Pit through Stage, src/pit/stage.ts)`);
});

test('the simulation never imports the coordinator', () => {
  const bad = SIM.flatMap(file => refs(read(file)).filter(r => resolve(file, r.spec) === COORDINATOR).map(r => `${file} imports ${r.spec}`));
  assert.deepEqual(bad, []);
});

test('the boundary check sees every import form', () => {
  const src = "import { a } from './x.ts';\nimport type { B } from '../loot.ts';\nexport { c } from './y.ts';\nimport './side.ts';\nimport * as T from 'three';\nconst m = import('./pit/pit.ts');\nlet t: typeof import('./pit/pit.ts');\n";
  assert.deepEqual(refs(src).map(r => [r.spec, r.typeOnly, r.dynamic]), [
    ['./x.ts', false, false], ['../loot.ts', true, false], ['./y.ts', false, false], ['./side.ts', false, false], ['three', false, false],
    ['./pit/pit.ts', false, true], ['./pit/pit.ts', false, true],
  ]);
  assert.equal(resolve('src/pit/pit.ts', '../loot.ts'), 'src/loot.ts');
  assert.equal(resolve('src/main.ts', './pit/pit.ts'), 'src/pit/pit.ts');
});

// Lead 2026-09-29: while the Pit shows, nothing of the fight runs in main.ts's frame — no sim step, no fight render, no effect or HUD
// update that could set .visible on what the Pit hid. The hand-off is the first thing frame() does after the context check and dt.
test('main.ts frame() hands the whole frame to the Pit before any fight work', () => {
  const main = read('src/main.ts'), start = main.indexOf('function frame(now: number) {');
  assert.ok(start >= 0, 'frame() is where this test looks for it');
  const body = main.slice(start, main.indexOf('\n}\n', start));
  const handoff = body.indexOf('if (pit) { pit.frame(dt); frameId = requestAnimationFrame(frame); return; }');
  assert.ok(handoff > 0, 'frame() has the Pit hand-off');
  for (const fight of ['match.step(', 'view.render(', 'updateHud()', 'controls.promoteDodge(']) {
    const at = body.indexOf(fight);
    assert.ok(at > handoff, `${fight} runs only after the Pit hand-off (${at} vs ${handoff})`);
  }
});
