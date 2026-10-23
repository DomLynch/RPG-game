// Release-checks setup cost (Deploy, release speed 2026-10-13, #2613; Lead 2026-10-22 after the K6q26 apt stall): ffmpeg is the heaviest apt package in a row group's
// setup and only arena-audio-check spawns it (a Mac-only row: CI never schedules it); jpegtran is needed by EVERY group because npm run build packs textures through
// scripts/lossless-jpeg.mjs. Every apt fetch is bounded so a stalled mirror fails in minutes, not at the job's 30-min cap. This pins all three.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const yml = readFileSync('.github/workflows/release-checks.yml', 'utf8');
const stepOf = (name: string) => { const i = yml.indexOf(`- name: ${name}`); assert.ok(i >= 0, `step ${name}`); const rest = yml.slice(i + 1), j = rest.search(/\n {6}- /); return yml.slice(i, j < 0 ? undefined : i + 1 + j); };
// only the step's own `if:` / `run:` lines count: the comments between the steps mention the packages
const lines = (name: string) => stepOf(name).split('\n').filter(l => /^\s+(if|run):/.test(l)).map(l => l.trim());

const WRAP = 'bash -c "$APT_OR_MIRROR" apt-or-mirror ';
test('release-checks: jpegtran is installed in every group (the build needs it), ffmpeg only for a group that runs the row that spawns it', () => {
  assert.deepEqual(lines('Lossless JPEG build tool'), [`run: ${WRAP}"sudo apt-get install -y libjpeg-turbo-progs"`], 'the build tool step is unconditional and carries no ffmpeg');
  assert.deepEqual(lines('ffmpeg for arena-audio-check'), ["if: contains(matrix.group.rows, 'arena-audio')", `run: APT_TRY_S=600 ${WRAP}"sudo apt-get install -y ffmpeg"`], 'ffmpeg runs only for arena-audio');
  assert.match(yml, /\n {4}name: checks \$\{\{ matrix\.group\.label \}\}/, 'the row jobs are groups (matrix.group): a condition on matrix.check would be dead');
  assert.doesNotMatch(yml, /matrix\.check\./, 'no step reads the pre-group matrix.check');
});

// The apt helper lives in each workflow's env, not in a repo script: a job checks out the PR head or the candidate tree, which may predate any script (Lead 2026-10-22, K6q26/K6q27/K6q28b apt stalls).
const WORKFLOWS = ['release-checks', 'unit-ci', 'quality'].map(f => ({ f, text: readFileSync(`.github/workflows/${f}.yml`, 'utf8') }));
const helperOf = (text: string) => { const m = /\n {2}APT_OR_MIRROR: \|\n((?: {4}.*\n)+)/.exec(text); assert.ok(m, 'APT_OR_MIRROR env block'); return m[1]; };

test('APT_OR_MIRROR is the same text in release-checks, unit-ci and quality, and it bounds, caps, repairs, moves to archive.ubuntu.com and retries once', () => {
  const [first, ...rest] = WORKFLOWS.map(w => helperOf(w.text));
  for (const [i, h] of rest.entries()) assert.equal(h, first, `${WORKFLOWS[i + 1].f}.yml's APT_OR_MIRROR differs from release-checks.yml's`);
  assert.match(first, /Acquire::http::Timeout "20".*Acquire::Retries "3".*timeout "\$try_s" bash -c "\$cmd" && exit 0.*dpkg --configure -a.*s#azure\.archive\.ubuntu\.com#archive\.ubuntu\.com#g.*apt-get update\n.*timeout "\$try_s" bash -c "\$cmd"\n$/s,
    'bound every fetch, run the call under the cap, else repair dpkg, swap the mirror, refresh, run it once more (and exit with that run)');
  assert.match(first, /try_s=\$\{APT_TRY_S:-300\}/);
  // K6q33 #3650 (2026-10-23): timeout killed the helper's bash, but Playwright's `sudo apt-get` (its own sudo session) lived on and held the dpkg lock, so the retry
  // failed on "Could not get lock". Before the repair: TERM the leftover apt-get/dpkg, wait for them to go, then KILL; later apt calls wait up to 120 s for the lock.
  assert.match(first, /DPkg::Lock::Timeout "120"/, 'apt waits for the dpkg lock instead of failing on it');
  assert.match(first, /&& exit 0\n.*\n {4}sudo pkill -TERM -x apt-get.*sudo pkill -TERM -x dpkg.*\n.*pgrep -x apt-get.*pgrep -x dpkg.*break.*\n {4}sudo pkill -KILL -x apt-get.*sudo pkill -KILL -x dpkg.*\n {4}sudo dpkg --configure -a/,
    'the leftover apt-get/dpkg from the timed-out call is stopped before the repair and the retry');
});

test('every apt call in release-checks, unit-ci and quality goes through APT_OR_MIRROR', () => {
  for (const { f, text } of WORKFLOWS) {
    // the helper itself has no install line (only its own `apt-get update`), so every non-comment line that installs is a step's call
    const calls = text.split('\n').filter(l => /(apt-get install|playwright install --with-deps)/.test(l) && !/^\s*#/.test(l));
    assert.ok(calls.length >= 1, `${f}: apt calls found`);
    for (const c of calls) assert.ok(c.includes(WRAP), `${f}.yml: not wrapped: ${c.trim()}`);
  }
});

test('release-checks: the only row script that mentions ffmpeg is the one the ffmpeg step names (a new ffmpeg row must extend the condition)', () => {
  const gate = JSON.parse(readFileSync('.quality-gate.json', 'utf8')) as { release_commands: string[][] };
  const users = gate.release_commands.map((c, i) => ({ i: i + 1, f: c.find(a => /\.(mjs|js)$/.test(a)) })).filter(r => r.f && /ffmpeg/.test(readFileSync(r.f, 'utf8')));
  assert.ok(users.length >= 1 && users.every(r => /arena-audio/.test(r.f!)), `ffmpeg users: ${users.map(r => `${r.i}:${r.f}`).join(', ')}`);
});
