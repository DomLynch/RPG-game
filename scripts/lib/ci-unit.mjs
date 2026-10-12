// The CI unit-suite receipt: `npm run test:all` split over N GitHub runners (.github/workflows/unit-ci.yml), summed into ONE receipt in the same shape as the VPS unit
// receipt (sha, tree, pass, fail, exit, seconds, node). deploy.sh trusts it (scripts/ci-unit-trust.mjs) when the run is a green unit-ci.yml run for a commit with the deploy tree.
import { NODE_PIN } from './vps-unit.mjs';

export const SHARDS = 8;
const HEX40 = /^[0-9a-f]{40}$/;
const count = (log, name) => { const m = [...log.matchAll(new RegExp(`^# ${name} (\\d+)$`, 'gm'))].pop(); return m ? Number(m[1]) : null; };

// One shard's node:test TAP summary -> { shard, of, pass, fail, exit, seconds, node }. Anything unreadable is fail: null (never a pass).
export const parseShard = ({ log, shard, of, exit, seconds, node }) => ({ shard, of, pass: count(log, 'pass'), fail: count(log, 'fail'), exit, seconds, node });

// Every one of the N shards present exactly once, each exit 0 with zero failures, and a positive pass count -> the receipt; anything else -> { ok: false, reason }.
export function buildReceipt({ shards, sha, tree, runId, node, repo }) {
  const fail = (reason) => ({ ok: false, reason });
  if (!HEX40.test(sha || '') || !HEX40.test(tree || '')) return fail('sha and tree must be 40 hex');
  const seen = new Set();
  for (const s of shards) {
    if (s?.of !== SHARDS || !Number.isInteger(s.shard) || s.shard < 1 || s.shard > SHARDS) return fail('a shard report is malformed');
    if (seen.has(s.shard)) return fail(`shard ${s.shard} reported twice`);
    seen.add(s.shard);
    if (s.node !== node) return fail(`shard ${s.shard} ran node ${s.node}, not ${node}`);
    if (s.exit !== 0 || s.fail !== 0 || !Number.isInteger(s.pass)) return fail(`shard ${s.shard}: exit ${s.exit}, ${s.fail} failed, pass ${s.pass}`);
  }
  if (seen.size !== SHARDS) return fail(`${seen.size} of ${SHARDS} shards reported`);
  const pass = shards.reduce((n, s) => n + s.pass, 0);
  if (!(pass > 0)) return fail('no passing tests');
  return { ok: true, receipt: { kind: 'ci-unit-suite', repo, run: String(runId), sha, tree, shards: SHARDS, node, pass, fail: 0, exit: 0, seconds: Math.max(...shards.map((s) => s.seconds || 0)) } };
}

// What deploy.sh re-checks against the deploy tree: the tree (from git, not from the receipt), the GitHub run it names (a green unit-ci.yml run on that very sha), zero failures.
export const ciUnitReceiptOk = (receipt, { tree, run, repo }) =>
  !!receipt && receipt.kind === 'ci-unit-suite' && HEX40.test(tree || '') && receipt.tree === tree && HEX40.test(receipt.sha || '')
  && receipt.shards === SHARDS && receipt.node === NODE_PIN.version && receipt.exit === 0 && receipt.fail === 0 && Number.isInteger(receipt.pass) && receipt.pass > 0
  && !!run && String(run.id) === receipt.run && run.conclusion === 'success' && run.headSha === receipt.sha && run.path === '.github/workflows/unit-ci.yml' && (!repo || receipt.repo === repo);
