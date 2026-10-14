// Runs one release-checks GROUP of rows inside a single GitHub job (Deploy, release speed 2026-10-13; scripts/lib/row-groups.mjs packs the groups).
// Per ROW it behaves exactly like the one-job-per-row workflow did: the same argv, a receipt with the same fields, a failed row is a red row.
//   - rows run one after another in ascending index order, each in its own child process;
//   - a row that fails is retried ALONE, once, right after it (never the whole group; deploy.sh does the same: "Retrying release check N alone");
//     the receipt records the final attempt, with retried:true and first_status so a flaky row stays visible;
//   - artifacts/release-check-N.json per row (what the summary and the full artifact carry) and artifacts/release-check-<group>.json, an array of those
//     receipts (the tiny `release-check-<group>-receipt` artifact scripts/ci-trusted-checks.mjs downloads);
//   - exit 1 when any row's final attempt failed, and every failed row is named in the log and in the receipt; the receipts are written whether or not rows pass.
// env: GROUP_ID, GROUP_ROWS (JSON [{ index, name, argv: "<JSON argv>" }]), GITHUB_EVENT_NAME; optional ROW_RETRIES (default 1), RECEIPT_DIR (default artifacts).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function runGroup({ id, rows, event, retries = 1, dir = 'artifacts', run = defaultRun, rev = defaultRev, log = console.log, now = Date.now }) {
  mkdirSync(dir, { recursive: true });
  const receipts = [];
  for (const row of [...rows].sort((a, b) => a.index - b.index)) {
    const argv = typeof row.argv === 'string' ? JSON.parse(row.argv) : row.argv;
    let status = 1, seconds = 0, firstStatus = null, attempts = 0;
    for (; attempts <= retries; attempts++) {
      if (attempts) log(`Retrying release check ${row.index} alone`);
      const t0 = now();
      status = run(argv);
      seconds = Math.round((now() - t0) / 100) / 10;
      if (firstStatus === null) firstStatus = status;
      log(`check ${row.index} ${status === 0 ? 'passed' : `FAILED (exit ${status})`} in ${seconds}s${attempts ? ' (retry)' : ''}`);
      if (status === 0) break;
    }
    // sha/tree are what the job checked out: deploy.sh trusts a receipt only for the tree it is deploying.
    const receipt = { index: Number(row.index), name: row.name, command: argv.join(' '), seconds, status, runner: 'ubuntu-latest', sha: rev('HEAD'), tree: rev('HEAD^{tree}'), event, group: id, ...(firstStatus !== 0 ? { retried: true, first_status: firstStatus } : {}) };
    writeFileSync(join(dir, `release-check-${row.index}.json`), JSON.stringify(receipt) + '\n');
    receipts.push(receipt);
  }
  writeFileSync(join(dir, `release-check-${id}.json`), JSON.stringify(receipts) + '\n');
  const failed = receipts.filter(r => r.status !== 0);
  if (failed.length) log(`::error::release rows FAILED in group ${id}: ${failed.map(r => `${r.index} (${r.name}, exit ${r.status})`).join(', ')}`);
  return { receipts, failed };
}

// A row that hangs is killed at 30 min (the slowest measured group ran 754 s) and reads as FAILED (status null -> 1), so it is retried once like any red row and can never hold the job.
const ROW_TIMEOUT_MS = 30 * 60_000;
const defaultRun = argv => spawnSync(argv[0], argv.slice(1), { stdio: 'inherit', env: { ...process.env, PG_BIN: process.env.PG_BIN }, timeout: ROW_TIMEOUT_MS, killSignal: 'SIGKILL' }).status ?? 1;
const defaultRev = a => execFileSync('git', ['rev-parse', a], { encoding: 'utf8', timeout: 60_000 }).trim();

if (import.meta.url === `file://${process.argv[1]}`) {
  const { GROUP_ID, GROUP_ROWS, GITHUB_EVENT_NAME, ROW_RETRIES, RECEIPT_DIR } = process.env;
  if (!/^g\d+$/.test(GROUP_ID || '') || !GROUP_ROWS) { console.error('ci-row-group: GROUP_ID (g<N>) and GROUP_ROWS (JSON) are required'); process.exit(2); }
  const { failed } = runGroup({ id: GROUP_ID, rows: JSON.parse(GROUP_ROWS), event: GITHUB_EVENT_NAME, retries: ROW_RETRIES === undefined ? 1 : Number(ROW_RETRIES), dir: RECEIPT_DIR || 'artifacts' });
  process.exit(failed.length ? 1 : 0);
}
