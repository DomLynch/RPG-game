// CORE 1a, "the door": the account / item-ledger / loot / writer-call modules live in src/core and nothing reaches them except through the core's two doors.
//   C1  modes (the Pit src/main.ts, the zone page origins/preview/**) reach the core only through src/core/index.ts; server-run code (origins/server, contracts, encounters, inventory,
//       region1, node scripts) only through src/core/server.ts (renderer-free: tests/origins-writer-closure.test.ts walks its closure).
//   C2  nothing outside src/core imports writer-call or POSTs the writer (`/origins/<op>`).
//   C3  no page module imports origins/server/** at runtime (a type-only import is erased and loads nothing).
//   C4  k7-engine-parity's LEDGER_UI list is empty and stays empty.
//   C5  the bank and the smith panel (origins/preview/play.ts) keep no item or coin of their own (no inventory or economy module, no inv/coin/receipts state), and no mode calls the save server directly (fetch, a database client's rpc/from).
// Each rule is a pure function of (read, files) so a mutation case can feed it a bad file.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
const SERVER = (f: string): boolean => (f.startsWith('origins/') && !PAGE(f)) || (f.startsWith('scripts/') && /\.(ts|mjs)$/.test(f));   // every other origins/ dir (server, contracts, encounters, inventory, region1, mobs, zones, ...) and the node scripts
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

const NOT_TEST = (f: string): boolean => !/\.test\.ts$|^tests\//.test(f);
const PIT = (f: string): boolean => f.startsWith('origins/pit/') || f === 'src/core/career-model.ts';
export function c6(read: (f: string) => string, list: readonly string[]): string[] {
  const bad: string[] = [];
  const own: Record<string, string> = { levelOfMarks: 'src/core/career-ladder.ts', levelOfCredit: 'src/core/career-model.ts' };
  for (const f of list) {
    if (!NOT_TEST(f)) continue;
    const text = read(f).replace(/^\s*\/\/.*$/gm, '');
    for (const m of text.matchAll(/\b(?:const|function|let)\s+(levelOfMarks|levelOfCredit|creditFromMarks|marksToCredit|levelFromMarks|levelFromCredit)\b/g))
      if (own[m[1]!] !== f) bad.push(`${f} defines ${m[1]} (one level function per input; it lives in ${own[m[1]!] ?? 'nowhere'})`);
    const zone = f.startsWith('origins/server/') || f.startsWith('origins/preview/') || f.startsWith('origins/mobs/') || f.startsWith('origins/boss/');
    if (zone && /\b(levelOfMarks|marksOf|shownMarks|rankFor|victoryMarks|victory_marks)\b/.test(text)) bad.push(`${f} reads Pit marks in zone code (Pit marks never seed a zone level)`);
    if (!PIT(f) && /\bcareerAtLevel\s*\(/.test(text)) bad.push(`${f} stands a career at a level (only the Pit session and tests may; zone characters start at newCareer())`);
    if (/\bnewCareer\s*\(\s*[^)\s,][^)]*[,)]/.test(text) && f !== 'src/core/career-model.ts') bad.push(`${f} passes a seed to newCareer (a zone character starts at level 1)`);
  }
  const pit = read('origins/server/career.ts').replace(/^\s*\/\/.*$/gm, '');
  if (/\baward\s*\(|\btotal_credit\b|\bcredit\s*:/.test(pit) || !/\bcp:\s*0\b/.test(pit)) bad.push('origins/server/career.ts: a Pit win must pay cp 0 and touch no career credit');
  return bad.sort();
}

export function c5(read: (f: string) => string, list: readonly string[]): string[] {
  const bad: string[] = [];
  for (const f of list) {
    if (!PAGE(f) || inCore(f)) continue;
    const text = read(f).replace(/^\s*\/\/.*$/gm, '');
    if (/\bnavigator\.sendBeacon\s*\(|(?<![\w.])fetch\s*\(|\.rpc\(|\.from\(\s*['"`]/.test(text)) bad.push(`${f} calls the save server directly`);
    if (f === 'origins/preview/play.ts') {
      for (const s of specsOf(f, text)) if (!s.typeOnly && /(^|\/)(inventory|economy)(\.ts|\/)|inventory\/inventory|contracts\/(economy|items)/.test(s.target)) bad.push(`${f} imports ${s.target}`);
      if (/\b(?:let|var)\s+(?:inv|coin|balance|receipts|bronze)\b|\bconst\s+(?:inv|coin|balance|receipts|bronze)\s*=|coin\s*=\s*\d/.test(text)) bad.push(`${f} holds an item or coin value`);
    }
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
  assert.equal(c1(withFile('origins/mobs/info.ts', "import { LOOT } from '../../src/core/loot.ts';"), FILES).length, 1, 'any origins/ dir, not only the server ones');
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

test('C5: the bank and the smith hold nothing of their own and no mode calls the save server directly', () => {
  assert.deepEqual(c5(disk, FILES), []);
  assert.ok(FILES.includes('origins/preview/play.ts'));
});
test('C5 mutation: page-memory values and direct save-server calls are flagged; the core door is not', () => {
  const play = 'origins/preview/play.ts';
  assert.equal(c5(withFile(play, 'let inv = openInventory();'), FILES).length, 1);
  assert.equal(c5(withFile(play, 'let coin = 400;'), FILES).length, 1);
  assert.equal(c5(withFile(play, 'const receipts = new Map();'), FILES).length, 1);
  assert.equal(c5(withFile(play, "import { deposit } from '../inventory/inventory.ts';"), FILES).length, 1);
  assert.equal(c5(withFile(play, "import { performUpgrade } from '../contracts/economy.ts';"), FILES).length, 1);
  assert.equal(c5(withFile(play, "void fetch(url, { method: 'POST' });"), FILES).length, 1);
  assert.equal(c5(withFile('origins/preview/main.ts', "await client.rpc('origins_save', {});"), FILES).length, 1);
  assert.equal(c5(withFile('src/main.ts', "await client.from('origins_events').insert({});"), FILES).length, 1);
  assert.equal(c5(withFile(play, "import { bankMove } from '../../src/core/index.ts';"), FILES).length, 0);
  assert.equal(c5(withFile(play, "import type { Grid } from '../inventory/inventory.ts';"), FILES).length, 0);
});

test('C6: one level function per input; Pit marks never seed a zone level; zone characters start at level 1; Pit wins pay Pit ranks only', () => {
  assert.deepEqual(c6(disk, FILES), []);
  assert.ok(FILES.includes('src/core/career-model.ts') && FILES.includes('src/core/career-ladder.ts') && FILES.includes('origins/server/career.ts'));
});
test('C6 mutation: a second level function, marks in zone code, a seeded zone character and a paying Pit win are flagged', () => {
  assert.equal(c6(withFile('origins/server/story.ts', 'const levelOfMarks = (m: number) => 1 + m;'), FILES).length, 2, 'a second definition, and the zone file now names Pit marks');
  assert.equal(c6(withFile('origins/server/shop-buy.ts', 'const creditFromMarks = (m: number) => m;'), FILES).length, 1);
  assert.equal(c6(withFile('origins/server/mob-rewards.ts', 'const l = rankFor(row.victory_marks);'), FILES).length, 1);
  assert.equal(c6(withFile('origins/preview/save.ts', 'const lvl = marksOf(profile);'), FILES).length, 1);
  assert.equal(c6(withFile('origins/server/story.ts', 'const c = careerAtLevel(12);'), FILES).length, 1);
  assert.equal(c6(withFile('origins/server/story.ts', 'const c = newCareer(12);'), FILES).length, 1);
  assert.equal(c6(withFile('origins/server/career.ts', 'const p = award(state, ev);'), FILES).length, 1);
  assert.equal(c6((f) => f === 'origins/server/career.ts' ? disk(f).replaceAll('cp: 0', 'cp: 5') : disk(f), FILES).length, 1);
  assert.equal(c6(withFile('origins/pit/pit.ts', 'const s = careerAtLevel(3);'), FILES).length, 0, 'the Pit session may');
  assert.equal(c6(withFile('origins/server/story.ts', 'const c = newCareer();'), FILES).length, 0);
});

test('every moved module lives in src/core and nothing is left behind at the old paths', () => {
  const moved = ['career-ladder', 'career-model', 'gear-ledger', 'gear-net', 'gear-server', 'gear-sheet', 'gear-room', 'loot', 'loot-claims', 'loot-panel', 'open'];
  const top = ['writer-call', 'account', 'account-entry', 'session', 'profile', 'cloud-profile', 'grades'];
  const src = new Set(readdirSync('src')), fight = new Set(readdirSync('src/fight')), core = new Set(readdirSync('src/core'));
  assert.deepEqual(moved.filter((n) => fight.has(`${n}.ts`)), []);
  assert.deepEqual(top.filter((n) => src.has(`${n}.ts`)), []);
  assert.equal(src.has('career.ts') || existsSync('origins/progression'), false, 'the old career paths are gone');
  assert.deepEqual([...moved, ...top].filter((n) => !core.has(`${n}.ts`)), []);
});
