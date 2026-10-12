// `node scripts/release-train.mjs cut [--dry-run]`: the release train's CUTTER (Dom via Strategy + Lead, 2026-10-12: no operator turn in the loop). Run by
// .github/workflows/release-train.yml every 10 min and on a `release:go` label; safe to run by hand. The train reads labels, not messages:
//   - a PR rides when it carries `release:go` (the Auditor adds it with its PASS), its checks are all green, and the Auditor's (or Lead's) "PASS @<head>" names its CURRENT
//     head (a push after the PASS drops it until the Auditor passes the new head);
//   - order: docs/release-order.txt (one PR number per line, Lead-owned), then the unlisted ones oldest-PASS-first; a stacked PR (base = another PR's branch) rides
//     only once its base is on trunk, in the candidate it builds on, or picked earlier in this cut;
//   - base: the newest open release-* candidate's tip (N+1 is built on N, so N's tree is never re-listed), else trunk. At most MAX_IN_FLIGHT candidates in flight: open ones plus those
//     on trunk but not yet live (release.json); the workflow's concurrency group is the per-run lock;
//   - a PR that conflicts is skipped with ONE comment per head and never blocks the others (cut-release.mjs mergeAll);
//   - a unique branch per run (release-T<MMDDHHmmss>r<run id>), pushed with a lease on "absent" and retried 3x with backoff (a transient "remote rejected" stopped CO's cut);
//   - the candidate PR is opened with ci:release-checks + auditor:ready; the Mac publisher (scripts/release-train-publish.sh) waits for the Auditor's
//     candidate:pass label AND its "PASS @<head>" comment, plus unit-ci/quality/release-checks present and green. A failed dispatch fails the cut.
// Prints one JSON line: { action, name?, sha?, pr?, base, merged, skipped }. Never merges to trunk and never deploys.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { TRUNK, mergeAll, passAt, pushWithRetry } from './cut-release.mjs';

export const GO = 'release:go';
export const CANDIDATE_LABELS = ['ci:release-checks', 'auditor:ready'];
export const MAX_IN_FLIGHT = 2;   // deploy.sh pipelines two runs at most (scripts/lib/deploy-lock.sh)
export const SKIP_MARK = 'release-train: skipped';

/** docs/release-order.txt -> [PR numbers]; blank lines and # comments ignored. */
export const readOrder = text => String(text || '').split('\n').map(l => l.replace(/#.*/, '').trim()).filter(l => /^\d+$/.test(l)).map(Number);

/** One check finished SUCCESS / SKIPPED / NEUTRAL; anything pending or red is not. */
export const checkGreen = c => ['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(String(c.__typename === 'StatusContext' ? c.state : (c.status === 'COMPLETED' ? c.conclusion : 'PENDING')).toUpperCase());

/** Skipped browser jobs read as green (#2359, Lead + Auditor 2026-10-12): on a feature head the quality.yml with the `browser-rows (status)` job ran on,
 * the plan always sets the `browser-rows` commit status, so a head without it at SUCCESS has not passed its browser jobs. A release-* head is exempt (it
 * always runs them and gets no status); a head only the older quality.yml ran on has no reporter check and is not held. No head ref: the rule applies. */
export function browserRowsMissing(rollup, headRef = '') {
  if (/^release-/.test(headRef)) return false;
  const rows = rollup || [];
  return rows.some(c => c.workflowName === 'quality' && c.name === 'browser-rows (status)')
    && !rows.some(c => c.__typename === 'StatusContext' && c.context === 'browser-rows' && String(c.state).toUpperCase() === 'SUCCESS');
}

/** The attempt that decides each check on the head (Lead, #2359): a rollup lists every run of a check, so a run the concurrency group or
 * cancel-member-runs CANCELLED stays beside its newer SUCCESS. Per CheckRun (workflow + name) the LATEST attempt that is not SKIPPED decides (a later
 * inert run, a title edit or a label, skips every job and must never hide a red); all skipped is skipped. A status context is already one per context. */
export function decisiveChecks(rollup) {
  const latest = new Map(), out = [];
  for (const c of rollup || []) {
    if (c.__typename === 'StatusContext') { out.push(c); continue; }
    const key = `${c.workflowName}/${c.name}`, prev = latest.get(key);
    const rank = x => [String(x.conclusion).toUpperCase() !== 'SKIPPED' ? 1 : 0, String(x.startedAt || x.completedAt || '')];
    const [a, b] = [rank(c), prev && rank(prev)];
    if (!prev || a[0] > b[0] || (a[0] === b[0] && a[1] >= b[1])) latest.set(key, c);
  }
  return [...out, ...[...latest.values()].filter(c => !orphanCancel(c, rollup))];
}

/** A CANCELLED row no later run reuses (release-DC #2406): a job cancelled before its matrix expanded keeps a placeholder name (`shard`,
 * `check ${{ matrix.check.index }} (...)`) that the re-run never repeats (`shard (1)`, `check 12 (name)`), so nothing supersedes it. It is ignored when
 * its name is still an unexpanded `${{` placeholder, or when its workflow's verdict job (REQUIRED_ROWS) SUCCEEDED in a run started after it.
 * Only CANCELLED: a FAILURE anywhere still blocks, and a plain cancel with no later green verdict stays red. */
function orphanCancel(c, rollup) {
  if (String(c.conclusion).toUpperCase() !== 'CANCELLED') return false;
  if (String(c.name).includes('${{')) return true;
  const verdict = REQUIRED_ROWS.find(([wf]) => wf === c.workflowName)?.[1];
  return !!verdict && rollup.some(v => v.workflowName === c.workflowName && v.name === verdict && v.status === 'COMPLETED'
    && String(v.conclusion).toUpperCase() === 'SUCCESS' && String(v.startedAt || '') > String(c.startedAt || ''));
}

/** A rollup is green when the deciding attempt of every check is (and an empty rollup is not), and a feature head carries its browser-rows status at SUCCESS. */
export function checksGreen(rollup, headRef = '') {
  if (!Array.isArray(rollup) || !rollup.length) return false;
  return decisiveChecks(rollup).every(checkGreen) && !browserRowsMissing(rollup, headRef);
}

/**
 * The pure plan. prs: [{ number, head, headRef, baseRef, labels: [name], green, passedAt (ISO of the PASS comment at this head, or null) }].
 * inBase(head) -> is that head already in the base we build on. order: [PR numbers]. Returns { pick: [{ pr, head }], skipped: [{ pr, why }] }.
 */
export function planTrain({ prs, order, inBase, trunk = TRUNK }) {
  const rank = n => { const i = order.indexOf(n); return i < 0 ? order.length : i; };
  const eligible = [], skipped = [];
  for (const p of prs) {
    if (!p.labels.includes(GO) || /^release-/.test(p.headRef)) continue;
    if (!p.passedAt) { skipped.push({ pr: p.number, why: `no "<reviewer>: PASS @${p.head.slice(0, 9)}" (Auditor, Lead, Combat A or Deploy B) at its current head` }); continue; }
    if (!p.green) { skipped.push({ pr: p.number, why: 'checks not all green' }); continue; }
    if (inBase(p.head)) continue;   // already riding in the candidate we build on
    eligible.push(p);
  }
  eligible.sort((a, b) => rank(a.number) - rank(b.number) || String(a.passedAt).localeCompare(String(b.passedAt)) || a.number - b.number);
  const byRef = new Map(prs.map(p => [p.headRef, p]));
  const pick = [], picked = new Set(), waiting = [...eligible];
  const baseIn = p => p.baseRef === trunk || picked.has(p.baseRef) || (byRef.has(p.baseRef) && inBase(byRef.get(p.baseRef).head));
  for (let p; (p = waiting.find(baseIn));) {   // first ready PR in order, rescanned after each pick: a stacked PR listed before its base rides right after it
    pick.push({ pr: p.number, head: p.head }); picked.add(p.headRef); waiting.splice(waiting.indexOf(p), 1);
  }
  for (const p of waiting) skipped.push({ pr: p.number, why: `stacked on ${p.baseRef}, which is not in yet` });
  return { pick, skipped };
}

/** The newest open candidate (head release-*, base trunk) is the base N+1 builds on; null when none is in flight. */
export const newestCandidate = cands => [...cands].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;

/** release-T<MMDDHHmmss>r<run id> in UTC: alphanumeric like the hand cuts, sortable, and unique per run (a label event and a cron tick in the same minute
 * shared a per-minute name, Lead on #2336); the push also refuses a branch that already exists. */
export const trainName = (d = new Date(), runId = process.env.GITHUB_RUN_ID || String(process.pid)) => `T${d.toISOString().slice(5, 19).replace(/[-T:]/g, '')}r${String(runId).replace(/\D/g, '')}`;

/** The rows a candidate must carry, present and SUCCESS (a rollup that simply lacks them is not green: a failed dispatch left no unit-ci, Lead on #2336). */
export const REQUIRED_ROWS = [['unit-ci', 'receipt'], ['quality', 'quality'], ['release-checks', 'summary']];
export const missingRows = rollup => REQUIRED_ROWS.filter(([wf, name]) => !(rollup || []).some(c => c.workflowName === wf && c.name === name && c.status === 'COMPLETED' && c.conclusion === 'SUCCESS')).map(r => r.join('/'));

/** The publisher's pick (Strategy's gate, 2026-10-12): an open candidate (head release-*, base trunk) with the candidate:pass label AND an Auditor's (or Lead's)
 * "PASS @<sha9>" comment naming its CURRENT head, every check green and the REQUIRED_ROWS present and green; OLDEST first (forward-only publish). Either
 * gate alone is not enough: a label survives a head move. */
export function pickPublish(prs, trunk = TRUNK) {
  const ok = prs.filter(p => /^release-/.test(p.headRefName) && p.baseRefName === trunk && (p.labels || []).some(l => (l.name || l) === 'candidate:pass')
    && passAt((p.comments || []).map(c => c.body ?? c), p.headRefOid) && checksGreen(p.statusCheckRollup, p.headRefName) && !missingRows(p.statusCheckRollup).length);
  return ok.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0] || null;
}

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 120_000, killSignal: 'SIGKILL', maxBuffer: 1 << 26, ...opts });
const gh = args => { const r = run('gh', args); if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')}: ${String(r.stderr).trim().slice(0, 300)}`); return r.stdout; };
const ghJson = args => JSON.parse(gh(args) || 'null');

function cut({ dryRun }) {
  const git = args => run('git', args);
  git(['fetch', '-q', 'origin', '+refs/heads/*:refs/remotes/origin/*']);
  const open = ghJson(['pr', 'list', '--state', 'open', '--limit', '300', '--json', 'number,headRefName,baseRefName,headRefOid,labels,createdAt,isDraft']);
  const cands = open.filter(p => /^release-/.test(p.headRefName) && p.baseRefName === TRUNK);
  // In flight = open candidates + candidates already on trunk but not yet live (the publisher fast-forwarded trunk, deploy.sh still running; Lead on #2336).
  const live = String(JSON.parse(run('curl', ['-fsS', '-m', '20', 'https://frankendom.com/release.json']).stdout || '{}').revision || '');
  const landed = ghJson(['pr', 'list', '--state', 'merged', '--base', TRUNK, '--limit', '10', '--json', 'number,headRefName,headRefOid'])
    .filter(p => /^release-/.test(p.headRefName));
  const notLive = landed.filter(p => !live || git(['merge-base', '--is-ancestor', p.headRefOid, live]).status !== 0);
  const inFlight = cands.length + notLive.length;
  if (inFlight >= MAX_IN_FLIGHT) return { action: 'wait', why: `${inFlight} candidates in flight (open ${cands.map(c => `#${c.number}`).join(' ') || '-'}; merged, not live yet ${notLive.map(c => `#${c.number}`).join(' ') || '-'}; max ${MAX_IN_FLIGHT})`, base: null, merged: [], skipped: [] };
  const top = newestCandidate(cands);
  const baseRef = top ? `origin/${top.headRefName}` : `origin/${TRUNK}`;
  const baseSha = git(['rev-parse', baseRef]).stdout.trim();
  const inBase = head => git(['merge-base', '--is-ancestor', head, baseSha]).status === 0;
  const gos = open.filter(p => p.labels.some(l => l.name === GO) && !/^release-/.test(p.headRefName));
  const prs = gos.map(p => {
    const view = ghJson(['pr', 'view', String(p.number), '--json', 'comments,statusCheckRollup']);
    const pass = (view.comments || []).filter(c => passAt([c.body], p.headRefOid)).pop();
    return { number: p.number, head: p.headRefOid, headRef: p.headRefName, baseRef: p.baseRefName, labels: p.labels.map(l => l.name), green: checksGreen(view.statusCheckRollup, p.headRefName), passedAt: pass?.createdAt || null, comments: (view.comments || []).map(c => c.body) };
  });
  let order = []; try { order = readOrder(readFileSync('docs/release-order.txt', 'utf8')); } catch { /* no file: oldest PASS first */ }
  const plan = planTrain({ prs, order, inBase });
  const base = top ? `${top.headRefName} @${baseSha.slice(0, 9)} (#${top.number})` : `${TRUNK} @${baseSha.slice(0, 9)}`;
  if (!plan.pick.length) return { action: 'idle', base, merged: [], skipped: plan.skipped };
  const name = trainName();
  if (dryRun) return { action: 'dry-run', name, base, merged: plan.pick.map(p => p.pr), skipped: plan.skipped };
  if (git(['switch', '-q', '-C', `release-${name}`, baseSha]).status !== 0) throw new Error(`cannot create release-${name}`);
  const { merged, skipped } = mergeAll(git, name, plan.pick);
  for (const s of skipped) {   // one comment per PR head, never a blocker
    const p = prs.find(x => x.number === s.pr);
    if (p && !p.comments.some(b => b.includes(`${SKIP_MARK} @${p.head.slice(0, 9)}`))) run('gh', ['pr', 'comment', String(s.pr), '--body', `${SKIP_MARK} @${p.head.slice(0, 9)} from release-${name} (base ${base}): ${s.why}. The train went on without it; rebase on that base and it rides the next cut.`]);
  }
  if (!merged.length) return { action: 'nothing-merged', name, base, merged, skipped: [...plan.skipped, ...skipped] };
  const sha = git(['rev-parse', 'HEAD']).stdout.trim();
  // Lease on "absent": the push creates release-<name> or fails, never fast-forwards an open candidate's branch (Lead on #2336).
  const pushed = pushWithRetry(git, `release-${name}`, { extra: [`--force-with-lease=refs/heads/release-${name}:`] });
  if (!pushed.ok) throw new Error(`git push failed after ${pushed.tries} tries: ${pushed.err}`);
  const all = [...plan.skipped, ...skipped];
  const body = `Release candidate ${name} (release train) = ${base} + ${merged.map(pr => `#${pr} @${plan.pick.find(s => s.pr === pr).head.slice(0, 9)}`).join(' + ')}, each with release:go and the Auditor's PASS at that head.${top ? ` Built on #${top.number}: it carries that candidate's PRs too.` : ''}${all.length ? `\n\nNot included: ${all.map(s => `#${s.pr} (${s.why})`).join('; ')}.` : ''}\n\nThe publisher (scripts/release-train-publish.sh on the Mac) merges and deploys it once it carries candidate:pass and every check is green.\n\nDonor: n/a (release merge)\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
  const created = run('gh', ['pr', 'create', '--draft', '--base', TRUNK, '--head', `release-${name}`, '--title', `release-${name}: ${merged.map(pr => `#${pr}`).join(' + ')}`, '--body', body, ...CANDIDATE_LABELS.flatMap(l => ['--label', l])]);
  const pr = Number((/\/pull\/(\d+)/.exec(created.stdout) || [])[1]) || null;
  if (created.status !== 0 || !pr) throw new Error(`gh pr create failed: ${String(created.stderr || created.stdout).trim().slice(0, 300)}`);
  // A PR opened with the Actions token starts no pull_request workflows (GitHub's loop guard), so without RELEASE_TRAIN_TOKEN the receipts are dispatched on the branch.
  if (process.env.RELEASE_TRAIN_DISPATCH === '1') for (const wf of ['unit-ci.yml', 'quality.yml', 'release-checks.yml']) {
    const d = run('gh', ['workflow', 'run', wf, '--ref', `release-${name}`]);
    if (d.status !== 0) throw new Error(`release-${name} (#${pr}) opened but dispatching ${wf} failed: ${String(d.stderr || d.stdout).trim().slice(0, 200)}; it will never get candidate:pass rows. Re-dispatch by hand`);
  }
  return { action: 'cut', name, sha, pr, base, merged, skipped: all };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'pick') {   // stdin: `gh pr list --json number,headRefName,baseRefName,headRefOid,createdAt,isDraft,labels,statusCheckRollup`; stdout: "<number> <head sha> <draft>" or nothing
    const p = pickPublish(JSON.parse(readFileSync(0, 'utf8') || '[]'));
    if (p) console.log(`${p.number} ${p.headRefOid} ${p.isDraft ? 'draft' : 'ready'}`);
    process.exit(0);
  }
  if (cmd === 'verify') {   // stdin: `gh pr view <n> --json number,headRefName,baseRefName,headRefOid,createdAt,isDraft,labels,statusCheckRollup,comments` (ALL checks:
    // `gh pr list` stops at 100, CQ #2342 had 144, Lead on #2336) + argv sha: exit 0 only when that one candidate still passes the whole gate at that sha
    const p = JSON.parse(readFileSync(0, 'utf8') || 'null'), want = rest[0];
    const why = !p ? 'no PR' : p.headRefOid !== want ? `head moved to ${String(p.headRefOid).slice(0, 9)}` : !pickPublish([p]) ? `gate not met on the full check list (${p.statusCheckRollup?.length ?? 0} checks; missing/red: ${[...missingRows(p.statusCheckRollup), ...decisiveChecks(p.statusCheckRollup).filter(c => !checkGreen(c)).map(c => c.context || `${c.workflowName}/${c.name}`), ...(browserRowsMissing(p.statusCheckRollup, p.headRefName) ? ['browser-rows status'] : [])].slice(0, 5).join(', ') || 'label or PASS'})` : '';
    if (why) { console.log(why); process.exit(1); }
    process.exit(0);
  }
  if (cmd !== 'cut') { console.error('usage: node scripts/release-train.mjs cut [--dry-run] | pick < prs.json | verify <sha> < pr.json'); process.exit(2); }
  try { console.log(JSON.stringify(cut({ dryRun: rest.includes('--dry-run') }))); }
  catch (e) { console.error(`release-train: ${e?.message || e}`); process.exit(1); }
}
