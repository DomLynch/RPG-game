// CORE 1a, "the door": the account / item-ledger / loot / writer-call modules live in src/core and nothing reaches them except through the core's two doors.
//   C1  modes (the Pit src/main.ts, the zone page origins/preview/**) reach the core only through src/core/index.ts; server-run code (origins/server, contracts, encounters, inventory,
//       region1, node scripts) only through src/core/server.ts (renderer-free: tests/origins-writer-closure.test.ts walks its closure).
//   C2  nothing outside src/core imports writer-call or POSTs the writer (`/origins/<op>`).
//   C3  no page module imports origins/server/** at runtime (a type-only import is erased and loads nothing).
//   C4  k7-engine-parity's LEDGER_UI list is empty and stays empty.
// Each rule is a pure function of (read, files) so a mutation case can feed it a bad file.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import test from 'node:test';

const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'node_modules' || e.name === 'dist' ? [] : walk(join(dir, e.name))) : /\.(ts|mjs)$/.test(e.name) && !/\.test\.(ts|mjs)$/.test(e.name) ? [join(dir, e.name)] : []);
const disk = (f: string): string => readFileSync(f, 'utf8');

const IMPORT = /(?:^\s*(?:import|export)\b([^'"]*?)\bfrom\s+|^\s*import\s+()|\bimport\(\s*)['"]([^'"]+)['"]/gm;
type Spec = { spec: string; typeOnly: boolean; target: string };
const specsOf = (file: string, text: string): Spec[] => [...text.matchAll(IMPORT)].map((m) => {
  const spec = m[3]!;
  return { spec, typeOnly: /^\s*type\b/.test(m[1] ?? '') && !m[0].includes('import('), target: spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file.replaceAll('\\', '/')), spec.replace(/[?#].*$/, ''))) : spec };
});

const PAGE = (f: string): boolean => f === 'src/main.ts' || f.startsWith('origins/preview/');
const SERVER = (f: string): boolean => /^origins\/(server|contracts|encounters|inventory|region1)\//.test(f) || (f.startsWith('scripts/') && /\.(ts|mjs)$/.test(f));
const inCore = (t: string): boolean => /^src\/core\//.test(t);

export function c1(read: (f: string) => string, list: readonly string[]): string[] {
  const bad: string[] = [];
  for (const f of list) {
    const door = PAGE(f) ? 'src/core/index.ts' : SERVER(f) ? 'src/core/server.ts' : null;
    if (!door) continue;
    for (const s of specsOf(f, read(f))) if (inCore(s.target) && s.target !== door) bad.push(`${f} -> ${s.target} (take ${door})`);
  }
  return bad.sort();
}
export function c2(read: (f: string) => string, list: readonly string[]): string[] {
  const bad: string[] = [];
  for (const f of list) {
    if (inCore(f) || f.startsWith('origins/server/')) continue;
    const text = read(f);
    for (const s of specsOf(f, text)) if (/(^|\/)writer-call(\.ts)?$/.test(s.target)) bad.push(`${f} imports writer-call`);
    if (/['"`]\/origins\/(?!presence\b)[a-z]|\$\{[^}]*\}\/origins\/(?!presence\b)[a-z]|\bWRITER_PATH\s*\+/.test(text.replace(/^\s*\/\/.*$/gm, ''))) bad.push(`${f} builds a writer URL`);
  }
  return bad.sort();
}
export function c3(read: (f: string) => string, list: readonly string[]): string[] {
  const bad: string[] = [];
  for (const f of list) {
    if (!(PAGE(f) || (f.startsWith('src/') && !inCore(f)))) continue;
    for (const s of specsOf(f, read(f))) if (!s.typeOnly && /^origins\/server\//.test(s.target)) bad.push(`${f} -> ${s.target}`);
  }
  return bad.sort();
}

const FILES = [...walk('src'), ...walk('origins'), ...walk('scripts')].map((f) => f.replaceAll('\\', '/'));
const withFile = (name: string, extra: string) => (f: string): string => f === name ? `${disk(f)}\n${extra}` : disk(f);

test('C1: modes reach the core only through src/core/index.ts, server code only through src/core/server.ts', () => {
  assert.deepEqual(c1(disk, FILES), []);
  assert.ok(FILES.filter(PAGE).length > 5 && FILES.filter(SERVER).length > 5, 'the walk found the pages and the server code');
});
test('C1 mutation: a deep core import from the Pit, the zone page or a server module is flagged; the door is not', () => {
  assert.equal(c1(withFile('src/main.ts', "import { loadProfile } from './core/profile.ts';"), FILES).length, 1);
  assert.equal(c1(withFile('origins/preview/save.ts', "import { call } from '../../src/core/writer-call.ts';"), FILES).length, 1);
  assert.equal(c1(withFile('origins/contracts/ids.ts', "import { LOOT } from '../../src/core/loot.ts';"), FILES).length, 1);
  assert.equal(c1(withFile('origins/contracts/ids.ts', "import { LOOT } from '../../src/core/index.ts';"), FILES).length, 1, 'a server module may not take the page door');
  assert.equal(c1(withFile('src/main.ts', "import { x } from './core/server.ts';"), FILES).length, 1, 'a page may not take the server door');
  assert.equal(c1(withFile('src/main.ts', "import { loadProfile } from './core/index.ts';"), FILES).length, 0);
});

test('C2: nothing outside src/core imports writer-call or POSTs /origins', () => {
  assert.deepEqual(c2(disk, FILES), []);
});
test('C2 mutation: a writer-call import or a hand-built /origins POST is flagged; the presence socket is not', () => {
  assert.equal(c2(withFile('origins/preview/save.ts', "import { call } from '../../src/core/writer-call.ts';"), FILES).length, 1);
  assert.equal(c2(withFile('src/main.ts', "void fetch('/origins/open', { method: 'POST' });"), FILES).length, 1);
  assert.equal(c2(withFile('origins/preview/mobs.ts', 'const u = `${base}/origins/open`;'), FILES).length, 1);
  assert.equal(c2(withFile('origins/preview/presence-client.ts', "const u = `${o}/origins/presence`;"), FILES).length, 0);
});

test('C3: no page module imports origins/server/** at runtime', () => {
  assert.deepEqual(c3(disk, FILES), []);
});
test('C3 mutation: a runtime server import from a page is flagged; a type-only import is not', () => {
  assert.equal(c3(withFile('origins/preview/save.ts', "import { careerState } from '../server/career.ts';"), FILES).length, 1);
  assert.equal(c3(withFile('src/main.ts', "import('../origins/server/store.ts');"), FILES).length, 1);
  assert.equal(c3(withFile('origins/preview/save.ts', "import type { Snapshot } from '../server/store.ts';"), FILES).length, 0);
});

test('C4: the ledger-UI allow-list in k7-engine-parity is empty and cannot grow back', () => {
  const k7 = disk('tests/k7-engine-parity.test.ts');
  assert.match(k7, /const LEDGER_UI: readonly string\[\] = \[\];/, 'LEDGER_UI is an empty list');
  assert.doesNotMatch('const LEDGER_UI: readonly string[] = [\n  \'a -> b\',\n];', /const LEDGER_UI: readonly string\[\] = \[\];/, 'mutation: a non-empty list does not match the exit assert');
});

test('every moved module lives in src/core and nothing is left behind at the old paths', () => {
  const moved = ['gear-ledger', 'gear-net', 'gear-server', 'gear-sheet', 'gear-room', 'loot', 'loot-claims', 'loot-panel', 'open'];
  const top = ['writer-call', 'account', 'account-entry', 'session', 'profile', 'cloud-profile', 'grades'];
  const src = new Set(readdirSync('src')), fight = new Set(readdirSync('src/fight')), core = new Set(readdirSync('src/core'));
  assert.deepEqual(moved.filter((n) => fight.has(`${n}.ts`)), []);
  assert.deepEqual(top.filter((n) => src.has(`${n}.ts`)), []);
  assert.deepEqual([...moved, ...top].filter((n) => !core.has(`${n}.ts`)), []);
});
