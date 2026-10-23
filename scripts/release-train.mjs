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
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { TRUNK, TRUSTED, checkRangeHasPrs, checkWatchedPaths, mergeAll, passAt, pullsOfViaGh, pushWithRetry } from './cut-release.mjs';
import { RECEIPT_WORKFLOWS, receiptState } from './lib/receipt-rule.mjs';

export const GO = 'release:go';
export const CANDIDATE_LABELS = ['ci:release-checks', 'auditor:ready'];
export const MAX_IN_FLIGHT = 2;   // deploy.sh pipelines two runs at most (scripts/lib/deploy-lock.sh)
export const SKIP_MARK = 'release-train: skipped';

/** docs/release-order.txt -> [PR numbers]; blank lines and # comments ignored. */
export const readOrder = text => String(text || '').split('\n').map(l => l.replace(/#.*/, '').trim()).filter(l => /^\d+$/.test(l)).map(Number);

/** A check run is finished when GitHub says COMPLETED, or when the rollup still lists it IN_PROGRESS but it already carries a conclusion and a real
 * completedAt after its startedAt (FV #2750, 2026-10-14: `quality / plan` read IN_PROGRESS + SUCCESS for 4 h and the train waited on it). A running job has
 * no conclusion and a 0001-01-01 completedAt, so it is never finished by this rule. */
const finished = c => c.status === 'COMPLETED' || (String(c.conclusion || '') !== '' && Date.parse(c.completedAt || '') > Date.parse('2000-01-01') && Date.parse(c.completedAt) >= (Date.parse(c.startedAt || '') || 0));

/** One check finished SUCCESS / SKIPPED / NEUTRAL; anything pending or red is not. */
export const checkGreen = c => ['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(String(c.__typename === 'StatusContext' ? c.state : (finished(c) ? c.conclusion : 'PENDING')).toUpperCase());

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
// A run the concurrency group cancelled before it started (DL #2431, 2026-10-12 19:13:23Z: the cut's first run of each workflow, CANCELLED in its first
// second, many under unexpanded matrix names such as `shard` or `check ${{ matrix.check.index }} (…)` that no later run reuses) carries no verdict. Such
// an attempt is dropped when the same check has ANY later attempt, a skip included, so it can no longer pin the candidate red forever. A cancel that ran
// (a timeout, a mid-run cancel) is not dropped, and neither is one with nothing after it.
const NEVER_RAN_S = 10;
const at = (x) => Date.parse(x.startedAt || x.completedAt || '') || 0;
const neverRan = (x) => String(x.conclusion).toUpperCase() === 'CANCELLED' && ((Date.parse(x.completedAt || '') || 0) - at(x)) / 1000 < NEVER_RAN_S;
export function decisiveChecks(rollup) {
  const latest = new Map(), out = [], last = new Map();
  for (const c of rollup || []) if (c.__typename !== 'StatusContext') { const key = `${c.workflowName}/${c.name}`; last.set(key, Math.max(last.get(key) ?? 0, at(c))); }
  for (const c of rollup || []) {
    if (c.__typename !== 'StatusContext' && neverRan(c) && (last.get(`${c.workflowName}/${c.name}`) ?? 0) > at(c)) continue;
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

/** A feature head needs its unit-ci/receipt and quality verdicts PRESENT and green at this head (Lead + Auditor on #2546): a push to a feature PR that is not
 * labelled, or a run that only did the static job, leaves them missing or skipped, and a skipped job reads as green to checkGreen. No head ref (a caller that
 * does not know it) and a release-* head are exempt here: a candidate is held to all three verdicts by missingRows. */
export const featureReceiptsMissing = (rollup, headRef = '') => !!headRef && !/^release-/.test(headRef)
  && receiptState(rollup, [['unit-ci', 'receipt'], ['quality', 'quality']]).state !== 'green';

/** A rollup is green when the deciding attempt of every check is (and an empty rollup is not), a feature head carries its browser-rows status at SUCCESS, and its unit and quality verdicts are in. */
export function checksGreen(rollup, headRef = '') {
  if (!Array.isArray(rollup) || !rollup.length) return false;
  return decisiveChecks(rollup).every(checkGreen) && !browserRowsMissing(rollup, headRef) && !featureReceiptsMissing(rollup, headRef);
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
    if (!p.passedAt) { skipped.push({ pr: p.number, why: `no "<reviewer>: PASS @${p.head.slice(0, 9)}" (Auditor, Lead, Combat A, Combat B, Deploy B or Hooks) at its current head` }); continue; }
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
export const REQUIRED_ROWS = RECEIPT_WORKFLOWS;
/** Every verdict job that is not green, wait and red alike (scripts/lib/receipt-rule.mjs: the one rule; the latest attempt that carries a verdict decides). */
export const missingRows = rollup => { const green = new Set(receiptState(rollup).green); return REQUIRED_ROWS.map(r => r.join('/')).filter(k => !green.has(k)); };

/** Optional rows (Strategy 2026-10-19, after the optional remote-heroes-soft row went red on the GitHub runner and the gate below refused JU): a quality.yml matrix row marked
 * `required: false` is evidence, not a gate; its red must never stop a publish. ONE source of truth: the matrix itself, read from this checkout's own quality.yml (by file URL, not the cwd:
 * the early-rows query once failed on exactly that). An unreadable file gives no optional rows, so the gate only ever gets stricter. The job is named `browser (<row>)`. */
export const optionalRowNames = (yml) => {
  let text = yml;
  if (text === undefined) { try { text = readFileSync(fileURLToPath(new URL('../.github/workflows/quality.yml', import.meta.url)), 'utf8'); } catch { text = ''; } }
  return [...String(text).matchAll(/\{\s*name:\s*([\w.-]+)[^}\n]*\brequired:\s*false\b/g)].map(m => m[1]);
};
const isOptionalCheck = (c, names) => c.__typename !== 'StatusContext' && c.workflowName === 'quality' && names.some(n => c.name === `browser (${n})`);
export const withoutOptionalRows = (rollup, names) => (Array.isArray(rollup) ? rollup.filter(c => !isOptionalCheck(c, names)) : rollup);
/** The optional rows that are not green on this rollup, for the train log ("ignored"). */
export const optionalRedRows = (rollup, names) => (Array.isArray(rollup) ? rollup.filter(c => isOptionalCheck(c, names) && !checkGreen(c)).map(c => c.name) : []);

/** A written per-run trust (Lead 2026-10-22, after K6q26 needed a manual publish: the runner's apt mirror stalled row 57 on three CI attempts while the row was green on the Mac
 * and the VPS at the same tree). A line "Lead: TRUST @<sha9> rows 57[,58] — <reason>" from a repo author names release-checks rows that are proven elsewhere for THIS head.
 * The newest such line wins and a reason is required. "Only Lead" is PROCESS, not code (Lead's review): every lane posts as the same repo owner, so the "Lead:" prefix is all the
 * code can check. What the code does guarantee is the audit: { rows, reason, line, url } carries the line verbatim and its comment URL, and the train's log and deploy.sh's
 * Published block quote both, so every use is on the record. Returns that or null. */
export function trustAt(comments, head) {
  const re = new RegExp(`^\\*{0,2}Lead: \\*{0,2}TRUST @${String(head).slice(0, 9)} rows ([0-9]+(?:,[0-9]+)*)\\s*(?:—|–|-|:)\\s*(\\S.*)$`, 'm');
  for (const c of [...comments].reverse()) {
    const m = TRUSTED.includes(c?.authorAssociation) && re.exec(String(c.body || ''));
    if (m) return { rows: m[1].split(',').map(Number), reason: m[2].trim(), line: m[0].trim(), url: String(c.url || '') };
  }
  return null;
}
const rowsOfJob = name => { const m = /^checks ([0-9]+(?:,[0-9]+)*) \(/.exec(String(name)); return m ? m[1].split(',').map(Number) : null; };   // a row group's job: "checks 11,14,24 (names)"
// A trust covers a row the RUNNER lost (cancelled, timed out, or never finished: the K6q26 apt stall), never an assertion: a FAILURE on any attempt of the row's job keeps blocking
// even when the TRUST line names the row (Lead's review, HIGH). Anything other than these, success included, is judged by the gate as before.
const LOST = ['CANCELLED', 'TIMED_OUT', 'STALE', 'SKIPPED'];
const lostToRunner = c => !finished(c) || LOST.includes(String(c.conclusion || '').toUpperCase());
/** The rollup the gate reads under a trust: a release-checks row job whose rows are ALL trusted and whose EVERY attempt was lost to the runner (none failed) drops out, and
 * release-checks/summary (red or waiting because of them) reads green, but only when every other row job is finished green. A red row, any other pending row, and every other
 * workflow still block exactly as before. */
export function withoutTrustedRows(rollup, trust) {
  if (!trust || !Array.isArray(rollup)) return rollup;
  const rc = c => c.__typename !== 'StatusContext' && c.workflowName === 'release-checks';
  const named = c => rc(c) && !!rowsOfJob(c.name)?.every(r => trust.rows.includes(r));
  const failedNames = new Set(rollup.filter(c => named(c) && !lostToRunner(c) && !checkGreen(c)).map(c => c.name));   // an assertion red on any attempt
  const kept = rollup.filter(c => !(named(c) && !failedNames.has(c.name)));
  if (kept.some(c => rc(c) && rowsOfJob(c.name) && !checkGreen(c))) return kept;
  const at = new Date().toISOString();
  return [...kept.filter(c => !(rc(c) && c.name === 'summary')), { __typename: 'CheckRun', workflowName: 'release-checks', name: 'summary', status: 'COMPLETED', conclusion: 'SUCCESS', startedAt: at, completedAt: at, trusted: trust.rows }];
}

/** The publisher's pick (Strategy's gate, 2026-10-12): an open candidate (head release-*, base trunk) with the candidate:pass label AND an Auditor's (or Lead's)
 * "PASS @<sha9>" comment naming its CURRENT head, every check green and the REQUIRED_ROWS present and green; OLDEST first (forward-only publish). Either
 * gate alone is not enough: a label survives a head move. A Lead TRUST line at the head (trustAt) stands in for its named release rows only. */
export function pickPublish(prs, trunk = TRUNK, optional = optionalRowNames()) {
  const rollupOf = p => withoutTrustedRows(p.statusCheckRollup, trustAt(p.comments || [], p.headRefOid));
  const ok = prs.filter(p => /^release-/.test(p.headRefName) && p.baseRefName === trunk && (p.labels || []).some(l => (l.name || l) === 'candidate:pass')
    && passAt(p.comments || [], p.headRefOid) && checksGreen(withoutOptionalRows(rollupOf(p), optional), p.headRefName) && !missingRows(rollupOf(p)).length);
  return ok.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0] || null;
}

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 120_000, killSignal: 'SIGKILL', maxBuffer: 1 << 26, ...opts });
const gh = args => { const r = run('gh', args); if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')}: ${String(r.stderr).trim().slice(0, 300)}`); return r.stdout; };
const ghJson = args => JSON.parse(gh(args) || 'null');

/** The two cut gates (scripts/cut-gates.json) as the train runs them, the same functions the manual cut uses. A stop is a thrown Error carrying the reason: main prints it as
 *  "release-train: STOP gate N: ..." in the workflow log and exits 1, so a candidate is never cut past a gate. Both fail closed (no live revision, an unreadable range, a failed
 *  GitHub lookup). gateRange runs before any branch exists; gatePaths runs on the merged tip, before the push. */
export function gateRange(args) {
  const r = checkRangeHasPrs(args);
  if (!r.ok) throw new Error(`STOP ${r.reason}; no candidate was cut`);
  return r;
}
export function gatePaths(args) {
  const r = checkWatchedPaths(args);
  if (!r.ok) throw new Error(`STOP ${r.reason}; nothing was pushed`);
  return r;
}

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
    const pass = (view.comments || []).filter(c => passAt([c], p.headRefOid)).pop();
    return { number: p.number, head: p.headRefOid, headRef: p.headRefName, baseRef: p.baseRefName, labels: p.labels.map(l => l.name), green: checksGreen(view.statusCheckRollup, p.headRefName), passedAt: pass?.createdAt || null, comments: (view.comments || []).map(c => c.body) };
  });
  let order = []; try { order = readOrder(readFileSync('docs/release-order.txt', 'utf8')); } catch { /* no file: oldest PASS first */ }
  const plan = planTrain({ prs, order, inBase });
  const base = top ? `${top.headRefName} @${baseSha.slice(0, 9)} (#${top.number})` : `${TRUNK} @${baseSha.slice(0, 9)}`;
  if (!plan.pick.length) return { action: 'idle', base, merged: [], skipped: plan.skipped };
  gateRange({ git, pullsOf: pullsOfViaGh(run), live, base: baseSha });   // gate 1, before any branch exists (a dry run reports the stop too)
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
  try { gatePaths({ git, base: baseSha, cut: sha }); }   // gate 2, before the push
  catch (e) { git(['switch', '-q', '--detach', baseSha]); git(['branch', '-q', '-D', `release-${name}`]); throw e; }
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
    if (p) {
      const ignored = optionalRedRows(p.statusCheckRollup, optionalRowNames());
      if (ignored.length) console.error(`release-train: #${p.number} is publishable with optional (required: false) rows not green, ignored: ${ignored.join(', ')}`);   // the train log shows what the gate let through
      console.log(`${p.number} ${p.headRefOid} ${p.isDraft ? 'draft' : 'ready'}`);
    }
    process.exit(0);
  }
  if (cmd === 'verify') {   // stdin: `gh pr view <n> --json number,headRefName,baseRefName,headRefOid,createdAt,isDraft,labels,statusCheckRollup,comments` (ALL checks:
    // `gh pr list` stops at 100, CQ #2342 had 144, Lead on #2336) + argv sha: exit 0 only when that one candidate still passes the whole gate at that sha
    const p = JSON.parse(readFileSync(0, 'utf8') || 'null'), want = rest[0];
    const why = !p ? 'no PR' : p.headRefOid !== want ? `head moved to ${String(p.headRefOid).slice(0, 9)}` : !pickPublish([p]) ? `gate not met on the full check list (${p.statusCheckRollup?.length ?? 0} checks; missing/red: ${[...missingRows(p.statusCheckRollup), ...decisiveChecks(p.statusCheckRollup).filter(c => !checkGreen(c)).map(c => c.context || `${c.workflowName}/${c.name}`), ...(browserRowsMissing(p.statusCheckRollup, p.headRefName) ? ['browser-rows status'] : [])].slice(0, 5).join(', ') || 'label or PASS'})` : '';
    if (why) { console.log(why); process.exit(1); }
    process.exit(0);
  }
  if (cmd === 'trust') {   // stdin: `gh pr view <n> --json headRefOid,comments` + argv sha: prints "<rows csv>\t<reason>" for a Lead TRUST line at that sha (release-train-publish.sh hands it to deploy.sh as DEPLOY_TRUST_ROWS / DEPLOY_TRUST_REASON), or nothing
    const p = JSON.parse(readFileSync(0, 'utf8') || 'null'), want = rest[0];
    const trust = p && p.headRefOid === want ? trustAt(p.comments || [], want) : null;
    if (trust) console.log(`${trust.rows.join(',')}\t"${trust.line.replace(/[\t\n]/g, ' ')}" (${trust.url || 'no comment url'})`);   // the reason deploy.sh records IS the verbatim line + its URL (the audit)
    process.exit(0);
  }
  if (cmd !== 'cut') { console.error('usage: node scripts/release-train.mjs cut [--dry-run] | pick < prs.json | verify <sha> < pr.json | trust <sha> < pr.json'); process.exit(2); }
  try { console.log(JSON.stringify(cut({ dryRun: rest.includes('--dry-run') }))); }
  catch (e) { console.error(`release-train: ${e?.message || e}`); process.exit(1); }
}
