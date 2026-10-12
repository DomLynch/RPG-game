// The PR preflight (scripts/preflight-steps.sh runs on the box; scripts/preflight.mjs ships it and prints the receipt). Red-to-green on fixture repos: a clean PR passes, a type clash
// (TS2308: two `export *` both exporting `x`) and a merge conflict both FAIL, and the conflict names its file and stops before any step runs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { buildRunner, parsePreflight, receiptFrom } from '../scripts/preflight.mjs';

const STEPS = resolve('scripts/preflight-steps.sh'), TSC = resolve('node_modules/.bin/tsc');
const git = (cwd: string, ...args: string[]): string => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (dir: string, name: string, text: string): void => writeFileSync(join(dir, name), text);

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'preflight-'));
  git(dir, 'init', '-q', '-b', 'main');
  write(dir, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: 'esnext', target: 'es2022', moduleResolution: 'bundler', allowImportingTsExtensions: true }, include: ['*.ts'] }));
  write(dir, 'a.ts', 'export const x: number = 1;\n');
  write(dir, 'index.ts', "export * from './a.ts';\n");
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'base');
  const mk = (branch: string, edit: () => void): string => { git(dir, 'switch', '-q', '-c', branch, 'main'); edit(); git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', branch); const sha = git(dir, 'rev-parse', 'HEAD'); git(dir, 'switch', '-q', 'main'); return sha; };
  const clean = mk('clean', () => write(dir, 'b.ts', 'export const y: number = 2;\n'));
  const clash = mk('clash', () => { write(dir, 'c.ts', 'export const x: number = 3;\n'); write(dir, 'index.ts', "export * from './a.ts';\nexport * from './c.ts';\n"); });
  const conflict = mk('conflict', () => write(dir, 'a.ts', 'export const x: number = 100;\n'));
  write(dir, 'a.ts', 'export const x: number = 200;\n'); git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'trunk moves');
  const trunk = git(dir, 'rev-parse', 'HEAD');
  return { dir, trunk, clean, clash, conflict };
}

function run(f: ReturnType<typeof fixture>, head: string) {
  const r = spawnSync('bash', [STEPS, f.trunk, head], { cwd: f.dir, encoding: 'utf8', timeout: 120_000, killSignal: 'SIGKILL', env: { ...process.env, PREFLIGHT_STEPS: `tsc=${TSC} --noEmit -p .` } });
  return { status: r.status, out: r.stdout, result: parsePreflight(r.stdout) };
}

test('a clean PR passes every step and the receipt names head and trunk', () => {
  const f = fixture();
  try {
    const r = run(f, f.clean);
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(r.result?.steps, { merge: 'pass', tsc: 'pass' });
    assert.equal(r.result?.head, f.clean); assert.equal(r.result?.trunk, f.trunk);
    assert.equal(receiptFrom({ pr: 1, head: f.clean, trunk: f.trunk, result: r.result }).ok, true);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('a type clash (TS2308) that merges cleanly still FAILS the tsc step', () => {
  const f = fixture();
  try {
    const r = run(f, f.clash);
    assert.notEqual(r.status, 0);
    assert.equal(r.result?.steps.merge, 'pass'); assert.equal(r.result?.steps.tsc, 'fail');
    assert.match(r.out, /TS2308/);
    assert.equal(receiptFrom({ pr: 2, head: f.clash, trunk: f.trunk, result: r.result }).ok, false);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('a merge conflict FAILS naming the file, and no step runs on the broken tree', () => {
  const f = fixture();
  try {
    const r = run(f, f.conflict);
    assert.notEqual(r.status, 0);
    assert.deepEqual(r.result?.steps, { merge: 'fail' });
    assert.deepEqual(r.result?.conflicts, ['a.ts']);
    assert.match(r.out, /merge conflict in: a\.ts/);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('a receipt is not ok when the box answered for another head or trunk, or not at all', () => {
  const h = 'a'.repeat(40), t = 'b'.repeat(40);
  assert.equal(receiptFrom({ pr: 3, head: h, trunk: t, result: { head: h, trunk: 'c'.repeat(40), steps: {}, conflicts: [], ok: true } }).ok, false);
  assert.equal(receiptFrom({ pr: 3, head: h, trunk: t, result: null }).ok, false);
  assert.equal(parsePreflight('no line here'), null);
});

test('the runner takes full shas only and keeps its run dir out of /root/deploy-runs (that dir is the release lock)', () => {
  assert.throws(() => buildRunner({ head: 'abc', trunk: 'b'.repeat(40), runid: '0'.repeat(16), steps: 'x' }));
  const text = buildRunner({ head: 'a'.repeat(40), trunk: 'b'.repeat(40), runid: '0'.repeat(16), steps: 'echo steps' });
  assert.ok(!text.includes('/root/deploy-runs')); assert.match(text, /preflight-runs/); assert.match(text, /steps\.sh/);
});
