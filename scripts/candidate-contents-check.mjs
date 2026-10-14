// A deterministic read of a release candidate's CONTENTS, so the "contents PASS" does not have to wait for a person to repeat it by hand (EN waited 8 h for one; the Auditor's
// own check is "rebuild the merge, compare the tree"). It prints a verdict; it NEVER posts a PASS under anyone's name: whether a verdict may stand in for the contents read is
// the Auditor's and Lead's call. Given a candidate ref and the commit it was cut on (trunk, or the previous candidate's tip):
//   1. the first-parent chain from the candidate down to the base is nothing but `Merge pull request #N (release-X candidate)` two-parent merges (no extra commit, no
//      hand edit riding on the branch), and reaches the base;
//   2. every merged head (second parent) carries a canonical "<reviewer>: PASS @<head>" line from a trusted author (the same passAt rule cut-release enforces);
//   3. re-merging those heads onto the base in the same order, with git merge-tree (no worktree), is conflict-free and yields EXACTLY the candidate's tree (so nothing was
//      hand-resolved, added or dropped).
// Usage: `node scripts/candidate-contents-check.mjs <candidate-ref> [--base <ref>]` (env GH_TOKEN, GITHUB_REPOSITORY=owner/repo). Exit 0 = ok. --offline checks chain + tree only and exits 3 with ok:false: PASS lines unchecked is never a verdict.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { passAt } from './cut-release.mjs';

const SUBJECT = /^Merge pull request #(\d+) \(release-[A-Za-z0-9]+ candidate\)$/;
const mkGit = cwd => (args, input) => spawnSync('git', args, { cwd, input, encoding: 'utf8', timeout: 60_000, killSignal: 'SIGKILL', maxBuffer: 1 << 28 });

/** Walk the first-parent chain from `candidate` down to `base`. Returns the merges oldest first and any problems.
 *  @returns {{ merges: Array<{ pr: number, head: string, commit: string }>, problems: string[], baseSha: string | null, candidateSha: string | null }} */
export function readCandidate(git, candidate, base) {
  const out = (args) => { const r = git(args); return r.status === 0 ? r.stdout.trim() : null; };
  const baseSha = out(['rev-parse', '--verify', `${base}^{commit}`]);
  let cur = out(['rev-parse', '--verify', `${candidate}^{commit}`]);
  const problems = [], merges = [];
  if (!baseSha) return { merges, problems: [`base ${base} does not resolve`], baseSha: null, candidateSha: cur };
  if (!cur) return { merges, problems: [`candidate ${candidate} does not resolve`], baseSha, candidateSha: null };
  const candidateSha = cur;
  for (let guard = 0; cur !== baseSha; guard++) {
    if (guard > 500) { problems.push('chain longer than 500 commits'); break; }
    const line = out(['log', '-1', '--format=%P%n%s', cur]);
    if (line === null) { problems.push(`cannot read ${cur}`); break; }
    const [parents = '', subject = ''] = line.split('\n');
    const ps = parents.split(' ').filter(Boolean);
    const m = SUBJECT.exec(subject);
    if (!m || ps.length !== 2) { problems.push(`${cur.slice(0, 9)} is not a candidate merge (${ps.length} parents, subject "${subject.slice(0, 60)}"): extra work on the branch`); break; }
    merges.unshift({ pr: Number(m[1]), head: ps[1], commit: cur });
    cur = ps[0];
  }
  if (!problems.length && cur !== baseSha) problems.push('the chain never reaches the base');
  return { merges, problems, baseSha, candidateSha };
}

/**
 * The allow-list merge driver (scripts/as-data/merge-allow.mjs, PR #2725) as the cut applies it, for merge-tree: when the tree being merged onto carries the script, the
 * attributes come from THAT tree (`--attr-source`) and the driver is that tree's own script, written to a temp file, so the rebuild gives the same answer from any checkout
 * (a bare `-c` with the repo's relative path only works where the checker happens to be on a commit that has the script and .gitattributes).
 * A tree without the script gets plain merge-tree, as before. Returns { args, dispose }.
 */
export function driverArgs(git, tree) {
  const script = git(['show', `${tree}:scripts/as-data/merge-allow.mjs`]);
  if (script.status !== 0) return { args: [], dispose() {} };
  const dir = mkdtempSync(join(tmpdir(), 'ccc-driver-')), file = join(dir, 'merge-allow.mjs');
  writeFileSync(file, script.stdout);
  return { args: ['--attr-source', tree, '-c', `merge.as-data-allow.driver=node "${file}" %O %A %B %P`], dispose() { rmSync(dir, { recursive: true, force: true }); } };
}

/** Re-merge the heads onto the base with merge-tree + commit-tree (no worktree). Returns { tree }, { conflictAt: pr } or { error }. */
export function rebuildTree(git, baseSha, merges) {
  let acc = baseSha;
  for (const { pr, head } of merges) {
    const driver = driverArgs(git, acc);   // per step, like the cut: the script of the tree being merged onto
    let mt;
    try { mt = git([...driver.args, 'merge-tree', '--write-tree', '--no-messages', acc, head]); } finally { driver.dispose(); }
    if (mt.status === 1) return { conflictAt: pr };   // merge-tree exits 1 for conflicts; anything else is a failure to run, not a verdict
    if (mt.status !== 0) return { error: `git merge-tree failed on #${pr}: ${String(mt.stderr).trim().slice(0, 160)}` };
    const tree = mt.stdout.trim().split('\n')[0];
    // its own identity: a bare clone (the VPS, CI) has none and commit-tree would fail
    const ct = git(['-c', 'user.name=candidate-contents-check', '-c', 'user.email=check@invalid', 'commit-tree', tree, '-p', acc, '-p', head, '-m', `rebuild #${pr}`]);
    if (ct.status !== 0) return { error: `git commit-tree failed on #${pr}: ${String(ct.stderr).trim().slice(0, 160)}` };
    acc = ct.stdout.trim();
  }
  const t = git(['rev-parse', `${acc}^{tree}`]);
  return t.status === 0 ? { tree: t.stdout.trim() } : { error: 'git rev-parse of the rebuilt tree failed' };
}

/** passes(pr, head) -> truthy when a canonical PASS at that head exists. Returns the verdict object; ok only when every check holds.
 *  @returns {{ candidate: string | null, base: string | null, prs: Array<{ pr: number, head: string, pass: boolean }>, problems: string[], treeEqual: boolean | null, ok: boolean }} */
export function verifyCandidate({ git, candidate, base, passes }) {
  const { merges, problems, baseSha, candidateSha } = readCandidate(git, candidate, base);
  const verdict = { candidate: candidateSha, base: baseSha, prs: [], problems: [...problems], treeEqual: null, ok: false };
  for (const { pr, head } of merges) verdict.prs.push({ pr, head, pass: Boolean(passes(pr, head)) });
  for (const p of verdict.prs) if (!p.pass) verdict.problems.push(`#${p.pr} @${p.head.slice(0, 9)} has no canonical PASS at that head`);
  if (!merges.length && !problems.length) verdict.problems.push('the candidate merges nothing');
  if (!problems.length && merges.length) {
    const rebuilt = rebuildTree(git, baseSha, merges);
    if (rebuilt.error) verdict.problems.push(`could not rebuild: ${rebuilt.error}`);
    else if (rebuilt.tree === undefined) verdict.problems.push(`re-merging #${rebuilt.conflictAt} onto the base conflicts: the candidate was hand-resolved or built in another order`);
    else {
      const candTree = git(['rev-parse', `${candidateSha}^{tree}`]).stdout.trim();
      verdict.treeEqual = rebuilt.tree === candTree;
      if (!verdict.treeEqual) verdict.problems.push(`rebuilt tree ${rebuilt.tree.slice(0, 9)} differs from the candidate's ${candTree.slice(0, 9)}: something was added, dropped or hand-resolved`);
    }
  }
  verdict.ok = verdict.problems.length === 0 && verdict.treeEqual === true;
  return verdict;
}

/** All comments of a PR, following the pages (a busy thread has more than 100: a PASS on page 2 must not read as missing). */
export async function commentsOf(repo, pr, token, fetchImpl = fetch) {
  const out = [];
  for (let page = 1; page <= 30; page++) {
    const r = await fetchImpl(`https://api.github.com/repos/${repo}/issues/${pr}/comments?per_page=100&page=${page}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`comments of #${pr}: HTTP ${r.status}`);
    const batch = await r.json();
    out.push(...batch.map(c => ({ body: c.body, authorAssociation: c.author_association })));
    if (batch.length < 100) return out;
  }
  throw new Error(`comments of #${pr}: more than 3000, not read`);
}

// Compare real paths: on macOS $TMPDIR and many checkouts sit behind a symlink (/var -> /private/var), where a literal file:// comparison is false and the script would print nothing.
const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const argv = process.argv.slice(2);
  const flag = f => { const i = argv.indexOf(f); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v ?? null; };
  const offline = argv.includes('--offline'); if (offline) argv.splice(argv.indexOf('--offline'), 1);
  const base = flag('--base') || 'origin/codex/01a09a76/task-1';
  const [candidate] = argv;
  if (!candidate) { console.error('usage: node scripts/candidate-contents-check.mjs <candidate-ref> [--base <ref>] [--offline]'); process.exit(2); }
  const git = mkGit(process.cwd());
  const { merges } = readCandidate(git, candidate, base);
  const table = new Map();
  if (!offline) {
    const { GH_TOKEN, GITHUB_REPOSITORY } = process.env;
    for (const { pr, head } of merges) {
      try { table.set(`${pr}@${head}`, passAt(await commentsOf(GITHUB_REPOSITORY, pr, GH_TOKEN), head)); } catch (e) { console.error(`pass lookup failed: ${e.message}`); table.set(`${pr}@${head}`, false); }
    }
  }
  const verdict = verifyCandidate({ git, candidate, base, passes: (pr, head) => (offline ? true : table.get(`${pr}@${head}`)) });
  // --offline checks the chain and the tree only: PASS lines were NOT looked at, so it can never read as a verdict (ok false, exit 3) (Auditor on #2692).
  if (offline) { verdict.problems.push('PASS lines were not checked (--offline): tree check only, not a verdict'); verdict.ok = false; verdict.offline = true; }
  console.log(JSON.stringify(verdict, null, 2));
  process.exit(verdict.ok ? 0 : offline ? 3 : 1);
}
