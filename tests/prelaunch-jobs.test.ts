import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { cancelSuperseded, orphanedT4, recordUnitJob, retrySuperseded, runningOrphanT4 } from '../scripts/lib/prelaunch-jobs.mjs';
import { actualPlacement, summaryLine } from '../scripts/lib/published-summary.mjs';

const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();   // on "trunk" (the tests pass trunk = HEAD)
const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
const id = (n: number) => String(n).padStart(24, 'd');
const wall = (dir: string, sha: string, t4: number[]) => writeFileSync(`${dir}/${sha}.wall`, JSON.stringify({ jobId: t4.map(id).join(','), jobs: t4.map(n => ({ id: id(n), rows: [n] })), sha, rows: t4, launchedAt: Date.now() }) + '\n');
const run = (dir: string, superseded: string, newSha: string, hold = false) => { const got: string[] = []; const r = cancelSuperseded(superseded, newSha, { dir, trunk: 'HEAD', hold, cancel: (i: string) => { got.push(i); return true; } }); return { got, r }; };
const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('two releases in flight: cutting C over A cancels only A\'s T4, CPU and unit jobs and keeps its files as *.cancelled; B (in flight), C (new) and a sha on trunk are untouched', () => {
  const dir = mkdtempSync(`${tmpdir()}/prelaunch-`);
  wall(dir, A, [1, 2]); recordUnitJob(dir, A, id(9)); writeFileSync(`${dir}/${A}.cpu`, `${id(5)};31,53`);
  wall(dir, B, [3, 4]); recordUnitJob(dir, B, id(8)); wall(dir, C, [6]); wall(dir, head, [7]);
  assert.equal(JSON.parse(readFileSync(`${dir}/${A}.wall`, 'utf8')).unitJob, id(9), 'the unit job id is recorded in the candidate\'s .wall');
  assert.deepEqual(run(dir, A, C, true).got, [], 'no cancel while a deploy holds the lock');
  const { got } = run(dir, A, C);
  assert.deepEqual(got.sort(), [id(1), id(2), id(5), id(9)].sort(), 'A\'s T4 jobs, CPU job and unit job, and nothing of B\'s');
  assert.ok(existsSync(`${dir}/${A}.wall.cancelled`) && existsSync(`${dir}/${A}.cpu.cancelled`) && !existsSync(`${dir}/${A}.wall`));
  for (const keep of [B, C, head]) assert.ok(existsSync(`${dir}/${keep}.wall`), `${keep.slice(0, 9)} keeps its files`);
  assert.equal(run(dir, A, C).got.length, 0, 'a second cut does not cancel the same jobs again');
  assert.equal(run(dir, head, C).got.length, 0, 'a sha already on trunk is never cancelled');
  assert.equal(run(dir, '', C).got.length, 0, 'no superseded sha named = nothing cancelled (no scan of the other candidates)');
  assert.equal(run(dir, C, C).got.length, 0, 'a cut never cancels itself');
});

test('orphaned T4 jobs counts the T4 jobs of candidates that never reached trunk (cancelled or not), not the published sha\'s own', () => {
  const dir = mkdtempSync(`${tmpdir()}/prelaunch-`);
  wall(dir, A, [1, 2, 3]); wall(dir, B, [4]); wall(dir, head, [5, 6]);
  assert.equal(orphanedT4(B, { dir, trunk: 'HEAD' }), 3, 'A never shipped: 3 T4 jobs; B is the published one; HEAD is on trunk');
  run(dir, A, B);
  assert.equal(orphanedT4(B, { dir, trunk: 'HEAD' }), 3, 'cancelling does not hide them: they were launched for nothing');
  assert.equal(orphanedT4(B, { dir, trunk: 'HEAD', now: Date.now() + 13 * 3600e3 }), 0, 'older than 12 h is yesterday\'s count');
});

// 2026-10-18: "orphaned T4 jobs: 8" was 4 of a superseded IV cut plus 4 of JG, a candidate still in flight with an open release PR.
test('orphaned T4 jobs skips a candidate whose release PR is open: it is in flight, not an orphan', () => {
  const dir = mkdtempSync(`${tmpdir()}/prelaunch-`);
  wall(dir, A, [1, 2, 3, 4]); wall(dir, B, [5, 6]); wall(dir, C, [7]);
  assert.equal(orphanedT4(C, { dir, trunk: 'HEAD' }), 6, 'with no PR lookup, A and B both count (the unit-test default stays offline)');
  assert.equal(orphanedT4(C, { dir, trunk: 'HEAD', isOpen: (sha: string) => sha === B }), 4, 'B has an open release PR: only A is an orphan');
  assert.equal(orphanedT4(C, { dir, trunk: 'HEAD', isOpen: () => true }), 0);
});

test('a re-cut during a publish leaves a marker and the cancel runs once deploy_hold is gone', () => {
  const dir = mkdtempSync(`${tmpdir()}/prelaunch-`);
  wall(dir, A, [1, 2]); wall(dir, C, [6]);
  const got: string[] = [], cancel = (i: string) => { got.push(i); return true; };
  assert.deepEqual(run(dir, A, C, true).got, [], 'nothing cancelled under the hold');
  assert.equal(readFileSync(`${dir}/${A}.supersede`, 'utf8').trim(), C, 'the skipped cancel is remembered with the new sha');
  assert.deepEqual(retrySuperseded({ dir, trunk: 'HEAD', hold: true, cancel }), [], 'still held: the marker stays');
  assert.ok(existsSync(`${dir}/${A}.supersede`) && got.length === 0);
  const done = retrySuperseded({ dir, trunk: 'HEAD', hold: false, cancel });
  assert.deepEqual(got.sort(), [id(1), id(2)], 'the hold is gone: A\'s T4 jobs are cancelled');
  assert.equal(done.length, 1);
  assert.ok(!existsSync(`${dir}/${A}.supersede`) && existsSync(`${dir}/${A}.wall.cancelled`), 'marker removed, files renamed');
  assert.deepEqual(retrySuperseded({ dir, trunk: 'HEAD', hold: false, cancel }), [], 'nothing left to retry');
  wall(dir, B, [3]); assert.equal(run(dir, head, C, true).got.length, 0); assert.ok(!existsSync(`${dir}/${head}.supersede`), 'a sha on trunk or without files leaves no marker');
});

test('running T4 jobs lists the orphans\' jobs that are still live on Hugging Face (unreadable counts as live) and the Published line carries it', () => {
  const dir = mkdtempSync(`${tmpdir()}/prelaunch-`);
  wall(dir, A, [1, 2, 3]); wall(dir, B, [4]); wall(dir, C, [9]);
  const stage = (jid: string) => ({ [id(1)]: 'COMPLETED', [id(2)]: 'RUNNING', [id(3)]: '', [id(4)]: 'RUNNING' } as Record<string, string>)[jid] ?? 'COMPLETED';
  const r = runningOrphanT4(C, { dir, trunk: 'HEAD', isOpen: (sha: string) => sha === B }, stage);
  assert.deepEqual(r.ids.sort(), [id(2), id(3)], 'B is in flight (open PR) and C is the published sha: neither is listed');
  assert.equal(r.text, `2 (${id(2)},${id(3)})`);
  assert.equal(runningOrphanT4(C, { dir, trunk: 'HEAD' }, () => 'COMPLETED').text, '0', 'nothing live: just 0');
  assert.match(src('scripts/deploy.sh'), /orphans "\$revision" 2>\/dev\/null \|\| echo '\?'\) \(open release PRs excluded\); running T4 jobs: \$\(node scripts\/lib\/prelaunch-jobs\.mjs running "\$revision"/);
  assert.match(src('scripts/pre-launch.sh'), /prelaunch-jobs\.mjs retry-superseded/);
});

test('the wiring: launch.mjs records the HF unit job in the .wall, pre-launch.sh cancels the named superseded sha, deploy.sh passes the orphan count to the Published summary', () => {
  assert.match(src('scripts/vps-shadow/launch.mjs'), /if \(id && !lane && cmd === 'unit'\) recordUnitJob\(/, 'the HF unit launch (not a lane job) records its id');
  assert.match(src('scripts/pre-launch.sh'), /\[\[ "\$superseded" =~ \^\[0-9a-f\]\{40\}\$ \]\] && \{ node scripts\/lib\/prelaunch-jobs\.mjs cancel-superseded "\$superseded" "\$sha"/, 'the third argument names the sha to cancel');
  assert.doesNotMatch(src('scripts/pre-launch.sh'), /cancel-previous/, 'no scan of the other candidates');
  assert.match(src('scripts/deploy.sh'), /published-summary\.mjs [^\n]*"\$\(node scripts\/lib\/prelaunch-jobs\.mjs orphans "\$revision"/, 'the Published summary gets the count of the published revision');
});

test('the Published summary ends with the orphaned T4 count', () => {
  const p = actualPlacement(Array.from({ length: 3 }, (_, i) => ({ index: i + 1, seconds: 1, retried: false })), {});
  assert.match(summaryLine(p, '12 min', 3, '4'), /retried; orphaned T4 jobs: 4$/);
  assert.match(summaryLine(p, '12 min', 3), /orphaned T4 jobs: \?$/, 'unknown when the count is not passed');
});
