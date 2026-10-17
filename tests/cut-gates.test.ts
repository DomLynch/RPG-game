// scripts/cut-release.mjs, the two pre-launch hard stops (Strategy 2026-10-15; data in scripts/cut-gates.json).
// Gate 1 (checkRangeHasPrs): a commit in <live>..<base> that belongs to no PR stops the cut, except the exempt shas in the data file.
// Gate 2 (checkWatchedPaths): a cut that changes .github/workflows, .vscode or public/fonts stops.
// Both run on a fixture repo. The last test is the mutation check: each gate's decision line is broken in a copy of the script, and the scenarios must catch every mutant.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

import { checkRangeHasPrs, checkWatchedPaths, loadGates } from '../scripts/cut-release.mjs';
import { gatePaths, gateRange } from '../scripts/release-train.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const mkGit = (cwd: string) => (args: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL' });

/** live (one commit), then three commits on top: reviewed (has a PR), unreviewed (none) and one that touches a file under `badPath`. */
function fixture(badPath = '.github/workflows/x.yml') {
  const dir = mkdtempSync(join(tmpdir(), 'gates-'));
  const git = mkGit(dir), ok = (args: string[]) => { const r = git(args); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const commit = (file: string, msg: string) => { mkdirSync(dirname(join(dir, file)), { recursive: true }); writeFileSync(join(dir, file), `${msg}\n`); ok(['add', '-A']); ok(['commit', '-q', '-m', msg]); return ok(['rev-parse', 'HEAD']); };
  ok(['init', '-q', '-b', 'main']);
  const live = commit('a.txt', 'live');
  const reviewed = commit('b.txt', 'reviewed');
  const unreviewed = commit('c.txt', 'unreviewed');
  const base = ok(['rev-parse', 'HEAD']);
  const bad = commit(badPath, 'touches a watched path');
  return { git, live, reviewed, unreviewed, base, bad, cut: bad, commit };
}
const prsFor = (map: Record<string, number[]>) => (sha: string) => map[sha] ?? [];

// ---- gate 1 ----
test('gate 1 stops on a commit with no PR and names its sha', () => {
  const f = fixture();
  const r = checkRangeHasPrs({ git: f.git, pullsOf: prsFor({ [f.reviewed]: [1] }), live: f.live, base: f.base, gates: { noPrExempt: [] } });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, [f.unreviewed]);
  assert.match(String(r.reason), new RegExp(f.unreviewed.slice(0, 9)));
});

test('gate 1 passes when every commit in live..base has a PR', () => {
  const f = fixture();
  const r = checkRangeHasPrs({ git: f.git, pullsOf: prsFor({ [f.reviewed]: [1], [f.unreviewed]: [2] }), live: f.live, base: f.base, gates: { noPrExempt: [] } });
  assert.deepEqual(r, { ok: true, checked: 2 });
});

test('gate 1 skips an exempt sha (a prefix is enough) and still stops on the others', () => {
  const f = fixture();
  const ex = { noPrExempt: [{ sha: f.unreviewed.slice(0, 9) }] };
  assert.equal(checkRangeHasPrs({ git: f.git, pullsOf: prsFor({ [f.reviewed]: [1] }), live: f.live, base: f.base, gates: ex }).ok, true);
  assert.equal(checkRangeHasPrs({ git: f.git, pullsOf: prsFor({}), live: f.live, base: f.base, gates: ex }).ok, false);   // the reviewed commit has no PR here
});

test('gate 1 fails closed: no --live, a bad range, or a failed GitHub lookup is a stop, never a pass', () => {
  const f = fixture();
  const gates = { noPrExempt: [] };
  const noLive = checkRangeHasPrs({ git: f.git, pullsOf: prsFor({}), live: undefined, base: f.base, gates });
  assert.equal(noLive.ok, false); assert.match(String(noLive.reason), /--live/);
  const badRange = checkRangeHasPrs({ git: f.git, pullsOf: prsFor({}), live: '0'.repeat(40), base: f.base, gates });
  assert.equal(badRange.ok, false); assert.match(String(badRange.reason), /cannot list/);
  const down = checkRangeHasPrs({ git: f.git, pullsOf: () => { throw new Error('HTTP 502'); }, live: f.live, base: f.base, gates });
  assert.equal(down.ok, false); assert.match(String(down.reason), /HTTP 502/);
});

test('the real data file exempts exactly the four 2026-10-15 shas and watches the three paths', () => {
  const g = loadGates();
  assert.deepEqual(g.noPrExempt.map((e: { sha: string }) => e.sha).sort(), ['7f19a0842', 'd531a0f1d', 'e35b9b16d', 'e5410d2c4']);
  assert.deepEqual(g.watchedPaths, ['.github/workflows', '.vscode', 'public/fonts']);
});

// ---- gate 2 ----
test('gate 2 stops on a change under each watched path and names the file', () => {
  for (const path of ['.github/workflows/x.yml', '.vscode/tasks.json', 'public/fonts/fa.woff2']) {
    const f = fixture(path);
    const r = checkWatchedPaths({ git: f.git, base: f.base, cut: f.cut });
    assert.equal(r.ok, false, path);
    assert.deepEqual(r.files, [path]);
    assert.match(String(r.reason), /watched paths/);
  }
});

test('gate 2 passes a cut that changes other paths, including look-alikes of a watched path', () => {
  for (const path of ['src/x.ts', '.github/CODEOWNERS', 'public/fonts-extra/a.txt', '.vscodex/a.json']) {
    const f = fixture(path);
    assert.deepEqual(checkWatchedPaths({ git: f.git, base: f.base, cut: f.cut }), { ok: true, allowed: [] }, path);
  }
});

test('gate 2 fails closed on a diff git cannot run', () => {
  const f = fixture();
  const r = checkWatchedPaths({ git: f.git, base: f.base, cut: '0'.repeat(40) });
  assert.equal(r.ok, false); assert.match(String(r.reason), /cannot diff/);
});

// ---- gate 2: the reviewed-blob list ----
const blobAt = (f: ReturnType<typeof fixture>, rev: string, path: string) => f.git(['rev-parse', `${rev}:${path}`]).stdout.trim();

test('gate 2 passes a changed watched file whose blob is the listed, reviewed blob', () => {
  const f = fixture('.github/workflows/x.yml');
  const gates = { watchedPaths: ['.github/workflows'], watchedAllow: [{ path: '.github/workflows/x.yml', blob: blobAt(f, f.cut, '.github/workflows/x.yml'), pr: 1, note: 'reviewed' }] };
  assert.deepEqual(checkWatchedPaths({ git: f.git, base: f.base, cut: f.cut, gates }), { ok: true, allowed: ['.github/workflows/x.yml'] });
});

test('gate 2 stops the same path once it is edited after the review (the blob no longer matches)', () => {
  const f = fixture('.github/workflows/x.yml');
  const reviewed = blobAt(f, f.cut, '.github/workflows/x.yml');
  const edited = f.commit('.github/workflows/x.yml', 'edited after the review');
  const gates = { watchedPaths: ['.github/workflows'], watchedAllow: [{ path: '.github/workflows/x.yml', blob: reviewed, pr: 1, note: 'reviewed' }] };
  const r = checkWatchedPaths({ git: f.git, base: f.base, cut: edited, gates });
  assert.equal(r.ok, false); assert.deepEqual(r.files, ['.github/workflows/x.yml']);
});

test('gate 2 stops an unlisted path, and a listed blob does not cover a different path', () => {
  const f = fixture('.github/workflows/x.yml');
  const other = f.commit('.github/workflows/y.yml', 'a second workflow');
  const gates = { watchedPaths: ['.github/workflows'], watchedAllow: [{ path: '.github/workflows/x.yml', blob: blobAt(f, other, '.github/workflows/x.yml'), pr: 1, note: 'reviewed' }] };
  const r = checkWatchedPaths({ git: f.git, base: f.base, cut: other, gates });
  assert.equal(r.ok, false); assert.deepEqual(r.files, ['.github/workflows/y.yml']);
});

test('gate 2 never allows a deleted watched file (it has no blob), even one that is on the list', () => {
  const f = fixture();
  const present = f.commit('.github/workflows/z.yml', 'present in the base');
  f.git(['rm', '-q', '.github/workflows/z.yml']); f.git(['commit', '-q', '-m', 'delete it']);
  const cut = f.git(['rev-parse', 'HEAD']).stdout.trim();
  const gates = { watchedPaths: ['.github/workflows'], watchedAllow: [{ path: '.github/workflows/z.yml', blob: blobAt(f, present, '.github/workflows/z.yml'), pr: 1, note: 'reviewed' }] };
  const r = checkWatchedPaths({ git: f.git, base: present, cut, gates });
  assert.equal(r.ok, false); assert.deepEqual(r.files, ['.github/workflows/z.yml']);
});

test('every reviewed-list entry in the real data file names a full blob, its PR and a note', () => {
  for (const a of loadGates().watchedAllow) {
    assert.match(a.blob, /^[0-9a-f]{40}$/, a.path);
    assert.ok(Number.isInteger(a.pr) && a.pr > 0, a.path);
    assert.ok(a.note.length > 0, a.path);
  }
});

// ---- a bare --live ----
test('a bare or non-hex --live is refused with the reason, never a crash', () => {
  const f = fixture();
  for (const live of [true, '', 'main', 'zz12345', '12']) {
    const r = checkRangeHasPrs({ git: f.git, pullsOf: prsFor({}), live: live as unknown as string, base: f.base, gates: { noPrExempt: [] } });
    assert.equal(r.ok, false, String(live)); assert.match(String(r.reason), /--live/);
  }
});

// ---- the train's automatic cutter runs the same gates ----
test('a train cut with a no-PR commit stops with the reason (gateRange throws)', () => {
  const f = fixture();
  assert.throws(() => gateRange({ git: f.git, pullsOf: prsFor({ [f.reviewed]: [1] }), live: f.live, base: f.base, gates: { noPrExempt: [] } }),
    (e: Error) => /^STOP gate 1: 1 commit\(s\)/.test(e.message) && e.message.includes(f.unreviewed.slice(0, 9)) && /no candidate was cut/.test(e.message));
  assert.deepEqual(gateRange({ git: f.git, pullsOf: prsFor({ [f.reviewed]: [1], [f.unreviewed]: [2] }), live: f.live, base: f.base, gates: { noPrExempt: [] } }), { ok: true, checked: 2 });
});

test('a train cut that changes a watched path stops before the push (gatePaths throws)', () => {
  const f = fixture('.vscode/tasks.json');
  assert.throws(() => gatePaths({ git: f.git, base: f.base, cut: f.cut }), (e: Error) => /^STOP gate 2:/.test(e.message) && e.message.includes('.vscode/tasks.json') && /nothing was pushed/.test(e.message));
});

test('the train calls gate 1 before it creates a branch and gate 2 before it pushes, and drops the local branch on a stop', () => {
  const src = readFileSync(join(here, '../scripts/release-train.mjs'), 'utf8');
  const at = (needle: string) => { const i = src.indexOf('  ' + needle); assert.ok(i > 0, `missing in cut(): ${needle}`); return i; };
  assert.ok(at('gateRange({') < at("if (git(['switch', '-q', '-C'"), 'gate 1 must run before the release branch is created');
  assert.ok(at('try { gatePaths({') < at('const pushed = pushWithRetry('), 'gate 2 must run before the push');
  assert.match(src, /catch \(e\) \{ git\(\['switch', '-q', '--detach', baseSha\]\); git\(\['branch', '-q', '-D', `release-\$\{name\}`\]\); throw e; \}/);
});

// ---- mutation check ----
// Each mutant breaks one decision in a copy of the script; the scenarios below (the same assertions as above, as booleans) must fail for every one of them.
const MUTANTS: Array<[string, string, string]> = [
  ['gate 1 never reports a missing PR', 'if (missing.length) return', 'if (false) return'],
  ['gate 1 ignores the exempt list inverted', "!exempt.some(e => s.startsWith(e))", 'exempt.some(e => s.startsWith(e))'],
  ['gate 1 treats a failed lookup as a pass', 'catch (e) { return { ok: false, reason: `gate 1: cannot ask', 'catch (e) { continue; return { ok: false, reason: `gate 1: cannot ask'],
  ['gate 2 never reports a changed path', 'if (files.length) return', 'if (false) return'],
  ['gate 2 watches nothing', "const watched = gates.watchedPaths || [];", 'const watched = [];'],
  ['gate 2 allows a listed path at any blob', 'a.path === f && a.blob === b', 'a.path === f'],
  ['gate 2 allows any changed file once the list is non-empty', 'return !!b && allow.some(', 'return allow.length > 0 || allow.some('],
  ['gate 1 accepts a bare --live', "typeof live !== 'string' || !/^[0-9a-f]{7,40}$/i.test(live)", '!live'],
];

async function scenariosHold(mod: { checkRangeHasPrs: typeof checkRangeHasPrs; checkWatchedPaths: typeof checkWatchedPaths }): Promise<boolean> {
  try {
    const f = fixture('.github/workflows/x.yml');
    const none = { noPrExempt: [] as Array<{ sha: string }> };
    const stops = mod.checkRangeHasPrs({ git: f.git, pullsOf: prsFor({ [f.reviewed]: [1] }), live: f.live, base: f.base, gates: none });
    const exempt = mod.checkRangeHasPrs({ git: f.git, pullsOf: prsFor({ [f.reviewed]: [1] }), live: f.live, base: f.base, gates: { noPrExempt: [{ sha: f.unreviewed.slice(0, 9) }] } });
    const noLive = mod.checkRangeHasPrs({ git: f.git, pullsOf: prsFor({}), live: undefined as unknown as string, base: f.base, gates: none });
    const down = mod.checkRangeHasPrs({ git: f.git, pullsOf: () => { throw new Error('HTTP 502'); }, live: f.live, base: f.base, gates: none });
    const watched = mod.checkWatchedPaths({ git: f.git, base: f.base, cut: f.cut, gates: { watchedPaths: ['.github/workflows'] } });
    const f2 = fixture('src/x.ts');   // a cut that touches no watched path must pass: a gate that watches nothing filters nothing and would stop it
    const clean = mod.checkWatchedPaths({ git: f2.git, base: f2.base, cut: f2.cut, gates: { watchedPaths: ['.github/workflows'] } });
    const f3 = fixture('.github/workflows/x.yml');   // a listed path at its reviewed blob passes; the same path edited afterwards stops
    const rev = blobAt(f3, f3.cut, '.github/workflows/x.yml');
    const listed = { watchedPaths: ['.github/workflows'], watchedAllow: [{ path: '.github/workflows/x.yml', blob: rev, pr: 1, note: 'n' }] };
    const passes = mod.checkWatchedPaths({ git: f3.git, base: f3.base, cut: f3.cut, gates: listed });
    const edited = mod.checkWatchedPaths({ git: f3.git, base: f3.base, cut: f3.commit('.github/workflows/x.yml', 'edited'), gates: listed });
    const bare = mod.checkRangeHasPrs({ git: f.git, pullsOf: prsFor({}), live: true as unknown as string, base: f.base, gates: none });
    return !stops.ok && exempt.ok === true && !noLive.ok && !down.ok && !watched.ok && clean.ok === true && passes.ok === true && !edited.ok && !bare.ok;
  } catch { return false; }
}

test('mutation check: the scenarios hold on the real script and fail on every mutant', async () => {
  const src = readFileSync(join(here, '../scripts/cut-release.mjs'), 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'mut-'));
  copyFileSync(join(here, '../scripts/cut-gates.json'), join(dir, 'cut-gates.json'));
  const load = async (name: string, text: string) => { const p = join(dir, `${name}.mjs`); writeFileSync(p, text); return import(`${pathToFileURL(p).href}?${name}`); };
  assert.equal(await scenariosHold(await load('real', src)), true, 'the scenarios must hold on an unmutated copy');
  for (const [label, from, to] of MUTANTS) {
    assert.equal(src.split(from).length - 1, 1, `mutation target must appear exactly once in the script (the gate code changed?): ${label}`);
    assert.equal(await scenariosHold(await load(label.replace(/\W+/g, '-'), src.replace(from, to))), false, `mutant survived: ${label}`);
  }
});
