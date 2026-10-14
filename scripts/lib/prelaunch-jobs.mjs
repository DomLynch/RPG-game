// Pre-launched Hugging Face jobs, owned by the candidate that started them (Dom 2026-10-11: freeze at cut, no orphaned HF jobs; 27 of 74 T4 jobs were orphaned in one day).
// scripts/pre-launch.sh writes <sha>.wall (the T4 jobs) and <sha>.cpu ("id,id;rows"); scripts/vps-shadow/launch.mjs adds the unit job to the .wall as `unitJob`.
//   node scripts/lib/prelaunch-jobs.mjs cancel-superseded <old sha> <new sha>   cancel the jobs of the ONE candidate the new cut replaces, rename its files *.cancelled
//   node scripts/lib/prelaunch-jobs.mjs orphans <published sha>      print the number of T4 jobs launched for candidates that never shipped (last 12 h)
import { existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
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
  if (hold) return { cancelled, skipped: 'a deploy is running (deploy_hold)' };
  const c = candidates(dir).find(x => x.sha === superseded);
  if (!c || c.cancelled || onTrunk(c.sha, trunk)) return { cancelled, skipped: c ? 'already cancelled or on trunk' : 'no pre-launch files for it' };
  for (const id of [...c.t4, ...c.other]) { cancel(id); cancelled.push(id); }   // a finished job refuses the cancel; nothing to do then
  for (const f of c.files) renameSync(f, `${f}.cancelled`);
  return { cancelled };
}

export function orphanedT4(publishedSha, { dir = dirOf(), trunk = 'origin/codex/01a09a76/task-1', now = Date.now() } = {}) {
  return candidates(dir).filter(c => c.sha !== publishedSha && now - c.mtime < 12 * 3600e3 && !onTrunk(c.sha, trunk)).reduce((n, c) => n + c.t4.length, 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, sha, newSha] = process.argv.slice(2);
  if (cmd === 'cancel-superseded') { const r = cancelSuperseded(sha, newSha); console.error(r.skipped ? `prelaunch-jobs: ${r.skipped}; nothing cancelled` : `prelaunch-jobs: cancelled ${r.cancelled.length} job(s) of superseded ${sha.slice(0, 9)}${r.cancelled.length ? ` (${r.cancelled.join(',')})` : ''}`); }
  else if (cmd === 'orphans') console.log(orphanedT4(sha));
  else { console.error('usage: prelaunch-jobs.mjs cancel-superseded <old sha> <new sha> | orphans <published sha>'); process.exit(2); }
}
