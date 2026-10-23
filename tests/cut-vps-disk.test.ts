// scripts/cut-release.mjs, the VPS root-disk pre-check (Strategy 2026-10-21): WARN at 80%, refuse at 90%, a dead ssh is a WARN. Thresholds come from scripts/cut-gates.json.
import './lib/era-off.ts';
import assert from 'node:assert/strict';
import test from 'node:test';

import { loadGates, vpsDiskVerdict } from '../scripts/cut-release.mjs';

const df = (pct: number) => `Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/sda1 100000000 ${pct * 1000000} ${(100 - pct) * 1000000} ${pct}% /\n`;

test('thresholds are data: 80 warn, 90 refuse', () => {
  const g = loadGates().vpsDisk;
  assert.equal(g.warnPct, 80);
  assert.equal(g.refusePct, 90);
});

test('79 ok, 80 warn, 89 warn, 90 refuse, 95 refuse', () => {
  assert.equal(vpsDiskVerdict(df(79)).level, 'ok');
  assert.equal(vpsDiskVerdict(df(80)).level, 'warn');
  assert.equal(vpsDiskVerdict(df(89)).level, 'warn');
  assert.equal(vpsDiskVerdict(df(90)).level, 'refuse');
  assert.equal(vpsDiskVerdict(df(95)).level, 'refuse');
  assert.equal(vpsDiskVerdict(df(72)).pct, 72);
});

test('a dead ssh or unreadable output is a WARN, never a block', () => {
  assert.equal(vpsDiskVerdict(null).level, 'warn');
  assert.equal(vpsDiskVerdict('').level, 'warn');
  assert.equal(vpsDiskVerdict('garbage').level, 'warn');
});

test('two mounts: the fullest decides and the reason names it', () => {
  const two = (a: number, b: number) => `Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/sda1 1 1 1 ${a}% /\n/dev/sdb 1 1 1 ${b}% /mnt/HC_Volume_107195252\n`;
  assert.equal(vpsDiskVerdict(two(72, 40)).level, 'ok');
  const w = vpsDiskVerdict(two(72, 85));
  assert.equal(w.level, 'warn'); assert.equal(w.mount, '/mnt/HC_Volume_107195252');
  const r = vpsDiskVerdict(two(91, 40));
  assert.equal(r.level, 'refuse'); assert.match(r.reason, /\/ at 91%/);
  assert.deepEqual(loadGates().vpsDisk.paths, ['/', '/mnt/HC_Volume_107195252']);
});

test('the header line is not read as a percentage', () => {
  assert.equal(vpsDiskVerdict('Use% header only\n').level, 'warn');
});
