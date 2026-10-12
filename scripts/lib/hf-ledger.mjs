// The Hugging Face cost ledger (Dom 2026-10-12): one line per HF job this machine launches, an alarm when the day passes HF_COST.alarmUsdPerDay,
// and no new T4 job once the day reaches HF_COST.t4StopUsdPerDay (CPU builds and unit receipts continue). The count starts from the ledger's own lines
// (no backfill). Every launcher reaches it through scripts/lib/hf-slots.mjs withSlot({ cost }), so there is one place that launches and one that counts.
//   line: <iso time>\t<job id>\t<flavor>\t<minutes>\t<usd>\t<reason>     minutes/usd are the job's UPPER bound (its own --timeout x USD_PER_HOUR):
//   hf reports no end time for a finished job, and a bound that overcounts can only stop the T4 early, never late.
//   alarm: one `ALARM\t<day>\t<usd>` line the first time a day passes the alarm, a stderr line, and ~/.claude/state/hf-cost-alarm-<day>.json for the
//   COO's sweep (a script cannot message a session; the COO and Lead read the flag file).
// Days are UTC. Env: HF_COST_LEDGER (the file), HF_COST_ALARM_DIR (where the flag file goes).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { USD_PER_HOUR } from '../hf-cleanup.mjs';

export const HF_COST = Object.freeze({ alarmUsdPerDay: 3, t4StopUsdPerDay: 5 });
// Under `node --test` (NODE_TEST_CONTEXT, inherited by every child a test spawns) without an explicit HF_COST_LEDGER the ledger is a throwaway file:
// a test that launches through a stub hf must never write the real ledger (AGENTS.md: tests never read or write live box state).
export const ledgerPath = (env = process.env) => env.HF_COST_LEDGER
  || (env.NODE_TEST_CONTEXT ? join(tmpdir(), `hf-cost-ledger-test-${process.pid}.tsv`) : join(env.HOME || '.', '.claude', 'state', 'hf-cost-ledger.tsv'));
const day = ms => new Date(ms).toISOString().slice(0, 10);
const read = path => (existsSync(path) ? readFileSync(path, 'utf8') : '');

/** "45m" | "2h" | "600s" | "600" -> seconds (NaN when unreadable). */
export function timeoutSeconds(text) {
  const m = /^(\d+(?:\.\d+)?)\s*([smh]?)$/.exec(String(text ?? '').trim());
  return m ? Number(m[1]) * ({ s: 1, m: 60, h: 3600, '': 1 })[m[2]] : NaN;
}

/** The USD the ledger holds for the day of `now` (job lines only). */
export function spentOn(text, now = Date.now()) {
  const today = day(now);
  return text.split('\n').map(line => line.split('\t')).filter(f => f.length === 6 && f[0].slice(0, 10) === today && f[0] !== 'ALARM')
    .reduce((sum, f) => sum + (Number(f[4]) || 0), 0);
}

/** null, or why this launch is refused: a T4 job once the day has reached the stop. */
export function t4Refusal(flavor, { path = ledgerPath(), now = Date.now() } = {}) {
  if (!String(flavor).startsWith('t4')) return null;
  const spent = spentOn(read(path), now);
  return spent >= HF_COST.t4StopUsdPerDay ? `hf-cost: $${spent.toFixed(2)} spent on HF today (UTC ${day(now)}), at or over the $${HF_COST.t4StopUsdPerDay} T4 stop: no new T4 job (CPU jobs continue)` : null;
}

/** Appends one job line; on the first crossing of the alarm that day, the ALARM line, a stderr line and the flag file. Returns { usd, total, alarm }. */
export function record({ id, flavor, timeout, reason }, { path = ledgerPath(), now = Date.now(), alarmDir = process.env.HF_COST_ALARM_DIR || dirname(path), say = m => console.error(m) } = {}) {
  const seconds = timeoutSeconds(timeout), minutes = Number.isFinite(seconds) ? seconds / 60 : 60;   // an unreadable timeout counts as an hour
  const usd = (USD_PER_HOUR[flavor] ?? USD_PER_HOUR['t4-medium']) * minutes / 60;
  const before = read(path), spentBefore = spentOn(before, now), total = spentBefore + usd;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${new Date(now).toISOString()}\t${id}\t${flavor}\t${minutes.toFixed(0)}\t${usd.toFixed(4)}\t${String(reason || 'none').replace(/\s+/g, '-')}\n`);
  const alarm = total >= HF_COST.alarmUsdPerDay && !before.split('\n').some(l => l.startsWith(`ALARM\t${day(now)}\t`));
  if (alarm) {
    appendFileSync(path, `ALARM\t${day(now)}\t${total.toFixed(2)}\n`);
    mkdirSync(alarmDir, { recursive: true });
    writeFileSync(join(alarmDir, `hf-cost-alarm-${day(now)}.json`), JSON.stringify({ day: day(now), usd: Number(total.toFixed(2)), alarmAt: HF_COST.alarmUsdPerDay, t4StopAt: HF_COST.t4StopUsdPerDay, lastJob: id }) + '\n');
    say(`HF COST ALARM: $${total.toFixed(2)} on HF today (UTC ${day(now)}) passed $${HF_COST.alarmUsdPerDay}; the T4 stops at $${HF_COST.t4StopUsdPerDay}. COO and Lead: ${join(alarmDir, `hf-cost-alarm-${day(now)}.json`)}`);
  }
  return { usd, total, alarm };
}
