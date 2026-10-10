import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MAC_ENFORCE, MAC_MAX, MAC_ONLY, ON_T4, placementLine } from '../scripts/lib/row-placement.mjs';
import { coverageGaps, SLOW_ROWS } from '../scripts/lib/vps-receipts.mjs';

const commands: string[][] = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
const source = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : null);

test('the Mac-only list is the rows no Hugging Face job may vouch for, minus the VPS rows, and fits MAC_MAX (it cannot drift from the code)', () => {
  const computed = coverageGaps([], commands, source).macOnly.filter((row: number) => !ON_T4.some(entry => entry.row === row));
  assert.deepEqual(MAC_ONLY.map(entry => entry.row), computed);
  assert.ok(MAC_ONLY.length <= MAC_MAX, 'the Mac runs the Mac-only rows and nothing else');
  for (const entry of MAC_ONLY) assert.ok(entry.why, `row ${entry.row} needs a reason`);
});

test('every slow row runs on the T4 with its measurement, and the T4 beat every box that ran it (Lead 2026-10-09: the fastest box wins)', () => {
  assert.deepEqual(SLOW_ROWS.filter((row: number) => !MAC_ONLY.some(entry => entry.row === row)), ON_T4.map(entry => entry.row).filter((row: number) => SLOW_ROWS.includes(row)));
  for (const entry of ON_T4) {
    assert.ok((entry.t4_s ?? 0) > 0, `row ${entry.row} needs its T4 time`);
    for (const other of [entry.cpu_s, entry.vps_s, entry.mac_s]) if (other) assert.ok(entry.t4_s! < other, `row ${entry.row}: the T4 (${entry.t4_s} s) is not the fastest (${other} s)`);
  }
  for (const entry of MAC_ONLY.filter(e => /^(roster|sparring)/.test(e.why))) assert.ok((entry.mac_s ?? 0) > 0, `row ${entry.row} needs mac_s`);
});

test('the first line counts trusted / HF / VPS / Mac, and an over-limit Mac list names the rows off the list (not enforced while MAC_ENFORCE is false)', () => {
  const ok = placementLine({ total: 52, ci: [1], hf: [3, 6], mac: [2, 4] });
  assert.match(ok.text, /^Release rows: 52 total: 3 trusted \/ 2 HF \(3,6\) \/ 0 VPS \/ 2 Mac \(2,4\)/);
  assert.equal(ok.refuse, false);
  const many = placementLine({ total: 52, ci: [], hf: [], mac: Array.from({ length: 20 }, (_, i) => i + 1) });
  assert.equal(many.refuse, true);
  assert.equal(many.enforce, MAC_ENFORCE);
  assert.match(many.warning, /Mac rows 20 > MAC_MAX 8: rows not on the Mac-only list: 1,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20/);
});
