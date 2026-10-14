// `node scripts/cut-release.mjs <name> <PR>@<head sha> [<PR>@<head sha> ...] [--base <release branch>] [--live <sha>]`: the release cut in one command (Dom 2026-10-12, CI runners first).
// From trunk (or --base release-<N>: the next candidate on the last one's tip): a branch release-<name>, one `Merge pull request #N (release-<name> candidate)` merge per PR in the order given (a PR that conflicts is aborted and named, the rest
// still merge), ONE push, a draft PR labelled ci:release-checks (the rows run on GitHub's 40 runners) and auditor:ready, then the pre-launch jobs (T4/CPU rows)
// in the background. No unit job: unit-ci.yml on the candidate is the unit receipt (Lead 2026-10-12; HF unit jobs only with reason=unit-ci-down). Prints one JSON line: { name, sha, pr, merged, skipped, driverResolved, logs }. Never launches the deploy: that stays Deploy's call (deploy-run skill).
// Run it in the release worktree, which must be clean. The Auditor's PASS at each head is checked from the PR thread unless --no-verify.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';

export const TRUNK = process.env.TRUNK_BRANCH || 'codex/01a09a76/task-1';
export const LABELS = ['ci:release-checks', 'auditor:ready'];

/** "2291@23b4f51e0" -> { pr: 2291, head: "23b4f51e0" }; anything else throws. */
export function parseSpec(spec) {
  const m = /^#?(\d+)@([0-9a-f]{7,40})$/.exec(spec || '');
  if (!m) throw new Error(`bad PR spec "${spec}": expected <PR number>@<head sha>`);
  return { pr: Number(m[1]), head: m[2] };
}

const REVIEWERS = 'Auditor|Lead|Combat A|Combat B|Deploy B|Hooks';   // full reviewers: Auditor, Lead (#2326), Combat A, Combat B (boss/finisher PRs), Deploy B (Strategy 2026-10-12) and Hooks (CI/workflow/scripts PRs, Lead 2026-10-13)
const TRUSTED = ['OWNER', 'MEMBER', 'COLLABORATOR'];   // the repo is public: anyone can type "Auditor: PASS @sha", so only these authors count (every lane posts as DomLynch, OWNER)

/** Does a PR comment list ({body, authorAssociation}, as gh returns it) hold a trusted full reviewer's PASS for exactly this head (9-char prefix)? */
export const passAt = (comments, head) => comments.some(c => TRUSTED.includes(c?.authorAssociation) && new RegExp(`^\\*{0,2}(?:${REVIEWERS}): \\*{0,2}PASS(?: @|\\*{0,2} @)${head.slice(0, 9)}`, 'm').test(c.body));   // at a line start: "waiting for Auditor: PASS @…" is not a PASS (Lead on #2336)

/**
 * Merges each spec into the current branch through git(args) -> { status, stdout }. A merge that leaves conflicts is aborted and reported; a merge that fails
 * without conflicts (an unknown sha) is reported too. Returns { merged: [pr], skipped: [{ pr, why }], driverResolved: { pr: [files] } }.
 * The allow lists merge through scripts/as-data/merge-allow.mjs (PR #2725) when the branch carries it: passed per call with -c, never written to the shared git config, and
 * only for the paths .gitattributes names. A true clash makes the driver exit 1, which git reports as a conflict, so that PR is aborted and skipped exactly as before.
 * driverResolved names, per merged PR, the allow files both sides changed (the ones the driver, not a line merge, resolved), for the Auditor's contents-check.
 */
export const ALLOW_DRIVER = 'merge.as-data-allow.driver=node scripts/as-data/merge-allow.mjs %O %A %B %P';
export function mergeAll(git, name, specs) {
  const merged = [], skipped = [], driverResolved = {};
  for (const { pr, head } of specs) {
    const driver = git(['cat-file', '-e', 'HEAD:scripts/as-data/merge-allow.mjs']).status === 0 ? ['-c', ALLOW_DRIVER] : [];   // an older base has no script: git's own line merge, as before
    const r = git([...driver, 'merge', '--no-ff', '-q', '-m', `Merge pull request #${pr} (release-${name} candidate)`, head]);
    const conflicts = git(['diff', '--name-only', '--diff-filter=U']).stdout.split('\n').filter(Boolean);
    if (conflicts.length) { git(['merge', '--abort']); skipped.push({ pr, why: `conflicts in ${conflicts.join(', ')}` }); }
    else if (r.status !== 0 || git(['merge-base', '--is-ancestor', head, 'HEAD']).status !== 0) skipped.push({ pr, why: `merge failed (${String(r.stderr || r.stdout || '').trim().slice(0, 120)})` });
    else {
      merged.push(pr);
      const base = git(['merge-base', 'HEAD^1', 'HEAD^2']).stdout.trim();   // empty when the PR was already in the branch (no merge commit was made)
      const changed = side => new Set(git(['diff', '--name-only', base, side, '--', 'scripts/as-data/allow']).stdout.split('\n').filter(Boolean));
      const [a, b] = [changed('HEAD^1'), changed('HEAD^2')], both = [...a].filter(f => b.has(f));
      if (base && both.length) driverResolved[pr] = both;
    }
  }
  return { merged, skipped, driverResolved };
}

/** git push with 3 tries and backoff (2 s, 4 s): a transient GitHub "remote rejected" stopped CO's cut. sleep is injectable for the test.
 * @param {(args: string[]) => { status: number | null, stderr?: unknown, stdout?: unknown }} git @param {string} branch @param {{ tries?: number, extra?: string[], sleep?: (s: number) => unknown }} [opts] */
export function pushWithRetry(git, branch, { tries = 3, extra = [], sleep = s => spawnSync('sleep', [String(s)], { timeout: (s + 5) * 1000 }) } = {}) {
  let err = '';
  for (let i = 1; i <= tries; i++) {
    const r = git(['push', '-q', ...extra, 'origin', branch]);
    if (r.status === 0) return { ok: true, tries: i };
    err = String(r.stderr || r.stdout || '').trim().slice(0, 200);
    if (i < tries) sleep(2 ** i);
  }
  return { ok: false, tries, err };
}

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 120_000, killSignal: 'SIGKILL', ...opts });

/** gh can hang for many minutes on this Mac (2026-10-14: `gh pr create` sat 17 min after the push, its own spawnSync timeout never fired). Run it in its own process
 *  group and SIGKILL the whole group at `ms`; resolves { status, stdout, stderr, timedOut } and never throws. */
export const runBounded = (cmd, args, ms = 60_000) => new Promise(resolve => {
  let out = '', err = '', done = false, timer;
  const child = spawn(cmd, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const finish = r => { if (!done) { done = true; clearTimeout(timer); resolve({ stdout: out, stderr: err, ...r }); } };
  timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } finish({ status: null, timedOut: true }); }, ms);
  child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; });
  child.on('error', e => finish({ status: null, stderr: String(e) })); child.on('close', code => finish({ status: code }));
});

/** The REST fallback when gh hangs or fails: reuse an open PR for the head (gh may have made it before it hung), else open a draft; then label it. Returns the PR number or null. */
export async function openPrViaRest({ repo, token, head, base, title, body, labels, fetchImpl = fetch }) {
  const api = (path, init = {}) => fetchImpl(`https://api.github.com/repos/${repo}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' }, signal: AbortSignal.timeout(30_000) });
  const found = await (await api(`/pulls?head=${repo.split('/')[0]}:${head}&state=open`)).json();
  let number = Array.isArray(found) ? found[0]?.number : null;
  if (!number) number = (await (await api('/pulls', { method: 'POST', body: JSON.stringify({ title, head, base, body, draft: true }) })).json()).number;
  if (number) await api(`/issues/${number}/labels`, { method: 'POST', body: JSON.stringify({ labels }) });
  return number || null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const flag = f => { const i = argv.indexOf(f); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, f === '--no-verify' ? 1 : 2); return v ?? true; };
  const live = flag('--live'), base = flag('--base'), noVerify = flag('--no-verify');   // --base release-CN: N+1 built on N's tip (default trunk)
  const [name, ...rest] = argv;
  if (!/^[A-Za-z0-9]+$/.test(name || '') || !rest.length) { console.error('usage: node scripts/cut-release.mjs <name> <PR>@<head sha>... [--base <release branch>] [--live <sha>] [--no-verify]'); process.exit(2); }
  const specs = rest.map(parseSpec);
  const git = args => run('git', args);
  if (git(['status', '--porcelain']).stdout.trim()) { console.error('cut-release: the worktree is dirty'); process.exit(2); }
  const space = run('bash', ['scripts/lib/free-space.sh', process.env.FREE_GIB_MIN || '20'], { timeout: 60_000 });   // a candidate cut on a full disk fails mid-install
  if (space.status !== 0) { console.error(`cut-release: refusing to cut, ${space.stdout || ''}${space.stderr || ''}${space.error ? ` (${space.error.message})` : ''}${space.signal ? ` (killed by ${space.signal})` : ''}`.trim()); process.exit(2); }   // a timeout or kill is a refusal too (status null)
  console.log(space.stdout.trim());
  git(['fetch', '-q', 'origin']);
  if (!noVerify) for (const { pr, head } of specs) {
    const comments = JSON.parse(run('gh', ['pr', 'view', String(pr), '--json', 'comments', '--jq', '[.comments[] | {body, authorAssociation}]']).stdout || '[]');
    if (!passAt(comments, head)) { console.error(`cut-release: no "<reviewer>: PASS @${head.slice(0, 9)}" (Auditor, Lead, Combat A, Combat B, Deploy B or Hooks; owner, member or collaborator) on #${pr} (--no-verify to skip)`); process.exit(2); }
  }
  const from = `origin/${base || TRUNK}`, trunk = git(['rev-parse', from]).stdout.trim();
  if (!trunk) { console.error(`cut-release: no ${from}`); process.exit(2); }
  if (git(['switch', '-q', '-c', `release-${name}`, from]).status !== 0) { console.error(`cut-release: cannot create release-${name} (exists?)`); process.exit(2); }
  const { merged, skipped, driverResolved } = mergeAll(git, name, specs);
  if (!merged.length) { console.error(`cut-release: nothing merged: ${JSON.stringify(skipped)}`); process.exit(1); }
  const sha = git(['rev-parse', 'HEAD']).stdout.trim();
  const pushed = pushWithRetry(git, `release-${name}`);
  if (!pushed.ok) { console.error(`cut-release: git push failed after ${pushed.tries} tries: ${pushed.err}`); process.exit(1); }
  const body = `Release candidate ${name} = ${base || 'trunk'} ${trunk.slice(0, 9)} + ${merged.map(pr => `#${pr} @${specs.find(s => s.pr === pr).head}`).join(' + ')}, each with Auditor PASS at head.${skipped.length ? ` Not included: ${skipped.map(s => `#${s.pr} (${s.why})`).join('; ')}.` : ''}\n\nDonor: n/a (release merge)\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
  const created = await runBounded('gh', ['pr', 'create', '--draft', '--base', TRUNK, '--head', `release-${name}`, '--title', `release-${name}: ${merged.map(pr => `#${pr}`).join(' + ')}`, '--body', body, ...LABELS.flatMap(l => ['--label', l])], 60_000);   // a hung gh must not hold the cut: 60 s, then the REST API
  let pr = Number((/\/pull\/(\d+)/.exec(created.stdout) || [])[1]) || null;
  if (!pr) {
    console.error(`cut-release: gh pr create ${created.timedOut ? 'timed out after 60 s' : 'failed'} (${String(created.stderr).trim().slice(0, 120)}); opening the PR through the REST API`);
    const slug = /github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(run('git', ['remote', 'get-url', 'origin']).stdout.trim())?.[1];
    const token = process.env.GH_TOKEN || (await runBounded('gh', ['auth', 'token'], 10_000)).stdout.trim();
    const title = `release-${name}: ${merged.map(pr => `#${pr}`).join(' + ')}`;
    pr = slug && token ? await openPrViaRest({ repo: slug, token, head: `release-${name}`, base: TRUNK, title, body, labels: LABELS }).catch(() => null) : null;
  }
  if (!pr) { console.error('cut-release: could not open the PR (gh and the REST API both failed); the branch is pushed, open the PR by hand'); process.exit(1); }
  const logs = join(process.env.HOME, '.claude/state', `cut-${name}`); mkdirSync(logs, { recursive: true });
  const bg = (file, cmd, args) => spawn(cmd, args, { detached: true, stdio: ['ignore', openSync(join(logs, file), 'a'), openSync(join(logs, file), 'a')] }).unref();
  if (live) bg('prelaunch.log', 'bash', ['scripts/pre-launch.sh', sha, live]);
  console.log(JSON.stringify({ name, sha, pr, merged, skipped, driverResolved, logs }));
}
