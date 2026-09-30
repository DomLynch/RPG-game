// The T4 wall-row box (Lead's brief 2026-09-30, Dom's yes via Strategy): the wall-clock browser rows of a release run as ONE Hugging Face
// Job on a real GPU while the Mac does the rest. Pure helpers, no I/O: which rows go, which receipts count, what the job's log says.
// The rule that matters: a row is trusted ONLY when the job's receipt for it says exit 0 for the exact TREE being deployed — the same
// test scripts/ci-trusted-checks.mjs applies to CI receipts. Anything else (another tree, a failed row, no receipt, a job that never ran)
// leaves the row to the Mac, which retries a failed row once alone as it always has.
import { isWebKitRow, rowSet } from '../vps-shadow/rows-lib.mjs';

export const T4_MEDIUM_USD_PER_HOUR = 0.60;   // Hugging Face list price, 2026-09-30; the bill is the receipt
// Rows the T4 never takes, by script name so a renumbering cannot move the hold: row 22 (arena-audio-check) until it is green in a
// release after #1193 (Lead 2026-09-30). Lifting a hold is a one-line edit here.
export const HELD_ROWS = ['arena-audio-check'];

// The 1-based indices of the rows the job runs: timing-sensitive (wall clock) browser rows (rows-lib timingOf), never a WebKit row
// (Linux WebKit is not Mac Safari) and never a held one. Virtual-clock and no-browser rows stay on the Mac with test:all and publish.
export function selectWallRows(commands, readSource, held = HELD_ROWS) {
  return rowSet(commands, readSource)
    .filter(row => row.timing === 'wall' && !isWebKitRow(row.command) && !held.some(name => row.name.startsWith(name)))
    .map(row => row.index);
}

const fullHex = value => /^[0-9a-f]{40}$/.test(value || '');
// Receipts: [{ index, status, tree, seconds }]. Trusted = selected, reported, exit 0, and the receipt's tree is the deployed tree.
export function trustedRows(receipts, tree, selected) {
  if (!fullHex(tree)) return [];
  const byIndex = new Map(receipts.map(receipt => [Number(receipt.index), receipt]));
  return [...new Set(selected)].filter(index => { const r = byIndex.get(index); return !!r && r.status === 0 && r.tree === tree; }).sort((a, b) => a - b);
}
// Why each selected row was NOT trusted, for the deploy log: { index: reason }.
export function untrustedReasons(receipts, tree, selected) {
  const byIndex = new Map(receipts.map(receipt => [Number(receipt.index), receipt])), out = {};
  for (const index of [...new Set(selected)].sort((a, b) => a - b)) {
    const r = byIndex.get(index);
    if (!r) out[index] = 'no-receipt';
    else if (r.status !== 0) out[index] = `exit ${r.status}`;
    else if (r.tree !== tree) out[index] = 'other-tree';
  }
  return out;
}

// The job's stdout: `=== HEAD <sha> TREE <tree> ===` from git inside the container, one `=== RECEIPT {json} ===` per row it ran,
// `=== COST seconds=N … ===` last; `=== BLOCKER … ===` when it stopped early (no GPU, build failed). Unreadable receipt lines are skipped.
export function parseJobLog(text) {
  const head = /^=== HEAD ([0-9a-f]{40}) TREE ([0-9a-f]{40}) ===$/m.exec(text);
  const receipts = [];
  for (const m of text.matchAll(/^=== RECEIPT (\{.*\}) ===$/gm)) { try { const r = JSON.parse(m[1]); if (Number.isInteger(r.index)) receipts.push(r); } catch { /* not a receipt */ } }
  const cost = /^=== COST seconds=(\d+)/m.exec(text), blocker = /^=== BLOCKER (.*?) ===$/m.exec(text);
  return { sha: head?.[1] ?? null, tree: head?.[2] ?? null, receipts, seconds: cost ? Number(cost[1]) : null, ...(blocker ? { blocker: blocker[1] } : {}) };
}

export const costLine = (seconds, jobId, flavor = 't4-medium', rate = T4_MEDIUM_USD_PER_HOUR) =>
  `hf-wall-rows: job ${jobId} ran ${seconds} s on ${flavor} ≈ $${(seconds / 3600 * rate).toFixed(2)} at $${rate.toFixed(2)}/h`;
