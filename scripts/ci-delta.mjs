// A feature PR's full shards run only when the PR's OWN delta changed since its last green full run (Strategy 2026-10-14, runner queue: merge-up pushes were 20+
// minutes of shards each). The delta id is `git patch-id --verbatim` of `git diff $(git merge-base trunk HEAD) HEAD`: a clean merge of trunk moves the merge-base and
// leaves the id unchanged. --verbatim, not --stable: --stable ignores whitespace, so a whitespace-only change inside a string or YAML (a real behaviour change) read as unchanged (Auditor on #2661). A full run that went green writes the commit status `unit-ci/delta` = "patch-id <id>" on its head; this script looks for that status
// on the PR's earlier commits. Anything unknown (no id, an API error, no match) reads as CHANGED: the shards run. Release candidates and trunk pushes never skip.
// Usage in a workflow job (env GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, TRUNK_REF=origin/<trunk>): `node scripts/ci-delta.mjs` appends
// `unchanged=true|false`, `patch_id=<id>` and `since=<sha>` to $GITHUB_OUTPUT.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

export const CONTEXT = 'unit-ci/delta';
export const DESCRIPTION = id => `patch-id ${id}`;
const MAX_COMMITS = 40;

/** The patch id of the PR's own delta, or null when it cannot be computed (no merge-base, git failed, empty diff). */
export function deltaPatchId(cwd, trunkRef) {
  const git = (args, input) => spawnSync('git', args, { cwd, input, encoding: 'utf8', maxBuffer: 1 << 29, timeout: 120_000 });
  const base = git(['merge-base', trunkRef, 'HEAD']);
  if (base.status !== 0 || !base.stdout.trim()) return null;
  const diff = git(['diff', base.stdout.trim(), 'HEAD']);
  if (diff.status !== 0 || !diff.stdout.trim()) return null;
  const pid = git(['patch-id', '--verbatim'], diff.stdout);
  return pid.status === 0 ? pid.stdout.trim().split(/\s+/)[0] || null : null;
}

/** The sha of the first earlier commit whose green `unit-ci/delta` status carries this id; null otherwise. commits: [{ sha, statuses: [{ context, state, description }] }], newest first. */
export function unchangedSince(id, commits) {
  if (!id) return null;
  for (const c of commits || []) if ((c.statuses || []).some(s => s.context === CONTEXT && s.state === 'success' && s.description === DESCRIPTION(id))) return c.sha;
  return null;
}

async function api(path, token) {
  const r = await fetch(`https://api.github.com${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

/** The PR's commits (newest first, capped) with their statuses. Throws on any API error: the caller reads that as "changed". */
export async function pullCommitsWithStatuses(repo, pr, token, head, get = api) {
  const commits = (await get(`/repos/${repo}/pulls/${pr}/commits?per_page=100`, token)).map(c => c.sha).reverse().filter(s => s !== head).slice(0, MAX_COMMITS);
  const out = [];
  for (const sha of commits) out.push({ sha, statuses: await get(`/repos/${repo}/commits/${sha}/statuses?per_page=100`, token) });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, TRUNK_REF, HEAD_SHA, GITHUB_OUTPUT } = process.env;
  const emit = (unchanged, id, since) => {
    const lines = `unchanged=${unchanged}\npatch_id=${id || ''}\nsince=${since || ''}\n`;
    if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, lines); else process.stdout.write(lines);
  };
  const id = deltaPatchId(process.cwd(), TRUNK_REF || 'origin/codex/01a09a76/task-1');
  let since = null;
  try { since = unchangedSince(id, await pullCommitsWithStatuses(GITHUB_REPOSITORY, PR_NUMBER, GH_TOKEN, HEAD_SHA)); } catch (e) { console.log(`ci-delta: ${e.message}; treating the delta as changed`); }
  console.log(since ? `ci-delta: patch-id ${id} already ran green at ${since}: shards skipped` : `ci-delta: patch-id ${id || '(none)'} has no green full run: shards run`);
  emit(Boolean(since), id, since);
}
