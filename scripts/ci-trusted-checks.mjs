// Which release checks did CI already prove for this exact revision? Prints a comma-separated list of 1-based
// release_commands indices whose `release-checks` job succeeded on a completed run for `sha`, each with its receipt
// artifact present. deploy.sh passes the list to release-checks.mjs as RELEASE_CHECKS_SKIP; everything not listed runs
// locally. Conservative by construction: any missing run, unfinished run, failed job, missing artifact, gh error or
// RELEASE_CHECKS_TRUST_CI=0 leaves a check off the list, which means it runs on the Mac as before.
//   node scripts/ci-trusted-checks.mjs <full-sha>   -> stdout "1,3,4"  (may be empty); one summary line on stderr
import { spawnSync } from 'node:child_process';

const sha = process.argv[2];
const gh = process.env.CI_TRUST_GH || 'gh';
const say = message => process.stderr.write(`ci-trusted-checks: ${message}\n`);
const run = args => {
  const result = spawnSync(gh, args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`${gh} ${args.slice(0, 3).join(' ')} failed: ${(result.stderr || result.error?.message || '').trim().slice(0, 200)}`);
  return JSON.parse(result.stdout);
};

try {
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('expected a full 40-hex revision');
  if (process.env.RELEASE_CHECKS_TRUST_CI === '0') { say('disabled by RELEASE_CHECKS_TRUST_CI=0'); process.exit(0); }
  const runs = run(['run', 'list', '--workflow', 'release-checks.yml', '--commit', sha, '--status', 'completed', '--json', 'databaseId,headSha,url', '--limit', '5']);
  const match = runs.find(r => r.headSha === sha);
  if (!match) { say(`no completed release-checks run for ${sha.slice(0, 7)}; all checks run locally`); process.exit(0); }
  const jobs = run(['run', 'view', String(match.databaseId), '--json', 'jobs', '--jq', '[.jobs[] | {name, conclusion}]']);
  const artifacts = new Set(run(['api', `repos/{owner}/{repo}/actions/runs/${match.databaseId}/artifacts?per_page=100`, '--jq', '[.artifacts[].name]']));
  const trusted = [];
  const skipped = [];
  for (const job of jobs) {
    const m = /^check (\d+) /.exec(job.name || '');
    if (!m) continue;
    const index = Number(m[1]);
    if (job.conclusion === 'success' && artifacts.has(`release-check-${index}`)) trusted.push(index);
    else skipped.push(`${index}:${job.conclusion}${artifacts.has(`release-check-${index}`) ? '' : '/no-artifact'}`);
  }
  trusted.sort((a, b) => a - b);
  say(`${match.url}: trusting ${trusted.length} check(s) [${trusted.join(',')}]; running locally: [${skipped.join(' ')}]`);
  process.stdout.write(trusted.join(','));
} catch (error) {
  say(`${error.message}; all checks run locally`);
  process.exit(0);
}
