import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudProfile, fighterDetails } from '../src/cloud-profile.ts';

test('cloud saves carry the editable practice details and the client-reported mark count, never device identity', () => {
  assert.deepEqual(fighterDetails({ version: 1, id: 'forged-owner', name: ' Aldren\n', encounter: 'goblin', career: { victoryMarks: 12 } }), { display_name: 'Aldren', encounter: 'goblin', victory_marks: 12 });
  assert.deepEqual(fighterDetails({ version: 1, id: 'guest-123', name: '' }), { display_name: 'Wanderer', encounter: null, victory_marks: 0 });
});
test('a malformed remote fighter cannot corrupt a local save', () => {
  const row = { display_name: 'Aldren', encounter: 'goblin', revision: 1, victory_marks: 4 };
  assert.deepEqual(cloudProfile(row), row);
  for (const value of [null, {}, { ...row, display_name: '\n' }, { ...row, encounter: 'admin' }, { ...row, revision: 0 }, { ...row, revision: 1.5 }, { ...row, revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...row, victory_marks: -1 }, { ...row, victory_marks: 1.5 }, { ...row, victory_marks: undefined }, { ...row, victory_marks: '4' }]) {
    assert.throws(() => cloudProfile(value), /Invalid saved fighter/);
  }
});
