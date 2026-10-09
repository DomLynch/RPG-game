// The one shared GPU runner (Dom 2026-10-09: "make sure the devs use the GPU, enforce it like the waterfall"). Runs a command on a Hugging Face t4-medium job at a sha:
//   node scripts/gpu-run.mjs <sha> [--timeout 20m] [--blender] -- <cmd...>
// The job is scripts/hf-wall-rows/job.sh's own setup (playwright:v1.62.1-noble, clone at the sha, npm ci, the #2044 Vulkan flags, the guard that probes BOTH Chromium
// binaries and exits 11 unless they render on NVIDIA, the build) plus scripts/gpu-run/job-tail.sh (software-GL args stripped and probed again, --blender, the command,
// the artifacts/ it wrote). Every path ends in the ledger + scripts/hf-cleanup.mjs's "HF: N jobs, 0 running, <=$X" line. The exit code is the command's own; 11 = no NVIDIA
// renderer, 12 = a setup blocker, 124 = the job did not finish in its timeout. The artifacts the command wrote land in artifacts/gpu-run/<job id>/.
// The HF token is the hf CLI's own login: never read or printed here. Env: GPU_RUN_HF (the hf binary; tests stub it), HF_LEDGER_DIR (the ledger folder), GPU_RUN_OUT, GPU_RUN_POLL_S.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { costOfSeconds, jobScript, parseArgs, parseJobLog, shellLine } from './lib/gpu-run.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const hf = process.env.GPU_RUN_HF || 'hf', flavor = 't4-medium', pollS = Number(process.env.GPU_RUN_POLL_S || 20), SCHEDULE_GRACE_S = 600;
const say = message => process.stderr.write(`gpu-run: ${message}\n`);
const run = (args, options = {}) => spawnSync(hf, args, { encoding: 'utf8', timeout: 120_000, ...options });   // every sync child is bounded (tests/child-process-bounds.test.ts)
const sleep = s => { if (s > 0) spawnSync('sleep', [String(s)], { timeout: (s + 5) * 1000 }); };
const PUBLIC_KEYS = ['VITE_SENTRY_DSN', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
const LIVE = ['SCHEDULING', 'PENDING', 'RUNNING', 'STARTING', 'QUEUED', 'UNKNOWN'];

const stage = id => { const r = run(['jobs', 'inspect', id]); if (r.status !== 0) return 'UNKNOWN'; return /"stage":\s*"([A-Z_]+)"/.exec(r.stdout || '')?.[1] || 'UNKNOWN'; };
const resolveSha = rev => { const r = spawnSync('git', ['rev-parse', '--verify', `${rev}^{commit}`], { cwd: root, encoding: 'utf8', timeout: 30_000 }); if (r.status !== 0) throw new Error(`${rev} is not a revision in this checkout`); return r.stdout.trim(); };

export async function main(argv) {
  const ledgerDir = process.env.HF_LEDGER_DIR || mkdtempSync(join(tmpdir(), 'gpu-run-ledger-'));
  process.env.HF_BIN ||= hf;   // hf-cleanup runs the same binary
  process.env.HF_LEDGER_DIR = ledgerDir;   // before the imports: hf-cleanup reads it once, and this run's ledger must be the only one it cancels (a deploy's jobs are not ours)
  const { ledger } = await import('./vps-shadow/launch.mjs'), { cleanup } = await import('./hf-cleanup.mjs');
  let code = 1, jobId = null, secrets = null;
  try {
    let args;
    try { args = parseArgs(argv); } catch (error) { say(error.message); code = 2; return code; }   // nothing launched; the finally below still logs the HF line
    const sha = resolveSha(args.sha);
    const env = ['--env', `SHA=${sha}`, '--env', `CMD_B64=${Buffer.from(shellLine(args.cmd)).toString('base64')}`, '--env', `BLENDER=${args.blender ? 1 : 0}`,
      '--env', `JOB_B64=${Buffer.from(jobScript()).toString('base64')}`, '--env', `CYCLES_B64=${readFileSync(join(root, 'scripts', 'gpu-run', 'cycles_gpu.py')).toString('base64')}`];
    const launchArgs = ['jobs', 'run', '--detach', '--flavor', flavor, '--timeout', args.timeout, ...env];
    const envFile = process.env.HF_WALL_ROWS_ENV_FILE || join(root, '.env.production.local');
    if (existsSync(envFile)) {   // only the three public client keys, in a private temp file the CLI reads once
      const pairs = readFileSync(envFile, 'utf8').split('\n').map(line => line.trim()).filter(line => PUBLIC_KEYS.some(key => line.startsWith(`${key}=`)));
      if (pairs.length) { secrets = join(mkdtempSync(join(tmpdir(), 'gpu-run-')), 'secrets.env'); writeFileSync(secrets, pairs.join('\n') + '\n', { mode: 0o600 }); launchArgs.push('--secrets-file', secrets); }
    }
    launchArgs.push('mcr.microsoft.com/playwright:v1.62.1-noble', 'bash', '-c', 'echo "$JOB_B64" | base64 -d > /tmp/job.sh; bash /tmp/job.sh');
    const started = run(launchArgs);
    jobId = /Job started with ID: (\S+)/.exec(started.stdout || '')?.[1] ?? null;
    if (jobId) ledger(jobId, sha, args.timeout);   // an id means a job exists, whatever the CLI's exit said: ledger it first so the cleanup below cancels it (two jobs once leaked on a nonzero exit)
    if (started.status !== 0 || !jobId) throw new Error(`hf jobs run failed: ${(started.stderr || started.stdout || '').trim().slice(0, 200)}`);
    say(`job ${jobId} on ${flavor} at ${sha.slice(0, 8)}${args.blender ? ' (+Blender)' : ''}: ${args.cmd.join(' ').slice(0, 120)}`);

    const t0 = Date.now(), budgetS = args.timeoutS + SCHEDULE_GRACE_S;
    let now = stage(jobId), timedOut = false;
    while (LIVE.includes(now)) {
      if ((Date.now() - t0) / 1000 > budgetS) { say(`still ${now} after ${Math.round((Date.now() - t0) / 1000)} s: cancelling`); run(['jobs', 'cancel', jobId]); timedOut = true; break; }
      sleep(pollS); now = stage(jobId);
    }
    const logs = run(['jobs', 'logs', jobId], { maxBuffer: 1 << 28, timeout: 300_000 }).stdout || '';
    const parsed = parseJobLog(logs);
    const ran = logs.split('\n'), from = ran.findIndex(l => l === '=== RUN ==='), to = ran.findIndex((l, i) => i > from && /^=== EXIT \d+ ===$/.test(l));
    if (from >= 0) process.stdout.write(`${ran.slice(from + 1, to > from ? to : undefined).join('\n')}\n`);
    say(`renderer: ${parsed.renderer ?? 'none printed'}${parsed.blender ? ` | ${parsed.blender}` : ''}`);
    if (parsed.sha && parsed.sha !== sha) say(`WARNING the job built ${parsed.sha.slice(0, 8)}, not ${sha.slice(0, 8)}`);
    if (parsed.seconds !== null) say(`job ${jobId} ran ${parsed.seconds} s on ${flavor} ≈ $${costOfSeconds(parsed.seconds).toFixed(2)} at $0.60/h`);
    if (parsed.artifactsB64) {
      const out = join(process.env.GPU_RUN_OUT || join(root, 'artifacts', 'gpu-run'), jobId); mkdirSync(out, { recursive: true });
      const tgz = join(out, 'artifacts.tgz'); writeFileSync(tgz, Buffer.from(parsed.artifactsB64, 'base64'));
      const untar = spawnSync('tar', ['xzf', tgz, '-C', out], { timeout: 120_000 }); rmSync(tgz, { force: true });
      say(untar.status === 0 ? `artifacts back in ${out}/artifacts/` : `artifacts could not be unpacked (tar exit ${untar.status})`);
    } else if (parsed.artifactsTooLarge) say(`artifacts too large to bring back (${parsed.artifactsTooLarge} bytes); the command should write less or smaller files`);
    if (timedOut || now === 'CANCELED') code = 124;
    else if (parsed.blocker) { say(`BLOCKER ${parsed.blocker}`); code = /GL|renderer|hardware/i.test(parsed.blocker) ? 11 : 12; }
    else if (now !== 'COMPLETED') { say(`job ended ${now}`); code = 1; }
    else code = parsed.exit ?? 1;
    if (code !== 0) say(`exit ${code}`);
  } catch (error) {
    say(error.message);
  } finally {
    if (secrets) rmSync(dirname(secrets), { recursive: true, force: true });
    const { line, running } = cleanup();   // every path: cancel what is still running, then the one line
    if (running) { console.error(`RED LINE ${line}`); code = 1; } else console.log(line);
  }
  return code;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await main(process.argv.slice(2)));
