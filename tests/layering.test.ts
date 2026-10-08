// The layering (Lead's architecture decision, 2026-10-08, no rewrite of Zone 1): `core` is zone-agnostic (sim, moves, record, duel engine, loot, grades, gear-stats, legends, career constants, roster, twist); `pit` is the arena,
// its themes, props and audio, the ladder, the Pit module; a zone is every origins/<name>/ except pit. The rule: no zone imports pit, and pit imports no zone. Zones import core only.
// This is the boundary half of the split (the files do not move yet, so record and fingerprint bytes cannot change). PIT lists the pit files in src/; src/pit/ and origins/pit/ are pit whole. Every existing crossing is named in
// KNOWN with its owner, and the check goes both ways: a new crossing fails, and so does a KNOWN line that no longer crosses (delete it; the list only shrinks). Same import scan as tests/sim-boundary.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const PIT = new Set(['src/arena.ts', 'src/arena-themes.ts', 'src/arena-props.ts', 'src/ladder.ts', 'src/gate-rise.ts', 'src/audio/arena.ts', 'src/audio/arena-manifest.ts', 'src/audio/gate.ts', 'src/audio/bell.ts']);
const KNOWN = new Set([
  // World owns these (the seamless-engage fix): the preview mount draws the arena and its themes.
  'origins/preview/exchange.ts > src/arena.ts', 'origins/preview/frontier.ts > src/arena.ts', 'origins/preview/look.ts > src/arena-themes.ts', 'origins/preview/main.ts > src/arena.ts', 'origins/preview/main.ts > src/arena-themes.ts',
  // The seam between the open world and the Pit (encounter start, Pit duel, world record): these four import the Pit module on purpose until the seam moves behind core.
  'origins/preview/encounter-duel.ts > origins/pit/pit.ts', 'origins/preview/main.ts > origins/pit/pit.ts', 'origins/preview/pit-duel.ts > origins/pit/pit.ts', 'origins/preview/world-record.ts > origins/pit/pit.ts',
  // The Pit module reads the progression model; the model is zone-agnostic and belongs in core.
  'origins/pit/pit.ts > origins/progression/model.ts',
]);
const IMPORT = /^\s*(?:import|export)\b[^'"]*?\bfrom\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;
const walk = (d: string): string[] => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? (n === 'node_modules' || n === 'assets' ? [] : walk(p)) : n.endsWith('.ts') && !n.endsWith('.test.ts') ? [p] : []; });
const isPit = (f: string) => PIT.has(f) || f.startsWith('src/pit/') || f.startsWith('origins/pit/');
const zoneOf = (f: string) => { const m = f.match(/^origins\/([^/]+)\//); return m && m[1] !== 'pit' ? m[1] : null; };
function crossings(files: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [file, text] of Object.entries(files)) for (const m of text.matchAll(IMPORT)) {
    const spec = m[1] ?? m[2]!; if (!spec.startsWith('.')) continue;
    const to = relative('.', resolve(dirname(file), spec));
    if ((zoneOf(file) && isPit(to)) || (isPit(file) && zoneOf(to))) out.push(`${file} > ${to}`);
  }
  return out.sort();
}
const load = () => Object.fromEntries([...walk('src'), ...walk('origins')].map(f => [f, readFileSync(f, 'utf8')]));

test('no zone imports pit and pit imports no zone, beyond the named KNOWN crossings', () => {
  const found = crossings(load());
  assert.deepEqual(found.filter(c => !KNOWN.has(c)), [], 'new zone<->pit crossing: import core instead (or move the shared piece into core)');
  assert.deepEqual([...KNOWN].filter(c => !found.includes(c)), [], 'stale KNOWN entry: the crossing is gone, delete the line');
});

test('the scanner sees both directions and every import form', () => {
  const files = { 'origins/world/a.ts': "import { x } from '../../src/arena.ts';\nimport { y } from '../../src/moves.ts';", 'origins/pit/p.ts': "export { z } from '../world/a.ts';\nimport '../../src/duel.ts';", 'src/pit/s.ts': "import type { T } from '../../origins/mobs/m.ts';" };
  assert.deepEqual(crossings(files), ['origins/pit/p.ts > origins/world/a.ts', 'origins/world/a.ts > src/arena.ts', 'src/pit/s.ts > origins/mobs/m.ts']);
});
