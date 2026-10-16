// Runs one release-checks GROUP of rows inside a single GitHub job (Deploy, release speed 2026-10-13; scripts/lib/row-groups.mjs packs the groups).
// Per ROW it behaves exactly like the one-job-per-row workflow did: the same argv, a receipt with the same fields, a failed row is a red row.
//   - rows run one after another in ascending index order, each in its own child process;
//   - a row that fails is retried ALONE, once, right after it (never the whole group; deploy.sh does the same: "Retrying release check N alone");
//     the receipt records the final attempt, with retried:true and first_status so a flaky row stays visible;
//   - artifacts/release-check-N.json per row (what the summary and the full artifact carry) and artifacts/release-check-<group>.json, an array of those
//     receipts (the tiny `release-check-<group>-receipt` artifact scripts/ci-trusted-checks.mjs downloads);
//   - exit 1 when any row's final attempt failed, and every failed row is named in the log and in the receipt; the receipts are written whether or not rows pass.
//   - a row has a hard CEILING: its own entry (by check name) in scripts/lib/row-ceilings.json (account-browser-check and end-overlap-check run long, measured 525 s and 868-1024 s) or the default 600 s (= the ci-trust-run row cap;
//     ROW_TIMEOUT_S overrides the default only). A flat 600 s killed row 55 on GT 2026-10-16 although it passes in ~1000 s. At the ceiling the whole row process GROUP is killed (GNU timeout -s TERM -k 5 signals the group, so an
//     npx-spawned vite grandchild dies too), that row alone is FAILED with its name (status 124, timed_out:true), it is NOT retried (a hang does not heal; deploy.sh does the same:
//     "Not retrying release check N: it hit the 600s ceiling"), and the rest of the group still runs. Before this a hung row (GS row 56, 2026-10-15) held the job to the 30-minute
//     job timeout and the cancel failed the WHOLE group.
// env: GROUP_ID, GROUP_ROWS (JSON [{ index, name, argv: "<JSON argv>" }]), GITHUB_EVENT_NAME; optional ROW_RETRIES (default 1), RECEIPT_DIR (default artifacts).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const TIMED_OUT = 124;   // GNU timeout's exit status for a command that hit its limit
export const KILLED = 137;       // ... and 128+9 when it then had to KILL a child that ignored TERM (-k)
const positive = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
/** scripts/lib/row-ceilings.json: { default, rows: { "<check name>": seconds } }. A slow row names its own ceiling there, BY NAME (release-rows-for.mjs rowName: the index moves whenever a
 *  row is inserted, GT 2026-10-16: a ceiling keyed by index would land on the wrong check and put row 55 back at 600 s); every other row gets the default. */
export const rowCeilings = () => JSON.parse(readFileSync(new URL('./lib/row-ceilings.json', import.meta.url), 'utf8'));
/** The ceiling of ONE row: its own entry (by name) in the table wins; otherwise ROW_TIMEOUT_S (an override of the DEFAULT only), otherwise the table's default. */
export const rowCeilingS = (name, table = rowCeilings(), env = process.env.ROW_TIMEOUT_S) => positive(table.rows?.[String(name)]) ?? positive(env) ?? positive(table.default) ?? 600;

export function runGroup({ id, rows, event, retries = 1, dir = 'artifacts', run = defaultRun, rev = defaultRev, log = console.log, now = Date.now, ceilings = rowCeilings() }) {
  mkdirSync(dir, { recursive: true });
  const receipts = [];
  for (const row of [...rows].sort((a, b) => a.index - b.index)) {
    const argv = typeof row.argv === 'string' ? JSON.parse(row.argv) : row.argv;
    const ceiling = rowCeilingS(row.name, ceilings);   // this row's own ceiling (row-ceilings.json, by name) or the default
    let status = 1, seconds = 0, firstStatus = null, attempts = 0, timedOut = false;
    for (; attempts <= retries; attempts++) {
      if (attempts) log(`Retrying release check ${row.index} alone`);
      const t0 = now();
      status = run(argv, ceiling);
      seconds = Math.round((now() - t0) / 100) / 10;
      if (firstStatus === null) firstStatus = status;
      if (status === TIMED_OUT || (status === KILLED && seconds >= ceiling - 1)) {   // a hang is not retried: the group goes on to the next row (137 = timeout had to KILL a child that ignored TERM)
        status = TIMED_OUT;
        log(`check ${row.index} (${row.name}) hit the ${ceiling}s ceiling after ${seconds}s: the row process group was killed, FAILED, not retried`);
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
  if (failed.length) log(`::error::release rows FAILED in group ${id}: ${failed.map(r => `${r.index} (${r.name}, exit ${r.status}${r.timed_out ? `, timed out at the ${rowCeilingS(r.name, ceilings)}s ceiling` : ''})`).join(', ')}`);
  return { receipts, failed };
}

// GNU timeout runs the row in its own process group and, at the ceiling, sends TERM to the GROUP (timeout itself survives), then KILL 5 s later (-k) to a child that ignored it, so a grandchild
// (npx -> vite) dies with the row and cannot keep the job's pipes open (the GS row-56 hang). Exit 124 on a timeout, 137 when the KILL was needed. `-s KILL` from the start would kill timeout
// ITSELF with the group from the start; the -k KILL does the same when a child ignored TERM (spawnSync then sees signal SIGKILL, status null: mapped to a timeout below). The spawnSync timeout is only a backstop for timeout.
// Without `timeout` (not on the ubuntu runners' path, never seen) the plain spawnSync timeout still kills the row itself.
const defaultRun = (argv, secs = rowCeilingS('')) => {
  const env = { ...process.env, PG_BIN: process.env.PG_BIN };
  const r = spawnSync('timeout', ['-s', 'TERM', '-k', '5', String(secs), ...argv], { stdio: 'inherit', env, timeout: (secs + 30) * 1000, killSignal: 'SIGKILL' });
  if (r.error?.code === 'ETIMEDOUT') return TIMED_OUT;
  if (r.signal === 'SIGKILL') return TIMED_OUT;   // timeout had to send the final KILL to the group and died with it (a child ignored TERM): that is the ceiling
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
