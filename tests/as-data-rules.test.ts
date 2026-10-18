// Rules (f) const expressions, (g) object consts and (h) inline numbers in game logic of the as-data checker (scripts/as-data/{const-expr,const-object,inline-number}.yml + check.ts; hard-coding audit 2026-10-17,
// gaps 1, 3 and 2). Pinned on a fixture tree with its own baselines, never the live count: each site is listed, a tree that matches its baselines is green under --gate, a NEW site is red (exit 1), and a baseline above the
// tree is stale (exit 3). (h) scans only the files its scope names, so the fixture scopes one folder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

type Site = { file: string; line: number; text: string };
type Report = Record<'constExprSites' | 'newConstExprSites' | 'constObjectSites' | 'newConstObjectSites' | 'inlineNumberSites' | 'newInlineNumberSites', Site[]>
  & Record<'loweredConstExprs' | 'loweredConstObjects' | 'loweredInlineNumbers', { file: string; literal: string; baseline: number; now: number }[]>;

const CONSTS = [
  'export const SAVE_EVERY_MS = 5 * 60_000;',            // (f) counted: arithmetic with a number
  'export const PLAIN = 7;',                              // not (f): a plain number is rule (c)'s (allow-listed in the real tree)
  'export const ALIAS = SAVE_EVERY_MS;',                  // not (f): no number in the value
  'const local = 3 * 4;',                                 // not (f): not an UPPER const
  'export const CAPS = { attack: 1.15, res: 0.80 };',     // (g) counted: single-digit decimals
  'export const FLAGS = { a: 0, b: 1 };',                 // not (g): only 0 and 1
  'export const SIZES = { a: 2 } as const;',              // (g) counted: a small integer, as const
].join('\n') + '\n';
const GAME = [
  'export const f = (x: number) => (x > 0.85 ? x * 2.5 : x);',   // (h) counted: 0.85 (a compare) and 2.5 (arithmetic)
  'export const g = (x: number) => Math.max(x, 0.5);',           // not (h): a Math.max argument is rule (e)'s
  'export const h = (n = 4) => n;',                              // (h) counted: a parameter default
  'export const k = () => foo({ gap: 7 }, 9);',                  // (h) counted: an object pair and a call argument
  'export const LIMIT = 40;',                                    // not (h): a top-level UPPER const is the const rules'
  'export const z = (x: number) => x + 1;',                      // not (h): 1 is identity
  'declare function foo(...a: unknown[]): void;',
].join('\n') + '\n';

function tree() {
  const dir = mkdtempSync(join(tmpdir(), 'as-data-rules-'));
  mkdirSync(join(dir, 'src', 'inl-fixture'), { recursive: true });
  const consts = join(dir, 'src', 'consts.ts'), game = join(dir, 'src', 'inl-fixture', 'game.ts');
  const ck = relative(process.cwd(), consts), gk = relative(process.cwd(), game);
  writeFileSync(consts, CONSTS); writeFileSync(game, GAME);
  const f = (name: string, body: unknown) => { const p = join(dir, name); writeFileSync(p, JSON.stringify(body)); return p; };
  const args = [
    '--allow', f('allow.json', { allow: [] }), '--inline-scope', f('scope.json', { files: [], dirs: ['**/inl-fixture/*.ts'] }),
    '--clamp-baseline', f('clamp.json', { [gk]: { '0.5': 1 } }), '--map-baseline', f('map.json', {}),
    '--const-expr-baseline', f('expr.json', { [ck]: { SAVE_EVERY_MS: 1 } }), '--const-object-baseline', f('obj.json', { [ck]: { CAPS: 1, SIZES: 1 } }),
    '--inline-number-baseline', f('inl.json', { [gk]: { '0.85': 1, '2.5': 1, '4': 1, '7': 1, '9': 1 } }),
  ];
  const run = (...extra: string[]) => spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--root', join(dir, 'src'), ...args, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const report = (r: ReturnType<typeof run>) => JSON.parse(r.stdout.split('\n').filter((l) => l.startsWith('{')).pop()!) as Report;
  const texts = (s: Site[]) => s.map((x) => x.text.replace(/ =.*/, '')).sort();
  return { dir, consts, game, ck, gk, run, report, texts };
}

test('(f) lists an UPPER const whose value is arithmetic with a number, (g) an UPPER const object with a number past 0/1, (h) an inline number in the scoped files; a tree matching its baselines is green under --gate', () => {
  const t = tree();
  try {
    const r = t.run('--gate');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const rep = t.report(r);
    assert.deepEqual(t.texts(rep.constExprSites), ['SAVE_EVERY_MS']);
    assert.deepEqual(t.texts(rep.constObjectSites), ['CAPS', 'SIZES']);
    assert.deepEqual(rep.inlineNumberSites.map((s) => s.text).sort(), ['0.85', '2.5', '4', '7', '9']);
    assert.deepEqual([rep.newConstExprSites, rep.newConstObjectSites, rep.newInlineNumberSites].map((l) => l.length), [0, 0, 0]);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('mutation: a NEW const expression, object const or inline number is refused under --gate (exit 1) and named', () => {
  const t = tree();
  try {
    writeFileSync(t.consts, CONSTS + 'export const FIRST_DELAY_S = 72 * 3600;\nexport const BANDS = { low: 0.25 };\n');
    const a = t.run('--gate'), rep = t.report(a);
    assert.equal(a.status, 1);
    assert.deepEqual(t.texts(rep.newConstExprSites), ['FIRST_DELAY_S']);
    assert.deepEqual(t.texts(rep.newConstObjectSites), ['BANDS']);
    writeFileSync(t.consts, CONSTS);
    writeFileSync(t.game, GAME + 'export const m = (x: number) => x < 0.9;\n');
    const b = t.run('--gate');
    assert.equal(b.status, 1);
    assert.deepEqual(t.report(b).newInlineNumberSites.map((s) => s.text), ['0.9']);
    assert.equal(t.run().status, 0, 'report-only without --gate');
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('a number moved out of code leaves its baseline stale (exit 3) until the baseline comes down, for each of the three rules', () => {
  const t = tree();
  try {
    writeFileSync(t.consts, CONSTS.replace('5 * 60_000', 'SAVE_ROW').replace('{ attack: 1.15, res: 0.80 }', '{ attack: 1, res: 0 }'));
    writeFileSync(t.game, GAME.replace('n = 4', 'n = 1'));
    const r = t.run(), rep = t.report(r);
    assert.equal(r.status, 3);
    assert.deepEqual(rep.loweredConstExprs.map((l) => [l.literal, l.baseline, l.now]), [['SAVE_EVERY_MS', 1, 0]]);
    assert.deepEqual(rep.loweredConstObjects.map((l) => [l.literal, l.baseline, l.now]), [['CAPS', 1, 0]]);
    assert.deepEqual(rep.loweredInlineNumbers.map((l) => [l.literal, l.baseline, l.now]), [['4', 1, 0]]);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});
