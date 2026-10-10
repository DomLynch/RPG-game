// The T4 wall-row box, the I/O half (scripts/lib/hf-wall-rows.mjs is the rules). Sourced into the release by scripts/lib/deploy-hf.sh:
//   node scripts/hf-wall-rows.mjs launch <full-sha> [--rows 1,3] [--skip 2,5]   starts ONE hf job (t4-medium, 4-wide) for the wall rows; prints the job id
//   node scripts/hf-wall-rows.mjs collect                           waits for it, prints the trusted rows "1,3" (empty = trust nothing)
//   node scripts/hf-wall-rows.mjs table                             the side-by-side after the Mac's rows (artifacts/release-checks.json)
// The job clones the public repo at the sha and prints its own `git rev-parse HEAD` + tree, so a receipt binds to what it built, not to
// what we asked for. The HF token is the hf CLI's own (HF_TOKEN or its stored login): never read here, never printed. The three public
// VITE_ keys go to the job as secrets from .env.production.local. Every failure path (no hf, launch error, no hardware in time, the 45-min
// job timeout, a blocker, unreadable output) ends in "trust nothing", which is today's behaviour: the rows run on the Mac.
// Env: HF_WALL_ROWS_HF (the hf binary, tests stub it), HF_WALL_ROWS_STATE (state file), HF_WALL_ROWS_ENV_FILE, HF_WALL_ROWS_FLAVOR,
// HF_WALL_ROWS_WIDTH, HF_WALL_ROWS_TIMEOUT (the job's own cap), HF_WALL_ROWS_SCHEDULE_MAX_S (hardware wait), HF_WALL_ROWS_WAIT_MAX_S
// (collect's own cap, inside the deploy ceiling), HF_WALL_ROWS_POLL_S.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tierLine, withSlot } from './lib/hf-slots.mjs';
import { costLine, parseJobLog, selectWallRows, splitRows, trustedRows, untrustedReasons, waitBudget } from './lib/hf-wall-rows.mjs';
import { ledger } from './vps-shadow/launch.mjs';
import { MAC_ONLY, ON_T4, T4_JOBS } from './lib/row-placement.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const hf = process.env.HF_WALL_ROWS_HF || 'hf';
const state = process.env.HF_WALL_ROWS_STATE || join(root, 'artifacts', 'hf-wall-rows', 'state');
const envFile = process.env.HF_WALL_ROWS_ENV_FILE || join(root, '.env.production.local');
const flavor = process.env.HF_WALL_ROWS_FLAVOR || 't4-medium', width = process.env.HF_WALL_ROWS_WIDTH || '4', timeout = process.env.HF_WALL_ROWS_TIMEOUT || '45m';
const num = (name, fallback) => (process.env[name] === undefined || process.env[name] === '' ? fallback : Number(process.env[name]));
const scheduleMaxS = num('HF_WALL_ROWS_SCHEDULE_MAX_S', 600), waitMaxS = num('HF_WALL_ROWS_WAIT_MAX_S', 1500), pollS = num('HF_WALL_ROWS_POLL_S', 20);
const say = message => process.stderr.write(`hf-wall-rows: ${message}\n`);
// Every sync child is bounded (tests/child-process-bounds.test.ts): the CLI answers in seconds; a log fetch gets longer.
const run = (args, options = {}) => spawnSync(hf, args, { encoding: 'utf8', timeout: 120_000, ...options });
const sleep = s => { if (s > 0) spawnSync('sleep', [String(s)], { timeout: (s + 5) * 1000 }); };
const PUBLIC_KEYS = ['VITE_SENTRY_DSN', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];

function launch(sha, rowsArg, skipArg) {
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('launch needs a full 40-hex revision');
  const gate = JSON.parse(readFileSync(join(root, '.quality-gate.json'), 'utf8')), commands = gate.release_commands;
  // deploy.sh: the CI-trusted and out-of-scope rows (no box needs to run them) and the Mac-only list, which wins over the wall timing: rows 4 and 22 are
  // wall rows whose scripts launch WebKit (selectWallRows reads the command only), and Linux WebKit is not Mac Safari.
  const skipRows = [...String(skipArg || '').split(',').map(Number), ...(rowsArg ? [] : MAC_ONLY.map(entry => entry.row))];
  const rows = (rowsArg ? rowsArg.split(',').map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= commands.length)
    : [...new Set([...selectWallRows(commands, script => { try { return readFileSync(join(root, script), 'utf8'); } catch { return ''; } }), ...ON_T4.map(entry => entry.row)])].sort((a, b) => a - b)).filter(n => !skipRows.includes(n));   // + the rows measured fastest on the T4 (row-placement.mjs ON_T4)
  if (!rows.length) throw new Error('no wall rows to run');
  // An explicit --rows (a benchmark, a test) is one job; the release's own selection is split across T4_JOBS parallel jobs, longest rows first.
  const expected = new Map(ON_T4.map(entry => [entry.row, entry.t4_s ?? 60])), groups = rowsArg ? [rows] : splitRows(rows, T4_JOBS, row => expected.get(row) ?? 60);
  const job = readFileSync(join(root, 'scripts', 'hf-wall-rows', 'job.sh'));
  let secrets = null;
  if (existsSync(envFile)) {
    // Only the three public client keys, in a private temp file the CLI reads once per job; nothing else from the env file leaves the Mac.
    const pairs = readFileSync(envFile, 'utf8').split('\n').map(line => line.trim()).filter(line => PUBLIC_KEYS.some(key => line.startsWith(`${key}=`)));
    if (pairs.length) { secrets = join(mkdtempSync(join(tmpdir(), 'hf-wall-rows-')), 'secrets.env'); writeFileSync(secrets, pairs.join('\n') + '\n', { mode: 0o600 }); }
  } else say(`no ${envFile}: the job builds without the public VITE_ keys`);
  const jobs = [];
  try {
    for (const group of groups) {
      const skip = commands.map((_, i) => i + 1).filter(i => !group.includes(i));
      const args = ['jobs', 'run', '--detach', '--flavor', flavor, '--timeout', timeout, '--env', `SHA=${sha}`, '--env', `SKIP=${skip.join(',')}`, '--env', `WIDTH=${width}`, '--env', `JOB_B64=${job.toString('base64')}`,
        ...(secrets ? ['--secrets-file', secrets] : []), 'mcr.microsoft.com/playwright:v1.62.1-noble', 'bash', '-c', 'echo "$JOB_B64" | base64 -d > /tmp/job.sh; bash /tmp/job.sh'];
      // Work waterfall: the release's T4 jobs take their slots under the shared cap (scripts/lib/hf-slots.mjs), waiting up to 5 min for a lane's graphics job to finish.
      const slot = withSlot({ hf, flavor, generic: false, maxWaitS: 300, launch: () => run(args) });
      if (!slot.ok) { say(`no ${flavor} slot (${slot.used} of ${slot.limit} in use) after ${Math.round(slot.queuedS)} s: rows [${group.join(',')}] run on the Mac`); continue; }
      say(tierLine(flavor, slot.slot, slot.queuedS));
      const result = slot.value, id = /Job started with ID: (\S+)/.exec(result.stdout || '')?.[1];
      if (result.status !== 0 || !id) { say(`hf jobs run failed for rows [${group.join(',')}] (they run on the Mac): ${(result.stderr || result.stdout || '').trim().slice(0, 200)}`); continue; }
      ledger(id, sha, timeout);   // scripts/hf-cleanup.mjs cancels it on deploy.sh's EXIT if it is still running and counts its cost
      jobs.push({ id, rows: group });
    }
  } finally { if (secrets) rmSync(dirname(secrets), { recursive: true, force: true }); }
  if (!jobs.length) throw new Error('hf jobs run failed for every T4 job');
  const placed = jobs.flatMap(j => j.rows).sort((x, y) => x - y), ids = jobs.map(j => j.id).join(',');
  mkdirSync(dirname(state), { recursive: true });
  rmSync(`${state}.json`, { force: true });   // a previous run's receipt must not read as this run's (deploy-hf.sh's cancel checks for it)
  writeFileSync(state, JSON.stringify({ jobId: ids, jobs, sha, rows: placed, flavor, width, launchedAt: Date.now() }) + '\n');
  say(`${jobs.length} job(s) ${ids} launched on ${flavor} at ${width}-wide for ${sha.slice(0, 8)}: ${jobs.map(j => `[${j.rows.join(',')}]`).join(' ')}; the other ${commands.length - placed.length} rows are not on the T4`);
  process.stdout.write(`${ids}\n`);
}

const stage = id => { const r = run(['jobs', 'inspect', id]); if (r.status !== 0) return 'UNKNOWN'; return /"stage":\s*"([A-Z_]+)"/.exec(r.stdout || '')?.[1] || 'UNKNOWN'; };
const cancel = (id, why) => { say(`cancelling job ${id}: ${why}`); run(['jobs', 'cancel', id]); };

const LIVE = ['SCHEDULING', 'PENDING', 'RUNNING', 'UNKNOWN'];
function collect() {
  const saved = JSON.parse(readFileSync(state, 'utf8')), { sha } = saved, jobs = saved.jobs ?? [{ id: saved.jobId, rows: saved.rows }];
  const started = Date.now(), errors = new Map(), stages = new Map(jobs.map(j => [j.id, stage(j.id)])), running = new Set();
  // The wait lives inside the deploy ceiling (Deploy's review of #1194): deploy-hf.sh passes the deploy's start and DEPLOY_CEILING_S.
  const budgetS = waitBudget({ ceilingS: Number(process.env.DEPLOY_CEILING_S), deployT0: Number(process.env.HF_WALL_ROWS_DEPLOY_T0), now: started / 1000, waitMaxS });
  const stop = (j, why) => { cancel(j.id, why); errors.set(j.id, why); };
  if (budgetS <= 0) for (const j of jobs) if (LIVE.includes(stages.get(j.id))) stop(j, 'no wait budget left in the deploy ceiling');
  if (budgetS > 0) say(`waiting up to ${Math.round(budgetS)} s for ${jobs.length} job(s) ${jobs.map(j => j.id).join(',')} (${Math.round(Math.min(scheduleMaxS, budgetS))} s for hardware)`);
  // Per job: SCHEDULING past the grace = no hardware for it (cancel it, its rows run on the Mac); any job past the budget: the same. The others go on.
  for (;;) {
    const waiting = jobs.filter(j => !errors.has(j.id) && LIVE.includes(stages.get(j.id)));
    if (!waiting.length) break;
    const elapsed = (Date.now() - started) / 1000;
    for (const j of waiting) {
      if (stages.get(j.id) === 'RUNNING') running.add(j.id);
      if (!running.has(j.id) && elapsed >= Math.min(scheduleMaxS, budgetS)) stop(j, `no hardware after ${Math.round(elapsed)} s`);
      else if (elapsed >= budgetS) stop(j, `still ${stages.get(j.id)} after ${Math.round(elapsed)} s (budget ${Math.round(budgetS)} s)`);
    }
    if (!jobs.some(j => !errors.has(j.id) && LIVE.includes(stages.get(j.id)))) break;
    sleep(pollS);
    for (const j of jobs) if (!errors.has(j.id)) stages.set(j.id, stage(j.id));
  }
  const results = jobs.map(j => {
    if (errors.has(j.id)) return { ...j, parsed: null, error: errors.get(j.id) };
    const parsed = parseJobLog(run(['jobs', 'logs', j.id], { maxBuffer: 1 << 26, timeout: 300_000 }).stdout || '');
    if (parsed.seconds !== null) say(costLine(parsed.seconds, j.id, saved.flavor));
    const error = stages.get(j.id) !== 'COMPLETED' ? `job ended ${stages.get(j.id)}` : parsed.blocker ? `blocker: ${parsed.blocker}`
      : parsed.sha !== sha ? `the job built ${parsed.sha ? parsed.sha.slice(0, 8) : 'nothing'}, not ${sha.slice(0, 8)}` : null;
    return { ...j, parsed, error };
  });
  return finish(saved, results);
}
// A job that failed trusts none of its own rows (they run on the Mac); the others still count. Each row is trusted only from its own job's receipt.
function finish(saved, results) {
  const { rows, sha, jobId } = saved, tree = gitTree(sha), ok = results.filter(r => !r.error);
  const receipts = ok.flatMap(r => r.parsed.receipts.filter(x => r.rows.includes(Number(x.index))));
  const okRows = ok.flatMap(r => r.rows), trusted = trustedRows(receipts, tree, okRows);
  const untrusted = { ...untrustedReasons(receipts, tree, okRows), ...Object.fromEntries(results.filter(r => r.error).flatMap(r => r.rows.map(i => [i, r.error]))) };
  const seconds = results.reduce((sum, r) => sum + (r.parsed?.seconds ?? 0), 0) || null, error = ok.length ? undefined : results[0]?.error;
  writeFileSync(`${state}.json`, JSON.stringify({ jobId, sha, tree, jobTree: ok[0]?.parsed.tree ?? null, seconds, receipts, trusted, untrusted, ...(error ? { error } : {}) }, null, 1) + '\n');
  say(error ? `${error}; nothing trusted, rows [${rows.join(',')}] run on the Mac`
    : `${ok.length} of ${results.length} job(s) vs deploy tree ${tree.slice(0, 8)}: trusting ${trusted.length} of ${rows.length} rows [${trusted.join(',')}]; on the Mac: [${Object.entries(untrusted).map(([i, why]) => `${i}:${why}`).join(' ') || 'none'}]`);
  process.stdout.write(trusted.join(','));
}
const gitTree = sha => { const r = spawnSync('git', ['rev-parse', `${sha}^{tree}`], { cwd: root, encoding: 'utf8', timeout: 30_000 }); return r.status === 0 ? r.stdout.trim() : ''; };

// Per row of the job: the Mac's result and seconds (artifacts/release-checks.json, or "trusted" when the Mac skipped it on this receipt),
// the T4's result and seconds, and whether the receipt tree is the deploy tree. The first live run (shadow) has both sides real.
function table() {
  const receipt = JSON.parse(readFileSync(`${state}.json`, 'utf8'));
  let mac = new Map();
  try { mac = new Map(JSON.parse(readFileSync(join(root, 'artifacts', 'release-checks.json'), 'utf8')).checks_detail.map(r => [r.index, r])); } catch { /* the Mac's rows did not pass: no receipt */ }
  const t4 = new Map(receipt.receipts.map(r => [Number(r.index), r]));
  const lines = ['| # | Mac | T4 | tree | trusted |', '|---|---|---|---|---|'];
  for (const index of receipt.trusted.concat(Object.keys(receipt.untrusted).map(Number)).sort((a, b) => a - b)) {
    const m = mac.get(index), r = t4.get(index);
    lines.push(`| ${index} | ${m ? (m.trusted ? `trusted (${m.trusted})` : `pass ${m.seconds}s${m.retried ? ' (retry)' : ''}`) : 'no receipt'} | ${r ? `${r.status === 0 ? 'pass' : `fail (exit ${r.status})`} ${r.seconds}s` : 'no receipt'} | ${r ? (r.tree === receipt.tree ? 'same' : 'OTHER') : '—'} | ${receipt.trusted.includes(index) ? 'yes' : `no: ${receipt.untrusted[index]}`} |`);
  }
  console.log(`hf-wall-rows table: job ${receipt.jobId} for ${receipt.sha.slice(0, 8)}${receipt.seconds !== null ? `, ${receipt.seconds} s` : ''}${receipt.error ? ` (${receipt.error})` : ''}\n${lines.join('\n')}`);
}

try {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'launch') launch(rest[0], rest.includes('--rows') ? rest[rest.indexOf('--rows') + 1] : undefined, rest.includes('--skip') ? rest[rest.indexOf('--skip') + 1] : undefined);
  else if (command === 'collect') collect();
  else if (command === 'table') table();
  else throw new Error('usage: hf-wall-rows.mjs launch <sha> [--rows 1,3] [--skip 2,5] | collect | table');
} catch (error) {
  say(`${error.message}`);
  process.exit(1);
}
