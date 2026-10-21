// PROJECT_STATE.md is generated from docs/state/ (scripts/state-index.mjs, Dom's repo audit 2026-10-21): a file added or renamed there
// without regenerating the index is red here, so the index can never fall behind the folder again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render, readState, titleOf } from '../scripts/state-index.mjs';

test('PROJECT_STATE.md matches docs/state/ (run `node scripts/state-index.mjs` after adding or renaming a state file)', () => {
  assert.equal(readFileSync('PROJECT_STATE.md', 'utf8'), render(readState()));
});

test('a state file is listed by its own title; a dated file is a report, not a lane', () => {
  assert.equal(titleOf('# Weapons — project state\n\nbody', 'weapons.md'), 'Weapons');
  assert.equal(titleOf('## 2026-10-15 — an entry with no title line', 'combat.md'), 'combat');
  const out = render({ 'weapons.md': '# Weapons — project state', 'audit-2026-10-17.md': '# An audit, 2026-10-17' });
  assert.match(out, /## Lanes\n\n\| Lane \| File \|\n\|---\|---\|\n\| Weapons \| \[docs\/state\/weapons\.md\]/);
  assert.match(out, /## Dated reports and handovers\n\n\| Report \| File \|\n\|---\|---\|\n\| An audit, 2026-10-17 \|/);
});
