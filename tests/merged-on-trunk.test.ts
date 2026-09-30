// scripts/merged-on-trunk.mjs against a throwaway origin and a fake `gh`: a PR merged into a side branch that had already landed on
// trunk fails (the #358 miss), the same PR re-landed by cherry-pick passes by content, a stacked PR whose base is still in flight is
// only noted, and a PR merged to trunk but missing from the deployed tree fails. No network: `gh` is a stub on PATH.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts', 'merged-on-trunk.mjs'), TRUNK = 'trunk';
const g = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
function world() {
  const dir = mkdtempSync(join(tmpdir(), 'merged-on-trunk-')), origin = join(dir, 'origin.git'), work = join(dir, 'work'), bin = join(dir, 'bin');
  execFileSync('git', ['init', '-q', '--bare', origin]); execFileSync('git', ['clone', '-q', origin, work]);
  g(work, 'checkout', '-q', '-b', TRUNK); writeFileSync(join(work, 'a'), '1\n'); g(work, 'add', '.'); g(work, 'commit', '-qm', 'init'); g(work, 'push', '-q', 'origin', TRUNK);
  // side branch with the fix, merged into a lead branch that is then merged to trunk BEFORE or AFTER the fix — the test decides.
  mkdirSync(bin); const prs: object[] = [];
  const commit = (branch: string, file: string, msg: string) => { g(work, 'checkout', '-q', branch); writeFileSync(join(work, file), msg + '\n'); g(work, 'add', '.'); g(work, 'commit', '-qm', msg); return g(work, 'rev-parse', 'HEAD'); };
  const gh = () => { writeFileSync(join(bin, 'gh'), `#!/bin/sh\ncat <<'J'\n${JSON.stringify(prs)}\nJ\n`); chmodSync(join(bin, 'gh'), 0o755); };
  const run = () => spawnSync(process.execPath, [script, work, '--days=1'], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TRUNK_BRANCH: TRUNK } });
  return { work, prs, commit, gh, run };
}
const pushAll = (work: string) => g(work, 'push', '-q', '--all', 'origin');
const prRef = (work: string, n: number, sha: string) => g(work, 'push', '-q', 'origin', `${sha}:refs/pull/${n}/head`);

test('the #358 shape fails: merged into a base that had already landed', () => {
  const w = world();
  g(w.work, 'checkout', '-q', '-b', 'lead'); const leadHead = w.commit('lead', 'b', 'lead work');
  g(w.work, 'checkout', '-q', TRUNK); g(w.work, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #1 from lead', 'lead');   // lead lands on trunk
  const fix = w.commit('lead', 'c', 'reach fix');                                                                                 // then the fix merges into lead
  g(w.work, 'checkout', '-q', 'lead'); const merge = g(w.work, 'rev-parse', 'HEAD');
  pushAll(w.work); prRef(w.work, 2, fix); g(w.work, 'checkout', '-q', TRUNK);
  w.prs.push({ number: 2, title: 'reach fix', baseRefName: 'lead', mergeCommit: { oid: merge }, labels: [] }); w.gh();
  const r = w.run();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /#2 \(lead\) reach fix: base lead had already landed on trunk when this merged, and 1 patch\(es\) never reached trunk/);
  // re-landed by cherry-pick → passes by content; label alone also passes
  g(w.work, 'cherry-pick', fix); assert.equal(w.run().status, 0, 'cherry-picked patch counts as landed');
  g(w.work, 'reset', '-q', '--hard', 'HEAD~1'); (w.prs[0] as { labels: object[] }).labels = [{ name: 'merged-elsewhere' }]; w.gh();
  assert.equal(w.run().status, 0, 'merged-elsewhere label closes it');
  assert.ok(leadHead);
});

test('stacked on a base still in flight is noted, not failed; merged-to-trunk but absent fails', () => {
  const w = world();
  g(w.work, 'checkout', '-q', '-b', 'lead'); w.commit('lead', 'b', 'lead work');
  const fix = w.commit('lead', 'c', 'stacked fix'); pushAll(w.work); prRef(w.work, 3, fix); g(w.work, 'checkout', '-q', TRUNK);
  w.prs.push({ number: 3, title: 'stacked fix', baseRefName: 'lead', mergeCommit: { oid: fix }, labels: [] }); w.gh();
  let r = w.run(); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /#3 \(lead\) stacked fix: stacked on lead, still in flight/);
  // a PR merged to trunk whose merge commit is not in the deployed tree = deploying behind trunk
  w.prs.push({ number: 4, title: 'ahead', baseRefName: TRUNK, mergeCommit: { oid: fix }, labels: [] }); w.gh();
  r = w.run(); assert.equal(r.status, 1); assert.match(r.stderr, /#4 \(trunk\) ahead: merged to trunk but not in this tree/);
});
