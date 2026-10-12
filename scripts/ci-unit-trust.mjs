// node scripts/ci-unit-trust.mjs <sha>: prints "ok" when a green unit-ci.yml run (the CI-sharded `npm run test:all`) vouches for the TREE of <sha>, else nothing.
// unit-ci is THE unit receipt (Lead 2026-10-12): when its run for the exact sha is still queued or running, this WAITS for it (bounded: CI_UNIT_WAIT_S, default
// 600 s) instead of giving up. CK's deploy looked before the run finished ("no green unit-ci.yml run for f893b8f6") although the run went green. Nothing is
// waited for when no run exists at all. The last stderr line says why nothing was trusted ("unit-ci-down: ..."), so deploy.sh can log the fallback's reason.
// Candidates: <sha> itself and its merged branch head <sha>^2 (a merge commit with the same tree). The receipt is read from the run's artifact; the run's own record
// (workflow path, head sha, conclusion, event) comes from the GitHub REST API (`gh api`): `gh run list/view --json path` is rejected by gh 2.88+ ("Unknown JSON
// field"), which made this trust nothing on every release until CL (2026-10-12). Runs of either event count (push or pull_request: a PR run checks out the PR
// head, so its receipt is bound to that sha's tree); the receipt's tree decides. Env (tests): CI_UNIT_GH, CI_UNIT_WAIT_S, CI_UNIT_POLL_S.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ciUnitReceiptOk } from './lib/ci-unit.mjs';

const sha = process.argv[2];
const ghBin = process.env.CI_UNIT_GH || 'gh';
const waitS = Number(process.env.CI_UNIT_WAIT_S ?? 600), pollS = Number(process.env.CI_UNIT_POLL_S ?? 15), deadline = Date.now() + waitS * 1000;
const git = (...a) => { const r = spawnSync('git', a, { encoding: 'utf8', timeout: 10_000 }); return !r.error && r.status === 0 ? r.stdout.trim() : ''; };
const gh = (...a) => { const r = spawnSync(ghBin, a, { encoding: 'utf8', timeout: 60_000 }); return !r.error && r.status === 0 ? r.stdout : null; };
const json = (text, fallback) => { try { return JSON.parse(text || ''); } catch { return fallback; } };
const sleep = s => spawnSync('sleep', [String(s)], { timeout: (s + 5) * 1000 });
const tree = git('rev-parse', `${sha}^{tree}`);
const say = (m) => console.error(`ci-unit: ${m}`);
const down = (m) => { say(`unit-ci-down: ${m}`); process.exit(0); };
if (!tree) down('git rev-parse failed; trusting nothing');
const repo = gh('repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner')?.trim();
const RUN = '{databaseId: .id, status, conclusion, headSha: .head_sha, path, event}';
const asRun = r => r && { id: r.databaseId, conclusion: r.conclusion, status: r.status, headSha: r.headSha, path: r.path, event: r.event };
const why = [];
for (const cand of [sha, git('rev-parse', '-q', '--verify', `${sha}^2`)].filter(Boolean)) {
  if (git('rev-parse', `${cand}^{tree}`) !== tree) continue;
  const runs = json(gh('api', `repos/{owner}/{repo}/actions/workflows/unit-ci.yml/runs?head_sha=${cand}&per_page=10`, '--jq', `[.workflow_runs[] | ${RUN}]`), []).map(asRun);
  let run = runs.find(r => r.conclusion === 'success');
  const pending = !run && runs.find(r => r.status !== 'completed');
  if (pending) {   // the run for this sha exists and has not finished: wait for it rather than call it missing
    const t0 = Date.now();
    let now = pending;
    while (now && now.status !== 'completed' && Date.now() < deadline) {
      sleep(Math.max(1, Math.min(pollS, Math.ceil((deadline - Date.now()) / 1000))));
      now = asRun(json(gh('api', `repos/{owner}/{repo}/actions/runs/${pending.id}`, '--jq', RUN), null)) || now;
    }
    say(`waited ${Math.round((Date.now() - t0) / 1000)}s for run ${pending.id} on ${cand.slice(0, 8)}: ${now.status}${now.conclusion ? `/${now.conclusion}` : ''}`);
    if (now.status === 'completed' && now.conclusion === 'success') run = now;
    else { why.push(now.status === 'completed' ? `run ${pending.id} ${now.conclusion}` : `run ${pending.id} still ${now.status} after ${waitS}s`); continue; }
  }
  if (!run) { why.push(`no unit-ci.yml run for ${cand.slice(0, 8)}`); say(`no green unit-ci.yml run for ${cand.slice(0, 8)}`); continue; }
  const dir = mkdtempSync(join(tmpdir(), 'ci-unit-'));
  try {
    if (gh('run', 'download', String(run.id), '--name', 'unit-receipt', '--dir', dir) === null) { why.push(`run ${run.id} has no unit-receipt artifact`); continue; }
    const receipt = json(readFileSync(join(dir, 'unit-receipt.json'), 'utf8'), null);
    if (ciUnitReceiptOk(receipt, { tree, run, repo })) { say(`unit suite trusted: ${receipt.pass} pass over ${receipt.shards} shards, ${receipt.seconds}s, ${run.event || '?'} run ${run.id} on ${cand.slice(0, 8)} (tree ${tree.slice(0, 8)})`); process.stdout.write('ok'); process.exit(0); }
    why.push(`receipt of run ${run.id} not trusted (other tree, failures, or not this workflow's green run)`);
  } catch { why.push(`run ${run.id}: unreadable unit-receipt`); } finally { rmSync(dir, { recursive: true, force: true }); }
}
down(why.join('; ') || `no candidate with tree ${tree.slice(0, 8)}`);
