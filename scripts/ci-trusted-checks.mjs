// Which release checks did CI already prove for the code being deployed? Prints a comma-separated list of 1-based
// release_commands indices; deploy.sh passes it to release-checks.mjs as RELEASE_CHECKS_SKIP and everything not listed
// runs locally. A check is trusted only when a `release-checks` job for it succeeded AND its own receipt artifact
// (release-check-N-receipt, written by the job) says exit 0 for the exact TREE being deployed. Binding by tree, not by
// commit, is what lets a run on the PR branch (or on GitHub's pull_request merge ref, or on a branch trunk never
// contains) count after the merge: a rebased branch merged onto an unmoved trunk produces a merge commit with the very
// same tree, so the checks' inputs are
// identical. Runs still in progress count job by job: whatever CI has finished is trusted, the rest runs on the Mac. With CI_ROWS_WAIT_S (deploy.sh's
// "release checks" step: 900) it first WAITS, bounded, while a run for this tree still has a CI row queued or running (Lead 2026-10-12, CP: the Mac ran ~32
// rows because deploy.sh looked 13 min into a 20-wide matrix; rows 18/20/23/25 went green on CI minutes later). Default 0: look once, as before. Conservative by construction: any missing run, unfinished or
// failed job, missing receipt, receipt for another tree, gh/git error or RELEASE_CHECKS_TRUST_CI=0 leaves a check off
// the list, which means it runs locally as before.
// One exception to "same tree" (Lead's ruling 2026-09-24, option a'): a receipt for another tree still counts when every
// file that differs between that tree and the deployed one is inert — docs/**, *.md, or tests/ outside tests/fixtures/ —
// i.e. trunk moved under the PR only by files no release row can see. Any other file, or a tree git cannot diff, and the
// row runs locally. The trigger table (release_triggers) is deliberately NOT used: it is a curated subset, and a row it
// does not name would be trusted across any code change.
//   node scripts/ci-trusted-checks.mjs <full-sha>   -> stdout "1,3,4"  (may be empty); one summary line on stderr. Env: CI_ROWS_WAIT_S, CI_ROWS_POLL_S (30).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAC_ROWS } from './lib/row-placement.mjs';

// Linux WebKit is not Mac Safari (row-placement.mjs: the rows whose reason names WebKit): CI never vouches for them, the Mac runs them (Dom 2026-10-12: the Mac keeps WebKit/Safari only).
export const WEBKIT_ROWS = new Set(MAC_ROWS);   // every MAC_ONLY row, not only WebKit: one list with the release-checks plan's skip (row-placement.mjs MAC_ROWS)
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

const waitS = Number(process.env.CI_ROWS_WAIT_S || 0), pollS = Number(process.env.CI_ROWS_POLL_S || 30), deadline = Date.now() + waitS * 1000;
const sleep = s => spawnSync('sleep', [String(s)], { timeout: (s + 5) * 1000 });

/** One look at CI: { list, line, pending } (pending = CI rows still queued or running in a run for this tree), or null when no run exists. */
function look(tree) {
  // Runs are looked up by commit: the revision itself (trunk push) and, for a merge commit, the branch head that was
  // merged (pull_request and workflow_dispatch runs are recorded against that head). The receipt's tree decides.
  const [, ...parents] = git(['rev-list', '--parents', '-n', '1', sha]).split(/\s+/);
  const candidates = [sha, ...parents.slice(1)];
  const runs = [];
  const seen = run => runs.some(r => r.databaseId === run.databaseId);
  for (const commit of candidates) {
    for (const run of ghJson(['run', 'list', '--workflow', 'release-checks.yml', '--commit', commit, '--json', 'databaseId,headSha,url,status', '--limit', '5'])) {
      // Any run status: GitHub reports a run as `queued` while any job still waits, even with jobs already green.
      // The job-level checks below decide; a run with nothing finished simply vouches for nothing.
      if (run.headSha === commit && !seen(run)) runs.push(run);
    }
  }
  // And by TREE (Lead 2026-09-30, run AX): a run on a commit trunk never contains — Deploy's combined-dispatch branch, a
  // re-pushed PR head — has the identical tree when the same changes were merged, so its rows are as good as trunk's own.
  // Recent runs whose head commit resolves to the deployed tree join the list; the receipt check below still binds every
  // row by tree, so this widens where we look, not what counts. A head git cannot see locally is asked of the API; one
  // that resolves nowhere is skipped.
  const trees = new Map(); // head commit -> its tree, or null when unresolvable
  const treeOf = commit => {
    if (!trees.has(commit)) {
      let found = null;
      try { found = git(['rev-parse', '--verify', '-q', `${commit}^{tree}`]); } catch {
        try { found = exec(gh, ['api', `repos/{owner}/{repo}/git/commits/${commit}`, '--jq', '.tree.sha']).trim(); } catch { /* unknown head */ }
      }
      trees.set(commit, /^[0-9a-f]{40}$/.test(found || '') ? found : null);
    }
    return trees.get(commit);
  };
  for (const run of ghJson(['run', 'list', '--workflow', 'release-checks.yml', '--json', 'databaseId,headSha,url,status', '--limit', '30'])) {
    if (seen(run)) continue;
    if (treeOf(run.headSha) === tree) runs.push(run);
  }
  if (!runs.length) return null;

  const trusted = new Map(); // index -> run url
  const reasons = new Map(); // index -> why the latest run looked at could not vouch for it
  let started = false;
  for (const run of runs) {
    const jobs = ghJson(['run', 'view', String(run.databaseId), '--json', 'jobs', '--jq', '[.jobs[] | {name, conclusion}]']);
    if (jobs.some(job => /^check \d+ /.test(job.name || ''))) started = true;
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
      if (WEBKIT_ROWS.has(index)) { reasons.set(index, 'mac-only(the Mac runs it)'); continue; }
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
  // still coming: a CI row not yet trusted whose job has no conclusion, or a run not completed whose matrix has not started
  const pending = [...reasons.entries()].filter(([, why]) => why.startsWith('unfinished')).map(([i]) => i);
  if (!started && runs.some(run => run.status !== 'completed')) pending.push(0);
  // A run whose matrix has not started (or was gated off) lists no "check N" jobs at all: say so instead of "[]".
  const local = reasons.size || list.length ? [...reasons.entries()].sort((a, b) => a[0] - b[0]).map(([i, why]) => `${i}:${why}`) : ['all: no check jobs in the run(s) yet'];
  const why = list.map(i => `${i}:${trusted.get(i).how}`);
  return { list, pending, line: `${[...new Set([...trusted.values()].map(t => t.url))].join(' ') || runs[0].url}: trusting ${list.length} check(s) [${list.join(',')}] for tree ${tree.slice(0, 7)} (${why.join(' ') || 'none'}); running locally: [${local.join(' ')}]` };
}

try {
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('expected a full 40-hex revision');
  if (process.env.RELEASE_CHECKS_TRUST_CI === '0') { say('disabled by RELEASE_CHECKS_TRUST_CI=0'); process.exit(0); }
  const tree = git(['rev-parse', `${sha}^{tree}`]);
  const t0 = Date.now();
  let seen = look(tree);
  while (seen?.pending.length && Date.now() < deadline) {
    say(`waiting for ${seen.pending.filter(Boolean).length ? `CI row(s) [${seen.pending.filter(Boolean).join(',')}]` : 'the row matrix to start'} (${Math.round((Date.now() - t0) / 1000)}s of ${waitS}s)`);
    sleep(Math.max(1, Math.min(pollS, Math.ceil((deadline - Date.now()) / 1000))));
    seen = look(tree);
  }
  if (!seen) { say(`no release-checks run for ${sha.slice(0, 7)}, its merged branch or tree ${tree.slice(0, 7)}; all checks run locally`); process.exit(0); }
  if (seen.pending.length && waitS > 0) say(`stopped waiting after ${waitS}s with CI row(s) [${seen.pending.filter(Boolean).join(',')}] unfinished: they run locally`);
  say(seen.line);
  process.stdout.write(seen.list.join(','));
} catch (error) {
  say(`${error.message}; all checks run locally`);
  process.exit(0);
}
