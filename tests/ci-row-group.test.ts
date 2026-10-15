// scripts/ci-row-group.mjs + scripts/lib/row-groups.mjs: several release rows in ONE job, receipts still per row (Deploy, release speed 2026-10-13).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const { runGroup, rowCeilingS } = await import('../scripts/ci-row-group.mjs');
const { packRows, groupLabel, rowSeconds, DEFAULT_ROW_S, TARGET_GROUP_S } = await import('../scripts/lib/row-groups.mjs');

const row = (index: number, name = `r${index}`) => ({ index, name, argv: JSON.stringify(['node', `${name}.mjs`]) });
const harness = (outcomes: Record<string, number[]>) => {
  const dir = mkdtempSync(join(tmpdir(), 'rowgroup-')), calls: string[] = [], lines: string[] = [], left = { ...outcomes };
  let clock = 0;
  const run = (argv: string[]) => { calls.push(argv[1]); return (left[argv[1]] ?? [0]).shift() ?? 0; };
  return { dir, calls, lines, args: { run, rev: (a: string) => (a === 'HEAD' ? 'a'.repeat(40) : 'b'.repeat(40)), log: (l: string) => lines.push(l), now: () => (clock += 1000), dir } };
};

test('runGroup: every row runs once in index order, a receipt per row with the one-job-per-row fields, and an array receipt for the group', () => {
  const h = harness({});
  try {
    const { failed, receipts } = runGroup({ id: 'g3', rows: [row(14), row(3), row(11)], event: 'pull_request', ...h.args });
    assert.deepEqual(h.calls, ['r3.mjs', 'r11.mjs', 'r14.mjs']);
    assert.equal(failed.length, 0);
    const one = JSON.parse(readFileSync(join(h.dir, 'release-check-11.json'), 'utf8'));
    assert.deepEqual(Object.keys(one).sort(), ['command', 'event', 'group', 'index', 'name', 'runner', 'seconds', 'sha', 'status', 'tree'], 'same fields as the per-row job, plus the group');
    assert.deepEqual([one.index, one.status, one.runner, one.event, one.tree], [11, 0, 'ubuntu-latest', 'pull_request', 'b'.repeat(40)]);
    assert.deepEqual(JSON.parse(readFileSync(join(h.dir, 'release-check-g3.json'), 'utf8')).map((r: { index: number }) => r.index), [3, 11, 14]);
    assert.deepEqual(readdirSync(h.dir).sort(), ['release-check-11.json', 'release-check-14.json', 'release-check-3.json', 'release-check-g3.json']);
    assert.equal(receipts.length, 3);
  } finally { rmSync(h.dir, { recursive: true, force: true }); }
});

test('runGroup: a flaky row retries ALONE (never the group) and stays visible; a row that fails twice is red, named, and the others keep their green receipts', () => {
  const h = harness({ 'r5.mjs': [1, 0], 'r9.mjs': [2, 2] });
  try {
    const { failed, receipts } = runGroup({ id: 'g1', rows: [row(4), row(5), row(9), row(12)], event: 'pull_request', ...h.args });
    assert.deepEqual(h.calls, ['r4.mjs', 'r5.mjs', 'r5.mjs', 'r9.mjs', 'r9.mjs', 'r12.mjs'], 'only r5 and r9 ran twice, each right after its own failure');
    const by = Object.fromEntries(receipts.map(r => [r.index, r]));
    assert.deepEqual([by[5].status, by[5].retried, by[5].first_status], [0, true, 1], 'flaky but passed: green receipt that says it was retried');
    assert.deepEqual([by[9].status, by[9].first_status], [2, 2]);
    assert.ok(by[4].status === 0 && by[12].status === 0 && !('retried' in by[4]), 'rows after a red row still run and keep their receipts');
    assert.deepEqual(failed.map(r => r.index), [9]);
    assert.ok(h.lines.some(l => /Retrying release check 5 alone/.test(l)) && h.lines.some(l => /::error::release rows FAILED in group g1: 9 \(r9, exit 2\)/.test(l)), 'the red row names itself in the log');
  } finally { rmSync(h.dir, { recursive: true, force: true }); }
});

// GS row 56 (2026-10-15): the row printed its first PASS and never exited, because its npx-spawned vite grandchild kept the pipes open. The old 30-minute row timeout equalled the job timeout, so the
// job was cancelled at 30 min and the whole group failed. Now a row has its own ceiling (ROW_TIMEOUT_S, default 600 s) and a hang fails THAT row, by name, and is not retried.
test('runGroup: a row that hangs fails BY NAME at its own ceiling, is not retried, its stray child is killed, and the next row still runs', { skip: spawnSync('sh', ['-c', 'command -v timeout']).status !== 0 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'rowhang-')), lines: string[] = [];
  const before = process.env.ROW_TIMEOUT_S; process.env.ROW_TIMEOUT_S = '2';
  try {
    const hang = { index: 7, name: 'hang', argv: JSON.stringify(['sh', '-c', 'sleep 31337 & wait']) };   // a grandchild that outlives its parent, like npx -> vite
    const ok = { index: 8, name: 'ok', argv: JSON.stringify(['true']) };
    const t0 = Date.now();
    const { failed, receipts } = runGroup({ id: 'g9', rows: [hang, ok], event: 'pull_request', dir, log: (l: string) => lines.push(l) });
    assert.ok(Date.now() - t0 < 20_000, `the hang was killed at its 2 s ceiling, not the job timeout (${Date.now() - t0} ms)`);
    assert.deepEqual(failed.map(r => [r.index, r.name, r.status, r.timed_out]), [[7, 'hang', 124, true]], 'only the hung row failed, by name');
    assert.equal(receipts.find(r => r.index === 8)?.status, 0, 'the next row still ran and passed');
    assert.ok(!lines.some(l => /Retrying/.test(l)), 'a hang is not retried');
    assert.ok(lines.some(l => /check 7 \(hang\) hit the 2s ceiling/.test(l)), lines.join('\n'));
    assert.ok(lines.some(l => /::error::release rows FAILED.*7 \(hang, exit 124, timed out at the 2s ceiling\)/.test(l)), lines.join('\n'));
    assert.equal(spawnSync('pgrep', ['-f', 'sleep 31337'], { encoding: 'utf8' }).status, 1, 'the stray grandchild was killed with the row group');
    const one = JSON.parse(readFileSync(join(dir, 'release-check-7.json'), 'utf8'));
    assert.equal(one.timed_out, true);
    assert.equal(JSON.parse(readFileSync(join(dir, 'release-check-8.json'), 'utf8')).timed_out, undefined, 'an ordinary row has no timed_out field');
  } finally { if (before === undefined) delete process.env.ROW_TIMEOUT_S; else process.env.ROW_TIMEOUT_S = before; rmSync(dir, { recursive: true, force: true }); }
});

test('rowCeilingS: 600 s by default, ROW_TIMEOUT_S overrides it, and a bad value falls back to 600', () => {
  const before = process.env.ROW_TIMEOUT_S;
  try {
    delete process.env.ROW_TIMEOUT_S; assert.equal(rowCeilingS(), 600);
    process.env.ROW_TIMEOUT_S = '45'; assert.equal(rowCeilingS(), 45);
    for (const bad of ['', 'abc', '0', '-5']) { process.env.ROW_TIMEOUT_S = bad; assert.equal(rowCeilingS(), 600, `"${bad}"`); }
  } finally { if (before === undefined) delete process.env.ROW_TIMEOUT_S; else process.env.ROW_TIMEOUT_S = before; }
});

test('packRows: every row exactly once, groups near the target, the longest row alone, deterministic', () => {
  const sec = rowSeconds(), rows = Object.keys(sec).map(i => row(Number(i)));
  const groups = packRows(rows);
  assert.deepEqual(groups.flatMap(g => g.rows.map(r => r.index)).sort((a, b) => a - b), rows.map(r => r.index).sort((a, b) => a - b), 'each row in exactly one group');
  assert.ok(groups.length >= 8 && groups.length <= 14, `about ten jobs, not ${rows.length}: got ${groups.length}`);
  for (const g of groups) assert.ok(g.estimateS <= TARGET_GROUP_S + 60 || g.rows.length === 1, `group ${g.id} (${g.estimateS} s) stays near the target`);
  assert.deepEqual(packRows(rows.slice().reverse()).map(g => g.rows.map(r => r.index)), groups.map(g => g.rows.map(r => r.index)), 'input order does not change the packing');
  assert.deepEqual(groups.map(g => g.id), groups.map((_, i) => `g${i + 1}`));
  assert.deepEqual(packRows([]), []);
  assert.equal(packRows([row(999)])[0].estimateS, DEFAULT_ROW_S, 'a row with no measured weight is packed as the default');
});

test('groupLabel starts with the row list ci-trusted-checks reads', () => {
  const [g] = packRows([row(14, 'account-browser-check'), row(11, 'polearm-browser-check'), row(3, 'finisher-preview')], { 14: 100, 11: 100, 3: 100 }, 1000);
  assert.match(groupLabel(g), /^3,11,14 \(/);
  assert.match(groupLabel(g), /\+1 more\)$/);
});
