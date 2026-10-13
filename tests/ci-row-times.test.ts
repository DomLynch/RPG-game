// Hardening item 4, measurement only: scripts/ci-row-times.mjs turns a release-checks run's jobs into the per-row time table.
import assert from 'node:assert/strict';
import test from 'node:test';
import { markdown, rowTimes, summarize } from '../scripts/ci-row-times.mjs';

const t = (s: number) => new Date(Date.UTC(2026, 9, 13, 5, 0, 0) + s * 1000).toISOString();
const step = (name: string, from: number, to: number) => ({ name, started_at: t(from), completed_at: t(to) });
const job = (name: string, created: number, started: number, steps: ReturnType<typeof step>[], end: number) => ({ name, created_at: t(created), started_at: t(started), completed_at: t(end), conclusion: 'success', steps });

const slow = job('check 9 (polearm-browser-check)', 0, 2, [step('Set up job', 2, 3), step('Run actions/checkout@v4', 3, 35), step('Run actions/setup-node@v4', 35, 37), step('Run npm ci', 37, 40), step('Drop the Microsoft apt source', 40, 40), step('Run npx playwright install --with-deps chromium', 40, 65), step('Run npx playwright install --with-deps webkit', 65, 65), step('Lossless JPEG build tool and ffmpeg (arena-audio-check spawns ffmpeg)', 65, 80), step('Run npm run build', 80, 103), step('Release check 9', 103, 852), step('Run actions/upload-artifact@v4', 852, 853)], 856);
const fast = job('check 1 (finisher-preview)', 0, 300, [step('Run actions/checkout@v4', 300, 334), step('Run npm ci', 334, 338), step('Run npm run build', 338, 365), step('Release check 1', 365, 486)], 490);

test('rowTimes splits a CI row job into queue, setup phases and the row itself, slowest first; non-row jobs are ignored', () => {
  const rows = rowTimes([fast, { name: 'plan', created_at: t(0), started_at: t(1), completed_at: t(7), steps: [] }, slow, { name: 'summary', created_at: t(0), started_at: t(1), completed_at: t(19), steps: [] }]);
  assert.deepEqual(rows.map(r => r.index), [9, 1]);
  const r9 = rows[0];
  assert.equal(r9.queue, 2); assert.equal(r9.total, 854); assert.equal(r9.row, 749);
  assert.equal(r9.checkout, 32); assert.equal(r9.node, 2); assert.equal(r9['npm ci'], 3); assert.equal(r9.playwright, 25); assert.equal(r9.ffmpeg, 15); assert.equal(r9.build, 23);
  assert.equal(r9.setup, 32 + 2 + 3 + 25 + 15 + 23, 'setup = everything before the row command');
  assert.equal(rows[1].queue, 300, 'queue is created -> started: the runner cap, not work');
});

test('summarize: job-seconds, the setup share, the build share, longest row, median and longest queue', () => {
  const s = summarize(rowTimes([slow, fast]));
  assert.equal(s.rows, 2); assert.equal(s.jobSeconds, 854 + 190); assert.equal(s.longest, 854); assert.equal(s.longestQueue, 300);
  assert.equal(s.buildSeconds, 23 + 27);
  assert.ok(s.setupShare > 0 && s.setupShare < 1);
});

test('markdown prints one line per row under a header and a one-line summary; nothing throws on an empty run', () => {
  const md = markdown(rowTimes([slow, fast]));
  assert.match(md, /^2 CI rows, 1044 job-seconds;/);
  assert.match(md, /\| 9 \| polearm-browser-check \| 2 \| 32 \| 3 \| 25 \| 15 \| 23 \| 749 \| 854 \|/);
  assert.equal(md.split('\n').filter(l => /^\| \d+ \|/.test(l)).length, 2);
  assert.match(markdown([]), /^0 CI rows, 0 job-seconds;/);
});
