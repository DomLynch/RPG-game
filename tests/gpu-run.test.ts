import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { isHardware, jobScript, parseArgs, parseJobLog, shellLine } from '../scripts/lib/gpu-run.mjs';

const T4 = 'ANGLE (NVIDIA Corporation, Tesla T4/PCIe/SSE2, OpenGL ES 3.2 NVIDIA 550.54)', SW = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';

test('arguments: sha, --timeout, --blender, and everything after the first "--" is the command untouched', () => {
  assert.deepEqual(parseArgs(['abc', '--', 'node', 'x.mjs']), { sha: 'abc', timeout: '20m', timeoutS: 1200, blender: false, cmd: ['node', 'x.mjs'] });
  const a = parseArgs(['abc', '--timeout', '2h', '--blender', '--', 'blender', '-b', '--timeout', '5', '--blender']);
  assert.deepEqual([a.timeoutS, a.blender, a.cmd], [7200, true, ['blender', '-b', '--timeout', '5', '--blender']]);
});

test('arguments: no command, a bad or out-of-range timeout, an unknown option and two revisions are refused', () => {
  for (const bad of [['abc'], ['abc', '--'], ['--', 'x'], ['abc', '--timeout', '20', '--', 'x'], ['abc', '--timeout', '30s', '--', 'x'], ['abc', '--timeout', '4h', '--', 'x'], ['abc', '--gpu', '--', 'x'], ['abc', 'def', '--', 'x'], ['abc', '--timeout', '--', 'x']]) {
    assert.throws(() => parseArgs(bad), /usage:|--timeout|no command|no revision|unknown option|more than one/, bad.join(' '));
  }
});

test('the command reaches the job shell with every argument whole, quotes included', () => {
  assert.equal(shellLine(['node', 'a b.mjs', "it's"]), `'node' 'a b.mjs' 'it'\\''s'`);
  const r = spawnSync('bash', ['-c', `printf '%s|' ${shellLine(['a b', "it's", '$HOME', '--x'])}`], { encoding: 'utf8' });
  assert.equal(r.stdout, "a b|it's|$HOME|--x|");
});

test('the guard: only NVIDIA on BOTH binaries passes; SwiftShader, llvmpipe, no WebGL, or one software binary is refused', () => {
  assert.ok(isHardware(`shell=${T4} | chrome=${T4}`));
  assert.ok(!isHardware(`shell=${SW} | chrome=${SW}`));
  assert.ok(!isHardware(`shell=${T4} | chrome=${SW}`), 'the full Chromium alone in software is a refusal (the rows launch both)');
  assert.ok(!isHardware(`shell=${SW} | chrome=${T4}`));
  assert.ok(!isHardware('shell=llvmpipe (LLVM 15) | chrome=llvmpipe (LLVM 15)'));
  assert.ok(!isHardware('shell=NO WEBGL CONTEXT | chrome=NO WEBGL CONTEXT'));
});

test('the job is the wall rows\' own setup (guard, build) cut at its ROWS section, plus our tail that strips software-GL args and probes again', () => {
  const job = jobScript();
  assert.ok(job.includes('BLOCKER no hardware WebGL') && job.includes('exit 11') && job.includes('npm run build'), 'job.sh setup and its exit-11 guard');
  assert.ok(!job.includes('RELEASE_CHECK_CONCURRENCY'), 'none of the rows section');
  assert.ok(job.indexOf('npm run build') < job.indexOf('--use-angle=*|--use-gl=*') && job.includes('swiftshader') && job.includes('BLOCKER software GL still reachable'), 'then the strip + the second probe');
  assert.throws(() => jobScript({ readText: file => (file.endsWith('job.sh') ? 'no seam here' : '') }), /no longer has the .* seam/);
  assert.ok(readFileSync('scripts/hf-wall-rows/job.sh', 'utf8').includes('say "ROWS'), 'the wall-row job still has the seam');
});

test('the Chromium wrapper drops every software-GL arg, including a value in its own argument, and keeps the rest in order', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gpu-wrap-')), bin = join(dir, 'chrome'), line = readFileSync('scripts/gpu-run/job-tail.sh', 'utf8').split('\n').find(l => l.startsWith("  printf '#!/bin/sh"))!.trim();
  writeFileSync(`${bin}.real`, '#!/bin/sh\nprintf "%s|" "$@"\n'); chmodSync(`${bin}.real`, 0o755);
  assert.equal(spawnSync('bash', ['-c', line.replace(/; chmod 755 "\$bin"$/, '') + '; chmod 755 "$bin"'], { env: { ...process.env, bin, chosen: '--gpu-a --gpu-b' } }).status, 0);
  const out = (...args: string[]) => spawnSync(bin, args, { encoding: 'utf8' }).stdout;
  assert.equal(out('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--keep', 'x y', '--use-gl', 'swiftshader', '--use-angle', 'swiftshader', '--disable-gpu', '--end'), '--gpu-a|--gpu-b|--keep|x y|--end|');
  assert.equal(out('--use-gl'), '--gpu-a|--gpu-b|', 'a trailing bare flag is dropped without eating anything');
});

test('the job log parser reads the renderer, blocker, exit, seconds and the artifacts blob', () => {
  const log = ['=== HEAD aaaa TREE bbbb ===', '=== RENDERER shell=T | chrome=T ===', '=== RUN ===', 'hello', '=== EXIT 3 ===', '=== ARTIFACTS BEGIN bytes=6 ===', 'YWJj', 'ZGVm', '=== ARTIFACTS END ===', '=== COST seconds=95 ==='].join('\n');
  const p = parseJobLog(log);
  assert.deepEqual([p.sha, p.tree, p.renderer, p.exit, p.seconds, p.blocker, p.artifactsB64], ['aaaa', 'bbbb', 'shell=T | chrome=T', 3, 95, null, 'YWJjZGVm']);
  assert.equal(parseJobLog('=== BLOCKER no hardware WebGL (x) ===\n=== COST seconds=40 ===').blocker, 'no hardware WebGL (x)');
});

// A stub hf: `jobs run` starts job 'a'x24 (or fails), `jobs logs` prints a canned log, `jobs inspect` answers COMPLETED.
const setup = (mode: 'ok' | 'guard' | 'launch-fails' | 'id-then-fail', log = '') => {
  const dir = mkdtempSync(join(tmpdir(), 'gpu-run-')), stub = join(dir, 'hf'), logFile = join(dir, 'log'), out = join(dir, 'out'), ledger = join(dir, 'ledger');
  writeFileSync(logFile, log);
  writeFileSync(stub, `#!/usr/bin/env node
const fs = require('fs'); const [, , , verb] = process.argv;
if (verb === 'run') { if (${JSON.stringify(mode)} === 'launch-fails') { console.error('quota'); process.exit(1); }
if (${JSON.stringify(mode)} === 'id-then-fail') { console.log('Job started with ID: ${'a'.repeat(24)}'); process.exit(1); } fs.writeFileSync(${JSON.stringify(join(dir, 'ran'))}, process.argv.join(' ')); console.log('Job started with ID: ${'a'.repeat(24)}'); }
else if (verb === 'logs') process.stdout.write(fs.readFileSync(${JSON.stringify(logFile)}, 'utf8'));
else if (verb === 'inspect') console.log(JSON.stringify([{ id: 'x', flavor: 't4-medium', created_at: new Date(Date.now() - 120000).toISOString().replace('T', ' '), status: { stage: 'COMPLETED' } }]));
`);
  chmodSync(stub, 0o755);
  const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/gpu-run.mjs', ...args], { encoding: 'utf8', timeout: 60_000, env: { ...process.env, GPU_RUN_HF: stub, GPU_RUN_OUT: out, HF_LEDGER_DIR: ledger, GPU_RUN_POLL_S: '0', HF_WALL_ROWS_ENV_FILE: join(dir, 'none.env') } });
  return { run, out, ledger, dir };
};
const tgz = () => { const d = mkdtempSync(join(tmpdir(), 'gpu-art-')); mkdirSync(join(d, 'artifacts')); writeFileSync(join(d, 'artifacts', 'still.png'), 'png-bytes'); const f = join(d, 'a.tgz'); spawnSync('tar', ['czf', f, '-C', d, 'artifacts']); return readFileSync(f).toString('base64'); };

test('a good run: the job is ledgered, the artifacts come back, the exit is the command\'s, the HF line closes it', () => {
  const log = ['=== HEAD h TREE t ===', `=== RENDERER shell=${T4} | chrome=${T4} ===`, '=== RUN ===', 'smoke OK', '=== EXIT 0 ===', `=== ARTIFACTS BEGIN bytes=9 ===`, tgz(), '=== ARTIFACTS END ===', '=== COST seconds=180 ==='].join('\n');
  const t = setup('ok', log), r = t.run('HEAD', '--timeout', '10m', '--', 'node', 'x.mjs');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /smoke OK/);
  assert.match(r.stdout, /^HF: 1 jobs, 0 running, <=\$0\.\d\d$/m);
  assert.match(r.stderr, /renderer: shell=ANGLE \(NVIDIA/);
  assert.match(r.stderr, /ran 180 s on t4-medium ≈ \$0\.03/);
  assert.equal(readFileSync(join(t.out, 'a'.repeat(24), 'artifacts', 'still.png'), 'utf8'), 'png-bytes');
  assert.ok(readdirSync(t.ledger).some(f => f.endsWith('.done')), 'cleanup retired the ledger');
  const launched = readFileSync(join(t.dir, 'ran'), 'utf8');
  assert.match(launched, /--flavor t4-medium --timeout 10m/);
  assert.ok(launched.includes('mcr.microsoft.com/playwright:v1.62.1-noble'));
});

test('a software renderer: the job\'s guard blocker is exit 11, nothing runs, no artifacts, and the HF line still closes it', () => {
  const log = ['=== HEAD h TREE t ===', `=== RENDERER shell=${SW} | chrome=${SW} ===`, '=== BLOCKER software GL still reachable with swiftshader args (renderer: x) ===', '=== COST seconds=60 ==='].join('\n');
  const t = setup('guard', log), r = t.run('HEAD', '--', 'node', 'x.mjs');
  assert.equal(r.status, 11, r.stderr);
  assert.match(r.stderr, /BLOCKER software GL/);
  assert.match(r.stdout, /^HF: 1 jobs, 0 running/m);
  assert.ok(!existsSync(join(t.out, 'a'.repeat(24))));
});

test('a command that fails keeps its own exit code; a failed launch and bad arguments still log the HF line', () => {
  const failing = setup('ok', ['=== RUN ===', 'boom', '=== EXIT 7 ===', '=== COST seconds=30 ==='].join('\n')).run('HEAD', '--', 'node', 'x.mjs');
  assert.equal(failing.status, 7);
  assert.match(failing.stdout, /^HF: 1 jobs, 0 running/m);
  const launch = setup('launch-fails').run('HEAD', '--', 'node', 'x.mjs');
  assert.equal(launch.status, 1);
  assert.match(launch.stderr, /hf jobs run failed: quota/);
  assert.match(launch.stdout, /^HF: 0 jobs, 0 running, <=\$0\.00$/m);
  const bad = setup('ok').run('HEAD', 'node');
  assert.equal(bad.status, 2);
  assert.match(bad.stdout, /^HF: 0 jobs, 0 running/m);
});

test('a launch that prints a job id but exits nonzero is still ledgered, so the cleanup counts and cancels it', () => {
  const t = setup('id-then-fail'), r = t.run('HEAD', '--', 'node', 'x.mjs');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /hf jobs run failed/);
  assert.match(r.stdout, /^HF: 1 jobs, 0 running/m);
  assert.ok(readdirSync(t.ledger).length > 0);
});
