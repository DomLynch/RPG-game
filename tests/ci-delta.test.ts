// scripts/ci-delta.mjs: a feature PR's shards are skipped only when its OWN delta already ran green. Real git fixture for the patch id; the status lookup is pure.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const { CONTEXT, DESCRIPTION, deltaPatchId, pullCommitsWithStatuses, unchangedSince } = await import('../scripts/ci-delta.mjs');

const git = (cwd: string, ...args: string[]) => { const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
const put = (cwd: string, file: string, text: string) => writeFileSync(join(cwd, file), text);

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ci-delta-'));
  git(dir, 'init', '-q', '-b', 'trunk');
  put(dir, 'a.txt', Array.from({ length: 30 }, (_, i) => `a${i}`).join('\n') + '\n');
  put(dir, 'b.txt', 'b\n');
  git(dir, 'add', '.'); git(dir, 'commit', '-qm', 'base');
  git(dir, 'switch', '-qc', 'feature');
  put(dir, 'b.txt', 'b\nfeature line\n');
  git(dir, 'commit', '-qam', 'feature');
  return dir;
}

test('a clean trunk merge-up leaves the delta id unchanged; a real change to the delta moves it', () => {
  const dir = fixture();
  try {
    const before = deltaPatchId(dir, 'trunk');
    assert.match(before || '', /^[0-9a-f]{40}$/);
    git(dir, 'switch', '-q', 'trunk'); put(dir, 'a.txt', 'TRUNK\n' + readFileSync(join(dir, 'a.txt'), 'utf8')); git(dir, 'commit', '-qam', 'trunk moves');
    git(dir, 'switch', '-q', 'feature'); git(dir, 'merge', '-q', '--no-edit', 'trunk');
    assert.equal(deltaPatchId(dir, 'trunk'), before, 'merge-up: same delta, same id');
    put(dir, 'b.txt', 'b\nfeature line\nsecond change\n'); git(dir, 'commit', '-qam', 'more');
    assert.notEqual(deltaPatchId(dir, 'trunk'), before, 'a real change to the PR is a different delta');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('no merge-base or an empty delta has no id (the shards then run)', () => {
  const dir = fixture();
  try {
    assert.equal(deltaPatchId(dir, 'no-such-ref'), null);
    git(dir, 'switch', '-q', 'trunk');
    assert.equal(deltaPatchId(dir, 'trunk'), null, 'nothing differs from trunk');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('unchangedSince needs a SUCCESS unit-ci/delta status with exactly this id; anything else reads as changed', () => {
  const ok = { context: CONTEXT, state: 'success', description: DESCRIPTION('abc') };
  assert.equal(unchangedSince('abc', [{ sha: 'h1', statuses: [{ ...ok, description: DESCRIPTION('zzz') }] }, { sha: 'h2', statuses: [ok] }]), 'h2');
  assert.equal(unchangedSince('abc', [{ sha: 'h1', statuses: [{ ...ok, state: 'pending' }, { ...ok, state: 'failure' }, { ...ok, context: 'other' }] }]), null);
  assert.equal(unchangedSince(null, [{ sha: 'h1', statuses: [ok] }]), null);
  assert.equal(unchangedSince('abc', []), null);
});

test('pullCommitsWithStatuses skips the head, caps the history, and throws on an API error', async () => {
  const shas = Array.from({ length: 50 }, (_, i) => `c${i}`);   // oldest first, as the API returns them
  const get = async (path: string) => path.includes('/pulls/') ? shas.map(sha => ({ sha })) : [{ context: CONTEXT, state: 'success', description: path }];
  const got = await pullCommitsWithStatuses('o/r', 7, 't', 'c49', get as never);
  assert.equal(got.length, 40);
  assert.equal(got[0].sha, 'c48', 'newest first, the head itself excluded');
  await assert.rejects(pullCommitsWithStatuses('o/r', 7, 't', 'c49', (async () => { throw new Error('HTTP 500'); }) as never));
});

test('unit-ci.yml wiring: delta never runs for a release candidate, every full-run job skips on an unchanged delta, the receipt still reports, only a computed id is recorded', () => {
  const wf = readFileSync(new URL('../.github/workflows/unit-ci.yml', import.meta.url), 'utf8');
  const job = (name: string) => { const m = new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z-]+:\\n|$)`).exec(wf); assert.ok(m, `job ${name} exists`); return m[1]; };
  assert.match(job('delta'), /if: .*!startsWith\(github\.head_ref, 'release-'\)/, 'a candidate always runs in full');
  assert.match(job('delta'), /fetch-depth: 0/, 'the merge-base needs history');
  for (const name of ['static', 'shard', 'origins-db']) {
    const j = job(name);
    assert.match(j, /needs: (delta|\[delta, static\])/, `${name} waits for delta`);
    assert.match(j, /!cancelled\(\) && needs\.delta\.outputs\.unchanged != 'true'/, `${name} is skipped only on an unchanged delta, and runs if delta itself failed`);
  }
  const receipt = job('receipt');
  assert.match(receipt, /needs\.delta\.outputs\.unchanged == 'true' \|\| !\(needs\.static\.result == 'skipped' && needs\.shard\.result == 'skipped'\)/, 'the receipt job reports green on an unchanged delta');
  assert.match(receipt, /statuses: write/);
  assert.match(receipt, /name: Record the green delta\n\s+if: needs\.delta\.outputs\.unchanged != 'true' && needs\.delta\.outputs\.patch_id != ''/, 'only a changed delta with a computed id is recorded');
  assert.ok(receipt.indexOf('Record the green delta') > receipt.indexOf('actions/upload-artifact'), 'recorded last, after the shards and the artifact succeeded');
  assert.equal((receipt.match(/if: needs\.delta\.outputs\.unchanged != 'true'/g) || []).length >= 6, true, 'every artifact step is skipped when nothing ran');
});
