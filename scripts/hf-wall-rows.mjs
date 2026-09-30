// The T4 wall-row box, the I/O half (scripts/lib/hf-wall-rows.mjs is the rules). Sourced into the release by scripts/lib/deploy-hf.sh:
//   node scripts/hf-wall-rows.mjs launch <full-sha> [--rows 1,3]   starts ONE hf job (t4-medium, 4-wide) for the wall rows; prints the job id
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
import { costLine, parseJobLog, selectWallRows, trustedRows, untrustedReasons } from './lib/hf-wall-rows.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const hf = process.env.HF_WALL_ROWS_HF || 'hf';
const state = process.env.HF_WALL_ROWS_STATE || join(root, 'artifacts', 'hf-wall-rows', 'state');
const envFile = process.env.HF_WALL_ROWS_ENV_FILE || join(root, '.env.production.local');
const flavor = process.env.HF_WALL_ROWS_FLAVOR || 't4-medium', width = process.env.HF_WALL_ROWS_WIDTH || '4', timeout = process.env.HF_WALL_ROWS_TIMEOUT || '45m';
const num = (name, fallback) => (process.env[name] === undefined || process.env[name] === '' ? fallback : Number(process.env[name]));
const scheduleMaxS = num('HF_WALL_ROWS_SCHEDULE_MAX_S', 600), waitMaxS = num('HF_WALL_ROWS_WAIT_MAX_S', 1500), pollS = num('HF_WALL_ROWS_POLL_S', 20);
const say = message => process.stderr.write(`hf-wall-rows: ${message}\n`);
const run = (args, options = {}) => spawnSync(hf, args, { encoding: 'utf8', ...options });
const sleep = s => { if (s > 0) spawnSync('sleep', [String(s)]); };
const PUBLIC_KEYS = ['VITE_SENTRY_DSN', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];

function launch(sha, rowsArg) {
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('launch needs a full 40-hex revision');
  const gate = JSON.parse(readFileSync(join(root, '.quality-gate.json'), 'utf8')), commands = gate.release_commands;
  const rows = rowsArg ? rowsArg.split(',').map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= commands.length)
    : selectWallRows(commands, script => { try { return readFileSync(join(root, script), 'utf8'); } catch { return ''; } });
  if (!rows.length) throw new Error('no wall rows to run');
  const skip = commands.map((_, i) => i + 1).filter(i => !rows.includes(i));
  const job = readFileSync(join(root, 'scripts', 'hf-wall-rows', 'job.sh'));
  const args = ['jobs', 'run', '--detach', '--flavor', flavor, '--timeout', timeout, '--env', `SHA=${sha}`, '--env', `SKIP=${skip.join(',')}`, '--env', `WIDTH=${width}`, '--env', `JOB_B64=${job.toString('base64')}`];
  let secrets = null;
  if (existsSync(envFile)) {
    // Only the three public client keys, in a private temp file the CLI reads once; nothing else from the env file leaves the Mac.
    const pairs = readFileSync(envFile, 'utf8').split('\n').map(line => line.trim()).filter(line => PUBLIC_KEYS.some(key => line.startsWith(`${key}=`)));
    if (pairs.length) { secrets = join(mkdtempSync(join(tmpdir(), 'hf-wall-rows-')), 'secrets.env'); writeFileSync(secrets, pairs.join('\n') + '\n', { mode: 0o600 }); args.push('--secrets-file', secrets); }
  } else say(`no ${envFile}: the job builds without the public VITE_ keys`);
  args.push('mcr.microsoft.com/playwright:v1.62.1-noble', 'bash', '-c', 'echo "$JOB_B64" | base64 -d > /tmp/job.sh; bash /tmp/job.sh');
  const result = run(args);
  if (secrets) rmSync(dirname(secrets), { recursive: true, force: true });
  const id = /Job started with ID: (\S+)/.exec(result.stdout || '')?.[1];
  if (result.status !== 0 || !id) throw new Error(`hf jobs run failed: ${(result.stderr || result.stdout || '').trim().slice(0, 200)}`);
  mkdirSync(dirname(state), { recursive: true });
  writeFileSync(state, JSON.stringify({ jobId: id, sha, rows, flavor, width, launchedAt: Date.now() }) + '\n');
  say(`job ${id} launched on ${flavor} at ${width}-wide for ${sha.slice(0, 8)}: rows [${rows.join(',')}], the other ${skip.length} stay on the Mac`);
  process.stdout.write(`${id}\n`);
}

const stage = id => { const r = run(['jobs', 'inspect', id]); if (r.status !== 0) return 'UNKNOWN'; return /"stage":\s*"([A-Z_]+)"/.exec(r.stdout || '')?.[1] || 'UNKNOWN'; };
const cancel = (id, why) => { say(`cancelling job ${id}: ${why}`); run(['jobs', 'cancel', id]); };

function collect() {
  const saved = JSON.parse(readFileSync(state, 'utf8')), { jobId, sha, rows } = saved;
  const started = Date.now();
  let stageNow = stage(jobId), scheduling = true;
  // SCHEDULING past the grace = no hardware today: cancel, trust nothing (the Mac runs the rows). RUNNING past collect's own cap: the same.
  while (['SCHEDULING', 'PENDING', 'RUNNING', 'UNKNOWN'].includes(stageNow)) {
    const elapsed = (Date.now() - started) / 1000;
    if (stageNow === 'RUNNING') scheduling = false;
    if (scheduling && elapsed >= scheduleMaxS) { cancel(jobId, `no hardware after ${Math.round(elapsed)} s`); return finish(saved, null, `no hardware after ${Math.round(elapsed)} s`); }
    if (elapsed >= waitMaxS) { cancel(jobId, `still ${stageNow} after ${Math.round(elapsed)} s`); return finish(saved, null, `still ${stageNow} after ${Math.round(elapsed)} s`); }
    sleep(pollS);
    stageNow = stage(jobId);
  }
  const logs = run(['jobs', 'logs', jobId], { maxBuffer: 1 << 26 });
  const parsed = parseJobLog(logs.stdout || '');
  if (parsed.seconds !== null) say(costLine(parsed.seconds, jobId, saved.flavor));
  if (stageNow !== 'COMPLETED') return finish(saved, parsed, `job ended ${stageNow}`);
  if (parsed.blocker) return finish(saved, parsed, `blocker: ${parsed.blocker}`);
  if (parsed.sha !== sha) return finish(saved, parsed, `the job built ${parsed.sha ? parsed.sha.slice(0, 8) : 'nothing'}, not ${sha.slice(0, 8)}`);
  return finish(saved, parsed, null);
}
function finish(saved, parsed, error) {
  const { rows, sha, jobId } = saved;
  const tree = gitTree(sha);
  const receipts = parsed?.receipts ?? [];
  const trusted = error ? [] : trustedRows(receipts, tree, rows), untrusted = error ? Object.fromEntries(rows.map(i => [i, error])) : untrustedReasons(receipts, tree, rows);
  writeFileSync(`${state}.json`, JSON.stringify({ jobId, sha, tree, jobTree: parsed?.tree ?? null, seconds: parsed?.seconds ?? null, receipts, trusted, untrusted, ...(error ? { error } : {}) }, null, 1) + '\n');
  say(error ? `${error}; nothing trusted, rows [${rows.join(',')}] run on the Mac`
    : `job ${jobId} tree ${parsed.tree.slice(0, 8)} vs deploy tree ${tree.slice(0, 8)}: trusting ${trusted.length} of ${rows.length} rows [${trusted.join(',')}]; on the Mac: [${Object.entries(untrusted).map(([i, why]) => `${i}:${why}`).join(' ') || 'none'}]`);
  process.stdout.write(trusted.join(','));
}
const gitTree = sha => { const r = spawnSync('git', ['rev-parse', `${sha}^{tree}`], { cwd: root, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : ''; };

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
  if (command === 'launch') launch(rest[0], rest.includes('--rows') ? rest[rest.indexOf('--rows') + 1] : undefined);
  else if (command === 'collect') collect();
  else if (command === 'table') table();
  else throw new Error('usage: hf-wall-rows.mjs launch <sha> [--rows 1,3] | collect | table');
} catch (error) {
  say(`${error.message}`);
  process.exit(1);
}
