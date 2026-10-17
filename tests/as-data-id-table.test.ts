// Rule (i) of the as-data checker (scripts/as-data/id-table.yml + check.ts; hard-coding audit 2026-10-17, gap 4): an array literal of 3+ id-bearing object literals kept in TypeScript is a content table, held to a ratchet
// (id-table-baseline.json, per file and first row id). Pinned on a fixture tree with its own baselines, never the live count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

type Site = { file: string; line: number; text: string };
type Report = { idTableSites: Site[]; newIdTableSites: Site[]; loweredIdTables: { literal: string; baseline: number; now: number }[] };

const FIXTURE = [
  "export const A = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'c', n: 3 }];",       // counted: three rows with an id, keyed on the first
  "export const B = [{ id: 'x' }, { id: 'y' }];",                                       // not counted: two rows
  "export const C = [{ name: 'p' }, { name: 'q' }, { name: 'r' }];",                    // not counted: no id field
  "export const D = [{ 'id': 'q1' }, { 'id': 'q2' }, { 'id': 'q3' }] as const;",        // counted: a quoted key, as const
  "export const E = [{ id: 'm' }, { n: 1 }, { id: 'o' }];",                             // not counted: the second row has no id
].join('\n') + '\n';

function tree() {
  const dir = mkdtempSync(join(tmpdir(), 'as-data-idtable-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  const file = join(dir, 'src', 'tables.ts'), key = relative(process.cwd(), file);
  writeFileSync(file, FIXTURE);
  const f = (name: string, body: unknown) => { const p = join(dir, name); writeFileSync(p, JSON.stringify(body)); return p; };
  const args = [
    '--allow', f('allow.json', { allow: [] }), '--inline-scope', f('scope.json', { files: [], dirs: [] }),
    '--clamp-baseline', f('clamp.json', {}), '--map-baseline', f('map.json', {}), '--const-expr-baseline', f('expr.json', {}), '--const-object-baseline', f('obj.json', {}), '--inline-number-baseline', f('inl.json', {}),
    '--id-table-baseline', f('idt.json', { [key]: { a: 1, q1: 1 } }),
  ];
  const run = (...extra: string[]) => spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--root', join(dir, 'src'), ...args, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const report = (r: ReturnType<typeof run>) => JSON.parse(r.stdout.split('\n').filter((l) => l.startsWith('{')).pop()!) as Report;
  return { dir, file, run, report, allowFile: join(dir, 'allow.json') };
}

test('(i) lists an array of 3+ id-bearing object literals (keyed on the first id), not two rows, not rows without an id; a tree at its baseline is green under --gate', () => {
  const t = tree();
  try {
    const r = t.run('--gate');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const rep = t.report(r);
    assert.deepEqual(rep.idTableSites.map((s) => [s.line, s.text]), [[1, 'a'], [4, 'q1']]);
    assert.deepEqual(rep.newIdTableSites, []);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('a named exempt (allow idTables: file + first row id + reason) is listed apart and not counted; an exempt whose table is gone is stale (exit 3)', () => {
  const t = tree();
  try {
    const allow = (entries: unknown[]) => writeFileSync(t.allowFile, JSON.stringify({ allow: [], idTables: entries }));
    const key = relative(process.cwd(), t.file);
    allow([{ file: key, id: 'a', reason: 'a pure-data literal read by a tool; moving it needs a bump' }]);
    const r = t.run();
    assert.equal(r.status, 3, 'the baseline still counts "a" while the exempt removes it: stale, lower it');
    const rep = t.report(r) as Report & { allowedIdTables: Site[]; staleIdAllow: unknown[] };
    assert.deepEqual(rep.idTableSites.map((s) => s.text), ['q1']);
    assert.deepEqual(rep.allowedIdTables.map((s) => s.text), ['a']);
    allow([{ file: key, id: 'zz', reason: 'a table that is not there any more' }]);
    const stale = t.run();
    assert.equal(stale.status, 3);
    assert.equal((t.report(stale) as { staleIdAllow: unknown[] }).staleIdAllow.length, 1);
    allow([{ file: key, id: 'a', reason: 'short' }]);
    assert.equal(t.run().status, 2, 'a reason under 12 characters is refused');
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('mutation: a NEW id table is refused under --gate (exit 1) and named; a table moved to a rows file leaves its baseline stale (exit 3)', () => {
  const t = tree();
  try {
    writeFileSync(t.file, FIXTURE + "export const F = [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }];\n");
    const a = t.run('--gate');
    assert.equal(a.status, 1);
    assert.deepEqual(t.report(a).newIdTableSites.map((s) => s.text), ['k1']);
    assert.equal(t.run().status, 0, 'report-only without --gate');
    writeFileSync(t.file, FIXTURE.replace(/export const A = .*\n/, ''));
    const b = t.run();
    assert.equal(b.status, 3);
    assert.deepEqual(t.report(b).loweredIdTables.map((l) => [l.literal, l.baseline, l.now]), [['a', 1, 0]]);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});
