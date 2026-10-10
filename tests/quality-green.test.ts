// deploy.sh's quality_green: the CI-green gate must find the run that proved the tree even when a newer, unfinished run exists for the same sha
// (release V: the fast-forward push started a queued push run that sorted first; the green pull_request run was second, and the Mac ran its own suite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const deploy = readFileSync('scripts/deploy.sh', 'utf8');
const last = deploy.indexOf('\n}\n', deploy.indexOf('\nquality_green() {')) + 3;
const fn = `${deploy.slice(deploy.indexOf('quality_green_jq='), last)}`;
const run = (runs: Record<string, string>, list: string[]) => {
  const dir = mkdtempSync(join(tmpdir(), 'qgreen-'));
  try {
    mkdirSync(join(dir, 'bin'));
    const gh = `#!/bin/sh\nif [ "$2" = list ]; then printf '%s\\n' ${list.map((l) => `'${l}'`).join(' ')}; exit 0; fi\ncase "$3" in ${Object.entries(runs).map(([id, v]) => `${id}) echo ${v};;`).join(' ')} esac\n`;
    writeFileSync(join(dir, 'bin/gh'), gh); chmodSync(join(dir, 'bin/gh'), 0o755);
    const r = spawnSync('bash', ['-c', `${fn}\nquality_green deadbeef`], { encoding: 'utf8', timeout: 20_000, env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('a green run is found even when a newer unfinished run for the same sha sorts first', () => {
  assert.equal(run({ 111: 'no', 222: 'yes' }, ['111 https://x/runs/111', '222 https://x/runs/222']), 'https://x/runs/222');
});
test('no green run (or no run, or gh failing) prints nothing and still exits 0', () => {
  assert.equal(run({ 111: 'no', 222: 'no' }, ['111 https://x/runs/111', '222 https://x/runs/222']), '');
  assert.equal(run({}, []), '');
});
test('the first green run wins when several are green', () => {
  assert.equal(run({ 111: 'yes', 222: 'yes' }, ['111 https://x/runs/111', '222 https://x/runs/222']), 'https://x/runs/111');
});

// The job-conclusion rule itself, run through the real jq on a gh-shaped jobs list (the tests above mock the verdict).
const jq = deploy.match(/^quality_green_jq='(.*)'$/m)![1];
const verdict = (jobs: [string, string][]) => spawnSync('jq', ['-r', jq], { input: JSON.stringify({ jobs: jobs.map(([name, conclusion]) => ({ name, conclusion })) }), encoding: 'utf8' }).stdout.trim();
const SKIPPED = 'browser (${{ matrix.gate.name }})';
test('quality + browser (combat) both success is green; a failed or missing quality is not', () => {
  assert.equal(verdict([['quality', 'success'], ['browser (combat)', 'success']]), 'yes');
  assert.equal(verdict([['quality', 'success'], ['browser (combat)', 'failure']]), 'no');
  assert.equal(verdict([['quality', 'failure'], ['browser (combat)', 'success']]), 'no');
  assert.equal(verdict([['browser (combat)', 'success']]), 'no');
});
test('a skipped browser matrix is green only when quality and plan succeeded (release AI shape)', () => {
  assert.equal(verdict([['plan', 'success'], ['quality', 'success'], [SKIPPED, 'skipped']]), 'scoped');
  assert.equal(verdict([['plan', 'success'], ['quality', 'failure'], [SKIPPED, 'skipped']]), 'no');
  assert.equal(verdict([['plan', 'failure'], ['quality', 'success'], [SKIPPED, 'skipped']]), 'no');
  assert.equal(verdict([['plan', 'success'], ['quality', 'success']]), 'no');
  assert.equal(verdict([['plan', 'success'], ['quality', 'success'], [SKIPPED, 'success']]), 'no');
});
test('a real combat job beats the skipped-matrix rule: a failed combat run stays red even beside a skipped template job', () => {
  assert.equal(verdict([['plan', 'success'], ['quality', 'success'], ['browser (combat)', 'failure'], [SKIPPED, 'skipped']]), 'no');
});

// The merge-base guard: a scoped (browser-skipped) candidate run is trusted only when the trunk under it (first parent) has its own browser (combat) green.
// gh is a shim keyed by the commit argument; git rev-parse answers the first parent.
const guard = (opts: { parent: string | null; between?: boolean; runs: Record<string, [string, string][]>; verdicts: Record<string, string> }) => {
  const dir = mkdtempSync(join(tmpdir(), 'qgreen-'));
  try {
    mkdirSync(join(dir, 'bin'));
    const lists = Object.entries(opts.runs).map(([sha, rs]) => `${sha}) ${rs.map(([id, url]) => `echo '${id} ${url}'`).join('; ')};;`).join(' ');
    const views = Object.entries(opts.verdicts).map(([id, v]) => `${id}) echo ${v};;`).join(' ');
    writeFileSync(join(dir, 'bin/gh'), `#!/bin/sh\nif [ "$2" = list ]; then case "$6" in ${lists} esac; exit 0; fi\ncase "$3" in ${views} esac\n`);
    // cand~1 is a member merge (no CI run) when `between`, else the trunk itself; cand~2 is the trunk.
    writeFileSync(join(dir, 'bin/git'), `#!/bin/sh\ncase "$4" in cand~1) ${opts.parent ? (opts.between ? 'echo member' : `echo ${opts.parent}`) : 'exit 1'};; cand~2) ${opts.parent && opts.between ? `echo ${opts.parent}` : 'exit 1'};; *) exit 1;; esac\n`);
    chmodSync(join(dir, 'bin/gh'), 0o755); chmodSync(join(dir, 'bin/git'), 0o755);
    const r = spawnSync('bash', ['-c', `${fn}\nquality_green cand`], { encoding: 'utf8', timeout: 20_000, env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  } finally { rmSync(dir, { recursive: true, force: true }); }
};
test('a scoped candidate run is trusted when the trunk under it had browser (combat) green', () => {
  assert.equal(guard({ parent: 'base', runs: { cand: [['1', 'https://x/runs/1']], base: [['2', 'https://x/runs/2']] }, verdicts: { 1: 'scoped', 2: 'yes' } }), 'https://x/runs/1');
});
test('a scoped candidate run fails closed when the trunk run is red, has no combat job, is missing, or the parent is unknown', () => {
  const cand = { cand: [['1', 'https://x/runs/1']] as [string, string][] };
  assert.equal(guard({ parent: 'base', runs: { ...cand, base: [['2', 'https://x/runs/2']] }, verdicts: { 1: 'scoped', 2: 'no' } }), '');
  assert.equal(guard({ parent: 'base', runs: { ...cand, base: [['2', 'https://x/runs/2']] }, verdicts: { 1: 'scoped', 2: 'scoped' } }), '');
  assert.equal(guard({ parent: 'base', runs: { ...cand, base: [] }, verdicts: { 1: 'scoped' } }), '');
  assert.equal(guard({ parent: null, runs: { ...cand }, verdicts: { 1: 'scoped' } }), '');
});
test('a full green candidate run needs no trunk look-up', () => {
  assert.equal(guard({ parent: null, runs: { cand: [['1', 'https://x/runs/1']] }, verdicts: { 1: 'yes' } }), 'https://x/runs/1');
});
test('a two-member candidate: the member merge has no run, so the trunk under it decides (both ways)', () => {
  const runs = { cand: [['1', 'https://x/runs/1']] as [string, string][], member: [] as [string, string][], base: [['2', 'https://x/runs/2']] as [string, string][] };
  assert.equal(guard({ parent: 'base', between: true, runs, verdicts: { 1: 'scoped', 2: 'yes' } }), 'https://x/runs/1');
  assert.equal(guard({ parent: 'base', between: true, runs, verdicts: { 1: 'scoped', 2: 'no' } }), '');
  assert.equal(guard({ parent: 'base', between: true, runs: { ...runs, base: [] }, verdicts: { 1: 'scoped' } }), '');
});

test('a gh failure while looking up the trunk commit stops the walk and fails closed (never trusts an older parent)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qgreen-'));
  try {
    mkdirSync(join(dir, 'bin'));
    // list for the candidate works (scoped run); every list call on a parent exits 1; cand~1 is a parent, cand~2 would be an older green trunk.
    writeFileSync(join(dir, 'bin/gh'), '#!/bin/sh\nif [ "$2" = list ]; then case "$6" in cand) echo "1 https://x/runs/1";; *) exit 1;; esac; exit 0; fi\ncase "$3" in 1) echo scoped;; 2) echo yes;; esac\n');
    writeFileSync(join(dir, 'bin/git'), '#!/bin/sh\ncase "$4" in cand~1) echo parent;; cand~2) echo older;; *) exit 1;; esac\n');
    chmodSync(join(dir, 'bin/gh'), 0o755); chmodSync(join(dir, 'bin/git'), 0o755);
    const r = spawnSync('bash', ['-c', `${fn}\nquality_green cand`], { encoding: 'utf8', timeout: 20_000, env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` } });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
