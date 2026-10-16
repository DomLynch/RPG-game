// The Hugging Face cost ledger (Dom 2026-10-12): one line per HF job ANY launcher starts (one ledger for the account, Auditor HOLD on #2329), an alarm when the day passes HF_COST.alarmUsdPerDay,
// and no new T4 job once the day reaches HF_COST.t4StopUsdPerDay (CPU builds and unit receipts continue). The count starts from the ledger's own lines
// (no backfill). Every launcher reaches it through scripts/lib/hf-slots.mjs withSlot({ cost }), so there is one place that launches and one that counts.
//   line: <iso time>\t<job id>\t<flavor>\t<minutes>\t<usd>\t<reason>     minutes/usd are the job's UPPER bound (its own --timeout x USD_PER_HOUR), booked at launch
//   as a reservation: a bound that overcounts can only stop the T4 early, never late.
//   settle: `SETTLE\t<iso time>\t<job id>\t<flavor>\t<seconds>\t<usd>` once the launcher knows the job's real runtime (gpu-run reads it from the job log). The day's total then
//   counts that job at its settled USD on the reservation's day, not at its bound (Lead 2026-10-16: 25-min-timeout stills jobs that ran 194-259 s were booked at ~$0.25, not ~$0.04, and
//   tripped the stop on spend that never happened). A job never settled (no log, cancelled at its timeout) keeps its bound. The ledger stays append-only: several writers share it.
//   alarm: one `ALARM\t<day>\t<usd>` line the first time a day passes the alarm, a stderr line, and ~/.claude/state/hf-cost-alarm-<day>.json for the
//   COO's sweep (a script cannot message a session; the COO and Lead read the flag file).
// ONE ledger: /var/lib/frankendom/hf-cost-ledger.tsv on the VPS (dir 2775 root:lanes, so VPS root and the lanes user append to the same file); the Mac and
// any other host read and append it over the same ssh as the VPS unit runs. HF's own job list cannot stand in: it keeps the last 100 jobs (~6 h on 2026-10-12)
// and reports no timeout or end time. An unreadable ledger REFUSES a T4 (fail closed; CPU continues); a failed append is a stderr line (the job already started).
// Days are UTC. Env: HF_COST_LEDGER (a local file instead: tests, a host without the VPS), HF_COST_ALARM_DIR (where the flag file goes), VPS_HOST / VPS_KEY.
import { spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { USD_PER_HOUR } from '../hf-cleanup.mjs';
import { vpsHost } from './waterfall.mjs';
import LANE_PREFIXES from './lane-prefixes.json' with { type: 'json' };

export const HF_COST = Object.freeze({ alarmUsdPerDay: 3, t4StopUsdPerDay: 5 });
// Under `node --test` (NODE_TEST_CONTEXT, inherited by every child a test spawns) without an explicit HF_COST_LEDGER the ledger is a throwaway file:
// a test that launches through a stub hf must never write the real ledger (AGENTS.md: tests never read or write live box state).
export const ledgerPath = (env = process.env) => env.HF_COST_LEDGER
  || (env.NODE_TEST_CONTEXT ? join(tmpdir(), `hf-cost-ledger-test-${process.pid}.tsv`) : join(env.HOME || '.', '.claude', 'state', 'hf-cost-ledger.tsv'));
/** @typedef {{ where: string, read: () => string | null, append: (text: string) => boolean }} LedgerStore */
export const SHARED_LEDGER = '/var/lib/frankendom/hf-cost-ledger.tsv';
const day = ms => new Date(ms).toISOString().slice(0, 10);

/** A local ledger file. shared=true (the VPS's one ledger): its directory must already exist (set up once by root), else unreadable -> null. */
export function localStore(path, { shared = false } = {}) {
  return {
    where: path,
    read: () => { try { return existsSync(path) ? readFileSync(path, 'utf8') : (shared && !existsSync(dirname(path)) ? null : ''); } catch { return null; } },
    append: text => { try { const fresh = !existsSync(path); if (!shared) mkdirSync(dirname(path), { recursive: true }); appendFileSync(path, text); if (shared && fresh) chmodSync(path, 0o664); return true; } catch { return false; } },   // 664 whatever the umask: root's first line must leave it appendable for lanes
  };
}

/** The VPS's ledger from another host, over ssh. A missing ledger directory (exit 3) or a failed ssh reads as null. */
export function sshStore({ host = vpsHost(), key = process.env.VPS_KEY || `${process.env.HOME}/.ssh/binance_futures_tool`, run = spawnSync } = {}) {
  const ssh = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-i', key, host], f = SHARED_LEDGER, d = dirname(SHARED_LEDGER);
  return {
    where: `${host}:${f}`,
    read: () => { const r = run('ssh', [...ssh, `if [ -e ${f} ]; then cat ${f}; elif [ -d ${d} ]; then :; else exit 3; fi`], { encoding: 'utf8', timeout: 20_000 }); return r.status === 0 ? String(r.stdout || '') : null; },
    append: text => run('ssh', [...ssh, `[ -d ${d} ] && cat >> ${f}`], { input: text, encoding: 'utf8', timeout: 20_000 }).status === 0,
  };
}

/** Which ledger this process uses: HF_COST_LEDGER or a test file (local), the shared file on the VPS itself, else the VPS's over ssh. */
export function ledgerStore(env = process.env, { onVps = existsSync('/opt/frankendom'), ssh = () => sshStore() } = {}) {
  if (env.HF_COST_LEDGER || env.NODE_TEST_CONTEXT) return localStore(ledgerPath(env));
  return onVps ? localStore(SHARED_LEDGER, { shared: true }) : ssh();
}
/** @param {{ store?: LedgerStore, path?: string }} o @returns {LedgerStore} */
const storeOf = ({ store, path }) => store || (path ? localStore(path) : ledgerStore());

// WHO is spending (the ledger could not say: every row's reason was just "gpu-run", so the $5.29 of 2026-10-15 was untraceable). The caller's lane and branch go INSIDE the reason field (the tab format
// is unchanged): `<reason>;lane=<lane>;branch=<branch>`. Lane: FRANKENDOM_LANE, else the "Frankendom **<lane>** lane" line of CLAUDE.local.md in the repo the caller runs in, else the branch's prefix (scripts/lib/lane-prefixes.json: combat/ -> combat, release- -> deploy...); branch: git. Anything missing is
// "unknown-lane" / "unknown-branch", never an error: a ledger tag is never a reason to lose a job.
const slug = v => String(v).replace(/[^A-Za-z0-9._/-]+/g, '-').replace(/^-+|-+$/g, '') || null;
/** @param {{ env?: NodeJS.ProcessEnv, cwd?: string, run?: typeof spawnSync }} [o] @returns {{ lane: string, branch: string }} */
export function callerOf({ env = process.env, cwd = process.cwd(), run = spawnSync } = {}) {
  const git = args => { try { const r = run('git', args, { cwd, encoding: 'utf8', timeout: 10_000 }); return r.status === 0 ? String(r.stdout || '').trim() : ''; } catch { return ''; } };
  let lane = slug(env.FRANKENDOM_LANE || '');
  if (!lane) { try { lane = slug(/Frankendom \*\*([^*]+)\*\* lane/i.exec(readFileSync(join(git(['rev-parse', '--show-toplevel']) || cwd, 'CLAUDE.local.md'), 'utf8'))?.[1] ?? ''); } catch { /* no CLAUDE.local.md here */ } }
  let branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch === 'HEAD') branch = `detached-${git(['rev-parse', '--short', 'HEAD'])}`;
  lane ||= LANE_PREFIXES.lanePrefixes.find((r) => branch.startsWith(r.prefix))?.lane ?? null;   // a VPS clone has neither CLAUDE.local.md nor the env var: its branch prefix says whose it is
  return { lane: lane || 'unknown-lane', branch: slug(branch) || 'unknown-branch' };
}
/** The reason column for a job: the launcher's own reason plus who launched it. */
export const taggedReason = (reason, opts) => { const { lane, branch } = callerOf(opts); return `${String(reason || 'none').replace(/\s+/g, '-')};lane=${lane};branch=${branch}`; };

/** "45m" | "2h" | "600s" | "600" -> seconds (NaN when unreadable). */
export function timeoutSeconds(text) {
  const m = /^(\d+(?:\.\d+)?)\s*([smh]?)$/.exec(String(text ?? '').trim());
  return m ? Number(m[1]) * ({ s: 1, m: 60, h: 3600, '': 1 })[m[2]] : NaN;
}

/** The USD the ledger holds for the day of `now`: each job line of that day at its SETTLE line's USD when it has one, else at its reserved bound. */
export function spentOn(text, now = Date.now()) {
  const today = day(now), rows = text.split('\n').map(line => line.split('\t'));
  const settled = new Map(rows.filter(f => f.length === 6 && f[0] === 'SETTLE').map(f => [f[2], Number(f[5]) || 0]));
  return rows.filter(f => f.length === 6 && f[0].slice(0, 10) === today && f[0] !== 'ALARM' && f[0] !== 'SETTLE')
    .reduce((sum, f) => sum + (settled.has(f[1]) ? settled.get(f[1]) : (Number(f[4]) || 0)), 0);
}

/** Settles a reserved job to its real runtime: appends one SETTLE line, so spentOn counts the job at `seconds` x USD_PER_HOUR instead of its --timeout bound.
 * A bad id or runtime records nothing (the bound stands, the safe side). Returns { usd } or null.
 * @param {{ id: string, flavor: string, seconds: number }} job @param {{ store?: LedgerStore, path?: string, now?: number, say?: (m: string) => void }} [opts] */
export function settle({ id, flavor, seconds }, { store, path, now = Date.now(), say = m => console.error(m) } = {}) {
  if (!id || !Number.isFinite(seconds) || seconds < 0) return null;
  const ledger = storeOf({ store, path }), usd = (USD_PER_HOUR[flavor] ?? USD_PER_HOUR['t4-medium']) * seconds / 3600;
  if (!ledger.append(`SETTLE\t${new Date(now).toISOString()}\t${id}\t${flavor}\t${Math.round(seconds)}\t${usd.toFixed(4)}\n`)) say(`hf-cost: could not settle job ${id} in ${ledger.where}; it stays counted at its --timeout bound`);
  return { usd };
}

/** null, or why this launch is refused: a T4 job once the day has reached the stop, or when the ledger cannot be read (fail closed).
 * @param {string} flavor @param {{ store?: LedgerStore, path?: string, now?: number }} [opts] */
export function t4Refusal(flavor, { store, path, now = Date.now() } = {}) {
  if (!String(flavor).startsWith('t4')) return null;
  const ledger = storeOf({ store, path }), text = ledger.read();
  if (text === null) return `hf-cost: the HF cost ledger (${ledger.where}) cannot be read: no new T4 job until it can (CPU jobs continue). One-time setup on the VPS as root: install -d -m 2775 -g lanes ${dirname(SHARED_LEDGER)} && install -m 664 -g lanes /dev/null ${SHARED_LEDGER}`;
  const spent = spentOn(text, now);
  return spent >= HF_COST.t4StopUsdPerDay ? `hf-cost: $${spent.toFixed(2)} spent on HF today (UTC ${day(now)}), at or over the $${HF_COST.t4StopUsdPerDay} T4 stop: no new T4 job (CPU jobs continue)` : null;
}

/** Appends one job line; on the first crossing of the alarm that day, the ALARM line, a stderr line and the flag file. Returns { usd, total, alarm }.
 * @param {{ id: string, flavor: string, timeout?: string, reason?: string }} job @param {{ store?: LedgerStore, path?: string, now?: number, alarmDir?: string, say?: (m: string) => void }} [opts] */
export function record({ id, flavor, timeout, reason }, { store, path, now = Date.now(), alarmDir = process.env.HF_COST_ALARM_DIR || (path ? dirname(path) : join(process.env.HOME || '.', '.claude', 'state')), say = m => console.error(m) } = {}) {
  const ledger = storeOf({ store, path });
  const seconds = timeoutSeconds(timeout), minutes = Number.isFinite(seconds) ? seconds / 60 : 60;   // an unreadable timeout counts as an hour
  const usd = (USD_PER_HOUR[flavor] ?? USD_PER_HOUR['t4-medium']) * minutes / 60;
  const before = ledger.read() ?? '', spentBefore = spentOn(before, now), total = spentBefore + usd;
  const line = `${new Date(now).toISOString()}\t${id}\t${flavor}\t${minutes.toFixed(0)}\t${usd.toFixed(4)}\t${String(reason || 'none').replace(/\s+/g, '-')}\n`;
  if (!ledger.append(line)) say(`hf-cost: could not append job ${id} to ${ledger.where}; it is NOT counted in today's total`);
  const alarm = total >= HF_COST.alarmUsdPerDay && !before.split('\n').some(l => l.startsWith(`ALARM\t${day(now)}\t`));
  if (alarm) {
    ledger.append(`ALARM\t${day(now)}\t${total.toFixed(2)}\n`);
    mkdirSync(alarmDir, { recursive: true });
    writeFileSync(join(alarmDir, `hf-cost-alarm-${day(now)}.json`), JSON.stringify({ day: day(now), usd: Number(total.toFixed(2)), alarmAt: HF_COST.alarmUsdPerDay, t4StopAt: HF_COST.t4StopUsdPerDay, lastJob: id }) + '\n');
    say(`HF COST ALARM: $${total.toFixed(2)} on HF today (UTC ${day(now)}) passed $${HF_COST.alarmUsdPerDay}; the T4 stops at $${HF_COST.t4StopUsdPerDay}. COO and Lead: ${join(alarmDir, `hf-cost-alarm-${day(now)}.json`)}`);
  }
  return { usd, total, alarm };
}

// `node scripts/lib/hf-ledger.mjs record <job id> <flavor> <timeout> <reason>`: the same record for a launcher that is not node (scripts/capture-mac.sh).
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, id, flavor, timeout, reason] = process.argv.slice(2);
  if (cmd !== 'record' || !id || !flavor) { console.error('usage: node scripts/lib/hf-ledger.mjs record <job id> <flavor> <timeout> <reason>'); process.exit(2); }
  record({ id, flavor, timeout, reason: taggedReason(reason) });
}
