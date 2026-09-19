import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudProfile, fighterDetails } from '../src/cloud-profile.ts';

test('cloud saves contain editable practice details only, never device identity or career authority', () => {
  assert.deepEqual(fighterDetails({ version: 1, id: 'forged-owner', name: ' Aldren\n', encounter: 'goblin', career: { victoryMarks: 999999 } }), { display_name: 'Aldren', encounter: 'goblin' });
  assert.deepEqual(fighterDetails({ version: 1, id: 'guest-123', name: '' }), { display_name: 'Wanderer', encounter: null });
});
test('a malformed remote fighter cannot corrupt a local save', () => {
  const row = { display_name: 'Aldren', encounter: 'goblin', revision: 1 };
  assert.deepEqual(cloudProfile(row), row);
  for (const value of [null, {}, { ...row, display_name: '\n' }, { ...row, encounter: 'admin' }, { ...row, revision: 0 }, { ...row, revision: 1.5 }, { ...row, revision: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.throws(() => cloudProfile(value), /Invalid saved fighter/);
  }
});
