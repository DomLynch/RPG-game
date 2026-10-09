import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MAC_ENFORCE, MAC_MAX, MAC_ONLY, SLOW_ON_HF, VPS_ROWS, placementLine } from '../scripts/lib/row-placement.mjs';
import { coverageGaps, SLOW_ROWS } from '../scripts/lib/vps-receipts.mjs';

const commands: string[][] = JSON.parse(readFileSync('.quality-gate.json', 'utf8')).release_commands;
const source = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : null);

test('the Mac-only list is the rows no Hugging Face job may vouch for, minus the VPS rows, and fits MAC_MAX (it cannot drift from the code)', () => {
  const computed = coverageGaps([], commands, source).macOnly.filter((row: number) => !VPS_ROWS.includes(row));
  assert.deepEqual(MAC_ONLY.map(entry => entry.row), computed);
  assert.ok(MAC_ONLY.length + SLOW_ON_HF.length <= MAC_MAX);
  for (const entry of MAC_ONLY) assert.ok(entry.why, `row ${entry.row} needs a reason`);
});

test('a "slower on HF" entry carries its measurement, and every slow row has one', () => {
  assert.deepEqual(SLOW_ON_HF.map(entry => entry.row), SLOW_ROWS.filter((row: number) => !VPS_ROWS.includes(row)));
  for (const entry of SLOW_ON_HF) assert.ok(entry.hf_s > 0, `row ${entry.row} needs hf_s`);
  for (const entry of MAC_ONLY.filter(e => /^(roster|sparring)/.test(e.why))) assert.ok((entry.mac_s ?? 0) > 0, `row ${entry.row} needs mac_s`);
});

test('the first line counts trusted / HF / VPS / Mac, and an over-limit Mac list names the rows off the list (not enforced while MAC_ENFORCE is false)', () => {
  const ok = placementLine({ total: 52, ci: [1], hf: [3, 6], mac: [2, 4] });
  assert.match(ok.text, /^Release rows: 52 total: 3 trusted \/ 2 HF \(3,6\) \/ 0 VPS \/ 2 Mac \(2,4\)/);
  assert.equal(ok.refuse, false);
  const many = placementLine({ total: 52, ci: [], hf: [], mac: Array.from({ length: 20 }, (_, i) => i + 1) });
  assert.equal(many.refuse, true);
  assert.equal(many.enforce, MAC_ENFORCE);
  assert.match(many.warning, /Mac rows 20 > MAC_MAX 16: rows not on the Mac-only list: 1,3,6,8,10,11,12,13,14,15,17,18,19,20/);
});
