// The work waterfall's one router (Dom 2026-10-11). Mac = coding + WebKit rows only. Every heavy job goes to the VPS first; to Hugging Face CPU when the VPS is busy
// (1-minute load >= VPS_MAX_LOAD1) or has no room for the job; to the T4 only when the job needs graphics (gfx). A job never lands on the Mac from here, and a job
// without gfx never gets a T4. Pure decision (pickTarget) + one reader for the VPS (vpsStatus); the launchers call both, so the rule lives in one place.
// tests/waterfall.test.ts pins every branch and fails when a script starts a heavy job without going through here (shrink-only KNOWN list).
import { spawnSync } from 'node:child_process';
import { FLAVORS, JOB_IMAGE, SLOW_CEILING_S, SLOW_ROWS, genericJobCommand, jobCommand } from './vps-receipts.mjs';

export const VPS_MAX_LOAD1 = 12;
// The remote command vpsStatus runs: loadavg, MemAvailable (kB), and the live release run dirs. A run dir is the release lock; one older than 90 minutes is a crashed run and stops counting.
export const VPS_STATUS_CMD = "cat /proc/loadavg; awk '/MemAvailable/{print $2}' /proc/meminfo; find /root/deploy-runs -mindepth 1 -maxdepth 1 -type d -mmin -90 2>/dev/null | wc -l";

// vps: { load1, freeRamMb } or null when the box cannot be read. mem: the job's RAM need in MB (default 0 = just a readable, quiet box).
/** @param {{ gfx?: boolean, mem?: number, lane?: boolean, vps?: { load1: number, freeRamMb: number, releaseRuns?: number } | null }} [job] @returns {'vps' | 'hf-cpu' | 'hf-t4'} */
export function pickTarget({ gfx = false, mem = 0, vps = null, lane = false } = {}) {
  if (gfx) return 'hf-t4';
  const { load1, freeRamMb, releaseRuns = 0 } = vps || {};
  if (!Number.isFinite(load1) || !Number.isFinite(freeRamMb)) return 'hf-cpu';
  if (lane && releaseRuns > 0) return 'hf-cpu';   // a RELEASE run owns the VPS while it runs (Strategy 2026-10-11): a lane job never shares the box with one; a release never waits behind a lane job
  return load1 < VPS_MAX_LOAD1 && freeRamMb >= mem ? 'vps' : 'hf-cpu';
}

// Output of vpsStatus's remote command: /proc/loadavg, MemAvailable in kB, and the number of live release run dirs under /root/deploy-runs (a release run's dir exists only while it runs: it IS the lock).
export function parseVpsStatus(text) {
  const [loadLine = '', memLine = '', runsLine = '0'] = String(text || '').trim().split('\n');
  const load1 = Number(loadLine.trim().split(/\s+/)[0]), kb = Number(memLine.trim()), releaseRuns = Number(runsLine.trim() || 0);
  return loadLine && memLine && Number.isFinite(load1) && Number.isFinite(kb) && kb >= 0 && Number.isInteger(releaseRuns) && releaseRuns >= 0 ? { load1, freeRamMb: Math.floor(kb / 1024), releaseRuns } : null;
}

// null = cannot read the VPS (the caller treats that as busy and spills to Hugging Face CPU).
/** The VPS login: VPS_HOST may be a bare address in some shells (this Mac's is), so a missing user means root. */
export const vpsHost = (env = process.env) => { const h = env.VPS_HOST || '49.12.7.18'; return h.includes('@') ? h : `root@${h}`; };

export function vpsStatus({ host = vpsHost(), key = process.env.VPS_KEY || `${process.env.HOME}/.ssh/binance_futures_tool`, run = spawnSync } = {}) {
  const r = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-i', key, host, VPS_STATUS_CMD], { encoding: 'utf8', timeout: 20_000 });
  return r.status === 0 ? parseVpsStatus(r.stdout) : null;
}

// ---- the Hugging Face argument builders: the ONLY place an `hf jobs run` command line is made (launch.mjs re-exports them and spawns the result under withSlot) ----
export const hfArgs = (kind, sha, flavor = 'cpu-upgrade', rows = '', width = '') => {
  if (width && (kind !== 'rows' || !/^[1-8]$/.test(width))) throw new Error('width must be 1-8 and only for kind rows');
  if (rows && (kind !== 'rows' || !/^\d+(,\d+)*$/.test(rows))) throw new Error('rows must be a comma list of row numbers and only for kind rows');
  if (kind !== 'unit' && kind !== 'rows') throw new Error('kind must be unit or rows');
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('sha must be the full 40-hex commit');
  if (!FLAVORS.includes(flavor)) throw new Error(`flavor must be one of ${FLAVORS.join(', ')}`);
  const slow = rows ? rows.split(',').map(Number).filter(n => SLOW_ROWS.includes(n)) : [];
  if (slow.length && (rows.includes(',') || width !== '1' || flavor !== 'cpu-upgrade')) throw new Error(`rows ${slow.join(',')} are slow rows: one row per job, width 1, cpu-upgrade`);
  const [bash, dashC, script] = jobCommand(kind, sha);
  return ['jobs', 'run', '--flavor', flavor, '--timeout', kind === 'unit' ? '40m' : slow.length ? '35m' : '20m', '--detach', '-e', `SHA=${sha}`, ...(rows ? ['-e', `ROWS_ONLY=${rows}`] : []), ...(width ? ['-e', `RELEASE_CHECK_CONCURRENCY=${width}`] : []), ...(slow.length ? ['-e', `RELEASE_CHECK_CEILING_S=${SLOW_CEILING_S}`] : []), JOB_IMAGE, bash, dashC, script];
};

// `launch.mjs job <sha40> [--gfx] [--lane L] [--timeout 40m] [--max-wait-s 600] -- <argv…>`: a lane's job at a sha on HF (work waterfall, Hooks Dev's submit path).
// hf-cpu (cpu-upgrade) by default; --gfx = hf-t4 (t4-medium), graphics only: a job without --gfx never gets a T4. Exit 0 started, 75 no slot in --max-wait-s (the caller
// requeues to the VPS), 2 refused. Lane jobs use their own ledger (artifacts/hf-lane-jobs), never the release ledger deploy.sh's exit cleanup reads.
export function genericJobArgs(argv) {
  const dd = argv.indexOf('--');
  if (dd < 0 || dd === argv.length - 1) throw new Error('usage: launch.mjs job <sha40> [--gfx] [--lane L] [--timeout 40m] [--max-wait-s 600] -- <command…>');
  const [sha, ...flags] = argv.slice(0, dd), cmd = argv.slice(dd + 1);
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('sha must be the full 40-hex commit');
  const opts = { gfx: false, lane: 'lane', timeout: '40m', maxWaitS: 600, env: [] };
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if (f === '--gfx') opts.gfx = true;
    else if (f === '--lane') opts.lane = String(flags[++i] ?? '');
    else if (f === '--timeout') opts.timeout = String(flags[++i] ?? '');
    else if (f === '--max-wait-s') opts.maxWaitS = Number(flags[++i]);
    else if (f === '--env') opts.env.push(String(flags[++i] ?? ''));
    else throw new Error(`unknown flag ${f}`);
  }
  for (const kv of opts.env) {   // repeatable; values are NOT secret (hf shows a job's env), so no tokens here
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/s.exec(kv);
    if (!m) throw new Error(`--env needs KEY=VALUE with an upper-case key, got "${kv}"`);
    if (['SHA', 'LANE', 'JOB_ARGV_B64'].includes(m[1]) || /TOKEN|SECRET|PASSWORD|KEY/.test(m[1])) throw new Error(`--env ${m[1]} is reserved or looks like a secret`);
  }
  if (!/^\d+[mh]$/.test(opts.timeout)) throw new Error('--timeout must look like 40m or 2h');
  if (!/^[\w.-]{1,40}$/.test(opts.lane)) throw new Error('--lane must be a short word');
  if (!Number.isFinite(opts.maxWaitS) || opts.maxWaitS < 0 || opts.maxWaitS > 3600) throw new Error('--max-wait-s must be 0-3600');
  const flavor = opts.gfx ? 't4-medium' : 'cpu-upgrade', [bash, dashC, script] = genericJobCommand(sha);
  const args = ['jobs', 'run', '--flavor', flavor, '--timeout', opts.timeout, '--detach', '-e', `SHA=${sha}`, '-e', `LANE=${opts.lane}`, '-e', `JOB_ARGV_B64=${Buffer.from(cmd.join(' ')).toString('base64')}`, ...opts.env.flatMap(kv => ['-e', kv]), JOB_IMAGE, bash, dashC, script];
  return { args, flavor, opts, sha };
}
