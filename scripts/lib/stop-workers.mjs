// Test workers for the lane Stop gate (Lead, 2026-10-09): node --test defaults to every core but one, and nine lanes' Stop gates on the
// shared Mac drove the load to 80. QUALITY_STOP_WORKERS (a whole number 1..64) overrides; anything else is the default, 2.
import process from 'node:process';

export const STOP_WORKERS_DEFAULT = 2;
export const stopWorkers = (env = process.env) => {
  const v = String(env.QUALITY_STOP_WORKERS ?? '').trim();
  return /^[1-9][0-9]?$/.test(v) && Number(v) <= 64 ? Number(v) : STOP_WORKERS_DEFAULT;
};
