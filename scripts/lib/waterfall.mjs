// The work waterfall's one router (Dom 2026-10-11). Mac = coding + WebKit rows only. Every heavy job goes to the VPS first; to Hugging Face CPU when the VPS is busy
// (1-minute load >= VPS_MAX_LOAD1) or has no room for the job; to the T4 only when the job needs graphics (gfx). A job never lands on the Mac from here, and a job
// without gfx never gets a T4. Pure decision (pickTarget) + one reader for the VPS (vpsStatus); the launchers call both, so the rule lives in one place.
// tests/waterfall.test.ts pins every branch and fails when a script starts a heavy job without going through here (shrink-only KNOWN list).
import { spawnSync } from 'node:child_process';

export const VPS_MAX_LOAD1 = 12;

// vps: { load1, freeRamMb } or null when the box cannot be read. mem: the job's RAM need in MB (default 0 = just a readable, quiet box).
export function pickTarget({ gfx = false, mem = 0, vps = null } = {}) {
  if (gfx) return 'hf-t4';
  const { load1, freeRamMb } = vps || {};
  if (!Number.isFinite(load1) || !Number.isFinite(freeRamMb)) return 'hf-cpu';
  return load1 < VPS_MAX_LOAD1 && freeRamMb >= mem ? 'vps' : 'hf-cpu';
}

// Output of: cut -d' ' -f1-3 /proc/loadavg; awk '/MemAvailable/{print $2}' /proc/meminfo   (two lines: loadavg, MemAvailable in kB).
export function parseVpsStatus(text) {
  const [loadLine = '', memLine = ''] = String(text || '').trim().split('\n');
  const load1 = Number(loadLine.trim().split(/\s+/)[0]), kb = Number(memLine.trim());
  return loadLine && memLine && Number.isFinite(load1) && Number.isFinite(kb) && kb >= 0 ? { load1, freeRamMb: Math.floor(kb / 1024) } : null;
}

// null = cannot read the VPS (the caller treats that as busy and spills to Hugging Face CPU).
export function vpsStatus({ host = process.env.VPS_HOST || 'root@49.12.7.18', key = process.env.VPS_KEY || `${process.env.HOME}/.ssh/binance_futures_tool`, run = spawnSync } = {}) {
  const r = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-i', key, host, "cat /proc/loadavg; awk '/MemAvailable/{print $2}' /proc/meminfo"], { encoding: 'utf8', timeout: 20_000 });
  return r.status === 0 ? parseVpsStatus(r.stdout) : null;
}
