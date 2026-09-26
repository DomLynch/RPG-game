import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) || fileURLToPath(new URL('..', import.meta.url)));
// `--extended` runs extended_commands instead: the Season 2 creature gates (Minotaur, Wraith, Werewolf, Skeleton are on hold for the
// beta, owner 2026-09-20). They run on demand, not on deploy, and never write the release receipt.
const extended = process.argv.includes('--extended');
const gate = JSON.parse(readFileSync(join(root, '.quality-gate.json'), 'utf8'));
const commands = extended ? gate.extended_commands : gate.release_commands;
if (!Array.isArray(commands) || !commands.length || !commands.every(command =>
  Array.isArray(command) && command.length && command.every(arg => typeof arg === 'string' && arg))) {
  throw new Error(extended ? 'Invalid extended_commands' : 'Invalid release_commands');
}
// Checks run concurrently: every browser check serves its own build on an ephemeral port (`port: 0`), so they are
// independent. Scripts that bind a fixed port (`strictPort`) share a lock so only one of them runs at a time, but they
// still overlap with the rest. Longest checks start first, using the durations the previous run recorded in the
// receipt, so the slow ones cannot become the tail. A check that fails inside the pool is retried once alone before it
// counts, so a flake under contention cannot fail a release. RELEASE_CHECK_CONCURRENCY=1 restores serial behaviour.
const concurrency = Math.max(1, Number(process.env.RELEASE_CHECK_CONCURRENCY) || 4);
const kind = extended ? 'Extended' : 'Release';
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const receipt = join(root, 'artifacts', 'release-checks.json');
const logDir = join(root, 'artifacts', 'release-checks');
const previous = (() => { try { return JSON.parse(readFileSync(receipt, 'utf8')); } catch { return {}; } })();
const knownSeconds = new Map((previous.checks_detail || []).map(check => [check.command, check.seconds]));
rmSync(receipt, { force: true });
rmSync(logDir, { recursive: true, force: true });
mkdirSync(logDir, { recursive: true });

const bindsFixedPort = command => {
  const script = command.find(arg => arg.endsWith('.mjs') || arg.endsWith('.js'));
  if (!script) return false;
  const path = resolve(root, script);
  return existsSync(path) && /strictPort\s*:\s*true/.test(readFileSync(path, 'utf8'));
};
const label = (command, index) => `${String(index + 1).padStart(2, '0')}-${(command.find(arg => arg.endsWith('.mjs')) || command[0]).replace(/[^\w.-]+/g, '_')}`;

// Hard ceiling per check. The slowest honest check is ~5 min on a loaded Mac; deploy #71 (2026-09-22) sat 60 min in a check whose
// jpegtran child had deadlocked on a stdin pipe at 0 % CPU, with no timeout anywhere in the chain. Past the ceiling the whole
// process group is SIGKILLed (SIGTERM does not reach a child blocked in a sync pipe wait) and the check counts as failed with a
// clear line; the runner's retry-once-alone still applies. RELEASE_CHECK_CEILING_S overrides.
const ceilingS = Number(process.env.RELEASE_CHECK_CEILING_S) > 0 ? Number(process.env.RELEASE_CHECK_CEILING_S) : 15 * 60;
// Wall clock and 1-min load on every row's start and end line, so a slow run shows which rows ate the time and under what load
// (2026-09-25: f7866b30's npm test took 270 s against ~34 s on a quiet box).
const clock = () => `${new Date().toTimeString().slice(0, 8)} (load ${loadavg()[0].toFixed(1)})`;
const runCheck = (command, index, suffix = '') => new Promise(done => {
  const started = Date.now();
  const log = join(logDir, `${label(command, index)}${suffix}.log`);
  console.log(`${kind} check ${index + 1}/${commands.length} started at ${clock()} — ${command.join(' ')}`);
  const child = spawn(command[0], command.slice(1), { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const chunks = [];
  const ceiling = setTimeout(() => {
    chunks.push(Buffer.from(`\nRelease check ceiling: no exit after ${ceilingS}s — killing the process group (pid ${child.pid})\n`));
    console.log(`${kind} check ${index + 1}/${commands.length} CEILING ${ceilingS}s — killing the process group — ${command.join(' ')}`);
    try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* already gone */ } }
  }, ceilingS * 1000);
  child.stdout.on('data', chunk => chunks.push(chunk));
  child.stderr.on('data', chunk => chunks.push(chunk));
  const finish = status => {
    clearTimeout(ceiling);
    const output = Buffer.concat(chunks);
    writeFileSync(log, output);
    const seconds = (Date.now() - started) / 1000;
    console.log(`${kind} check ${index + 1}/${commands.length} ${status === 0 ? 'passed' : `FAILED (exit ${status})`} in ${seconds.toFixed(0)}s, ended ${clock()} — ${command.join(' ')}`);
    done({ index, command, status: status ?? 1, log, seconds, output });
  };
  child.on('error', error => { chunks.push(Buffer.from(`\n${error.stack || error}\n`)); finish(1); });
  child.on('close', finish);
});

// One fixed-port check at a time; everything else limited only by the pool.
let fixedPortLock = Promise.resolve();
const withFixedPortLock = task => {
  const run = fixedPortLock.then(task, task);
  fixedPortLock = run.catch(() => {});
  return run;
};

const pool = async (items, limit) => {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      const task = () => runCheck(item.command, item.index);
      results[item.index] = await (item.fixedPort ? withFixedPortLock(task) : task());
    }
  });
  await Promise.all(workers);
  return results.filter(Boolean);
};

const median = values => { const v = [...values].sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; };
const fallback = median([...knownSeconds.values()]);
// RELEASE_CHECKS_SKIP="1,3" (from scripts/ci-trusted-checks.mjs): checks CI already proved for this exact revision.
// Never applies to --extended. Anything not listed runs here.
const trustedSource = process.env.RELEASE_CHECKS_SKIP_SOURCE || 'CI';
const trustedIndices = new Set(extended ? [] : String(process.env.RELEASE_CHECKS_SKIP || '').split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n >= 1 && n <= commands.length));
const all = commands.map((command, index) => ({ command, index, fixedPort: bindsFixedPort(command), expected: knownSeconds.get(command.join(' ')) ?? fallback }))
  .filter(item => !trustedIndices.has(item.index + 1));
for (const index of [...trustedIndices].sort((a, b) => a - b)) console.log(`${kind} check ${index}/${commands.length} trusted from ${trustedSource} — ${commands[index - 1].join(' ')}`);
const ordered = [...all].sort((a, b) => b.expected - a.expected);  // longest known first; unknown checks sit at the median
const fixed = all.filter(item => item.fixedPort).length;
console.log(`${kind} checks: ${commands.length} total, ${trustedIndices.size} trusted from ${trustedSource}, ${all.length} to run, concurrency ${concurrency}, ${fixed} fixed-port (one at a time), ` +
  (knownSeconds.size ? `ordered by last run's durations (${knownSeconds.size} known)` : 'no previous durations, contract order'));
const wall = Date.now();
const results = await pool(ordered, concurrency);
const failed = results.filter(result => result.status !== 0);
const retried = new Set();
for (const result of failed) {
  console.log(`Retrying ${kind.toLowerCase()} check ${result.index + 1} alone`);
  retried.add(result.index);
  // The retry writes its own .retry.log and a passing retry prints the first attempt's tail, so a flaky row's cause survives
  // (2026-09-26: row 32 failed at load 182 and 309, passed alone both times, and both first-attempt logs had been overwritten).
  const retry = await runCheck(result.command, result.index, '.retry');
  if (retry.status === 0) {
    console.log(`--- ${kind} check ${result.index + 1} first attempt (failed, retry passed) last 40 lines, full log: ${result.log} ---`);
    console.log(result.output.toString('utf8').split('\n').slice(-40).join('\n'));
  }
  results[results.indexOf(result)] = retry;
}
const stillFailing = results.filter(result => result.status !== 0);
if (stillFailing.length) {
  for (const result of stillFailing) {
    console.error(`\n--- ${kind} check ${result.index + 1} output (last 40 lines, full log: ${result.log}) ---`);
    console.error(result.output.toString('utf8').split('\n').slice(-40).join('\n'));
  }
  process.exit(stillFailing[0].status || 1);
}
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() !== revision) {
  throw new Error('Revision changed during release checks');
}
const wallSeconds = (Date.now() - wall) / 1000;
const detail = [
  ...results.map(r => ({ index: r.index + 1, command: r.command.join(' '), seconds: Number(r.seconds.toFixed(1)), retried: retried.has(r.index) })),
  ...[...trustedIndices].map(index => ({ index, command: commands[index - 1].join(' '), seconds: 0, retried: false, trusted: trustedSource })),
].sort((a, b) => a.index - b.index);
console.log(`${kind} checks wall time ${wallSeconds.toFixed(0)}s (serial sum ${detail.reduce((sum, r) => sum + r.seconds, 0).toFixed(0)}s)`);
if (extended) { console.log(`Extended checks passed for ${revision}`); process.exit(0); }
mkdirSync(dirname(receipt), { recursive: true });
writeFileSync(receipt, JSON.stringify({ revision, passed: true, checks: commands.length, wall_seconds: Number(wallSeconds.toFixed(1)), checks_detail: detail }) + '\n');
console.log(`Release checks passed for ${revision}`);
