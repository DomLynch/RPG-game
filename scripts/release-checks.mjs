import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const runCheck = (command, index) => new Promise(done => {
  const started = Date.now();
  const log = join(logDir, `${label(command, index)}.log`);
  console.log(`${kind} check ${index + 1}/${commands.length} started — ${command.join(' ')}`);
  const child = spawn(command[0], command.slice(1), { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks = [];
  child.stdout.on('data', chunk => chunks.push(chunk));
  child.stderr.on('data', chunk => chunks.push(chunk));
  const finish = status => {
    const output = Buffer.concat(chunks);
    writeFileSync(log, output);
    const seconds = (Date.now() - started) / 1000;
    console.log(`${kind} check ${index + 1}/${commands.length} ${status === 0 ? 'passed' : `FAILED (exit ${status})`} in ${seconds.toFixed(0)}s — ${command.join(' ')}`);
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
const all = commands.map((command, index) => ({ command, index, fixedPort: bindsFixedPort(command), expected: knownSeconds.get(command.join(' ')) ?? fallback }));
const ordered = [...all].sort((a, b) => b.expected - a.expected);  // longest known first; unknown checks sit at the median
const fixed = all.filter(item => item.fixedPort).length;
console.log(`${kind} checks: ${commands.length} total, concurrency ${concurrency}, ${fixed} fixed-port (one at a time), ` +
  (knownSeconds.size ? `ordered by last run's durations (${knownSeconds.size} known)` : 'no previous durations, contract order'));
const wall = Date.now();
const results = await pool(ordered, concurrency);
const failed = results.filter(result => result.status !== 0);
const retried = new Set();
for (const result of failed) {
  console.log(`Retrying ${kind.toLowerCase()} check ${result.index + 1} alone`);
  retried.add(result.index);
  results[results.indexOf(result)] = await runCheck(result.command, result.index);
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
const detail = results.sort((a, b) => a.index - b.index).map(r => ({ index: r.index + 1, command: r.command.join(' '), seconds: Number(r.seconds.toFixed(1)), retried: retried.has(r.index) }));
console.log(`${kind} checks wall time ${wallSeconds.toFixed(0)}s (serial sum ${detail.reduce((sum, r) => sum + r.seconds, 0).toFixed(0)}s)`);
if (extended) { console.log(`Extended checks passed for ${revision}`); process.exit(0); }
mkdirSync(dirname(receipt), { recursive: true });
writeFileSync(receipt, JSON.stringify({ revision, passed: true, checks: commands.length, wall_seconds: Number(wallSeconds.toFixed(1)), checks_detail: detail }) + '\n');
console.log(`Release checks passed for ${revision}`);
