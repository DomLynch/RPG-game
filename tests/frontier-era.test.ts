// Drift guard (Lead, 2026-10-17): Backend's Frontier-wield era row (origins/region1/frontier-wield.json, fromRecordVersion; #3051) must equal the RECORD_VERSION the sim batch introduces, so it cannot silently drift if
// someone else bumps first. A claim at or above the row's number wears Frontier pieces; the sim batch (the specials, the audit rows, the world creature movement) is what opens version 75. If this fails, a later bump or a
// renumber moved one of them: change BOTH deliberately (the row follows the number the batch ends up with).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_FRONTIER_WIELD_VERSION } from '../origins/region1/frontier-wield.ts';
import { FIRST_SKILL2_VERSION, READABLE_VERSIONS, RECORD_VERSION } from '../src/fight/record.ts';

test('the Frontier-wield era opens at the version the sim batch introduced (75)', () => {
  assert.equal(FIRST_FRONTIER_WIELD_VERSION, FIRST_SKILL2_VERSION, 'the era row and the SPECIAL 2 record era open at the same bump');
  assert.equal(FIRST_FRONTIER_WIELD_VERSION, 75, 'the number the sim batch introduced (RV 74 -> 75, WSV 51 -> 52)');
  assert.ok(RECORD_VERSION >= FIRST_FRONTIER_WIELD_VERSION, 'the build is at or past the era: a claim it stamps wears Frontier pieces');
  assert.ok((READABLE_VERSIONS as readonly number[]).includes(FIRST_FRONTIER_WIELD_VERSION), 'the era\'s version is one the decoder reads');
});
