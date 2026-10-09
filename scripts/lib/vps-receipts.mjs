// Item 3 (pull model, no runner): the VPS runs the release rows for a candidate commit (scripts/vps-shadow-rows.sh -> rows.json) and
// deploy.sh trusts a row from that receipt ONLY when it is safe to read off a box with no GPU. Pure helpers, no I/O. Same test as
// ci-trusted-checks.mjs and hf-wall-rows.mjs: exit 0 for the exact TREE being deployed, and the row is still the same command.
import { dirname, join } from 'node:path';
import { isWebKitRow, timingOf } from '../vps-shadow/rows-lib.mjs';

const fullHex = value => /^[0-9a-f]{40}$/.test(value || '');
const RELATIVE_IMPORT = /(?:from\s*|import\s*\(\s*|import\s+|require\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
// The script plus every relative import, transitively (a row that launches its browser through scripts/lib/harness.mjs shows nothing in
// its own file). null = the script or an import is missing: fail closed.
export function sourceWithImports(script, readSource, seen = new Set()) {
  if (seen.has(script)) return '';
  seen.add(script);
  const text = readSource(script);
  if (text === null || text === undefined || text === '') return null;
  let all = text;
  for (const [, rel] of text.matchAll(RELATIVE_IMPORT)) {
    const sub = sourceWithImports(join(dirname(script), rel), readSource, seen);
    if (sub === null) return null;
    all += `\n${sub}`;
  }
  return all;
}
// Not trusted from the VPS whatever its receipt says: a missing script, a WebKit launch (Linux WebKit is not Mac Safari), a real-clock
// resume, or a wall-clock browser row (software GL runs the fight at ~1/5 speed: the T4's or the Mac's to judge). Virtual-clock
// Chromium rows and no-browser rows are deterministic on both boxes, so a VPS pass is a pass. Judged on the script AND its imports.
// Rows that never passed on a Hugging Face job even at low load (Release I, 2026-10-09): roster hit the 600 s ceiling, sparring exited 1; both passed on the Mac (73 s, 145 s).
export const NEVER_ON_HF = ['roster-browser-check.mjs', 'sparring-browser-check.mjs', 'account-database-check.mjs'];   // the last: initdb refuses root in the HF container (Auditor, #1998)
export const vpsSafeRow = (command, argv, readSource, allowWall = false) => {
  const script = argv.find(arg => /\.(mjs|js|sh)$/.test(arg));
  if (NEVER_ON_HF.includes((argv.find(arg => /\.(mjs|js|sh)$/.test(arg)) || '').split('/').pop())) return false;
  const source = script ? sourceWithImports(script, readSource) : null;
  if (source === null) return false;
  // Any non-comment `webkit` in the script or its imports (a row can pick its engine through a variable: engine = x ? webkit : chromium).
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (isWebKitRow(command) || /\bwebkit\b/i.test(code) || /clock\s*\.\s*resume/.test(code)) return false;
  return allowWall || timingOf(source) !== 'wall';
};
// Receipts come ONLY from Hugging Face jobs (a fresh container each run, Dom's hardware rule 2026-10-08: cpu-upgrade or t4-medium, never another
// GPU). The flavor is never read off the receipt: the job it names is looked up (`hf jobs inspect <id>`, scripts/vps-receipt-trust.mjs does the I/O)
// and must be COMPLETED, on an allowed flavor, with the run's sha in its own environment (-e SHA=...). `jobs` = { <id>: inspect record }.
export const FLAVORS = ['cpu-upgrade', 't4-medium'];
// The job's own command must be the canonical runner invocation for this sha (jobCommand below), so a job that merely sets SHA=<sha> and runs some
// other script is not a receipt. The runner it executes is the file inside the checked-out tree, whose sha256 the receipt carries (boundToTree).
export const jobCommand = (kind, sha) => ['bash', '-c', `set -e; apt-get update -qq >/dev/null; apt-get install -y -qq git ca-certificates libjpeg-turbo-progs >/dev/null; mkdir -p /work/repo; cd /work/repo; git init -q; git remote add origin https://github.com/DomLynch/RPG-game.git; git fetch -q origin ${sha}; git checkout -q --detach ${sha}; export SHADOW_HOME=/work SHADOW_JOB_KIND=${kind}; exec bash scripts/vps-shadow/run-${kind}.sh ${sha}`];
// The job's whole environment is part of what it ran: the canonical command with NODE_OPTIONS=--require, BASH_ENV or npm_config_* injected could print its own RECEIPT.
// So the env keys are a closed set with strict values, and the job carries no secrets.
const ENV_RULES = { SHA: (v, sha) => v === sha, ROWS_ONLY: v => /^\d+(,\d+)*$/.test(v), RELEASE_CHECK_CONCURRENCY: v => /^[1-8]$/.test(v), RELEASE_CHECK_CEILING_S: v => /^[1-9]\d{2,3}$/.test(v) };
const ENV_ALLOWED = { rows: ['SHA', 'ROWS_ONLY', 'RELEASE_CHECK_CONCURRENCY', 'RELEASE_CHECK_CEILING_S'], unit: ['SHA'] };
export const jobEnvOk = (env, sha, kind) => !!env && typeof env === 'object' && Object.keys(env).every(k => (ENV_ALLOWED[kind] || []).includes(k) && typeof env[k] === 'string' && ENV_RULES[k](env[k], sha)) && env.SHA === sha;
// Everything `hf jobs inspect` reports about how the job ran is pinned: image, no arguments, the account that owns it, no Space, no secrets (the field is present and empty
// in a real inspect, so absent is refused), the closed env above and the canonical command.
export const JOB_IMAGE = 'node:22', JOB_OWNER = 'Domlynch';
export const jobVerified = (info, id, sha, kind) => !!info && !!id && info.id === id && info.status?.stage === 'COMPLETED' && FLAVORS.includes(info.flavor) && fullHex(sha)
  && info.docker_image === JOB_IMAGE && (info.arguments === undefined || (Array.isArray(info.arguments) && info.arguments.length === 0)) && info.owner?.name === JOB_OWNER && !info.space_id
  && Array.isArray(info.secrets) && info.secrets.length === 0 && jobEnvOk(info.environment, sha, kind) && JSON.stringify(info.command) === JSON.stringify(jobCommand(kind, sha));
// The runner files a receipt names (sha256 by file name) must equal the deploy tree's own copies: a run started from another checkout
// copied different runner scripts. `ownSums` = { 'run-rows.sh': sha256, ... } of the deploy tree.
export const boundToTree = (receipt, ownSums) => !!receipt?.scripts && Object.keys(ownSums).length > 0 && Object.entries(ownSums).every(([name, sum]) => receipt.scripts[name] === sum);
export function trustedFromVps(receipt, tree, commands, readSource, ownSums = {}, jobs = {}, trees = {}) {
  if (!receipt || receipt.kind !== 'vps-shadow-rows' || !fullHex(tree) || receipt.tree !== tree) return [];
  const info = jobs?.[receipt.job];
  if (trees?.[receipt.sha] !== tree) return [];   // receipt.tree is self-declared: the commit the job ran must itself have the deploy tree (trees = { sha: git rev-parse sha^{tree} })
  if (!jobVerified(info, receipt.job, receipt.sha, 'rows') || !boundToTree(receipt, ownSums)) return [];
  if (receipt.buildStatus !== 0 || receipt.dirty !== 0) return [];
  return (receipt.rows || [])
    .filter(row => Number.isInteger(row.index) && row.status === 'pass' && row.exit === 0)   // strict: a missing, null or negative exit is never a pass
    .filter(row => commands[row.index - 1]?.join(' ') === row.command)   // a renumbered or edited row is never trusted by number
    .filter(row => vpsSafeRow(row.command, commands[row.index - 1], readSource, info.flavor === 't4-medium'))   // only the inspected T4 may vouch for wall-clock rows
    .map(row => row.index).sort((a, b) => a - b);
}

// N shard receipts for one tree: a row is trusted when some receipt trusts it AND no receipt for this tree shows it failing (a FAIL or CEILING anywhere vetoes; a skipped row does not).
export function trustedFromShards(receipts, tree, commands, readSource, ownSums, jobs = {}, trees = {}) {
  const seen = new Set(), failed = new Set();
  for (const receipt of receipts) {
    if (receipt?.kind !== 'vps-shadow-rows' || receipt.tree !== tree) continue;
    for (const row of receipt.rows || []) if (row.status === 'fail' || row.status === 'ceiling' || (Number.isInteger(row.exit) && row.exit !== 0)) failed.add(Number(row.index));   // Number(): a string index cannot dodge the veto. A row a shard SKIPPED ('trusted') or never reached ('missing') is not a failure
    for (const index of trustedFromVps(receipt, tree, commands, readSource, ownSums, jobs, trees)) seen.add(index);
  }
  return [...seen].filter(index => !failed.has(index)).sort((a, b) => a - b);
}
// The unit-suite receipt (scripts/vps-shadow/run-unit.sh): the whole `npm run test:all` for this exact tree, zero failures, a verified job
// and the producing script's own sha256 matching the deploy tree's copy. Anything else = the Mac runs its own suite.
export const unitReceiptOk = (receipt, tree, ownSums, jobs = {}, trees = {}) =>
  !!receipt && trees?.[receipt.sha] === tree && receipt.kind === 'vps-unit-suite' && fullHex(tree) && receipt.tree === tree && jobVerified(jobs?.[receipt.job], receipt.job, receipt.sha, 'unit')
  && receipt.exit === 0 && receipt.fail === 0 && Number.isInteger(receipt.pass) && receipt.pass > 0 && boundToTree(receipt, ownSums);

// Rows that take too long to share a Hugging Face job (#1933): launch.mjs runs each ALONE on cpu-upgrade, width 1, row ceiling 1500 s, job timeout 35m (SLOW_CEILING_S); never "unassigned".
export const SLOW_CEILING_S = 1500;
export const SLOW_ROWS = [5, 7, 9, 13, 16, 21, 28, 34, 36];
// Shard coverage for a release: every row must be run by some shard or be one no Hugging Face job can vouch for. `macOnly` = rows even the T4 may not vouch for
// (WebKit, real-clock resume, a missing script): they always run on the Mac. `t4Only` = wall-clock rows only the T4 can vouch for. `unassigned` = rows no shard ran
// that a shard COULD have vouched for: a launch with any of these ran them on a busy Mac for nothing (Release G: 15 rows).
export function coverageGaps(receipts, commands, readSource) {
  const ran = new Set(receipts.flatMap(r => (r?.rows || []).filter(x => x.status !== 'trusted').map(x => Number(x.index))));
  const rows = commands.map((argv, i) => i + 1);
  const macOnly = rows.filter(i => !vpsSafeRow(commands[i - 1].join(' '), commands[i - 1], readSource, true));
  const t4Only = rows.filter(i => !macOnly.includes(i) && !vpsSafeRow(commands[i - 1].join(' '), commands[i - 1], readSource, false));
  return { macOnly, t4Only, slow: SLOW_ROWS.filter(i => !macOnly.includes(i) && i <= commands.length), unassigned: rows.filter(i => !ran.has(i) && !macOnly.includes(i) && !SLOW_ROWS.includes(i)) };
}
