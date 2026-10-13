import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPELL_SCHOOL, SPELL_BRICKS } from '../../src/fight/server.ts';
import { ACCOUNT, CHAR, fakeDb } from './encounter-fixtures.ts';
import { checkSpell, expectedSpell } from './spell-check.ts';

const id = Object.keys(SPELL_BRICKS).find((k) => SPELL_SCHOOL[k] === 'fire')!, school = 'fire';
const own = { [id]: SPELL_BRICKS[id] };

test('every spell the catalogue keys has a school the sheet knows', () => {
  for (const k of Object.keys(SPELL_BRICKS)) assert.ok(SPELL_SCHOOL[k], k);
});

test('owned and honest verifies; inflated or unowned is refused', () => {
  const held = { grimoire: own, xp: { [school]: 500 }, placed: { [school]: 10 } };   // 5 points banked of 10 placed
  assert.deepEqual(checkSpell({ id, skill: 5 }, held), { ok: true });
  assert.equal(checkSpell({ id, skill: 6 }, held).ok, false);
  assert.equal(checkSpell({ id, skill: 5 }, { ...held, grimoire: {} }).ok, false);
  assert.equal(checkSpell({ id: 'nope', skill: 0 }, held).ok, false);
  assert.equal(checkSpell({ id, skill: 101 }, held).ok, false);
  assert.equal(checkSpell({ id, skill: 1.5 }, held).ok, false);
});

test('banked xp past the placed points does not lift the stored skill', () => {
  assert.equal(checkSpell({ id, skill: 4 }, { grimoire: own, xp: { [school]: 9999 }, placed: { [school]: 3 } }).ok, false);
});

test('expectedSpell reads the ledger and the pool; a retry reads the same', async () => {
  const f = fakeDb({ t: 0 });
  f.world.build = { level: 10, placed: { [school]: 10 }, version: 1 };
  f.grimoire.set(`${ACCOUNT}:${id}`, SPELL_BRICKS[id]); f.xp.set(school, 300);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(await expectedSpell(f.db, ACCOUNT, CHAR, { id, skill: 3 }), { ok: true });
    assert.equal((await expectedSpell(f.db, ACCOUNT, CHAR, { id, skill: 4 })).ok, false);
  }
  f.grimoire.delete(`${ACCOUNT}:${id}`);
  assert.equal((await expectedSpell(f.db, ACCOUNT, CHAR, { id, skill: 0 })).ok, false);
});
