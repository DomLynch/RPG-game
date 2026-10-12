// The ONE place a receipt job is launched and read back (the verifier, scripts/lib/vps-receipts.mjs jobVerified, compares the job's command with jobCommand()).
//   node scripts/vps-shadow/launch.mjs unit|rows <full sha> [cpu-upgrade|t4-medium] [rows e.g. 31,33] [width 1-8, RELEASE_CHECK_CONCURRENCY; default 4]   -> prints the Hugging Face job id
//   node scripts/vps-shadow/launch.mjs fetch <job id> <full sha>                      -> writes artifacts/vps-shadow/<sha>/unit.json | rows-<job>.json
// Always --detach and a --timeout (Dom's cost rule: 40m unit suite, 20m a rows shard); flavors cpu-upgrade or t4-medium only. LAUNCH_DRY=1 prints the hf command.
// The job prints one `RECEIPT unit|rows <json>` line at rc 0 (run-unit.sh / run-rows.sh); `fetch` copies it out of `hf jobs logs`. Trust is not decided here:
// vps-receipt-trust.mjs still inspects the job (completed, flavor, SHA env, canonical command) and binds the receipt's sha to the deploy tree.
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { FLAVORS, JOB_IMAGE, SLOW_CEILING_S, SLOW_ROWS, coverageGaps, genericJobCommand, jobCommand } from '../lib/vps-receipts.mjs';
import { tierLine, withSlot } from '../lib/hf-slots.mjs';
import { genericJobArgs, hfArgs, pickTarget, vpsStatus } from '../lib/waterfall.mjs';
import { runUnitOnVps } from '../lib/vps-unit.mjs';
import { runRowsOnVps } from '../lib/vps-rows.mjs';
import { selectWallRows } from '../lib/hf-wall-rows.mjs';
import { MAC_ONLY, ON_T4 } from '../lib/row-placement.mjs';
import { recordUnitJob } from '../lib/prelaunch-jobs.mjs';

// Rows that hit the 600 s per-row ceiling on cpu-upgrade even alone (Backend's width-1 probe, 2026-10-08), or cannot run in the container at all (13: initdb refuses root).
// Sharding one of them loses the whole shard to the job timeout, so every flavor refuses them. The t4-medium trial of 5/7/16 (HF job 6ac7f57efee2c9007016dd66, 2026-10-09) hit the 600 s ceiling on all three too: they are not GPU-bound in this container.
export { SLOW_ROWS };   // the one list lives in scripts/lib/vps-receipts.mjs (the coverage gate reads it too)

const openLog = file => { mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true }); return openSync(file, 'a'); };
export { hfArgs, genericJobArgs };   // the `hf jobs run` argument builders live in scripts/lib/waterfall.mjs (the one place that starts heavy jobs)

// A release job (unit/rows) waits at most this long for a slot; the parent that spawns a `rows` child must outlive the child's WHOLE budget (slot wait + the hf call + the
// post-launch rank check + the cancel), or it kills the child between `hf jobs run` and the id line and leaves a job nobody ledgered (Auditor on #2079).
export const RELEASE_SLOT_WAIT_S = 300;
export const ROWS_CHILD_TIMEOUT_MS = (RELEASE_SLOT_WAIT_S + 60 + 60 + 60 + 60 + 60) * 1000;   // wait + one lock wait + the hf call + the rank check's ps + the cancel + 60 s margin (Auditor LOW on #2079: 540 -> 600)
// The CPU rows of a release (deploy.sh, before the quality gate): every row a CPU box may vouch for that is not Mac-only, slow, a T4 wall row or on ON_T4
// (scripts/hf-wall-rows.mjs takes those) or in `skip` (CI-trusted, out of scope). Packed CPU_SHARD to a cpu-upgrade job, CPU_WIDTH wide, each under hfArgs' 20m --timeout.
export const CPU_SHARD = 6;
export const CPU_WIDTH = 2;   // R's 4-wide CPU job ran at load 250-320, hit page.goto timeouts and the 20m cap (job 6ac9806a); width 2 until the drawing rows move to the T4 (Lead 2026-10-10)
export function cpuShards(commands, readSource, skip = []) {
  const gaps = coverageGaps([], commands, readSource), wall = selectWallRows(commands, readSource);
  const off = new Set([...skip, ...gaps.macOnly, ...gaps.t4Only, ...SLOW_ROWS, ...ON_T4.map(e => e.row), ...MAC_ONLY.map(e => e.row), ...wall]);
  const rows = commands.map((_, i) => i + 1).filter(i => !off.has(i));
  return Array.from({ length: Math.ceil(rows.length / CPU_SHARD) }, (_, i) => rows.slice(i * CPU_SHARD, (i + 1) * CPU_SHARD));
}
// Every job a release starts goes in the ledger scripts/hf-cleanup.mjs reads on deploy.sh's EXIT (id and the job's own --timeout in seconds).
export const ledger = (id, sha, timeout, laneDir) => { const dir = laneDir || process.env.HF_LEDGER_DIR || 'artifacts/hf-jobs'; mkdirSync(dir, { recursive: true }); appendFileSync(`${dir}/${sha}.ledger`, `${id} ${Number(/^(\d+)m$/.exec(timeout || '')?.[1] || 0) * 60}\n`); };
export const receiptFrom = (logs, kind) => {
  const line = String(logs).split('\n').reverse().find(l => l.startsWith(`RECEIPT ${kind} `));
  try { return line ? JSON.parse(line.slice(`RECEIPT ${kind} `.length)) : null; } catch { return null; }
};

// A unit receipt is tree-bound, so only a batch tree can use one; a unit job per PR push was 5 of the 6 jobs running at once on 2026-10-10 (HF host load 470, timing
// tests flaked). `launch.mjs unit <sha>` therefore takes a sha that is on trunk or is this checkout's HEAD (the deploy checkout sits on the batch tree), nothing else.
// LAUNCH_UNIT_ANY=1 forces it. `git` is injectable for the test: (...args) => { status, stdout }.
export function unitShaRefusal(sha, git = (...args) => spawnSync('git', args, { encoding: 'utf8', timeout: 30_000 }), trunk = process.env.TRUNK_BRANCH || 'codex/01a09a76/task-1', force = process.env.LAUNCH_UNIT_ANY === '1') {
  if (force) return null;
  if (!/^[0-9a-f]{40}$/.test(sha || '')) return `a unit job needs the full 40-hex sha, got "${sha}"`;
  if (git('rev-parse', 'HEAD').stdout?.trim() === sha) return null;
  if (git('merge-base', '--is-ancestor', sha, `origin/${trunk}`).status === 0) return null;
  return `refusing a unit job for ${sha}: it is not on origin/${trunk} and not this checkout's HEAD. A unit receipt is tree-bound, so only a batch tree can use one (LAUNCH_UNIT_ANY=1 forces it)`;
}

// Only a RELEASE unit run holds the box's release marker (/run/frankendom-release, which sends lane jobs to hf-cpu): FRANKENDOM_RELEASE=1 from deploy.sh or the
// cutter, or a sha that is the tip of an origin/release-* branch. A lane's receipt run never does (Lead/COO 2026-10-12). `git` is injectable for the test.
export function isReleaseSha(sha, git = (...args) => spawnSync('git', args, { encoding: 'utf8', timeout: 30_000 }), env = process.env) {
  if (env.FRANKENDOM_RELEASE === '1') return true;
  return /^[0-9a-f]{40}$/.test(sha || '') && Boolean(git('for-each-ref', '--points-at', sha, '--format=%(refname)', 'refs/remotes/origin/release-*').stdout?.trim());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b, c] = process.argv.slice(2);
  try {
    if (cmd === 'cpu') {
      // node launch.mjs cpu <full sha> <rows NOT to place: CI-trusted and out-of-scope>: prints "id,id;row,row" (the jobs and the rows they carry) or nothing.
      const commands = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands, read = path => { try { return readFileSync(path, 'utf8'); } catch { return null; } };
      const ids = [], placed = [];
      const shards = cpuShards(commands, read, String(b || '').split(',').map(Number).filter(Number.isInteger));
      // Work waterfall (Dom 2026-10-11): the CPU rows run on the prepaid VPS when it is quiet and has room; Hugging Face is the spillover (LAUNCH_TARGET=hf forces it). The VPS run is
      // started in the background and writes ~/.claude/state/pre-launch/<sha>.rowsvps (a running marker beside it); deploy.sh waits for the marker and re-checks the file against the deploy tree.
      const stateDir = process.env.PRELAUNCH_DIR || `${process.env.HOME}/.claude/state/pre-launch`, fileOf = `${stateDir}/${a}.rowsvps`, runningOf = `${fileOf}.running`;
      const fresh = f => existsSync(f) && Date.now() - statSync(f).mtimeMs < 4 * 3600e3;
      if (shards.length && !process.env.LAUNCH_DRY && process.env.LAUNCH_TARGET !== 'hf') {
        if (fresh(fileOf) || fresh(runningOf)) { console.error('launch: the CPU rows are already on the VPS (running or done) for this sha'); process.exit(0); }
        const status = vpsStatus();
        if (pickTarget({ mem: 12288, vps: status }) === 'vps') {
          mkdirSync(stateDir, { recursive: true }); writeFileSync(runningOf, `${Date.now()}\n${shards.flat().join(',')}\n`);   // line 2: the rows, for deploy.sh's placement line
          const child = spawn(process.execPath, [process.argv[1], 'rows-vps', a, shards.flat().join(','), String(CPU_WIDTH * 2)], { detached: true, stdio: ['ignore', openLog(`${stateDir}/${a}.rowsvps.log`), openLog(`${stateDir}/${a}.rowsvps.log`)] });
          child.unref();
          console.error(`launch: tier=vps load1=${status?.load1}: ${shards.flat().length} CPU rows run on the VPS in the background (log ${stateDir}/${a}.rowsvps.log)`);
          process.exit(0);
        }
      }
      for (const rows of shards) {
        if (process.env.LAUNCH_DRY) { placed.push(...rows); continue; }
        const r = spawnSync(process.execPath, [process.argv[1], 'rows', a, 'cpu-upgrade', rows.join(','), String(CPU_WIDTH)], { encoding: 'utf8', timeout: ROWS_CHILD_TIMEOUT_MS });
        const id = /Job started with ID: ([0-9a-f]{24})/.exec(r.stdout || '')?.[1];
        if (id) { ids.push(id); placed.push(...rows); } else console.error(`launch: no job for CPU rows ${rows.join(',')}; they run on the Mac`);
      }
      process.stdout.write(placed.length ? `${ids.join(',')};${placed.join(',')}` : '');
    } else if (cmd === 'rows-vps') {
      // node launch.mjs rows-vps <full sha> <rows csv> [width]: the rows in our own ssh session on the VPS (scripts/lib/vps-rows.mjs); an accepted receipt is stored for deploy.sh, a failed run spills to HF.
      const stateDir = process.env.PRELAUNCH_DIR || `${process.env.HOME}/.claude/state/pre-launch`, fileOf = `${stateDir}/${a}.rowsvps`;
      mkdirSync(stateDir, { recursive: true });
      try {
        const rows = String(b).split(',').map(Number), total = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands.length;
        const tree = spawnSync('git', ['rev-parse', `${a}^{tree}`], { encoding: 'utf8', timeout: 30_000 }).stdout?.trim();
        const status = vpsStatus(), res = runRowsOnVps({ sha: a, tree, rows, total, width: Number(c) || 4 });
        if (res.ok) {
          writeFileSync(fileOf, JSON.stringify({ kind: 'vps-rows-live', ...res.receipt, host: 'vps', load1: status?.load1, at: new Date().toISOString() }) + '\n');
          console.log(`VPS rows receipt: ${res.receipt.rows.length} rows, ${res.receipt.seconds} s, chromium ${res.receipt.chromium_revision} -> ${fileOf}`);
        } else {
          console.error(`launch: the VPS rows run was not accepted (${res.reason}); spilling to Hugging Face`);
          const hf = spawnSync(process.execPath, [process.argv[1], 'cpu', a, Array.from({ length: total }, (_, i) => i + 1).filter(n => !rows.includes(n)).join(',')], { encoding: 'utf8', env: { ...process.env, LAUNCH_TARGET: 'hf' }, timeout: 20 * 60_000 }).stdout?.trim();
          if (hf) writeFileSync(`${stateDir}/${a}.cpu`, hf);
        }
      } finally { rmSync(`${fileOf}.running`, { force: true }); }
    } else if (cmd === 'fetch') {
      const logs = spawnSync('hf', ['jobs', 'logs', a], { encoding: 'utf8', timeout: 120_000, maxBuffer: 64 << 20 });
      if (logs.error || logs.status !== 0) throw new Error(`hf jobs logs ${a} failed: ${logs.error?.message || String(logs.stderr || '').trim().slice(-300) || `exit ${logs.status}`}`);
      const unit = receiptFrom(logs.stdout, 'unit'), rows = receiptFrom(logs.stdout, 'rows'), receipt = unit || rows;
      if (!receipt || receipt.job !== a || receipt.sha !== b) throw new Error(`no RECEIPT line for job ${a} sha ${b} (a failed run prints none)`);
      const dir = `artifacts/vps-shadow/${b}`; mkdirSync(dir, { recursive: true });
      const file = `${dir}/${unit ? 'unit.json' : `rows-${a}.json`}`; writeFileSync(file, JSON.stringify(receipt, null, 1) + '\n');
      console.log(file);
    } else {
      const hfBin = process.env.HF_BIN || 'hf';
      const lane = cmd === 'job' ? genericJobArgs(process.argv.slice(3)) : null;
      if (!lane && cmd === 'unit') { const refusal = unitShaRefusal(a); if (refusal) throw new Error(refusal); }
      // Work waterfall (Dom 2026-10-11): the release unit suite runs on the prepaid VPS when it is quiet and has room; Hugging Face is the spillover (LAUNCH_TARGET=hf forces it).
      // The VPS receipt is accepted only from this process's own live ssh session (scripts/lib/vps-unit.mjs) and stored for deploy.sh, which re-checks it against the deploy tree.
      if (!lane && cmd === 'unit' && !process.env.LAUNCH_DRY) {
        const status = vpsStatus(), target = process.env.LAUNCH_TARGET || pickTarget({ mem: 8192, vps: status });
        if (target === 'vps') {
          const tree = spawnSync('git', ['rev-parse', `${a}^{tree}`], { encoding: 'utf8', timeout: 30_000 }).stdout?.trim();
          console.log(`tier=vps load1=${status?.load1} freeRamMb=${status?.freeRamMb}: running the unit suite on the VPS (about 5-8 min)`);
          const res = runUnitOnVps({ sha: a, tree, release: isReleaseSha(a) });
          if (res.ok) {
            const dir = `${process.env.PRELAUNCH_DIR || `${process.env.HOME}/.claude/state/pre-launch`}`; mkdirSync(dir, { recursive: true });
            const file = `${dir}/${a}.unitvps`; writeFileSync(file, JSON.stringify({ kind: 'vps-unit-live', ...res.receipt, host: 'vps', load1: status?.load1, at: new Date().toISOString() }) + '\n');
            console.log(`VPS unit receipt ${res.receipt.pass} pass, node ${res.receipt.node}, ${res.receipt.seconds} s -> ${file}`);
            process.exit(0);
          }
          console.error(`launch: the VPS unit run was not accepted (${res.reason}); spilling to Hugging Face`);
        }
      }
      const args = lane ? lane.args : hfArgs(cmd, a, b, c, process.argv[6]), flavor = args[args.indexOf('--flavor') + 1];
      if (process.env.LAUNCH_DRY) console.log(['hf', ...args].map(x => JSON.stringify(x)).join(' '));
      else {
        // Work waterfall: a slot under the shared HF caps (scripts/lib/hf-slots.mjs); a lane's job keeps off the slot reserved for the deploy lane's unit/rows jobs.
        const slot = withSlot({ hf: hfBin, flavor, generic: !!lane, maxWaitS: lane ? lane.opts.maxWaitS : RELEASE_SLOT_WAIT_S, launch: () => spawnSync(hfBin, args, { encoding: 'utf8', timeout: 60_000 }), cost: { timeout: args[args.indexOf('--timeout') + 1], reason: process.env.HF_REASON || (lane ? `lane-${cmd}` : cmd) }, idOf: r => /Job started with ID: ([0-9a-f]{24})/.exec(r.stdout || '')?.[1] ?? null, cancel: id => spawnSync(hfBin, ['jobs', 'cancel', id], { encoding: 'utf8', timeout: 60_000 }) });
        if (!slot.ok) { console.error(`launch: ${slot.refused || `no ${flavor} slot (${slot.used} of ${slot.limit} in use) after ${Math.round(slot.queuedS)} s`}; run it on the VPS queue instead`); process.exit(75); }
        const r = slot.value; process.stdout.write(`${tierLine(flavor, slot.slot, slot.queuedS)}\n${r.stdout || ''}`); process.stderr.write(r.stderr || '');
        const id = /Job started with ID: ([0-9a-f]{24})/.exec(r.stdout || '')?.[1];
        if (id) ledger(id, lane ? lane.sha : a, args[args.indexOf('--timeout') + 1], lane ? 'artifacts/hf-lane-jobs' : undefined);
        if (id && !lane && cmd === 'unit') recordUnitJob(process.env.PRELAUNCH_DIR || `${process.env.HOME}/.claude/state/pre-launch`, a, id);   // the re-cut cancel (scripts/lib/prelaunch-jobs.mjs) finds the unit job in the candidate's .wall
        process.exit(r.status ?? 1);
      }
    }
  } catch (e) { console.error(`launch: ${e.message}`); process.exit(2); }
}
