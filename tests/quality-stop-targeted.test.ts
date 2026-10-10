// The lane Stop gate caps its test workers (Lead, 2026-10-09: node --test on every core drove the shared Mac's load to 80).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STOP_WORKERS_DEFAULT, stopWorkers } from '../scripts/lib/stop-workers.mjs';

test('the Stop gate runs 2 test workers by default', () => {
  assert.equal(STOP_WORKERS_DEFAULT, 2);
  assert.equal(stopWorkers({}), 2);
  assert.equal(stopWorkers({ QUALITY_STOP_WORKERS: '' }), 2);
});

test('QUALITY_STOP_WORKERS overrides with a whole number 1..64; anything else falls back to 2 (never 0 = every core)', () => {
  assert.equal(stopWorkers({ QUALITY_STOP_WORKERS: '1' }), 1);
  assert.equal(stopWorkers({ QUALITY_STOP_WORKERS: ' 4 ' }), 4);
  assert.equal(stopWorkers({ QUALITY_STOP_WORKERS: '64' }), 64);
  for (const bad of ['0', '-1', '65', '99', '2.5', 'abc', '1e2', '08']) assert.equal(stopWorkers({ QUALITY_STOP_WORKERS: bad }), 2, bad);
});

test('quality-stop-targeted.mjs passes the cap to node --test and keeps the same checks', () => {
  const src = readFileSync('scripts/quality-stop-targeted.mjs', 'utf8');
  assert.match(src, /run\('node', \['--test', `--test-concurrency=\$\{stopWorkers\(\)\}`, '--test-skip-pattern=\\\\\[slow\\\\\]', \.\.\.files\]\)/);
  assert.match(src, /run\('npx', \['eslint', 'src'\]\)/);
  assert.match(src, /run\('npm', \['run', 'typecheck:tests'\]\)/);
  assert.match(src, /ALWAYS = \['tests\/record-version-guard\.test\.ts'\]/);
});
