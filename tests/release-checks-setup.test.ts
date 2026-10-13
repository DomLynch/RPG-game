// Release-checks setup cost (Deploy, release speed 2026-10-13): EH's run spent ~110-125 s of identical setup in each of 38 jobs, 45% of all runner time.
// ffmpeg is the heaviest apt package in that setup and only arena-audio-check spawns it (a Mac-only row: CI never schedules it); jpegtran is needed by EVERY
// job because npm run build packs textures through scripts/lossless-jpeg.mjs. This pins that split so neither tool is dropped for the build nor installed for nothing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const yml = readFileSync('.github/workflows/release-checks.yml', 'utf8');
const stepOf = (name: string) => { const i = yml.indexOf(`- name: ${name}`); assert.ok(i >= 0, `step ${name}`); const rest = yml.slice(i + 1), j = rest.search(/\n {6}- /); return yml.slice(i, j < 0 ? undefined : i + 1 + j); };

test('release-checks: jpegtran is installed in every job (the build needs it), ffmpeg only for the row that spawns it', () => {
  // only the step's own `if:` / `run:` lines count: the comment between the two steps mentions ffmpeg
  const lines = (name: string) => stepOf(name).split('\n').filter(l => /^\s+(if|run):/.test(l)).map(l => l.trim());
  const jpeg = lines('Lossless JPEG build tool'), ff = lines('ffmpeg for arena-audio-check');
  assert.deepEqual(jpeg, ['run: sudo apt-get install -y libjpeg-turbo-progs'], 'the build tool step is unconditional and carries no ffmpeg');
  assert.deepEqual(ff, ["if: contains(matrix.check.argv, 'arena-audio')", 'run: sudo apt-get install -y ffmpeg'], 'ffmpeg runs only for arena-audio');
});

test('release-checks: the only row script that mentions ffmpeg is the one the ffmpeg step names (a new ffmpeg row must extend the condition)', () => {
  const gate = JSON.parse(readFileSync('.quality-gate.json', 'utf8')) as { release_commands: string[][] };
  const users = gate.release_commands.map((c, i) => ({ i: i + 1, f: c.find(a => /\.(mjs|js)$/.test(a)) })).filter(r => r.f && /ffmpeg/.test(readFileSync(r.f, 'utf8')));
  assert.ok(users.length >= 1 && users.every(r => /arena-audio/.test(r.f!)), `ffmpeg users: ${users.map(r => `${r.i}:${r.f}`).join(', ')}`);
});
