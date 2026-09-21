// The kill-link determinism release check (scripts/record-replay-check.mjs): passes on identical replay, passes with a message when
// the record's version is refused, and fails loudly on a silent mismatch. Each case runs the script against its own modified copy
// of tests/fixtures/fight-records.json (RECORD_REPLAY_FIXTURE).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeRecord, fromBase64Url, toBase64Url } from '../src/record.ts';
import { gunzipSync, gzipSync } from 'node:zlib';

const repo = process.cwd();
const fixture = JSON.parse(readFileSync(join(repo, 'tests', 'fixtures', 'fight-records.json'), 'utf8'));

// Run the check against a modified copy of the fixture, pointed at through RECORD_REPLAY_FIXTURE.
function runWith(mutate: (f: typeof fixture) => void, args: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'record-replay-'));
  const copy = JSON.parse(JSON.stringify(fixture)); mutate(copy);
  const file = join(dir, 'fight-records.json');
  writeFileSync(file, JSON.stringify(copy));
  return spawnSync(process.execPath, [join(repo, 'scripts', 'record-replay-check.mjs'), ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, RECORD_REPLAY_FIXTURE: file } });
}

test('record-replay-check: the committed references replay identically on this build (exit 0)', () => {
  const r = runWith(() => {});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout.trim().split('\n').pop()!);
  assert.equal(out.passed, true);
  assert.equal(out.results.length, fixture.records.length);
  for (const res of out.results) { assert.equal(res.outcome, 'died', `${res.name} ends in the recorded kill`); assert.equal(typeof res.digestMatch, 'boolean', 'the state digest is reported'); }
});

test('record-replay-check: a silent mismatch fails loudly and names the drift', () => {
  const r = runWith(f => { f.records[0].expect.killedTick += 3; });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /SILENT MISMATCH.*killedTick: expected \d+, got \d+/);
  assert.match(r.stderr, /no longer replay identically/);
});

test('record-replay-check: a state-digest drift alone is reported, and gates only with --strict', () => {
  const soft = runWith(f => { f.records[0].expect.digest = '0000000000000000'; });
  assert.equal(soft.status, 0, soft.stdout + soft.stderr);
  assert.equal(JSON.parse(soft.stdout.trim().split('\n').pop()!).results[0].digestMatch, false, 'reported, not fatal');
  const hard = runWith(f => { f.records[0].expect.digest = '0000000000000000'; }, ['--strict']);
  assert.equal(hard.status, 1, 'strict: the digest gates too');
  assert.match(hard.stdout, /digest: expected 0000000000000000, got [0-9a-f]{16}/);
});

test('record-replay-check: a record whose version is refused passes with a clean refusal, never a silent pass', async () => {
  // Rewrite the first record's bytes with an unknown version, 9 (magic F K then the version byte; 1 and 2 are the read set), re-gzip, re-encode.
  const r = runWith(f => {
    const bytes = gunzipSync(fromBase64Url(f.records[0].encoded));
    bytes[2] = 9;
    f.records[0].encoded = toBase64Url(new Uint8Array(gzipSync(bytes)));
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout.trim().split('\n').pop()!);
  assert.match(out.results[0].refused, /version 9 is not supported/);
  assert.equal(out.results[1].outcome, 'died', 'the other reference still replays');
  await assert.rejects(decodeRecord(fixture.records[0].encoded.slice(0, -4) + 'zzzz'), 'sanity: a corrupt string is refused by decodeRecord');
});
