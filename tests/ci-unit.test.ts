// The CI unit receipt (scripts/lib/ci-unit.mjs): eight green shards make one receipt; anything short of that is refused, and deploy trust re-checks tree and run.
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReceipt, ciUnitReceiptOk, parseShard, SHARDS, type Shard } from '../scripts/lib/ci-unit.mjs';

const sha = 'a'.repeat(40), tree = 'b'.repeat(40);
const shard = (n: number, over: Partial<Shard> = {}): Shard => ({ shard: n, of: SHARDS, pass: 100 + n, fail: 0, exit: 0, seconds: 60 + n, ...over });
const all = (over: Partial<Shard> = {}) => Array.from({ length: SHARDS }, (_, i) => shard(i + 1, i === 3 ? over : {}));
const build = (shards: Shard[]) => buildReceipt({ shards, sha, tree, runId: 77, node: 'v22.1.0', repo: 'o/r' });

test('parseShard reads node:test summary counts from the last pass/fail lines', () => {
  const log = '# tests 5\n# pass 4\n# fail 1\n# pass 4\n# fail 0\n';
  assert.deepEqual(parseShard({ log, shard: 2, of: 8, exit: 0, seconds: 9 }), { shard: 2, of: 8, pass: 4, fail: 0, exit: 0, seconds: 9 });
  assert.equal(parseShard({ log: 'crashed', shard: 1, of: 8, exit: 1, seconds: 1 }).fail, null);
});

test('eight green shards sum into one receipt in the unit receipt shape', () => {
  const r = build(all());
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.receipt, { kind: 'ci-unit-suite', repo: 'o/r', run: '77', sha, tree, shards: 8, node: 'v22.1.0', pass: 101 + 102 + 103 + 104 + 105 + 106 + 107 + 108, fail: 0, exit: 0, seconds: 68 });
});

test('a missing, repeated, failing, crashed or empty shard refuses the receipt', () => {
  assert.match(String((build(all().slice(0, 7)) as { reason?: string }).reason), /7 of 8/);
  assert.match(String((build([...all().slice(0, 7), shard(1)]) as { reason?: string }).reason), /twice/);
  assert.equal(build(all({ fail: 1 })).ok, false);
  assert.equal(build(all({ exit: 1 })).ok, false);
  assert.equal(build(all({ fail: null, pass: null })).ok, false);
  assert.equal(build(all().map((s) => ({ ...s, pass: 0 }))).ok, false);
  assert.equal(buildReceipt({ shards: all(), sha: 'short', tree, runId: 1, node: 'v', repo: 'o/r' }).ok, false);
});

test('deploy trust: the receipt must name this tree and a green unit-ci.yml run on its own sha', () => {
  const r = build(all());
  assert.ok(r.ok);
  if (!r.ok) return;
  const run = { id: 77, conclusion: 'success', headSha: sha, path: '.github/workflows/unit-ci.yml' };
  assert.equal(ciUnitReceiptOk(r.receipt, { tree, run, repo: 'o/r' }), true);
  assert.equal(ciUnitReceiptOk(r.receipt, { tree: 'c'.repeat(40), run, repo: 'o/r' }), false, 'other tree');
  assert.equal(ciUnitReceiptOk(r.receipt, { tree, run: { ...run, id: 78 }, repo: 'o/r' }), false, 'other run');
  assert.equal(ciUnitReceiptOk(r.receipt, { tree, run: { ...run, conclusion: 'failure' }, repo: 'o/r' }), false);
  assert.equal(ciUnitReceiptOk(r.receipt, { tree, run: { ...run, path: '.github/workflows/quality.yml' }, repo: 'o/r' }), false, 'other workflow');
  assert.equal(ciUnitReceiptOk(r.receipt, { tree, run: { ...run, headSha: 'd'.repeat(40) }, repo: 'o/r' }), false, 'other sha');
  assert.equal(ciUnitReceiptOk(r.receipt, { tree, run, repo: 'x/y' }), false, 'other repo');
  assert.equal(ciUnitReceiptOk({ ...r.receipt, shards: 4 }, { tree, run, repo: 'o/r' }), false);
  assert.equal(ciUnitReceiptOk({ ...r.receipt, fail: 1 }, { tree, run, repo: 'o/r' }), false);
  assert.equal(ciUnitReceiptOk(null, { tree, run }), false);
});
