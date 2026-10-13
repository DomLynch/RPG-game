// `node scripts/cut-release.mjs <name> <PR>@<head sha> [<PR>@<head sha> ...] [--base <release branch>] [--live <sha>]`: the release cut in one command (Dom 2026-10-12, CI runners first).
// From trunk (or --base release-<N>: the next candidate on the last one's tip): a branch release-<name>, one `Merge pull request #N (release-<name> candidate)` merge per PR in the order given (a PR that conflicts is aborted and named, the rest
// still merge), ONE push, a draft PR labelled ci:release-checks (the rows run on GitHub's 40 runners) and auditor:ready, then the pre-launch jobs (T4/CPU rows)
// in the background. No unit job: unit-ci.yml on the candidate is the unit receipt (Lead 2026-10-12; HF unit jobs only with reason=unit-ci-down). Prints one JSON line: { name, sha, pr, merged, skipped, logs }. Never launches the deploy: that stays Deploy's call (deploy-run skill).
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

const REVIEWERS = 'Auditor|Lead|Combat A|Combat B|Deploy B';   // full reviewers: Auditor, Lead (#2326), Combat A, Combat B (boss/finisher PRs) and Deploy B (Strategy 2026-10-12)
const TRUSTED = ['OWNER', 'MEMBER', 'COLLABORATOR'];   // the repo is public: anyone can type "Auditor: PASS @sha", so only these authors count (every lane posts as DomLynch, OWNER)

/** Does a PR comment list ({body, authorAssociation}, as gh returns it) hold a trusted full reviewer's PASS for exactly this head (9-char prefix)? */
export const passAt = (comments, head) => comments.some(c => TRUSTED.includes(c?.authorAssociation) && new RegExp(`^\\*{0,2}(?:${REVIEWERS}): \\*{0,2}PASS(?: @|\\*{0,2} @)${head.slice(0, 9)}`, 'm').test(c.body));   // at a line start: "waiting for Auditor: PASS @…" is not a PASS (Lead on #2336)

/**
 * Merges each spec into the current branch through git(args) -> { status, stdout }. A merge that leaves conflicts is aborted and reported; a merge that fails
 * without conflicts (an unknown sha) is reported too. Returns { merged: [pr], skipped: [{ pr, why }] }.
 */
export function mergeAll(git, name, specs) {
  const merged = [], skipped = [];
  for (const { pr, head } of specs) {
    const r = git(['merge', '--no-ff', '-q', '-m', `Merge pull request #${pr} (release-${name} candidate)`, head]);
    const conflicts = git(['diff', '--name-only', '--diff-filter=U']).stdout.split('\n').filter(Boolean);
    if (conflicts.length) { git(['merge', '--abort']); skipped.push({ pr, why: `conflicts in ${conflicts.join(', ')}` }); }
    else if (r.status !== 0 || git(['merge-base', '--is-ancestor', head, 'HEAD']).status !== 0) skipped.push({ pr, why: `merge failed (${String(r.stderr || r.stdout || '').trim().slice(0, 120)})` });
    else merged.push(pr);
  }
  return { merged, skipped };
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const flag = f => { const i = argv.indexOf(f); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, f === '--no-verify' ? 1 : 2); return v ?? true; };
  const live = flag('--live'), base = flag('--base'), noVerify = flag('--no-verify');   // --base release-CN: N+1 built on N's tip (default trunk)
  const [name, ...rest] = argv;
  if (!/^[A-Za-z0-9]+$/.test(name || '') || !rest.length) { console.error('usage: node scripts/cut-release.mjs <name> <PR>@<head sha>... [--base <release branch>] [--live <sha>] [--no-verify]'); process.exit(2); }
  const specs = rest.map(parseSpec);
  const git = args => run('git', args);
  if (git(['status', '--porcelain']).stdout.trim()) { console.error('cut-release: the worktree is dirty'); process.exit(2); }
  const space = spawnSync('bash', ['scripts/lib/free-space.sh', process.env.FREE_GIB_MIN || '20'], { encoding: 'utf8' });   // a candidate cut on a full disk fails mid-install
  if (space.status !== 0) { console.error(`cut-release: refusing to cut, ${space.stdout}${space.stderr}`.trim()); process.exit(2); }
  console.log(space.stdout.trim());
  git(['fetch', '-q', 'origin']);
  if (!noVerify) for (const { pr, head } of specs) {
    const comments = JSON.parse(run('gh', ['pr', 'view', String(pr), '--json', 'comments', '--jq', '[.comments[] | {body, authorAssociation}]']).stdout || '[]');
    if (!passAt(comments, head)) { console.error(`cut-release: no "<reviewer>: PASS @${head.slice(0, 9)}" (Auditor, Lead, Combat A, Combat B or Deploy B; owner, member or collaborator) on #${pr} (--no-verify to skip)`); process.exit(2); }
  }
  const from = `origin/${base || TRUNK}`, trunk = git(['rev-parse', from]).stdout.trim();
  if (!trunk) { console.error(`cut-release: no ${from}`); process.exit(2); }
  if (git(['switch', '-q', '-c', `release-${name}`, from]).status !== 0) { console.error(`cut-release: cannot create release-${name} (exists?)`); process.exit(2); }
  const { merged, skipped } = mergeAll(git, name, specs);
  if (!merged.length) { console.error(`cut-release: nothing merged: ${JSON.stringify(skipped)}`); process.exit(1); }
  const sha = git(['rev-parse', 'HEAD']).stdout.trim();
  const pushed = pushWithRetry(git, `release-${name}`);
  if (!pushed.ok) { console.error(`cut-release: git push failed after ${pushed.tries} tries: ${pushed.err}`); process.exit(1); }
  const body = `Release candidate ${name} = ${base || 'trunk'} ${trunk.slice(0, 9)} + ${merged.map(pr => `#${pr} @${specs.find(s => s.pr === pr).head}`).join(' + ')}, each with Auditor PASS at head.${skipped.length ? ` Not included: ${skipped.map(s => `#${s.pr} (${s.why})`).join('; ')}.` : ''}\n\nDonor: n/a (release merge)\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
  const created = run('gh', ['pr', 'create', '--draft', '--base', TRUNK, '--head', `release-${name}`, '--title', `release-${name}: ${merged.map(pr => `#${pr}`).join(' + ')}`, '--body', body, ...LABELS.flatMap(l => ['--label', l])]);
  const pr = Number((/\/pull\/(\d+)/.exec(created.stdout) || [])[1]) || null;
  if (created.status !== 0 || !pr) { console.error(`cut-release: gh pr create failed: ${String(created.stderr || created.stdout).trim().slice(0, 200)}`); process.exit(1); }
  const logs = join(process.env.HOME, '.claude/state', `cut-${name}`); mkdirSync(logs, { recursive: true });
  const bg = (file, cmd, args) => spawn(cmd, args, { detached: true, stdio: ['ignore', openSync(join(logs, file), 'a'), openSync(join(logs, file), 'a')] }).unref();
  if (live) bg('prelaunch.log', 'bash', ['scripts/pre-launch.sh', sha, live]);
  console.log(JSON.stringify({ name, sha, pr, merged, skipped, logs }));
}
