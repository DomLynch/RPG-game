// The last step of every release, pass or fail (Dom 2026-10-09: "nothing is left running"): cancel every Hugging Face job this release launched that is still
// running, then log "HF: N jobs, 0 running, <=$X.XX". Jobs are jobs (never a Space or an endpoint). launch.mjs appends each job it starts to the ledger.
//   node scripts/hf-cleanup.mjs            cancel what is running, print the line; exit 1 (a red line in the log) if anything is still running
// The ledger is one file per launched sha (artifacts/hf-jobs/<sha>.ledger); a finished cleanup renames each to .done, so the next release counts only its own jobs.
// Env: HF_BIN (the hf binary; tests stub it), HF_LEDGER_DIR (the ledger folder).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync } from 'node:fs';

export const LEDGER_DIR = process.env.HF_LEDGER_DIR || 'artifacts/hf-jobs';
const ledgerFiles = () => (existsSync(LEDGER_DIR) ? readdirSync(LEDGER_DIR).filter(f => f.endsWith('.ledger')).map(f => `${LEDGER_DIR}/${f}`) : []);
export const USD_PER_HOUR = { 'cpu-upgrade': 0.03, 'cpu-basic': 0.01, 't4-medium': 0.6 };
const LIVE = /^(RUNNING|STARTING|PENDING|SCHEDULING|QUEUED)$/;
const hf = args => { try { return execFileSync(process.env.HF_BIN || 'hf', args, { encoding: 'utf8', timeout: 60_000 }); } catch { return ''; } };
const inspect = id => { try { const parsed = JSON.parse(hf(['jobs', 'inspect', id])); return [].concat(parsed)[0] || null; } catch { return null; } };

export const ledgerJobs = (text = ledgerFiles().map(file => readFileSync(file, 'utf8')).join('\n')) =>
  text.split('\n').map(line => line.trim().split(/\s+/)).filter(([id]) => /^[0-9a-f]{24}$/.test(id || '')).map(([id, timeoutS]) => ({ id, timeoutS: Number(timeoutS) || 0 }));

// Upper bound on spend: price x min(time since the job was created, its own --timeout). hf reports no end time for a finished job.
export const costOf = (info, timeoutS, now = Date.now()) => {
  const started = Date.parse(String(info?.created_at || '').replace(' ', 'T'));
  if (!Number.isFinite(started)) return 0;
  const seconds = Math.max(0, (now - started) / 1000), capped = timeoutS > 0 ? Math.min(seconds, timeoutS) : seconds;
  return (USD_PER_HOUR[info.flavor] ?? USD_PER_HOUR['t4-medium']) * capped / 3600;
};

export function cleanup(jobs = ledgerJobs()) {
  let total = 0, running = 0;
  for (const { id, timeoutS } of jobs) {
    let info = inspect(id);
    if (info && LIVE.test(info.status?.stage || '')) { hf(['jobs', 'cancel', id]); info = inspect(id) || info; }
    if (!info || LIVE.test(info.status?.stage || '')) running += 1;   // unknown counts as running: the red line is for a job we could not prove is stopped
    total += info ? costOf(info, timeoutS) : 0;
  }
  if (!running) for (const file of ledgerFiles()) renameSync(file, `${file}.done`.replace('.ledger.done', '.done'));
  const line = `HF: ${jobs.length} jobs, ${running} running, <=$${total.toFixed(2)}`;
  return { line, running };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { line, running } = cleanup();
  if (running) { console.error(`RED LINE ${line}`); process.exit(1); }
  console.log(line);
}
