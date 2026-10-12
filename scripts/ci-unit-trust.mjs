// node scripts/ci-unit-trust.mjs <sha>: prints "ok" when a green unit-ci.yml run (the CI-sharded `npm run test:all`) vouches for the TREE of <sha>, else nothing (the Mac runs its own suite).
// Candidates: <sha> itself and its merged branch head <sha>^2 (a merge commit with the same tree). The receipt is read from the run's artifact; the run's own record
// (workflow path, head sha, conclusion) comes from the GitHub API, and the tree is computed here from git. Says why on stderr.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ciUnitReceiptOk } from './lib/ci-unit.mjs';

const sha = process.argv[2];
const git = (...a) => { const r = spawnSync('git', a, { encoding: 'utf8', timeout: 10_000 }); return !r.error && r.status === 0 ? r.stdout.trim() : ''; };
const gh = (...a) => { const r = spawnSync('gh', a, { encoding: 'utf8', timeout: 60_000 }); return !r.error && r.status === 0 ? r.stdout : null; };
const tree = git('rev-parse', `${sha}^{tree}`);
const say = (m) => console.error(`ci-unit: ${m}`);
if (!tree) { say('git rev-parse failed; trusting nothing'); process.exit(0); }
const repo = gh('repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner')?.trim();
for (const cand of [sha, git('rev-parse', '-q', '--verify', `${sha}^2`)].filter(Boolean)) {
  if (git('rev-parse', `${cand}^{tree}`) !== tree) continue;
  const list = gh('run', 'list', '--workflow', 'unit-ci.yml', '--commit', cand, '--status', 'success', '--json', 'databaseId,conclusion,headSha,path', '--limit', '1');
  const run = (() => { try { const r = JSON.parse(list || '[]')[0]; return r && { id: r.databaseId, conclusion: r.conclusion, headSha: r.headSha, path: r.path }; } catch { return null; } })();
  if (!run) { say(`no green unit-ci.yml run for ${cand.slice(0, 8)}`); continue; }
  const dir = mkdtempSync(join(tmpdir(), 'ci-unit-'));
  try {
    if (gh('run', 'download', String(run.id), '--name', 'unit-receipt', '--dir', dir) === null) { say(`run ${run.id} has no unit-receipt artifact`); continue; }
    let receipt = null; try { receipt = JSON.parse(readFileSync(join(dir, 'unit-receipt.json'), 'utf8')); } catch { /* unreadable = untrusted */ }
    if (ciUnitReceiptOk(receipt, { tree, run, repo })) { say(`unit suite trusted: ${receipt.pass} pass over ${receipt.shards} shards, ${receipt.seconds}s, run ${run.id} on ${cand.slice(0, 8)} (tree ${tree.slice(0, 8)})`); process.stdout.write('ok'); process.exit(0); }
    say(`receipt of run ${run.id} NOT trusted (other tree, failures, or not this workflow's green run)`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
