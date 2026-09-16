import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, loadProfile, saveProfile, type StoragePort } from '../src/profile.ts';

test('guest identity and name survive loading a new session', () => {
  let stored: string | null = null;
  const storage: StoragePort = { getItem: () => stored, setItem: (_, value) => { stored = value; } };
  const first = loadProfile(storage, () => 'guest-12345678');
  assert.equal(first.returning, false);
  first.profile.name = 'Aldren';
  assert.equal(saveProfile(storage, first.profile), true);
  const second = loadProfile(storage, () => { throw new Error('must keep existing guest ID'); });
  assert.equal(second.returning, true);
  assert.deepEqual(second.profile, first.profile);
});
test('broken, wrong-version, mistyped or blocked storage cannot break entry', () => {
  for (const value of ['{broken', 'null', '42', '{"version":2}', '{"version":1,"id":42,"name":"x"}', '{"version":1,"id":"guest-12345678","name":null}']) {
    assert.equal(loadProfile({ getItem: () => value, setItem: () => {} }, () => 'fresh-12345678').returning, false);
  }
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
  const result = loadProfile(blocked, () => 'fresh-12345678');
  assert.equal(result.returning, false);
  assert.equal(saveProfile(blocked, result.profile), false);
});
test('names remove controls, trim and enforce a short visible identity', () => {
  assert.equal(cleanName(' \n Aldren\u0000 \t'), 'Aldren');
  assert.equal(cleanName('  '), 'Wanderer');
  assert.equal(cleanName('x'.repeat(100)).length, 24);
});

test('the ladder rung reached on this device survives reload, and a bad rung is dropped rather than trusted', () => {
  const store = new Map<string, string>(), storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  const first = loadProfile(storage, () => 'abcdefgh').profile;
  first.ladder = 'pitborn'; assert.equal(saveProfile(storage, first), true);
  assert.equal(loadProfile(storage, () => 'x').profile.ladder, 'pitborn');
  store.set('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'abcdefgh', name: 'A', ladder: 'Not a rung!' }));
  assert.equal(loadProfile(storage, () => 'x').profile.ladder, undefined);
  store.set('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'abcdefgh', name: 'A' }));
  assert.equal(loadProfile(storage, () => 'x').profile.ladder, undefined, 'older profiles without a rung still load');
});
