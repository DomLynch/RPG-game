// The ONE place a receipt job is launched and read back (the verifier, scripts/lib/vps-receipts.mjs jobVerified, compares the job's command with jobCommand()).
//   node scripts/vps-shadow/launch.mjs unit|rows <full sha> [cpu-upgrade|t4-medium] [rows e.g. 31,33] [width 1-8, RELEASE_CHECK_CONCURRENCY; default 4]   -> prints the Hugging Face job id
//   node scripts/vps-shadow/launch.mjs fetch <job id> <full sha>                      -> writes artifacts/vps-shadow/<sha>/unit.json | rows-<job>.json
// Always --detach and a --timeout (Dom's cost rule: 40m unit suite, 20m a rows shard); flavors cpu-upgrade or t4-medium only. LAUNCH_DRY=1 prints the hf command.
// The job prints one `RECEIPT unit|rows <json>` line at rc 0 (run-unit.sh / run-rows.sh); `fetch` copies it out of `hf jobs logs`. Trust is not decided here:
// vps-receipt-trust.mjs still inspects the job (completed, flavor, SHA env, canonical command) and binds the receipt's sha to the deploy tree.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { FLAVORS, jobCommand } from '../lib/vps-receipts.mjs';

export const hfArgs = (kind, sha, flavor = 'cpu-upgrade', rows = '', width = '') => {
  if (width && (kind !== 'rows' || !/^[1-8]$/.test(width))) throw new Error('width must be 1-8 and only for kind rows');
  if (rows && (kind !== 'rows' || !/^\d+(,\d+)*$/.test(rows))) throw new Error('rows must be a comma list of row numbers and only for kind rows');
  if (kind !== 'unit' && kind !== 'rows') throw new Error('kind must be unit or rows');
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('sha must be the full 40-hex commit');
  if (!FLAVORS.includes(flavor)) throw new Error(`flavor must be one of ${FLAVORS.join(', ')}`);
  const [bash, dashC, script] = jobCommand(kind, sha);
  return ['jobs', 'run', '--flavor', flavor, '--timeout', kind === 'unit' ? '40m' : '20m', '--detach', '-e', `SHA=${sha}`, ...(rows ? ['-e', `ROWS_ONLY=${rows}`] : []), ...(width ? ['-e', `RELEASE_CHECK_CONCURRENCY=${width}`] : []), 'node:22', bash, dashC, script];
};
export const receiptFrom = (logs, kind) => {
  const line = String(logs).split('\n').reverse().find(l => l.startsWith(`RECEIPT ${kind} `));
  try { return line ? JSON.parse(line.slice(`RECEIPT ${kind} `.length)) : null; } catch { return null; }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b, c] = process.argv.slice(2);
  try {
    if (cmd === 'fetch') {
      const logs = spawnSync('hf', ['jobs', 'logs', a], { encoding: 'utf8', timeout: 120_000, maxBuffer: 64 << 20 });
      if (logs.error || logs.status !== 0) throw new Error(`hf jobs logs ${a} failed`);
      const unit = receiptFrom(logs.stdout, 'unit'), rows = receiptFrom(logs.stdout, 'rows'), receipt = unit || rows;
      if (!receipt || receipt.job !== a || receipt.sha !== b) throw new Error(`no RECEIPT line for job ${a} sha ${b} (a failed run prints none)`);
      const dir = `artifacts/vps-shadow/${b}`; mkdirSync(dir, { recursive: true });
      const file = `${dir}/${unit ? 'unit.json' : `rows-${a}.json`}`; writeFileSync(file, JSON.stringify(receipt, null, 1) + '\n');
      console.log(file);
    } else {
      const args = hfArgs(cmd, a, b, c, process.argv[6]);
      if (process.env.LAUNCH_DRY) console.log(['hf', ...args].map(x => JSON.stringify(x)).join(' '));
      else { const r = spawnSync('hf', args, { encoding: 'utf8', timeout: 60_000 }); process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || ''); process.exit(r.status ?? 1); }
    }
  } catch (e) { console.error(`launch: ${e.message}`); process.exit(2); }
}
