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

test('the header line is not read as a percentage', () => {
  assert.equal(vpsDiskVerdict('Use% header only\n').level, 'warn');
});
