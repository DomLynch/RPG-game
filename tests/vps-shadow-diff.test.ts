// scripts/vps-shadow/rows-lib.mjs + scripts/vps-shadow-diff.mjs: the VPS shadow of the release rows reads the Mac's deploy log and the
// VPS rows.json and prints one line per row (result, seconds, pins) with a same/differs verdict; row 49 is flagged Linux WebKit ≠ Mac Safari.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TIMING_NOTE, WEBKIT_NOTE, diffTable, extractPins, macRows, parseRowsLog, rowSet, timingOf } from '../scripts/vps-shadow/rows-lib.mjs';

type Row = { name: string; timing?: string; note?: string };
const macLog = [
  'Release check 2/49 started at 12:00:00 — node scripts/roster-browser-check.mjs',
  'Release check 1/49 passed in 41s, ended 12:00:41 — node scripts/finisher-preview.mjs --only runThrough --no-video --label run-through-gate',
  'Release check 7/49 FAILED (exit 1) in 60s, ended 12:01:00 — node scripts/counter-browser-check.mjs',
  'Retrying release check 7 alone',
  'Release check 7/49 passed in 55s, ended 12:02:00 — node scripts/counter-browser-check.mjs',
  'Release check 13/49 trusted from CI release-checks for abc — node scripts/account-database-check.mjs',
  'Release check 49/49 passed in 56s, ended 12:03:00 — node scripts/browser-replay-check.mjs --engine webkit',
  'Release check 48/49 CEILING 600s — killing the process group — node scripts/browser-replay-check.mjs',
  'Release checks passed for 0123456789abcdef0123456789abcdef01234567',
].join('\n');

test('the release-checks log parses per row: last line wins, retries counted, trusted and ceiling rows kept apart', () => {
  const { total, rows } = parseRowsLog(macLog);
  assert.equal(total, 49);
  const by = new Map(rows.map(r => [r.index, r]));
  assert.deepEqual(by.get(1), { index: 1, command: 'node scripts/finisher-preview.mjs --only runThrough --no-video --label run-through-gate', status: 'pass', seconds: 41, attempts: 1 });
  assert.equal(by.get(7)!.status, 'pass'); assert.equal(by.get(7)!.attempts, 2); assert.equal(by.get(7)!.seconds, 55);
  assert.equal(by.get(13)!.status, 'trusted'); assert.equal(by.get(13)!.trusted, 'CI release-checks for abc');
  assert.equal(by.get(48)!.status, 'ceiling'); assert.equal(by.get(48)!.seconds, 600);
  assert.equal(by.has(2), false, 'a started line is not a result');
  assert.equal(macRows(macLog).revision, '0123456789abcdef0123456789abcdef01234567');
});

test('a Mac release-checks.json receipt is the other accepted Mac shape', () => {
  const receipt = JSON.stringify({ revision: 'f'.repeat(40), passed: true, checks: 2, checks_detail: [{ index: 1, command: 'node a.mjs', seconds: 3.5, retried: true }, { index: 2, command: 'node b.mjs', seconds: 0, retried: false, trusted: 'CI' }] });
  const mac = macRows(receipt);
  assert.equal(mac.total, 2);
  assert.deepEqual(mac.rows.map((r: { status: string; attempts: number }) => [r.status, r.attempts]), [['pass', 2], ['trusted', 1]]);
});

test('pins: hash, digest, snapshot and state-hash values a row log prints, in order, de-duplicated; the webkit row is named', () => {
  const log = 'state hash dwarf:828 = 9f8e7d6c5b4a\nreplay digest: 9f8e7d6c5b4a (again)\nsnapshot sha256 0011223344556677\nport 41234 no hash here\n';
  assert.deepEqual(extractPins(log), ['9f8e7d6c5b4a', '0011223344556677']);
  const set = rowSet([['node', 'scripts/browser-replay-check.mjs'], ['node', 'scripts/browser-replay-check.mjs', '--engine', 'webkit']]);
  assert.equal(set[0].note, undefined); assert.equal(set[1].note, WEBKIT_NOTE); assert.equal(set[1].name, 'browser-replay-check.mjs');
});

test('timing class per row script: virtual clock (harness-clock / page.clock), wall clock (a browser on real time), or none (no browser)', () => {
  assert.equal(timingOf("import { chromium } from 'playwright';\nimport { installClock } from './lib/harness-clock.mjs';"), 'virtual');
  assert.equal(timingOf("import { chromium } from 'playwright';\nawait page.waitForTimeout(500);"), 'wall');
  assert.equal(timingOf("import { execFileSync } from 'node:child_process'; initdb"), 'none');
  const sources: Record<string, string> = { 'scripts/a.mjs': "playwright page.clock.install()", 'scripts/b.mjs': 'playwright only', 'scripts/c.mjs': 'no browser' };
  const set = rowSet([['node', 'scripts/a.mjs'], ['node', 'scripts/b.mjs', '--engine', 'webkit'], ['node', 'scripts/c.mjs']], (s: string) => sources[s]);
  assert.deepEqual(set.map((r: Row) => [r.timing, r.note]), [['virtual', undefined], ['wall', `${WEBKIT_NOTE}; ${TIMING_NOTE}`], ['none', undefined]]);
  // the real row set: every browser row is classed, and the two replay rows drive the virtual clock
  const real = rowSet(JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands, (s: string) => readFileSync(s, 'utf8'));
  assert.equal(real.filter((r: Row) => r.timing === undefined).length, 0);
  assert.equal(real.find((r: Row) => r.name === 'browser-replay-check.mjs')!.timing, 'virtual');
  assert.equal(real.find((r: Row) => r.name === 'account-database-check.mjs')!.timing, 'none');
});

test('the table: same, differs on result, differs on pin, missing, and the webkit flag; the CLI exits 3 on a difference', () => {
  const mac = macRows(macLog);
  const vpsRows = [
    { index: 1, name: 'finisher-preview.mjs', command: mac.rows[0].command, timing: 'virtual', status: 'pass', seconds: 39, attempts: 1, pins: ['aa11bb22'] },
    { index: 7, name: 'counter-browser-check.mjs', command: 'node scripts/counter-browser-check.mjs', timing: 'wall', status: 'fail', seconds: 61, attempts: 2, pins: [], note: TIMING_NOTE },
    { index: 48, name: 'browser-replay-check.mjs', command: 'node scripts/browser-replay-check.mjs', timing: 'virtual', status: 'pass', seconds: 70, attempts: 1, pins: [] },
    { index: 49, name: 'browser-replay-check.mjs', command: 'node scripts/browser-replay-check.mjs --engine webkit', timing: 'virtual', status: 'pass', seconds: 80, attempts: 1, pins: [], note: WEBKIT_NOTE },
  ];
  const pins = { mac: new Map([[1, ['aa11bb22']]]), vps: new Map(vpsRows.map(r => [r.index, r.pins])) };
  const { lines, tally } = diffTable(mac, { total: 49, rows: vpsRows }, pins);
  const row = (i: number) => lines.find(l => l.startsWith(`| ${i} |`))!;
  assert.match(row(1), /\| virtual \| pass 41s \| pass 39s \| aa11bb22 \| aa11bb22 \| same \|/);
  assert.match(row(7), /\| wall \| pass 55s \(retry\) \| fail 61s \(retry\) \| {2}\| {2}\| differs \(result\) — timing-sensitive \(wall clock\) \|/, 'a wall-clock row that differs is listed, not counted as a mismatch');
  assert.match(row(48), /\| virtual \| ceiling 600s \| pass 70s \|.*DIFFERS \(result\)/);
  assert.match(row(49), new RegExp(`same · ${WEBKIT_NOTE}`));
  assert.match(row(13), /missing \| trusted on one side|trusted \| missing/);
  assert.deepEqual(tally, { same: 2, differs: 1, timingDiffers: 1, missing: 1, flagged: 1 });
  // a pin difference alone is a difference
  const { tally: pinTally } = diffTable(mac, { total: 49, rows: vpsRows.slice(0, 1) }, { mac: new Map([[1, ['aa11bb22']]]), vps: new Map([[1, ['ffffffff']]]) });
  assert.equal(pinTally.differs, 1);

  const dir = mkdtempSync(join(tmpdir(), 'shadow-'));
  mkdirSync(join(dir, 'mac-logs'));
  writeFileSync(join(dir, 'deploy.log'), macLog);
  writeFileSync(join(dir, 'mac-logs', '01-finisher-preview.mjs.log'), 'state hash aa11bb22\n');
  writeFileSync(join(dir, 'rows.json'), JSON.stringify({ sha: '0123456789abcdef0123456789abcdef01234567', node: 'v22.23.2', playwright: '1.62.1', rowsWallSeconds: 500, load: '0.1 0.1 0.1', total: 49, rows: vpsRows }));
  const cli = spawnSync(process.execPath, [join(process.cwd(), 'scripts', 'vps-shadow-diff.mjs'), '--mac', join(dir, 'deploy.log'), '--vps', join(dir, 'rows.json'), '--mac-logs', join(dir, 'mac-logs')], { encoding: 'utf8' });
  assert.equal(cli.status, 3, cli.stdout + cli.stderr);
  assert.match(cli.stdout, /^Shadow rows: Mac 01234567 vs VPS 01234567/);
  assert.match(cli.stdout, /\| 1 \| finisher-preview.mjs \| virtual \| pass 41s \| pass 39s \| aa11bb22 \| aa11bb22 \| same \|/);
  assert.match(cli.stdout, /2 same, 1 differ, 1 differ but timing-sensitive \(wall clock\), 1 not comparable, 1 flagged \(Linux WebKit ≠ Mac Safari\)/);
});
