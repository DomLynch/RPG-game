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

test('release-checks: jpegtran is installed in every group (the build needs it), ffmpeg only for a group that runs the row that spawns it', () => {
  assert.deepEqual(lines('Lossless JPEG build tool'), ['run: apt-or-mirror timeout 300 sudo apt-get install -y libjpeg-turbo-progs'], 'the build tool step is unconditional and carries no ffmpeg');
  assert.deepEqual(lines('ffmpeg for arena-audio-check'), ["if: contains(matrix.group.rows, 'arena-audio')", 'run: apt-or-mirror timeout 600 sudo apt-get install -y ffmpeg'], 'ffmpeg runs only for arena-audio');
  assert.match(yml, /\n {4}name: checks \$\{\{ matrix\.group\.label \}\}/, 'the row jobs are groups (matrix.group): a condition on matrix.check would be dead');
  assert.doesNotMatch(yml, /matrix\.check\./, 'no step reads the pre-group matrix.check');
});

test('release-checks: every apt fetch is bounded before the first apt call (playwright --with-deps included)', () => {
  const bound = yml.indexOf('- name: Bound apt fetches'), firstApt = Math.min(...['npx playwright install --with-deps', 'apt-get install'].map(s => yml.indexOf(s)).filter(i => i >= 0));
  assert.ok(bound >= 0 && bound < firstApt, 'the bound step comes before any apt call');
  assert.match(stepOf('Bound apt fetches'), /Acquire::http::Timeout "20".*Acquire::Retries "3"/s);
});

test('release-checks: every apt call goes through apt-or-mirror, which retries once on archive.ubuntu.com (Lead 2026-10-22, K6q27 stalls)', () => {
  const calls = yml.split('\n').filter(l => /^\s+(- )?run: .*(apt-get install|playwright install --with-deps)/.test(l)).map(l => l.trim().replace(/^- /, ''));
  assert.ok(calls.length >= 4, `apt calls: ${calls.join(' | ')}`);
  for (const c of calls) assert.match(c, /^run: apt-or-mirror /, `not wrapped: ${c}`);
  const helper = stepOf('Bound apt fetches');
  assert.match(helper, /"\$@" && exit 0.*s#azure\.archive\.ubuntu\.com#archive\.ubuntu\.com#g.*apt-get update.*"\$@"/s, 'the helper runs the call, swaps the mirror, refreshes and runs it once more');
  assert.match(helper, /tee \/usr\/local\/bin\/apt-or-mirror\n\s+sudo chmod \+x \/usr\/local\/bin\/apt-or-mirror/);
});

test('release-checks: the only row script that mentions ffmpeg is the one the ffmpeg step names (a new ffmpeg row must extend the condition)', () => {
  const gate = JSON.parse(readFileSync('.quality-gate.json', 'utf8')) as { release_commands: string[][] };
  const users = gate.release_commands.map((c, i) => ({ i: i + 1, f: c.find(a => /\.(mjs|js)$/.test(a)) })).filter(r => r.f && /ffmpeg/.test(readFileSync(r.f, 'utf8')));
  assert.ok(users.length >= 1 && users.every(r => /arena-audio/.test(r.f!)), `ffmpeg users: ${users.map(r => `${r.i}:${r.f}`).join(', ')}`);
});
