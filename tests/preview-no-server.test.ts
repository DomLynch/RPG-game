// The built Origins page must not reach the server's code (the #2484 leak class): nothing under origins/preview, followed through every relative import (static, re-export or dynamic), may land in origins/server/ (the writer and
// the grimoire's whole spell catalogue) or in the node-safe doors src/fight/server.ts and src/core/server.ts. The page reads the engine through src/fight/index.ts and the core through src/core/index.ts.
// Type-only imports are erased by the build and are not followed. There are NO pinned leaks: the two that predated this guard (zones/loader.ts reading ROSTER, mobs.ts reading the core's mob maths) now read
// the page-and-node-safe doors src/fight/safe.ts and src/core/safe.ts, whose own closure is checked below.
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const IMPORT = /(?:^\s*(?:import|export)\b(?!\s+type\b)[^'"]*?\bfrom\s+|^\s*import\s+|\bimport\()\s*['"]([^'"]+)['"]/gm;
const FORBIDDEN = /^(origins\/server\/|src\/fight\/server\.ts$|src\/core\/server\.ts$)/;
const code = (f: string) => /\.(ts|mjs)$/.test(f) && !/\.test\.(ts|mjs)$/.test(f);
const seeds = (dir = 'origins/preview'): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? seeds(join(dir, e.name)) : code(e.name) ? [join(dir, e.name)] : []);

/** Every forbidden file reachable from the seeds, each as a chain `a -> b -> c`. `read` is injectable for the mutation test. */
export function leaks(list: readonly string[], read: (f: string) => string | null = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : null)): string[] {
  const seen = new Map<string, string>(), out: string[] = [], queue = list.map((f) => [f, f] as const);
  for (const [f, chain] of queue) {
    if (seen.has(f)) continue; seen.set(f, chain);
    if (FORBIDDEN.test(f)) { out.push(chain); continue; }
    const text = code(f) ? read(f) : null; if (text === null) continue;
    for (const m of text.matchAll(IMPORT)) if (m[1]!.startsWith('.')) queue.push([normalize(join(dirname(f), m[1]!)), `${chain} -> ${normalize(join(dirname(f), m[1]!))}`]);
  }
  return out.sort();
}

test('origins/preview never reaches origins/server, src/fight/server.ts or src/core/server.ts, transitively', () => {
  assert.deepEqual(leaks(seeds()), [], 'a path from the page into server code: go through the page doors (src/fight/index.ts, src/core/index.ts), the safe doors (src/fight/safe.ts, src/core/safe.ts) or split a page-safe module');
  assert.deepEqual(leaks(['src/core/safe.ts', 'src/fight/safe.ts']), [], 'a safe door reaches only pure modules');
  const closure = (f: string, seen = new Set<string>()): Set<string> => { if (seen.has(f) || !existsSync(f)) return seen; seen.add(f); for (const m of readFileSync(f, 'utf8').matchAll(IMPORT)) if (m[1]!.startsWith('.')) closure(normalize(join(dirname(f), m[1]!)), seen); return seen; };
  for (const door of ['src/core/safe.ts', 'src/fight/safe.ts']) assert.deepEqual([...closure(door)].filter((f) => /(^origins\/|\/index\.ts$|three|gear-room)/.test(f)), [], `${door} reaches no origins/, no *index.ts door and no renderer`);
});

test('the detector follows a chain and an index of re-exports (mutation)', () => {
  const files: Record<string, string> = {
    'origins/preview/a.ts': "import { x } from './b.ts';", 'origins/preview/b.ts': "export { y } from '../boss/c.ts';",
    'origins/boss/c.ts': "const m = await import('../server/grimoire.ts');", 'origins/server/grimoire.ts': 'export const g = 1;',
    'origins/preview/ok.ts': "import { z } from '../../src/fight/index.ts';", 'src/fight/index.ts': 'export const z = 1;',
  };
  const read = (f: string) => files[f] ?? null;
  assert.deepEqual(leaks(['origins/preview/a.ts'], read), ['origins/preview/a.ts -> origins/preview/b.ts -> origins/boss/c.ts -> origins/server/grimoire.ts']);
  assert.deepEqual(leaks(['origins/preview/ok.ts'], read), [], 'the page door is fine');
  assert.deepEqual(leaks(['origins/preview/t.ts'], (f) => (f === 'origins/preview/t.ts' ? "import type { A } from '../server/store.ts';\nexport type { B } from '../server/store.ts';" : null)), [], 'type-only imports are erased');
});
