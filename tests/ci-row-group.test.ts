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
    const stubborn = { index: 8, name: 'stubborn', argv: JSON.stringify(['sh', '-c', 'trap "" TERM; sleep 31338 & wait']) };   // ignores TERM: timeout has to KILL the group after -k 5
    const ok = { index: 9, name: 'ok', argv: JSON.stringify(['true']) };
    const t0 = Date.now();
    const { failed, receipts } = runGroup({ id: 'g9', rows: [hang, stubborn, ok], event: 'pull_request', dir, log: (l: string) => lines.push(l) });
    assert.ok(Date.now() - t0 < 40_000, `both hangs were killed at their 2 s ceiling (+5 s KILL grace), not the job timeout (${Date.now() - t0} ms)`);
    assert.deepEqual(failed.map(r => [r.index, r.name, r.status, r.timed_out]), [[7, 'hang', 124, true], [8, 'stubborn', 124, true]], 'only the hung rows failed, by name');
    assert.equal(receipts.find(r => r.index === 9)?.status, 0, 'the next row still ran and passed');
    assert.ok(!lines.some(l => /Retrying/.test(l)), 'a hang is not retried');
    assert.ok(lines.some(l => /check 7 \(hang\) hit the 2s ceiling/.test(l)), lines.join('\n'));
    assert.ok(lines.some(l => /::error::release rows FAILED.*7 \(hang, exit 124, timed out at the 2s ceiling\), 8 \(stubborn, exit 124, timed out at the 2s ceiling\)/.test(l)), lines.join('\n'));
    for (const marker of ['^sleep 31337', '^sleep 31338']) assert.equal(spawnSync('pgrep', ['-f', marker], { encoding: 'utf8' }).status, 1, `the stray grandchild (${marker}) was killed with the row group`);
    const one = JSON.parse(readFileSync(join(dir, 'release-check-7.json'), 'utf8'));
    assert.equal(one.timed_out, true);
    assert.equal(JSON.parse(readFileSync(join(dir, 'release-check-9.json'), 'utf8')).timed_out, undefined, 'an ordinary row has no timed_out field');
  } finally { if (before === undefined) delete process.env.ROW_TIMEOUT_S; else process.env.ROW_TIMEOUT_S = before; rmSync(dir, { recursive: true, force: true }); }
});

test('runGroup: exit 137 (timeout had to KILL a child that ignored TERM) at the ceiling is a timeout too (not retried); a 137 well before the ceiling is an ordinary failure (retried)', () => {
  const before = process.env.ROW_TIMEOUT_S;
  try {
    process.env.ROW_TIMEOUT_S = '1';   // the harness clock advances 1 s per call, so a 137 here is "at the ceiling"
    const a = harness({ 'r7.mjs': [137] });
    const ra = runGroup({ id: 'g1', rows: [row(7, 'r7')], event: 'pull_request', ...a.args });
    assert.deepEqual(a.calls, ['r7.mjs'], 'not retried');
    assert.deepEqual(ra.failed.map(r => [r.status, r.timed_out]), [[124, true]]);
    rmSync(a.dir, { recursive: true, force: true });
    process.env.ROW_TIMEOUT_S = '600';
    const b = harness({ 'r7.mjs': [137, 137] });
    const rb = runGroup({ id: 'g1', rows: [row(7, 'r7')], event: 'pull_request', ...b.args });
    assert.deepEqual(b.calls, ['r7.mjs', 'r7.mjs'], 'an early 137 is an ordinary failure: retried once');
    assert.deepEqual(rb.failed.map(r => [r.status, r.timed_out]), [[137, undefined]]);
    rmSync(b.dir, { recursive: true, force: true });
  } finally { if (before === undefined) delete process.env.ROW_TIMEOUT_S; else process.env.ROW_TIMEOUT_S = before; }
});

test('rowCeilingS: 600 s by default, ROW_TIMEOUT_S overrides it, and a bad value falls back to 600', () => {
  const before = process.env.ROW_TIMEOUT_S;
  try {
    delete process.env.ROW_TIMEOUT_S; assert.equal(rowCeilingS(), 600);
    process.env.ROW_TIMEOUT_S = '45'; assert.equal(rowCeilingS(), 45);
    for (const bad of ['', 'abc', '0', '-5']) { process.env.ROW_TIMEOUT_S = bad; assert.equal(rowCeilingS(), 600, `"${bad}"`); }
  } finally { if (before === undefined) delete process.env.ROW_TIMEOUT_S; else process.env.ROW_TIMEOUT_S = before; }
});

// GT 2026-10-16: a flat 600 s ceiling killed row 55 (end-overlap-check), which passes in 868-1024 s (GS2 868, GR 1024, GQ 999); row 14 runs 503-525 s. A slow row now names its own ceiling as DATA
// (scripts/lib/row-ceilings.json) and that entry wins over the default.
test('rowCeilingS: a row\'s own entry wins over the default; ROW_TIMEOUT_S overrides the DEFAULT only; the real table has rows 14 and 55', () => {
  const table = { default: 600, rows: { '14': 900, '55': 1500 } };
  assert.equal(rowCeilingS(55, table, undefined), 1500);
  assert.equal(rowCeilingS(14, table, undefined), 900);
  assert.equal(rowCeilingS(12, table, undefined), 600, 'a row with no entry gets the default');
  assert.equal(rowCeilingS(12, table, '45'), 45, 'the env overrides the default');
  assert.equal(rowCeilingS(55, table, '45'), 1500, 'but never a row\'s own ceiling');
  assert.equal(rowCeilingS(12, { default: 'x', rows: { '12': -5 } }, undefined), 600, 'bad data falls back to 600, never to "no limit"');
  assert.equal(rowCeilingS(undefined, table, undefined), 600);
  const real = JSON.parse(readFileSync(new URL('../scripts/lib/row-ceilings.json', import.meta.url), 'utf8'));
  assert.equal(real.default, 600);
  assert.deepEqual([real.rows['14'], real.rows['55']], [900, 1500]);
});
test('row-ceilings.json vs row-seconds.json: every measured row time fits under 90% of its own ceiling, and a row longer than the packing target is alone in its job', () => {
  const real = JSON.parse(readFileSync(new URL('../scripts/lib/row-ceilings.json', import.meta.url), 'utf8')), seconds = rowSeconds();
  for (const [index, s] of Object.entries(seconds)) assert.ok(Number(s) <= 0.9 * rowCeilingS(Number(index), real, undefined), `row ${index}: measured ${s} s needs a ceiling of at least ${Math.ceil(Number(s) / 0.9)} s (name it in row-ceilings.json)`);
  for (const index of Object.keys(real.rows)) assert.ok(Number(index) in seconds || Number(real.rows[index]) <= 900, `row ${index} has its own ceiling, so its measured time belongs in row-seconds.json (packing)`);
  const groups = packRows([14, 55, 3, 6, 8].map(i => ({ index: i, name: `r${i}` })));
  assert.deepEqual(groups.find(g => g.rows.some(r => r.index === 55))?.rows.map(r => r.index), [55], 'row 55 (1024 s measured) gets a job to itself, so its 1500 s ceiling cannot eat the job timeout with other rows');
});
test('runGroup: a row over the default but under its OWN ceiling passes; the same duration on a row without one is killed', { skip: spawnSync('sh', ['-c', 'command -v timeout']).status !== 0 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'rowceil-')), lines: string[] = [];
  try {
    const slow = (index: number, name: string) => ({ index, name, argv: JSON.stringify(['sleep', '3']) });
    const { receipts, failed } = runGroup({ id: 'g5', rows: [slow(4, 'own-ceiling'), slow(5, 'default-only')], event: 'pull_request', dir, log: (l: string) => lines.push(l), ceilings: { default: 1, rows: { '4': 8 } } });
    assert.deepEqual(receipts.map(r => [r.index, r.status]), [[4, 0], [5, 124]], lines.join('\n'));
    assert.deepEqual(failed.map(r => [r.index, r.name, r.timed_out]), [[5, 'default-only', true]]);
    assert.ok(lines.some(l => /check 5 \(default-only\) hit the 1s ceiling/.test(l)), 'the kill names the default it hit');
    assert.ok(lines.some(l => /timed out at the 1s ceiling/.test(l)) && !lines.some(l => /hit the 8s ceiling/.test(l)), 'row 4 (own ceiling 8 s) was not killed at 3 s');
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
