// Pre-launched Hugging Face jobs, owned by the candidate that started them (Dom 2026-10-11: freeze at cut, no orphaned HF jobs; 27 of 74 T4 jobs were orphaned in one day).
// scripts/pre-launch.sh writes <sha>.wall (the T4 jobs) and <sha>.cpu ("id,id;rows"); scripts/vps-shadow/launch.mjs adds the unit job to the .wall as `unitJob`.
//   node scripts/lib/prelaunch-jobs.mjs cancel-superseded <old sha> <new sha>   cancel the jobs of the ONE candidate the new cut replaces, rename its files *.cancelled
//   node scripts/lib/prelaunch-jobs.mjs orphans <published sha>      print the number of T4 jobs launched for candidates that never shipped (last 12 h)
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const dirOf = () => process.env.PRELAUNCH_DIR || `${process.env.HOME}/.claude/state/pre-launch`;
const ids = text => String(text || '').split(/[,\s;]/).filter(s => /^[0-9a-f]{24}$/.test(s));
const read = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };

export function recordUnitJob(dir, sha, id) {
  const file = `${dir}/${sha}.wall`, state = read(file);
  if (state && state.sha === sha && /^[0-9a-f]{24}$/.test(id)) writeFileSync(file, JSON.stringify({ ...state, unitJob: id }) + '\n');
}

/** Every candidate sha with pre-launch files, with its T4 jobs (wall), its other jobs (unit + cpu) and its files. A cancelled candidate keeps its jobs under the .cancelled name. */
export function candidates(dir = dirOf()) {
  const out = new Map();
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const m = /^([0-9a-f]{40})\.(wall|cpu)(\.cancelled)?$/.exec(name);
    if (!m) continue;
    const c = out.get(m[1]) ?? { sha: m[1], t4: [], other: [], files: [], cancelled: false, mtime: 0 };
    const file = `${dir}/${name}`, mtime = statSync(file).mtimeMs;
    if (m[2] === 'wall') { const s = read(file); c.t4.push(...ids(s?.jobId)); c.other.push(...ids(s?.unitJob)); } else c.other.push(...ids(readFileSync(file, 'utf8').split(';')[0]));
    c.files.push(file); c.cancelled ||= !!m[3]; c.mtime = Math.max(c.mtime, mtime); out.set(m[1], c);
  }
  return [...out.values()];
}

/** A sha that is on trunk shipped (or is shipping); only candidates that never got there can be orphans. */
const onTrunk = (sha, trunk) => spawnSync('git', ['merge-base', '--is-ancestor', sha, trunk], { timeout: 30_000 }).status === 0;

/** Cancel the jobs of ONE candidate: the sha this re-cut replaces, named by the caller (pre-launch.sh's third argument). Never another candidate: two releases can be in flight at once. */
export function cancelSuperseded(superseded, newSha, { dir = dirOf(), trunk = 'origin/codex/01a09a76/task-1', cancel = id => spawnSync('hf', ['jobs', 'cancel', id], { encoding: 'utf8', timeout: 60_000 }).status === 0, hold = existsSync(`${process.env.HOME}/.claude/state/deploy_hold`) } = {}) {
  /** @type {string[]} */ const cancelled = [];
  if (!/^[0-9a-f]{40}$/.test(String(superseded)) || superseded === newSha) return { cancelled, skipped: 'no superseded candidate named' };
  const c = candidates(dir).find(x => x.sha === superseded);
  // A re-cut during a publish used to be dropped here and the old candidate's jobs ran out (2026-10-18: IV's four T4 jobs). Leave a marker; `retry-superseded` (pre-launch.sh, next cut) cancels once the hold is gone.
  if (hold) { if (c && !c.cancelled && !onTrunk(c.sha, trunk)) writeFileSync(`${dir}/${superseded}.supersede`, `${newSha}\n`); return { cancelled, skipped: 'a deploy is running (deploy_hold)' }; }
  if (!c || c.cancelled || onTrunk(c.sha, trunk)) return { cancelled, skipped: c ? 'already cancelled or on trunk' : 'no pre-launch files for it' };
  for (const id of [...c.t4, ...c.other]) { cancel(id); cancelled.push(id); }   // a finished job refuses the cancel; nothing to do then
  for (const f of c.files) renameSync(f, `${f}.cancelled`);
  return { cancelled };
}

/** Cancels for re-cuts that were skipped under deploy_hold (one `<old sha>.supersede` marker each, holding the new sha). A marker goes once its cancel ran; while the hold is still up it stays. */
export function retrySuperseded(opts = {}) {
  const { dir = dirOf() } = opts, done = [];
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const m = /^([0-9a-f]{40})\.supersede$/.exec(name);
    if (!m) continue;
    const newSha = readFileSync(`${dir}/${name}`, 'utf8').trim(), r = cancelSuperseded(m[1], newSha, opts);
    if (!r.skipped?.startsWith('a deploy is running')) { rmSync(`${dir}/${name}`, { force: true }); done.push({ sha: m[1], cancelled: r.cancelled }); }
  }
  return done;
}

/** A release PR is open for this sha: a candidate in flight, not an orphan. The default says no (unit tests stay offline); the CLI passes the GitHub lookup. */
const prOpen = sha => { const r = spawnSync('gh', ['api', `repos/DomLynch/RPG-game/commits/${sha}/pulls`, '-q', '[.[] | select(.state == "open")] | length'], { encoding: 'utf8', timeout: 20_000 }); return r.status === 0 && Number(r.stdout.trim()) > 0; };

const orphanCandidates = (publishedSha, { dir = dirOf(), trunk = 'origin/codex/01a09a76/task-1', now = Date.now(), isOpen = () => false } = {}) =>
  candidates(dir).filter(c => c.sha !== publishedSha && now - c.mtime < 12 * 3600e3 && !onTrunk(c.sha, trunk) && !isOpen(c.sha));

export function orphanedT4(publishedSha, opts = {}) {
  return orphanCandidates(publishedSha, opts).reduce((n, c) => n + c.t4.length, 0);
}

const LIVE_STAGE = /^(RUNNING|STARTING|PENDING|SCHEDULING|QUEUED)$/;
const stageOf = id => { const r = spawnSync('hf', ['jobs', 'inspect', id], { encoding: 'utf8', timeout: 60_000 }); try { return [].concat(JSON.parse(r.stdout))[0]?.status?.stage || ''; } catch { return ''; } };

/** The orphans' T4 jobs that are still live on Hugging Face: money burning for a sha that did not ship. An unreadable job counts as live (cannot prove it stopped). */
export function runningOrphanT4(publishedSha, opts = {}, stage = stageOf) {
  const live = orphanCandidates(publishedSha, opts).flatMap(c => c.t4).filter(jid => { const s = stage(jid); return !s || LIVE_STAGE.test(s); });
  return { count: live.length, ids: live, text: `${live.length}${live.length ? ` (${live.join(',')})` : ''}` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, sha, newSha] = process.argv.slice(2);
  if (cmd === 'cancel-superseded') { const r = cancelSuperseded(sha, newSha); console.error(r.skipped ? `prelaunch-jobs: ${r.skipped}; nothing cancelled` : `prelaunch-jobs: cancelled ${r.cancelled.length} job(s) of superseded ${sha.slice(0, 9)}${r.cancelled.length ? ` (${r.cancelled.join(',')})` : ''}`); }
  else if (cmd === 'orphans') console.log(orphanedT4(sha, { isOpen: prOpen }));
  else if (cmd === 'running') console.log(runningOrphanT4(sha, { isOpen: prOpen }).text);
  else if (cmd === 'retry-superseded') { const r = retrySuperseded(); console.error(r.length ? `prelaunch-jobs: retried ${r.length} skipped cancel(s): ${r.map(x => `${x.sha.slice(0, 9)} (${x.cancelled.length} job(s))`).join(', ')}` : 'prelaunch-jobs: no skipped cancels waiting'); }
  else { console.error('usage: prelaunch-jobs.mjs cancel-superseded <old sha> <new sha> | orphans <published sha> | running <published sha> | retry-superseded'); process.exit(2); }
}
