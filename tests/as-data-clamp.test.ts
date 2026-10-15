// Rule (e) of the as-data checker (scripts/as-data/clamp.yml + check.ts): a number written straight into Math.max / Math.min, held to a ratchet (clamp-baseline.json, per file and
// literal). Pinned on a fixture tree with its own baseline, never the live count: a new literal is red under --gate, a baseline above the tree is stale (exit 3), and the
// baseline can only be rewritten downward.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

type Clamp = { file: string; line: number; text: string };
type Report = { clamps: number; newClamps: number; clampSites: Clamp[]; newClampSites: Clamp[]; loweredClamps: { file: string; literal: string; baseline: number; now: number }[] };

const FIXTURE = [
  'export const a = (x: number) => Math.max(x, 0.5);',        // counted: a floor
  'export const b = (y: number) => Math.min(3, y);',          // counted: a cap, literal first
  'export const c = (z: number) => Math.max(z, -2);',         // counted: a negative literal
  'export const d = (w: number) => Math.max(0, Math.min(1, w));',   // 0 and 1 are identity bounds: not counted
  'export const e = (v: number) => Math.max(v, 0.5 * v);',    // a number inside a wider argument: not this rule's
].join('\n') + '\n';

function tree() {
  const dir = mkdtempSync(join(tmpdir(), 'as-data-clamp-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  const file = join(dir, 'src', 'clamps.ts'), key = relative(process.cwd(), file);
  writeFileSync(file, FIXTURE);
  const allow = join(dir, 'allow.json'), base = join(dir, 'clamp-baseline.json');
  writeFileSync(allow, '{"allow":[]}');
  writeFileSync(base, JSON.stringify({ [key]: { '0.5': 1, '3': 1, '-2': 1 } }));
  const run = (...extra: string[]) => spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--root', join(dir, 'src'), '--allow', allow, '--clamp-baseline', base, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const report = (r: ReturnType<typeof run>) => JSON.parse(r.stdout.split('\n').filter((l) => l.startsWith('{')).pop()!) as Report;
  return { dir, file, key, base, run, report };
}

test('rule (e) lists the bare numbers in Math.max/min (not 0 or 1, not a number inside a wider argument), and a tree that matches its baseline is green under --gate', () => {
  const t = tree();
  try {
    const r = t.run('--gate');
    assert.equal(r.status, 0, r.stderr);
    const rep = t.report(r);
    assert.deepEqual(rep.clampSites.map((c) => [c.line, c.text]), [[1, '0.5'], [2, '3'], [3, '-2']]);
    assert.equal(rep.newClamps, 0);
    assert.deepEqual(rep.loweredClamps, []);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('mutation: a NEW inline clamp literal is refused under --gate (exit 1) and named; without --gate it is reported, not failed', () => {
  const t = tree();
  try {
    writeFileSync(t.file, FIXTURE + 'export const f = (u: number) => Math.min(u, 0.25);\n');
    const gated = t.run('--gate');
    assert.equal(gated.status, 1, 'a new literal is red under --gate');
    assert.deepEqual(t.report(gated).newClampSites.map((c) => [c.file, c.line, c.text]), [[t.key, 6, '0.25']]);
    assert.equal(t.run().status, 0, 'report-only without --gate');
    // the same literal a second time in the file is also new: the baseline counts, it does not just list
    writeFileSync(t.file, FIXTURE + 'export const g = (u: number) => Math.max(u, 0.5);\n');
    assert.deepEqual(t.report(t.run('--gate')).newClampSites.map((c) => c.text), ['0.5']);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('swapping a literal for another is new AND stale, never silent; a removed literal leaves the baseline stale (exit 3) until it comes down', () => {
  const t = tree();
  try {
    writeFileSync(t.file, FIXTURE.replace('Math.max(x, 0.5)', 'Math.max(x, 0.7)'));
    const swapped = t.run('--gate'), rep = t.report(swapped);
    assert.notEqual(swapped.status, 0);
    assert.deepEqual(rep.newClampSites.map((c) => c.text), ['0.7']);
    assert.deepEqual(rep.loweredClamps.map((l) => [l.literal, l.baseline, l.now]), [['0.5', 1, 0]]);
    writeFileSync(t.file, FIXTURE.replace('Math.max(x, 0.5)', 'x'));
    const removed = t.run();
    assert.equal(removed.status, 3, 'a baseline above the tree is a list-integrity failure');
    assert.deepEqual(t.report(removed).loweredClamps.map((l) => l.literal), ['0.5']);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('--write-clamp-baseline only lowers: it refuses (exit 2, file untouched) while anything is new, and writes the smaller tally once nothing is', () => {
  const t = tree();
  try {
    const before = readFileSync(t.base, 'utf8');
    writeFileSync(t.file, FIXTURE + 'export const f = (u: number) => Math.min(u, 0.25);\n');
    const refused = t.run('--write-clamp-baseline');
    assert.equal(refused.status, 2, refused.stdout + refused.stderr);
    assert.match(refused.stderr, /the baseline only shrinks/);
    assert.equal(readFileSync(t.base, 'utf8'), before);
    writeFileSync(t.file, FIXTURE.replace('Math.min(3, y)', 'y'));
    assert.equal(t.run('--write-clamp-baseline').status, 0);
    assert.deepEqual(JSON.parse(readFileSync(t.base, 'utf8')), { [t.key]: { '0.5': 1, '-2': 1 } });
    assert.equal(t.run('--gate').status, 0);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});
