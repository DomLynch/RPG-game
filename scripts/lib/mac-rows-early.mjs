// The Mac-only rows started at the CUT (Strategy + Lead 2026-10-12): scripts/mac-rows-early.sh runs ONLY row-placement's MAC_ROWS on a release candidate
// as soon as it opens, in its own checkout, under deploy.sh's Mac-rows lock, and records a tree-bound receipt here. deploy.sh then trusts those rows by
// TREE (waiting, bounded, while that run is still going) instead of running them last, and the Published summary shows the run's start and end.
//   receipt  ${PRELAUNCH_DIR:-~/.claude/state/pre-launch}/<sha>.macrows.json  { kind, sha, tree, rows: [passed], ran: [all run], started, ended, exit }
//   running  <sha>.macrows.running  { pid, sha, tree, started }  (removed by the runner's trap)
//   node scripts/lib/mac-rows-early.mjs rows                                   -> "2,4,22,…" (MAC_ROWS)
//   node scripts/lib/mac-rows-early.mjs record <sha> <tree> <checks.json> <started iso> <exit>   (the runner, after release-checks.mjs)
//   node scripts/lib/mac-rows-early.mjs trust <revision>                       -> stdout "rows|start|end" (empty: nothing to trust); a line on stderr
// Env: PRELAUNCH_DIR, MAC_ROWS_WAIT_S (trust: how long to wait for a run still going, default 0), MAC_ROWS_POLL_S (15).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAC_ROWS } from './row-placement.mjs';

export const stateDir = (env = process.env) => env.PRELAUNCH_DIR || `${env.HOME}/.claude/state/pre-launch`;
const readJson = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const alive = pid => { try { process.kill(Number(pid), 0); return true; } catch { return false; } };

/** The receipt for this tree (the newest by `ended`), or null. Only rows that passed are ever trusted. */
export function findReceipt(dir, tree) {
  if (!existsSync(dir)) return null;
  return readdirSync(dir).filter(f => f.endsWith('.macrows.json')).map(f => readJson(join(dir, f)))
    .filter(r => r?.kind === 'mac-rows-early' && r.tree === tree && Array.isArray(r.rows))
    .sort((a, b) => String(b.ended).localeCompare(String(a.ended)))[0] || null;
}

/** A live run for this tree (its pid alive), or null. */
export function runningFor(dir, tree) {
  if (!existsSync(dir)) return null;
  return readdirSync(dir).filter(f => f.endsWith('.macrows.running')).map(f => readJson(join(dir, f)))
    .find(r => r?.tree === tree && alive(r.pid)) || null;
}

/** Only a Mac row is ever vouched for by an early run (Auditor on #2353): whatever a receipt says, a non-Mac row runs where it always does. */
const macOnly = rows => rows.filter(r => MAC_ROWS.includes(Number(r)));

/** The receipt from release-checks.mjs's own receipt (RELEASE_CHECKS_RECEIPT): rows it ran, and the ones that passed (all of them when it exited 0). */
export function receiptFrom({ sha, tree, checks, started, ended, exit }) {
  const ran = (checks?.checks_detail || []).filter(d => !d.trusted && !d.out_of_scope).map(d => d.index);
  return { kind: 'mac-rows-early', sha, tree, rows: exit === 0 && checks?.passed ? macOnly(ran) : [], ran, started, ended, exit };
}

/** What deploy.sh trusts: a receipt for this tree; while a live run for it is still going, wait up to waitS (poll injectable).
 * @param {string} dir @param {string} tree @param {{ waitS?: number, pollS?: number, sleep?: (s: number) => unknown, now?: () => number }} [opts] */
export function trust(dir, tree, { waitS = 0, pollS = 15, sleep = s => spawnSync('sleep', [String(s)], { timeout: (s + 5) * 1000 }), now = () => Date.now() } = {}) {
  const deadline = now() + waitS * 1000;
  let receipt = findReceipt(dir, tree);
  while (!receipt && runningFor(dir, tree) && now() < deadline) { sleep(Math.max(1, Math.min(pollS, Math.ceil((deadline - now()) / 1000)))); receipt = findReceipt(dir, tree); }
  if (receipt) receipt = { ...receipt, rows: macOnly(receipt.rows) };
  if (receipt) return { receipt, why: `mac rows (early, from the cut): ${receipt.rows.length}/${receipt.ran.length} passed on tree ${tree.slice(0, 7)} (${receipt.sha.slice(0, 9)}), ${receipt.started} - ${receipt.ended}${receipt.rows.length < receipt.ran.length ? `; the rest run here` : ''}` };
  return { receipt: null, why: runningFor(dir, tree) ? `mac rows (early): still running after ${waitS}s; they run here` : 'mac rows (early): no run for this tree; they run here' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'rows') console.log(MAC_ROWS.join(','));
  else if (cmd === 'record') {
    const [sha, tree, checksFile, started, exit] = a;
    const r = receiptFrom({ sha, tree, checks: readJson(checksFile), started, ended: new Date().toISOString(), exit: Number(exit) });
    writeFileSync(join(stateDir(), `${sha}.macrows.json`), JSON.stringify(r) + '\n');
    console.log(`mac-rows-early: ${r.rows.length}/${r.ran.length} rows passed for ${sha.slice(0, 9)} (exit ${r.exit})`);
  } else if (cmd === 'trust') {
    const tree = spawnSync('git', ['rev-parse', `${a[0]}^{tree}`], { encoding: 'utf8', timeout: 10_000 }).stdout?.trim();
    if (!/^[0-9a-f]{40}$/.test(tree || '')) { console.error('mac rows (early): no tree for the revision; they run here'); process.exit(0); }
    const { receipt, why } = trust(stateDir(), tree, { waitS: Number(process.env.MAC_ROWS_WAIT_S || 0), pollS: Number(process.env.MAC_ROWS_POLL_S || 15) });
    console.error(why);
    if (receipt?.rows.length) process.stdout.write(`${receipt.rows.join(',')}|${receipt.started}|${receipt.ended}`);
  } else { console.error('usage: node scripts/lib/mac-rows-early.mjs rows | record <sha> <tree> <checks.json> <started> <exit> | trust <revision>'); process.exit(2); }
}
