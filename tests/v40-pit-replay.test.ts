// RV41 (the shared crowd-control ladder) must not touch a single Pit fight: the ladder is opt-in per fighter (Fighter.cc), so a record made by the RV40 build replays on this build tick for tick.
// tests/fixtures/v40-pit-records.json was written by scripts/record-replay-check.mjs --write on trunk 28a7cea6 (RECORD_VERSION 40), before the ladder existed: five reference fights against the Veteran.
// The gate is the check script itself (record-replay-check.mjs): same final tick, outcome and Killed tick for every record; on Linux x64 (where the fixture was written and CI runs) the fighters' final-state digest too,
// which is the byte-for-byte promise (the digest drifts by a float ulp on arm64, see the script's header).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeRecord, READABLE_VERSIONS, RECORD_VERSION } from '../src/fight/record.ts';

const repo = process.cwd(), file = join(repo, 'tests', 'fixtures', 'v40-pit-records.json');
const fixture = JSON.parse(readFileSync(file, 'utf8')) as { records: { name: string; encoded: string; expect: { digest: string } }[] };

test('RV41 reads every record the RV40 build wrote (the stamped versions are all still readable)', async () => {
  assert.equal(RECORD_VERSION, 50); assert.ok(fixture.records.length >= 5);
  for (const r of fixture.records) { const rec = await decodeRecord(r.encoded); assert.ok((READABLE_VERSIONS as readonly number[]).includes(rec.v) && rec.v <= 40, `${r.name} is a v${rec.v} record`); }
});

test('RV41 replays the RV40 build\'s Pit records identically (ticks, outcome, Killed tick; the final-state digest on Linux x64)', () => {
  const strict = process.platform === 'linux' && process.arch === 'x64';
  const r = spawnSync(process.execPath, [join(repo, 'scripts', 'record-replay-check.mjs'), ...(strict ? ['--strict'] : [])], { cwd: repo, encoding: 'utf8', env: { ...process.env, RECORD_REPLAY_FIXTURE: file } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout.trim().split('\n').pop()!) as { passed: boolean; results: { name: string; digest?: string; error?: string }[] };
  assert.equal(out.passed, true); assert.equal(out.results.length, fixture.records.length);
  assert.deepEqual(out.results.filter((x) => x.error), []);
  if (strict) for (const x of out.results) assert.equal(x.digest, fixture.records.find((f) => f.name === x.name)!.expect.digest, `${x.name}: the final state is byte for byte the RV40 build's`);
});

test('mutation: a fixture whose expected Killed tick is off by one fails the gate', () => {
  const bad = JSON.parse(JSON.stringify(fixture)); bad.records[0].expect.killedTick += 1;
  const dir = mkdtempSync(join(tmpdir(), 'v40-pit-')), tmp = join(dir, 'bad.json');
  try { writeFileSync(tmp, JSON.stringify(bad)); const r = spawnSync(process.execPath, [join(repo, 'scripts', 'record-replay-check.mjs')], { cwd: repo, encoding: 'utf8', env: { ...process.env, RECORD_REPLAY_FIXTURE: tmp } }); assert.notEqual(r.status, 0, 'a wrong expectation must fail the script'); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});
