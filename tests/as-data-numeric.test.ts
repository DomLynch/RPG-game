// Rule (f) of the as-data checker (scripts/as-data/numeric.yml + check.ts): a number in a comparison, a multiply or a divide, held to a ratchet (numeric-baseline.json, per file and
// literal) over the scope in numeric-scope.json (the sim's import closure, whole folders by prefix, minus the format files named with a reason); the rest is counted, report-only.
// Pinned on a fixture tree with its own scope and baseline, never the live count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

type Num = { file: string; line: number; text: string };
type Report = { numerics: number; newNumerics: number; numericsOutOfScope: number; numericSites: Num[]; newNumericSites: Num[]; loweredNumerics: { file: string; literal: string; baseline: number; now: number }[] };

const SIM = [
  "import { HELPER } from './helper.ts';",
  'export const a = (r: number) => (r > 11.5 ? r * -2 : r / 0.5);',   // counted: a comparison, a multiply by a negative, a divide
  'export const b = (t: number) => { t *= 4; t /= 1; return t + 7 - 8; };',   // counted: 4 in *=; not 1 (identity), not + or -
].join('\n') + '\n';
const HELPER = 'export const HELPER = (x: number) => x >= 3;\n';   // in scope through the sim's import
const LOOK = 'export const glow = (x: number) => x * 0.85;\n';      // outside the scope: counted, report-only
const FORMAT = 'export const byte = (b: number) => b < 128;\n';     // a format file named in the scope: not counted at all

function tree() {
  const dir = mkdtempSync(join(tmpdir(), 'as-data-numeric-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  const key = (f: string) => relative(process.cwd(), join(dir, 'src', f));
  writeFileSync(join(dir, 'src', 'sim.ts'), SIM); writeFileSync(join(dir, 'src', 'helper.ts'), HELPER);
  writeFileSync(join(dir, 'src', 'look.ts'), LOOK); writeFileSync(join(dir, 'src', 'format.ts'), FORMAT);
  const allow = join(dir, 'allow.json'), base = join(dir, 'numeric-baseline.json'), scope = join(dir, 'numeric-scope.json');
  writeFileSync(allow, '{"allow":[]}');
  writeFileSync(scope, JSON.stringify({ simRoots: [key('sim.ts')], prefixes: [], format: [{ file: key('format.ts'), reason: 'a fixture byte format' }] }));
  writeFileSync(base, JSON.stringify({ [key('sim.ts')]: { '11.5': 1, '-2': 1, '0.5': 1, '4': 1 }, [key('helper.ts')]: { '3': 1 } }));
  const run = (...extra: string[]) => spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--root', join(dir, 'src'), '--allow', allow, '--numeric-scope', scope, '--numeric-baseline', base, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const report = (r: ReturnType<typeof run>) => JSON.parse(r.stdout.split('\n').filter((l) => l.startsWith('{')).pop()!) as Report;
  return { dir, key, base, scope, run, report, sim: join(dir, 'src', 'sim.ts') };
}

test('rule (f) lists numbers in comparisons, multiplies and divides in scope (the sim and what it imports, not a format file), counts the rest report-only, and is green when it matches its baseline', () => {
  const t = tree();
  try {
    const r = t.run('--gate');
    assert.equal(r.status, 0, r.stderr);
    const rep = t.report(r);
    assert.deepEqual(rep.numericSites.map((n) => [n.file, n.text]), [[t.key('helper.ts'), '3'], [t.key('sim.ts'), '11.5'], [t.key('sim.ts'), '-2'], [t.key('sim.ts'), '0.5'], [t.key('sim.ts'), '4']]);
    assert.equal(rep.numericsOutOfScope, 1, 'look.ts 0.85 is counted, not ratcheted; format.ts 128 is exempt by name and so is not in scope either');
    assert.equal(rep.newNumerics, 0);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('mutation: a NEW number in scope is red under --gate (exit 1) and named; a new number outside the scope is not', () => {
  const t = tree();
  try {
    writeFileSync(t.sim, SIM + 'export const c = (h: number) => h * 0.25;\n');
    const gated = t.run('--gate');
    assert.equal(gated.status, 1, 'a new in-scope number is red');
    assert.deepEqual(t.report(gated).newNumericSites.map((n) => [n.file, n.line, n.text]), [[t.key('sim.ts'), 4, '0.25']]);
    writeFileSync(t.sim, SIM);
    writeFileSync(join(t.dir, 'src', 'look.ts'), LOOK + 'export const dim = (x: number) => x * 0.4;\n');
    assert.equal(t.run('--gate').status, 0, 'outside the scope stays report-only');
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('a removed number leaves the baseline stale (exit 3); --write-numeric-baseline refuses while anything is new and writes the smaller tally once nothing is; a format entry needs a reason', () => {
  const t = tree();
  try {
    writeFileSync(t.sim, SIM.replace('r / 0.5', 'r'));
    const removed = t.run();
    assert.equal(removed.status, 3);
    assert.deepEqual(t.report(removed).loweredNumerics.map((l) => [l.literal, l.baseline, l.now]), [['0.5', 1, 0]]);
    const before = readFileSync(t.base, 'utf8');
    writeFileSync(t.sim, SIM + 'export const c = (h: number) => h * 0.25;\n');
    const refused = t.run('--write-numeric-baseline');
    assert.equal(refused.status, 2, refused.stdout + refused.stderr);
    assert.match(refused.stderr, /the baseline only shrinks/);
    assert.equal(readFileSync(t.base, 'utf8'), before);
    writeFileSync(t.sim, SIM.replace('r / 0.5', 'r'));
    assert.equal(t.run('--write-numeric-baseline').status, 0);
    assert.deepEqual(JSON.parse(readFileSync(t.base, 'utf8'))[t.key('sim.ts')], { '11.5': 1, '-2': 1, '4': 1 });
    assert.equal(t.run('--gate').status, 0);
    writeFileSync(t.scope, JSON.stringify({ simRoots: [], prefixes: [], format: [{ file: 'x.ts', reason: 'short' }] }));
    const bad = t.run();
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /needs a real reason/);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});
