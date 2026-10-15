// Runs one release-checks GROUP of rows inside a single GitHub job (Deploy, release speed 2026-10-13; scripts/lib/row-groups.mjs packs the groups).
// Per ROW it behaves exactly like the one-job-per-row workflow did: the same argv, a receipt with the same fields, a failed row is a red row.
//   - rows run one after another in ascending index order, each in its own child process;
//   - a row that fails is retried ALONE, once, right after it (never the whole group; deploy.sh does the same: "Retrying release check N alone");
//     the receipt records the final attempt, with retried:true and first_status so a flaky row stays visible;
//   - artifacts/release-check-N.json per row (what the summary and the full artifact carry) and artifacts/release-check-<group>.json, an array of those
//     receipts (the tiny `release-check-<group>-receipt` artifact scripts/ci-trusted-checks.mjs downloads);
//   - exit 1 when any row's final attempt failed, and every failed row is named in the log and in the receipt; the receipts are written whether or not rows pass.
//   - a row has a hard CEILING (ROW_TIMEOUT_S, default 600 s = the ci-trust-run row cap): at the ceiling the whole row process GROUP is killed (GNU timeout -s KILL signals the group, so an
//     npx-spawned vite grandchild dies too), that row alone is FAILED with its name (status 124, timed_out:true), it is NOT retried (a hang does not heal; deploy.sh does the same:
//     "Not retrying release check N: it hit the 600s ceiling"), and the rest of the group still runs. Before this a hung row (GS row 56, 2026-10-15) held the job to the 30-minute
//     job timeout and the cancel failed the WHOLE group.
// env: GROUP_ID, GROUP_ROWS (JSON [{ index, name, argv: "<JSON argv>" }]), GITHUB_EVENT_NAME; optional ROW_RETRIES (default 1), RECEIPT_DIR (default artifacts).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const TIMED_OUT = 124;   // GNU timeout's exit status for a command that hit its limit
export const rowCeilingS = () => { const n = Number(process.env.ROW_TIMEOUT_S); return Number.isFinite(n) && n > 0 ? n : 600; };

export function runGroup({ id, rows, event, retries = 1, dir = 'artifacts', run = defaultRun, rev = defaultRev, log = console.log, now = Date.now }) {
  mkdirSync(dir, { recursive: true });
  const receipts = [];
  for (const row of [...rows].sort((a, b) => a.index - b.index)) {
    const argv = typeof row.argv === 'string' ? JSON.parse(row.argv) : row.argv;
    let status = 1, seconds = 0, firstStatus = null, attempts = 0, timedOut = false;
    for (; attempts <= retries; attempts++) {
      if (attempts) log(`Retrying release check ${row.index} alone`);
      const t0 = now();
      status = run(argv);
      seconds = Math.round((now() - t0) / 100) / 10;
      if (firstStatus === null) firstStatus = status;
      if (status === TIMED_OUT) {   // a hang is not retried: the group goes on to the next row
        log(`check ${row.index} (${row.name}) hit the ${rowCeilingS()}s ceiling after ${seconds}s: the row process group was killed, FAILED, not retried`);
        timedOut = true; break;
      }
      log(`check ${row.index} ${status === 0 ? 'passed' : `FAILED (exit ${status})`} in ${seconds}s${attempts ? ' (retry)' : ''}`);
      if (status === 0) break;
    }
    // sha/tree are what the job checked out: deploy.sh trusts a receipt only for the tree it is deploying.
    const receipt = { index: Number(row.index), name: row.name, command: argv.join(' '), seconds, status, runner: 'ubuntu-latest', sha: rev('HEAD'), tree: rev('HEAD^{tree}'), event, group: id, ...(firstStatus !== 0 && !timedOut ? { retried: true, first_status: firstStatus } : {}), ...(timedOut ? { timed_out: true } : {}) };
    writeFileSync(join(dir, `release-check-${row.index}.json`), JSON.stringify(receipt) + '\n');
    receipts.push(receipt);
  }
  writeFileSync(join(dir, `release-check-${id}.json`), JSON.stringify(receipts) + '\n');
  const failed = receipts.filter(r => r.status !== 0);
  if (failed.length) log(`::error::release rows FAILED in group ${id}: ${failed.map(r => `${r.index} (${r.name}, exit ${r.status}${r.timed_out ? `, timed out at the ${rowCeilingS()}s ceiling` : ''})`).join(', ')}`);
  return { receipts, failed };
}

// GNU timeout puts the row in its own process group and sends -s KILL to the GROUP at the ceiling, so a grandchild (npx -> vite) dies with the row and cannot keep the job's pipes open
// (the GS row-56 hang). It exits 124 on a timeout. Without `timeout` (not on the ubuntu runners' path, never seen) the plain spawnSync timeout still kills the row itself.
const defaultRun = argv => {
  const env = { ...process.env, PG_BIN: process.env.PG_BIN }, secs = rowCeilingS();
  const r = spawnSync('timeout', ['-s', 'KILL', String(secs), ...argv], { stdio: 'inherit', env });
  if (r.error?.code !== 'ENOENT') return r.status ?? 1;
  const f = spawnSync(argv[0], argv.slice(1), { stdio: 'inherit', env, timeout: secs * 1000, killSignal: 'SIGKILL' });
  return f.error?.code === 'ETIMEDOUT' ? TIMED_OUT : f.status ?? 1;
};
const defaultRev = a => execFileSync('git', ['rev-parse', a], { encoding: 'utf8', timeout: 60_000 }).trim();

if (import.meta.url === `file://${process.argv[1]}`) {
  const { GROUP_ID, GROUP_ROWS, GITHUB_EVENT_NAME, ROW_RETRIES, RECEIPT_DIR } = process.env;
  if (!/^g\d+$/.test(GROUP_ID || '') || !GROUP_ROWS) { console.error('ci-row-group: GROUP_ID (g<N>) and GROUP_ROWS (JSON) are required'); process.exit(2); }
  const { failed } = runGroup({ id: GROUP_ID, rows: JSON.parse(GROUP_ROWS), event: GITHUB_EVENT_NAME, retries: ROW_RETRIES === undefined ? 1 : Number(ROW_RETRIES), dir: RECEIPT_DIR || 'artifacts' });
  process.exit(failed.length ? 1 : 0);
}
