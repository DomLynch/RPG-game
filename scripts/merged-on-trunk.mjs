// Deploy guard: every pull request GitHub calls MERGED in the last --days (default 3) must be in the tree being deployed. Deploy #71's night
// (2026-09-21) had #358 merged into its base branch lead/weapon-flip AFTER that branch had already gone to trunk, so "MERGED" was
// true and the fix silently missed a deploy until the Auditer diffed trunk by hand. This makes the target-branch check mechanical:
//   - merged into trunk but not an ancestor of HEAD  → FAIL (this tree is behind trunk)
//   - merged into a side branch that had already landed on trunk, while its patches are not on trunk → FAIL (the #358 case)
//   - merged into a side branch still in flight → noted, not failed (stacked PRs are normal)
//   - patches present on trunk by content (`git cherry`, e.g. re-landed by cherry-pick) → passes; the label `merged-elsewhere` also
//     closes a PR that was re-done under another number.
// gh must be authenticated (deploy.sh already depends on it); any lookup failure is a FAIL, never a silent pass.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const TRUNK = process.env.TRUNK_BRANCH || 'codex/01a09a76/task-1';
const args = process.argv.slice(2);
const root = resolve(args.find(a => !a.startsWith('--')) || '.');
const days = Number((args.find(a => a.startsWith('--days=')) || '--days=3').slice(7)), LIMIT = 500;   // ~100 merges a day on this repo; a deploy runs many times a day
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', timeout: 60_000 }).trim();
const ok = (...a) => { try { git(...a); return true; } catch { return false; } };
const head = git('rev-parse', 'HEAD');
const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const prs = JSON.parse(execFileSync('gh', ['pr', 'list', '--state', 'merged', '--limit', String(LIMIT), '--search', `merged:>=${since}`,
  '--json', 'number,title,baseRefName,mergeCommit,labels'], { cwd: root, encoding: 'utf8', timeout: 60_000 }));
const failures = [];
if (prs.length >= LIMIT) failures.push(`GitHub returned ${LIMIT} merged PRs since ${since}: the window is truncated, narrow --days`);
for (const pr of prs) {
  const merge = pr.mergeCommit?.oid, tag = `#${pr.number} (${pr.baseRefName}) ${pr.title}`;
  if (!merge) { failures.push(`${tag}: GitHub reports no merge commit`); continue; }
  if (!ok('cat-file', '-e', merge) && !ok('fetch', '-q', 'origin', merge)) { /* unreachable merge commit: judged by patches below */ }
  if (ok('merge-base', '--is-ancestor', merge, head)) continue;
  if (pr.baseRefName === TRUNK) { failures.push(`${tag}: merged to ${TRUNK} but not in this tree (${head.slice(0, 7)} is behind trunk)`); continue; }
  if (pr.labels?.some(l => l.name === 'merged-elsewhere')) { console.log(`merged-on-trunk: ${tag}: labelled merged-elsewhere`); continue; }
  if (!ok('fetch', '-q', 'origin', `refs/pull/${pr.number}/head:refs/merged-on-trunk/${pr.number}`)) { failures.push(`${tag}: cannot fetch refs/pull/${pr.number}/head`); continue; }
  const prHead = `refs/merged-on-trunk/${pr.number}`;
  const missing = git('cherry', head, prHead, git('merge-base', head, prHead)).split('\n').filter(l => l.startsWith('+'));
  ok('update-ref', '-d', prHead);   // the temporary ref is only needed for the comparison
  if (!missing.length) { console.log(`merged-on-trunk: ${tag}: landed by content`); continue; }
  // Was the base branch already on trunk when this merged? The merge's first parent is the base as it stood then: on trunk → the
  // PR merged into a branch that had nothing left to carry it (the #358 shape); not on trunk → a stacked PR whose base is in flight.
  if (ok('rev-parse', '--verify', `${merge}^1`) && !ok('merge-base', '--is-ancestor', `${merge}^1`, head)) {
    console.log(`merged-on-trunk: ${tag}: stacked on ${pr.baseRefName}, still in flight (${missing.length} patch(es) not on trunk yet)`); continue;
  }
  failures.push(`${tag}: base ${pr.baseRefName} had already landed on trunk when this merged, and ${missing.length} patch(es) never reached trunk — re-land them or label the PR merged-elsewhere`);
}
if (failures.length) { console.error(`merged-on-trunk FAILED for ${head.slice(0, 7)}:\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log(`merged-on-trunk: ${prs.length} PR(s) merged since ${since}, all in ${head.slice(0, 7)}`);
