// Rule (j) of the as-data checker (scripts/as-data/branch-id.yml + check.ts; hard-coding audit 2026-10-17, gap 5): a string literal compared (=== / !== / case) against a content id the data rows declare, beyond rule (a)'s
// five categories, held to a per-file, per-literal ratchet (branch-id-baseline.json). Pinned on a fixture tree with its own id list (--branch-ids) and baselines, never the live count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

type Site = { file: string; line: number; text: string };
type Report = { branchIdSites: Site[]; newBranchIdSites: Site[]; loweredBranchIds: { literal: string; baseline: number; now: number }[] };

const FIXTURE = [
  "export const a = (t: string) => t === 'gale';",                              // counted: a row id compared
  "export const b = (t: string) => { switch (t) { case 'loki': return 1; default: return 0; } };",   // counted: a case on a row id
  "export const c = (t: string) => t === 'other';",                             // not counted: not a row id
  "export const d = (t: string) => t !== 'gale' ? 1 : 0;",                      // counted: the same id again (the baseline counts)
  "export const e = ['gale', 'loki'];",                                          // not counted: not a compare
].join('\n') + '\n';

function tree() {
  const dir = mkdtempSync(join(tmpdir(), 'as-data-branch-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  const file = join(dir, 'src', 'branches.ts'), key = relative(process.cwd(), file);
  writeFileSync(file, FIXTURE);
  const f = (name: string, body: unknown) => { const p = join(dir, name); writeFileSync(p, JSON.stringify(body)); return p; };
  const args = [
    '--allow', f('allow.json', { allow: [] }), '--inline-scope', f('scope.json', { files: [], dirs: [] }), '--branch-ids', f('ids.json', ['gale', 'loki']),
    '--clamp-baseline', f('clamp.json', {}), '--map-baseline', f('map.json', {}), '--const-expr-baseline', f('expr.json', {}), '--const-object-baseline', f('obj.json', {}), '--inline-number-baseline', f('inl.json', {}), '--id-table-baseline', f('idt.json', {}),
    '--branch-id-baseline', f('bid.json', { [key]: { "'gale'": 2, "'loki'": 1 } }),
  ];
  const run = (...extra: string[]) => spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--root', join(dir, 'src'), ...args, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const report = (r: ReturnType<typeof run>) => JSON.parse(r.stdout.split('\n').filter((l) => l.startsWith('{')).pop()!) as Report;
  return { dir, file, run, report };
}

test('(j) lists a compare or a case against a row id (not another string, not a non-compare); a tree at its baseline is green under --gate', () => {
  const t = tree();
  try {
    const r = t.run('--gate');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const rep = t.report(r);
    assert.deepEqual(rep.branchIdSites.map((s) => [s.line, s.text]), [[1, "'gale'"], [2, "'loki'"], [4, "'gale'"]]);
    assert.deepEqual(rep.newBranchIdSites, []);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('mutation: a NEW branch on a row id is refused under --gate (exit 1) and named; a branch removed leaves its baseline stale (exit 3)', () => {
  const t = tree();
  try {
    writeFileSync(t.file, FIXTURE + "export const f = (t: string) => t === 'loki';\n");
    const a = t.run('--gate');
    assert.equal(a.status, 1);
    assert.deepEqual(t.report(a).newBranchIdSites.map((s) => s.text), ["'loki'"]);
    assert.equal(t.run().status, 0, 'report-only without --gate');
    writeFileSync(t.file, FIXTURE.replace("t !== 'gale' ? 1 : 0", '1'));
    const b = t.run();
    assert.equal(b.status, 3);
    assert.deepEqual(t.report(b).loweredBranchIds.map((l) => [l.literal, l.baseline, l.now]), [["'gale'", 2, 1]]);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});
