// Which release checks did CI already prove for the code being deployed? Prints a comma-separated list of 1-based
// release_commands indices; deploy.sh passes it to release-checks.mjs as RELEASE_CHECKS_SKIP and everything not listed
// runs locally. A check is trusted only when a `release-checks` job for it succeeded AND its own receipt artifact
// (release-check-N-receipt, written by the job) says exit 0 for the exact TREE being deployed. Binding by tree, not by
// commit, is what lets a run on the PR branch (or on GitHub's pull_request merge ref) count after the merge: a rebased
// branch merged onto an unmoved trunk produces a merge commit with the very same tree, so the checks' inputs are
// identical. Runs still in progress count job by job, so deploy.sh never has to wait for the slow runner jobs: whatever
// CI has finished is trusted, the rest runs on the Mac. Conservative by construction: any missing run, unfinished or
// failed job, missing receipt, receipt for another tree, gh/git error or RELEASE_CHECKS_TRUST_CI=0 leaves a check off
// the list, which means it runs locally as before.
// One exception to "same tree" (Lead's ruling 2026-09-24, option a'): a receipt for another tree still counts when every
// file that differs between that tree and the deployed one is inert — docs/**, *.md, or tests/ outside tests/fixtures/ —
// i.e. trunk moved under the PR only by files no release row can see. Any other file, or a tree git cannot diff, and the
// row runs locally. The trigger table (release_triggers) is deliberately NOT used: it is a curated subset, and a row it
// does not name would be trusted across any code change.
//   node scripts/ci-trusted-checks.mjs <full-sha>   -> stdout "1,3,4"  (may be empty); one summary line on stderr
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sha = process.argv[2];
const gh = process.env.CI_TRUST_GH || 'gh';
const say = message => process.stderr.write(`ci-trusted-checks: ${message}\n`);
const exec = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.slice(0, 3).join(' ')} failed: ${(result.stderr || result.error?.message || '').trim().slice(0, 200)}`);
  return result.stdout;
};
const ghJson = args => JSON.parse(exec(gh, args));
const git = args => exec('git', args).trim();
const inert = file => file.startsWith('docs/') || file.endsWith('.md') || (file.startsWith('tests/') && !file.startsWith('tests/fixtures/'));
const deltas = new Map(); // receipt tree -> the files it differs from the deployed tree by that a row could see ([] = inert only), or null
const visibleDelta = (from, to) => {
  if (!deltas.has(from)) {
    let files = null;
    try { files = git(['diff', '--name-only', from, to]).split('\n').filter(Boolean).filter(file => !inert(file)); } catch { /* unknown tree */ }
    deltas.set(from, files);
  }
  return deltas.get(from);
};

try {
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('expected a full 40-hex revision');
  if (process.env.RELEASE_CHECKS_TRUST_CI === '0') { say('disabled by RELEASE_CHECKS_TRUST_CI=0'); process.exit(0); }
  const tree = git(['rev-parse', `${sha}^{tree}`]);
  // Runs are looked up by commit: the revision itself (trunk push) and, for a merge commit, the branch head that was
  // merged (pull_request and workflow_dispatch runs are recorded against that head). The receipt's tree decides.
  const [, ...parents] = git(['rev-list', '--parents', '-n', '1', sha]).split(/\s+/);
  const candidates = [sha, ...parents.slice(1)];
  const runs = [];
  for (const commit of candidates) {
    for (const run of ghJson(['run', 'list', '--workflow', 'release-checks.yml', '--commit', commit, '--json', 'databaseId,headSha,url,status', '--limit', '5'])) {
      // Any run status: GitHub reports a run as `queued` while any job still waits, even with jobs already green.
      // The job-level checks below decide; a run with nothing finished simply vouches for nothing.
      if (run.headSha === commit && !runs.some(r => r.databaseId === run.databaseId)) runs.push(run);
    }
  }
  if (!runs.length) { say(`no release-checks run for ${sha.slice(0, 7)} or its merged branch; all checks run locally`); process.exit(0); }

  const trusted = new Map(); // index -> run url
  const reasons = new Map(); // index -> why the latest run looked at could not vouch for it
  for (const run of runs) {
    const jobs = ghJson(['run', 'view', String(run.databaseId), '--json', 'jobs', '--jq', '[.jobs[] | {name, conclusion}]']);
    const dir = mkdtempSync(join(tmpdir(), 'ci-trusted-checks-'));
    // Only the tiny receipt artifacts, never the screenshots/videos the full check artifacts carry.
    const download = spawnSync(gh, ['run', 'download', String(run.databaseId), '--pattern', 'release-check-*-receipt', '--dir', dir], { encoding: 'utf8' });
    const receipts = new Map();
    if (!download.error && download.status === 0 && existsSync(dir)) {
      for (const entry of readdirSync(dir)) {
        const file = join(dir, entry, `${entry.replace(/-receipt$/, '')}.json`);
        if (!existsSync(file)) continue;
        try { const receipt = JSON.parse(readFileSync(file, 'utf8')); receipts.set(Number(receipt.index), receipt); } catch { /* unreadable receipt: not trusted */ }
      }
    }
    for (const job of jobs) {
      const m = /^check (\d+) /.exec(job.name || '');
      if (!m) continue;
      const index = Number(m[1]);
      if (trusted.has(index)) continue;
      const receipt = receipts.get(index);
      const why = [];
      let how = 'same-tree';
      if (job.conclusion !== 'success') why.push(job.conclusion || 'unfinished');
      if (!receipt) why.push('no-receipt');
      else {
        if (receipt.status !== 0) why.push(`receipt-status=${receipt.status}`);
        if (receipt.tree !== tree) {
          const seen = visibleDelta(receipt.tree, tree);
          if (seen === null) why.push('other-tree(unknown)');
          else if (seen.length) why.push(`other-tree(${seen.length} code file(s), e.g. ${seen[0]})`);
          else how = 'docs/tests-only delta';
        }
      }
      if (why.length) reasons.set(index, why.join('/'));
      else { trusted.set(index, { url: run.url, how }); reasons.delete(index); }
    }
  }
  const list = [...trusted.keys()].sort((a, b) => a - b);
  // A run whose matrix has not started (or was gated off) lists no "check N" jobs at all: say so instead of "[]".
  const local = reasons.size || list.length ? [...reasons.entries()].sort((a, b) => a[0] - b[0]).map(([i, why]) => `${i}:${why}`) : ['all: no check jobs in the run(s) yet'];
  const why = list.map(i => `${i}:${trusted.get(i).how}`);
  say(`${[...new Set([...trusted.values()].map(t => t.url))].join(' ') || runs[0].url}: trusting ${list.length} check(s) [${list.join(',')}] for tree ${tree.slice(0, 7)} (${why.join(' ') || 'none'}); running locally: [${local.join(' ')}]`);
  process.stdout.write(list.join(','));
} catch (error) {
  say(`${error.message}; all checks run locally`);
  process.exit(0);
}
